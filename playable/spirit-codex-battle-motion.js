/* Real battle presentation. Resolution remains authoritative; this module owns no game values. */
(function () {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => 1 - (1 - clamp(value)) ** 3;
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const clock = () => window.BattleClock?.now()??(typeof performance !== 'undefined' ? performance.now() : 0);
  const uid = unit => String(unit?.uid ?? '');
  const COLORS = Object.freeze({ fire:'#f69b52', water:'#72d2ef', wind:'#93dab3', thunder:'#c2afff', light:'#f9e3a2', dark:'#ad9de6' });
  const MELEE = new Set(['H2','W2','T1','D1','L2']);
  const ARCHERS = new Set(['H1','A1']);
  let active = null, token = 0, matteRoot = null;
  const painted = new Map(), cells = new Map(), filters = new Map();

  function serial(value) {
    if (!value) return '';
    if (Array.isArray(value)) return JSON.stringify(value.map(item => ({ ...item })).sort((a,b) => String(a.type).localeCompare(String(b.type))));
    return JSON.stringify(value);
  }
  function capture(unit, exists = true) {
    return Object.freeze({ uid:uid(unit), characterId:unit?.characterId || null, hp:Math.max(0,finite(unit?.curHp)),
      maxHp:Math.max(1,finite(unit?.maxHp,1)), shield:Math.max(0,finite(unit?.shield)), alive:unit?.alive !== false,
      isEnemy:!!unit?.isEnemy, isSummon:!!unit?.isSummon, element:unit?.element || '', art:unit?.art || '',
      buffs:serial(unit?.buffs), debuffs:serial(unit?.debuffs), guard:serial(unit?.guardState), exists });
  }
  function snapshot(units = []) { return Object.freeze(Array.from(units || [], unit => capture(unit))); }

  function kindFor(before, after, actor) {
    if (!before.exists && after.isSummon) return 'summon';
    if (after.hp < before.hp || after.shield < before.shield || before.alive && !after.alive) return 'damage';
    if (!before.alive && after.alive || after.hp > before.hp) return 'heal';
    if (after.shield > before.shield) return 'shield';
    return after.isEnemy !== !!actor?.isEnemy ? 'status' : 'blessing';
  }
  function styleFor(actor, skill) {
    if (['heal','shield','buff','cleanse','summon'].includes(skill?.type)) return 'cast';
    if (ARCHERS.has(actor?.characterId)) return 'arrow';
    if (MELEE.has(actor?.characterId) || /斩|爪|咬|锤|冲锋/.test(skill?.name || '')) return 'slash';
    return 'spell';
  }
  function begin(actor, skill = {}, before = [], units = [], options = {}) {
    const now = finite(options.now, clock()), reduced = !!options.reduced;
    const basic = actor?.skills?.[0] === skill || skill.basic === true
      || !!actor?.skills?.[0] && actor.skills[0].name === skill.name && !skill.ult;
    const profile=window.SkillPerformance?.profileFor(actor,skill)||null;
    const duration = reduced ? 180 : profile?.duration || (skill.ult ? 1300 : basic ? 900 : 1100);
    const old = new Map(Array.from(before || [], record => [String(record.uid), record]));
    const refs = new Map(Array.from(units || [], unit => [uid(unit), unit]));
    if (actor) refs.set(uid(actor), actor);
    const changed = [];
    for (const [key, unit] of refs) {
      const after = capture(unit), prior = old.get(key) || Object.freeze({ ...after, hp:0, shield:0, alive:false, buffs:'', debuffs:'', guard:'', exists:false });
      if (prior.hp === after.hp && prior.maxHp === after.maxHp && prior.shield === after.shield && prior.alive === after.alive
        && prior.buffs === after.buffs && prior.debuffs === after.debuffs && prior.guard === after.guard && prior.exists !== false
        && !(profile&&(options.expectedTargetUids||[]).some(id=>String(id)===key))) continue;
      changed.push({ uid:key, unit, before:prior, after, kind:kindFor(prior,after,actor) });
    }
    // Actor-side counter damage follows the actual opponent's contact, never a self-fired projectile.
    const selectedTargetUid=String(options.selectedTargetUid??'');
    const order=[...new Set((options.hitEvents||[]).filter(event=>String(event.sourceUid)===uid(actor)).map(event=>String(event.uid)))];
    changed.sort((a,b) => (a.uid===selectedTargetUid?-100:a.uid===uid(actor)?100:order.indexOf(a.uid)<0?50:order.indexOf(a.uid))-(b.uid===selectedTargetUid?-100:b.uid===uid(actor)?100:order.indexOf(b.uid)<0?50:order.indexOf(b.uid)));
    const impactAt = now + (reduced ? 60 : duration * (profile?.impact??.60)), launchAt = now + (reduced ? 30 : duration * (profile?.launch??.34));
    const targets = changed.map((entry,index) => ({ ...entry, impactAt:impactAt + (reduced ? Math.min(index * 6,30) : Math.min(index * 35,120)) }));
    active = { token:++token, actor, actorUid:uid(actor), skill:{ name:skill.name || '',type:skill.type || 'attack',ult:!!skill.ult },
      style:styleFor(actor,skill), profile,selectedTargetUid,hitEvents:options.hitEvents||[],before:old, refs, targets, start:now, launchAt, impactAt, endAt:now+duration, duration, reduced };
    const action=active;
    action.routes=(target,time)=>flight(action,target,time);
    if(profile&&!reduced)for(const target of targets){target.contacts=window.SkillPerformance.beats(action,target);target.impactAt=target.contacts[0].at;}
    return duration;
  }

  function current(now) { return active && now >= active.start && now < active.endAt ? active : null; }
  function unitPoint(unit, ground = false) {
    const hit = unit?._hit;
    if (hit && [hit.left,hit.top,hit.right,hit.bottom].every(Number.isFinite)) return { x:(hit.left+hit.right)/2, y:ground?hit.bottom:(hit.top+hit.bottom)/2 };
    return { x:finite(unit?._x), y:finite(unit?._y) + (ground ? finite(unit?._r,26) * .72 : -finite(unit?._r,26) * .35) };
  }
  function primary(action) {
    return action.targets.find(target => target.unit.isEnemy !== action.actor?.isEnemy && ['damage','status'].includes(target.kind))
      || action.targets.find(target => target.uid !== action.actorUid) || action.targets[0];
  }
  function direction(action) {
    const target = primary(action), from = unitPoint(action.actor), to = target ? unitPoint(target.unit) : { x:from.x + (action.actor?.isEnemy?-1:1), y:from.y };
    const length = Math.max(1,Math.hypot(to.x-from.x,to.y-from.y));
    return { x:(to.x-from.x)/length, y:(to.y-from.y)/length, length, facingX:to.x < from.x ? -1 : 1 };
  }
  function actionFrame(progress) { return progress < .16 ? 0 : progress < .34 ? 1 : progress < .74 ? 2 : 3; }
  function pose(unit, now = clock()) {
    now = finite(now,clock());
    const result = { uid:uid(unit), time:now, dx:0, dy:0, rotation:0, scaleX:1, scaleY:1, flash:0,
      hp:Math.max(0,finite(unit?.curHp)), maxHp:Math.max(1,finite(unit?.maxHp,1)), shield:Math.max(0,finite(unit?.shield)),
      alive:unit?.alive !== false, opacity:1, actionFrame:null, casting:null };
    const action = current(now); if (!action) return result;
    const target = action.targets.find(target => target.uid === result.uid), progress = clamp((now-action.start)/action.duration);
    if (target) {
      const contacted = now >= target.impactAt, settle = action.reduced ? 0 : Math.min(180,action.duration*.2);
      const p = contacted ? settle ? ease((now-target.impactAt)/settle) : 1 : 0;
      result.hp = target.before.hp + (target.after.hp-target.before.hp)*p;
      result.maxHp = contacted ? target.after.maxHp : target.before.maxHp;
      result.shield = target.before.shield + (target.after.shield-target.before.shield)*p;
      result.alive = contacted ? target.after.alive : target.before.alive;
      result.opacity = !target.before.exists && !contacted ? 0 : 1;
      if(target.contacts?.length){
        const passed=target.contacts.filter(beat=>now>=beat.at),index=passed.length-1,beat=passed[index];
        if(beat){
          const previous=index?target.contacts[index-1].event:null,fromHp=previous?.hpAfter??target.before.hp,fromShield=previous?.shieldAfter??target.before.shield;
          const final=index===target.contacts.length-1,toHp=final?target.after.hp:beat.event?.hpAfter??target.after.hp,toShield=final?target.after.shield:beat.event?.shieldAfter??target.after.shield;
          const progress=ease((now-beat.at)/Math.min(180,action.duration*.2));result.hp=fromHp+(toHp-fromHp)*progress;result.shield=fromShield+(toShield-fromShield)*progress;
          result.alive=final&&progress>=1?target.after.alive:target.before.alive;
          const age=now-beat.at;result.flash=(target.kind==='damage'?.88:.45)*(1-clamp(age/230));
          if(target.kind==='damage'&&age<320){result.dx=Math.sin(age/30)*(1-age/320)*8;result.dy=-Math.sin(clamp(age/280)*Math.PI)*4;}
        }
      }
      if (!action.reduced && contacted) {
        const age = now-target.impactAt, fade = 1-clamp(age/310);
        if(!target.contacts?.length)result.flash = (target.kind === 'damage' ? .88 : .45) * (1-clamp(age/210));
        if (target.kind === 'damage') {
          const away = unitPoint(unit).x < unitPoint(action.actor).x ? -1 : 1;
          result.dx += Math.sin(age/34)*fade*7*away; result.dy -= Math.sin(clamp(age/260)*Math.PI)*3;
          result.rotation += Math.sin(age/46)*fade*.045*away;
          result.scaleX *= 1-fade*.022; result.scaleY *= 1+fade*.017;
        }
        if(target.kind==='summon'&&action.profile){const arrive=ease(age/650),height=unit._artHeight||70;
          result.opacity=arrive;
          if(action.profile.effect==='eagle-arrival'){result.dx=-height*.7*(1-arrive);result.dy=-height*1.4*(1-arrive);result.rotation=(1-arrive)*.25;}
          else{result.dy=height*.55*(1-arrive);result.scaleY=.48+.52*arrive;}
        }
      }
    }
    if (result.uid === action.actorUid && !action.reduced && action.profile) {
      Object.assign(result,window.SkillPerformance.actorPose(action,now));result.casting=castingFor(unit);
    } else if (result.uid === action.actorUid && !action.reduced) {
      const aim = direction(action), load = ease(progress/.31), strike = ease((progress-.30)/.18), recover = 1-ease((progress-.72)/.28);
      const thrust = strike * recover, range = action.style === 'slash' ? Math.min(42,aim.length*.17) : 8;
      result.dx += aim.x*(range*thrust-3*load*(1-strike)); result.dy += aim.y*range*thrust-Math.sin(progress*Math.PI)*3;
      result.rotation += aim.facingX*(-.028*load+.065*thrust)*recover;
      result.scaleX *= 1-.022*load+.028*thrust; result.scaleY *= 1+.018*load-.020*thrust;
      result.actionFrame = actionFrame(progress); result.casting = castingFor(unit); result.facingX = aim.facingX;
    }
    return result;
  }

  function castingFor(unit, override) {
    const recipes = override ? [{ casting:override }] : window.SC?.COMBO_RECIPES || [];
    for (const recipe of recipes) {
      const casting = recipe.casting; if (!casting?.src) continue;
      const row = casting.members?.findIndex(member => member.id === unit?.characterId) ?? -1;
      const member = row >= 0 ? casting.members[row] : casting.member?.id === unit?.characterId ? casting.member : null;
      if (member) return { src:casting.src, row:row >= 0 ? row : finite(casting.row), columns:casting.columns || 4, rows:casting.rows || 2,
        background:casting.background || '#050f1a', anchors:member.anchors, characterId:member.id };
    }
    return null;
  }
  function matteFilter(background) {
    if (typeof document === 'undefined' || !document.body) return null;
    if (filters.has(background)) return filters.get(background);
    const ns = 'http://www.w3.org/2000/svg', create = (tag, attrs = {}) => {
      const node = document.createElementNS(ns,tag); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value)); return node;
    };
    if (!matteRoot) { matteRoot=create('svg',{width:0,height:0,'aria-hidden':'true',focusable:'false'});matteRoot.style.cssText='position:absolute;pointer-events:none;overflow:hidden';document.body.append(matteRoot); }
    const rgb = /^#[\da-f]{6}$/i.test(background) ? [1,3,5].map(offset => parseInt(background.slice(offset,offset+2),16)) : [5,15,26];
    const id = `battle-casting-matte-${rgb.join('-')}`, defs=create('defs'), filter=create('filter',{id,'color-interpolation-filters':'sRGB',x:'0%',y:'0%',width:'100%',height:'100%'});
    const transfer = create('feComponentTransfer',{in:'SourceGraphic',result:'keyDistance'});
    ['R','G','B'].forEach((channel,index) => transfer.append(create('feFunc'+channel,{type:'discrete',tableValues:Array.from({length:256},(_,value) => clamp((Math.abs(value-rgb[index])-5)/7).toFixed(3)).join(' ')})));
    transfer.append(create('feFuncA',{type:'identity'})); filter.append(transfer);
    filter.append(create('feColorMatrix',{in:'keyDistance',type:'matrix',values:'0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 0',result:'keyAlpha'}));
    filter.append(create('feComposite',{in:'SourceGraphic',in2:'keyAlpha',operator:'in'}));defs.append(filter);matteRoot.append(defs);filters.set(background,id);return id;
  }
  function castingCell(casting, frame, loadedArt) {
    if (!casting || typeof loadedArt !== 'function') return null;
    const image = loadedArt(casting.src), width=image?.naturalWidth || image?.width, height=image?.naturalHeight || image?.height;
    if (!width || !height || typeof document === 'undefined') return null;
    const key = `${casting.src}:${casting.row}:${frame}`, cached=cells.get(key);
    if (cached?.source === image) return cached.canvas;
    const filter=matteFilter(casting.background); if (!filter) return null;
    const sw=width/casting.columns,sh=height/casting.rows,canvas=document.createElement('canvas');
    canvas.width=Math.ceil(sw);canvas.height=Math.ceil(sh);canvas.dataset.battleCastingSource=casting.src;
    canvas.dataset.battleCastingCharacter=casting.characterId;canvas.dataset.battleCastingRow=String(casting.row);canvas.dataset.battleCastingFrame=String(frame);
    const ctx=canvas.getContext('2d');ctx.filter=`url(#${filter})`;
    ctx.drawImage(image,frame*sw,casting.row*sh,sw,sh,0,0,canvas.width,canvas.height);ctx.filter='none';
    cells.set(key,{canvas,source:image});return canvas;
  }
  function fit(rect, unit, ratio = 1) {
    const width=Math.max(0,finite(rect?.width)),height=Math.max(0,finite(rect?.height));
    // Four-pose cells are square but their people occupy roughly 5–95% vertically.
    // Match that painted body height, not the narrow idle portrait's outer width.
    const laneWidth=finite(unit?._artWidth)>0?unit._artWidth*1.12:Math.max(width,height*1.10);
    const w=Math.min(height/.90*ratio,laneWidth),h=w/ratio;
    return { x:finite(rect?.x)+(width-w)/2,y:finite(rect?.y)+height-h*.95,width:w,height:h };
  }
  function applyPoint(point, pivot, visual) {
    const dx=(point.x-pivot.x)*visual.scaleX,dy=(point.y-pivot.y)*visual.scaleY,c=Math.cos(visual.rotation),s=Math.sin(visual.rotation);
    return { x:pivot.x+visual.dx+dx*c-dy*s,y:pivot.y+visual.dy+dx*s+dy*c };
  }
  function sampleCast(unit, casting, progress, rect, options = {}) {
    const descriptor=castingFor(unit,casting),p=clamp(finite(progress)),frame=p<.17?0:p<.38?1:p<.60?2:3;
    const facingX=options.facingX===-1?-1:1,thrust=frame===2?ease((p-.38)/.08):frame===3?1-ease((p-.60)/.40):frame===1?.16:0;
    const destination=fit(rect,unit),pivot={x:finite(rect?.x)+finite(rect?.width)/2,y:finite(rect?.y)+finite(rect?.height)};
    const visual={uid:uid(unit),time:finite(options.now),actionFrame:frame,dx:facingX*thrust*Math.min(12,finite(rect?.width)*.075),dy:-thrust*3,
      rotation:facingX*thrust*.035,scaleX:facingX,scaleY:1,casting:descriptor,facingX,opacity:1};
    const uv=descriptor?.anchors?.[frame] || [.75,.4];
    const raw={x:destination.x+uv[0]*destination.width,y:destination.y+uv[1]*destination.height};
    return { ...visual,rect:destination,pivot,anchor:applyPoint(raw,pivot,visual) };
  }
  function transformActor(ctx, pivot, visual) {
    ctx.translate(pivot.x+visual.dx,pivot.y+visual.dy);ctx.rotate(visual.rotation);ctx.scale(visual.scaleX,visual.scaleY);ctx.translate(-pivot.x,-pivot.y);
  }
  function screenPoint(ctx, point) {
    const m=ctx.getTransform(),canvas=ctx.canvas;
    const cssWidth=canvas?.clientWidth || canvas?.getBoundingClientRect?.().width || 0;
    const ratio=cssWidth>0&&canvas.width>0?canvas.width/cssWidth:1;
    return {x:(m.a*point.x+m.c*point.y+m.e)/ratio,y:(m.b*point.x+m.d*point.y+m.f)/ratio};
  }
  function remember(ctx, unit, rect, now, weapon) {
    painted.set(uid(unit),{time:now,body:screenPoint(ctx,{x:rect.x+rect.width/2,y:rect.y+rect.height*.52}),
      ground:screenPoint(ctx,{x:rect.x+rect.width/2,y:rect.y+rect.height}),weapon:screenPoint(ctx,weapon),rect:{...rect}});
  }
  function drawCast(ctx, unit, rect, casting, progress, loadedArt, options = {}) {
    const visual=sampleCast(unit,casting,progress,rect,options),cell=castingCell(visual.casting,visual.actionFrame,loadedArt);
    if (!cell) return {...visual,drawn:false};
    ctx.save();try {
      transformActor(ctx,visual.pivot,visual);ctx.drawImage(cell,visual.rect.x,visual.rect.y,visual.rect.width,visual.rect.height);
      const uv=visual.casting.anchors?.[visual.actionFrame] || [.75,.4];
      remember(ctx,unit,visual.rect,visual.time,{x:visual.rect.x+uv[0]*visual.rect.width,y:visual.rect.y+uv[1]*visual.rect.height});
    } finally {ctx.restore();}
    return {...visual,drawn:true};
  }

  function fallbackVertex(unit, u, v, rect, now, acting) {
    const seed=Array.from(uid(unit)).reduce((sum,char) => sum+char.charCodeAt(0),0),time=now/1000;
    const edge=Math.sin(Math.PI*u)*Math.sin(Math.PI*v),upper=1-clamp((v-.62)/.3),alive=unit?.alive!==false;
    const phase=acting?clamp((now-acting.start)/acting.duration):0,pulse=acting?Math.sin(clamp((phase-.13)/.65)*Math.PI):0;
    // Deform in authored image space; drawActor mirrors this entire mesh later.
    const facing=window.BattleFacing?.art(unit).sourceFacing ?? (acting?direction(acting).facingX:unit?.isEnemy?-1:1);
    const wings=/eagle|bat/.test(unit?.art || ''),quadruped=/wolf/.test(unit?.art || '');
    let dx=alive?Math.sin(time*2+seed*.13+v*2.4)*.005*upper:0,dy=alive?Math.sin(time*2.2+seed*.11+u*2)*.005*upper:0;
    if (wings) dy+=Math.sin(time*5.1+Math.abs(u-.5)*3)*Math.abs(u-.5)*.06*upper;
    if (quadruped) {dx+=pulse*facing*.035*upper;dy+=Math.sin(time*3.2+u*5)*.012*(1-Math.abs(v-.5));}
    if (acting) { dx+=facing*pulse*.045*upper*(.35+Math.abs(u-.5));dy-=pulse*.026*upper*(1-Math.abs(u-.5)); }
    return {u,v,x:rect.x+(u+dx*edge)*rect.width,y:rect.y+(v+dy*edge)*rect.height};
  }
  function meshImage(ctx,image,unit,rect,now,acting) {
    const width=image.naturalWidth || image.width,height=image.naturalHeight || image.height;
    if (!width || !height || !rect.width || !rect.height) return false;
    const columns=acting?6:4,rows=acting?6:4,vertices=[];
    for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++)vertices.push(fallbackVertex(unit,col/columns,row/rows,rect,now,acting));
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;
      for(const indices of [[a,b,d],[a,d,c]]){
        const points=indices.map(index=>vertices[index]),[p,q,r]=points;
        const u0=p.u*width,v0=p.v*height,u1=q.u*width,v1=q.v*height,u2=r.u*width,v2=r.v*height;
        const den=u0*(v1-v2)+u1*(v2-v0)+u2*(v0-v1);if(Math.abs(den)<1e-8)continue;
        const axis=key=>[(p[key]*(v1-v2)+q[key]*(v2-v0)+r[key]*(v0-v1))/den,
          (p[key]*(u2-u1)+q[key]*(u0-u2)+r[key]*(u1-u0))/den,
          (p[key]*(u1*v2-u2*v1)+q[key]*(u2*v0-u0*v2)+r[key]*(u0*v1-u1*v0))/den];
        const x=axis('x'),y=axis('y'),cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3;
        ctx.save();try{
          ctx.beginPath();points.forEach((point,index)=>{const length=Math.max(.01,Math.hypot(point.x-cx,point.y-cy));const px=point.x+(point.x-cx)/length*.20,py=point.y+(point.y-cy)/length*.20;index?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.closePath();ctx.clip();
          ctx.transform(x[0],y[0],x[1],y[1],x[2],y[2]);ctx.drawImage(image,0,0,width,height,0,0,width,height);
        }finally{ctx.restore();}
      }
    }
    return true;
  }
  function fallbackAnchor(unit, u, v, rect, now, acting) {
    const count=acting?6:4,px=u*count,py=v*count,col=Math.min(count-1,Math.floor(px)),row=Math.min(count-1,Math.floor(py));
    const s=px-col,t=py-row,corners=s>=t?[[col,row],[col+1,row],[col+1,row+1]]:[[col,row],[col+1,row+1],[col,row+1]];
    const weights=s>=t?[1-s,s-t,t]:[1-t,s,t-s];
    const points=corners.map(([x,y])=>fallbackVertex(unit,x/count,y/count,rect,now,acting));
    return {x:points.reduce((sum,p,i)=>sum+p.x*weights[i],0),y:points.reduce((sum,p,i)=>sum+p.y*weights[i],0)};
  }
  function skillMesh(ctx,image,rect,action,now,anchor){
    const n=7,width=image.width,height=image.height,vertices=[],progress=clamp((now-action.start)/action.duration);
    for(let row=0;row<=n;row++)for(let col=0;col<=n;col++){
      const u=col/n,v=row/n,point=window.SkillPerformance.deform(action.profile,u,v,progress,anchor);
      vertices.push({u,v,x:rect.x+point.u*rect.width,y:rect.y+point.v*rect.height});
    }
    for(let row=0;row<n;row++)for(let col=0;col<n;col++){
      const a=row*(n+1)+col,b=a+1,c=a+n+1,d=c+1;
      for(const indices of [[a,b,d],[a,d,c]]){
        const pts=indices.map(i=>vertices[i]),[p,q,r]=pts,u0=p.u*width,v0=p.v*height,u1=q.u*width,v1=q.v*height,u2=r.u*width,v2=r.v*height,den=u0*(v1-v2)+u1*(v2-v0)+u2*(v0-v1);
        const axis=k=>[(p[k]*(v1-v2)+q[k]*(v2-v0)+r[k]*(v0-v1))/den,(p[k]*(u2-u1)+q[k]*(u0-u2)+r[k]*(u1-u0))/den,(p[k]*(u1*v2-u2*v1)+q[k]*(u2*v0-u0*v2)+r[k]*(u0*v1-u1*v0))/den];
        const x=axis('x'),y=axis('y'),cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3;
        ctx.save();ctx.shadowBlur=0;ctx.beginPath();pts.forEach((point,i)=>{const len=Math.max(.01,Math.hypot(point.x-cx,point.y-cy)),px=point.x+(point.x-cx)*.2/len,py=point.y+(point.y-cy)*.2/len;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.closePath();ctx.clip();ctx.transform(x[0],y[0],x[1],y[1],x[2],y[2]);ctx.drawImage(image,0,0,width,height,0,0,width,height);ctx.restore();
      }
    }
    const col=Math.min(n-1,Math.floor(anchor[0]*n)),row=Math.min(n-1,Math.floor(anchor[1]*n)),s=anchor[0]*n-col,t=anchor[1]*n-row;
    const ids=s>=t?[[col,row],[col+1,row],[col+1,row+1]]:[[col,row],[col+1,row+1],[col,row+1]],weights=s>=t?[1-s,s-t,t]:[1-t,s,t-s],pts=ids.map(([x,y])=>vertices[y*(n+1)+x]);
    return {x:pts.reduce((sum,p,i)=>sum+p.x*weights[i],0),y:pts.reduce((sum,p,i)=>sum+p.y*weights[i],0)};
  }
  function drawActor(ctx,unit,rect,now=clock(),loadedArt) {
    if(!ctx || typeof loadedArt!=='function')return false;
    const action=current(now),visual=pose(unit,now),acting=action?.actorUid===uid(unit)?action:null;
    const descriptor=acting&&!action.reduced?visual.casting:null,cell=descriptor?castingCell(descriptor,visual.actionFrame,loadedArt):null;
    if(cell){
      const destination=fit(rect,unit),facingX=visual.facingX || 1,uv=descriptor.anchors?.[visual.actionFrame] || [.75,.4];
      unit._facing={facing:facingX,sourceFacing:1,mirror:facingX,socket:uv};
      ctx.save();try{
        if(facingX<0){const pivot=rect.x+rect.width/2;ctx.translate(pivot,0);ctx.scale(-1,1);ctx.translate(-pivot,0);}
        const weapon=action.profile?skillMesh(ctx,cell,destination,action,now,uv):{x:destination.x+uv[0]*destination.width,y:destination.y+uv[1]*destination.height};
        if(!action.profile)ctx.drawImage(cell,destination.x,destination.y,destination.width,destination.height);
        remember(ctx,unit,destination,now,weapon);
      }finally{ctx.restore();}return true;
    }
    const image=loadedArt(unit?.art);if(!image)return false;
    const noMesh=action?.reduced || unit?.alive===false;
    const target=acting?primary(acting)?.unit:null,orientation=window.BattleFacing?.pose(unit,target)||{mirror:1,socket:[unit?.isEnemy?.25:.75,.4]},uv=orientation.socket;
    const weapon=noMesh?{x:rect.x+rect.width*uv[0],y:rect.y+rect.height*uv[1]}:fallbackAnchor(unit,uv[0],uv[1],rect,now,acting);
    ctx.save();try{
      if(orientation.mirror<0){const x=rect.x+rect.width/2;ctx.translate(x,0);ctx.scale(-1,1);ctx.translate(-x,0);}
      unit._facing={...orientation};remember(ctx,unit,rect,now,weapon);
      if(noMesh){ctx.drawImage(image,rect.x,rect.y,rect.width,rect.height);return true;}
      ctx.shadowBlur=0;return meshImage(ctx,image,unit,rect,now,acting);
    }finally{ctx.restore();}
  }

  function actorPoint(action, unit, now, mode='body') {
    const record=painted.get(uid(unit));
    return record && Math.abs(record.time-now)<1 ? record[mode] || record.body : unitPoint(unit,mode==='ground');
  }
  function flight(action,target,now) {
    const counter=target.uid===action.actorUid&&target.kind==='damage';
    const originUnit=counter?primary(action)?.unit || action.actor:action.actor;
    const start=actorPoint(action,originUnit,now,'weapon'),end=actorPoint(action,target.unit,now,['heal','shield','summon','blessing'].includes(target.kind)?'ground':'body');
    if(action.profile&&!counter)return window.SkillPerformance.route(action,target,now,start,end,unit=>actorPoint(action,unit,now,'body'));
    const p=clamp((now-action.launchAt)/(target.impactAt-action.launchAt)),q=1-p;
    const control={x:(start.x+end.x)/2,y:(start.y+end.y)/2-Math.min(35,Math.hypot(end.x-start.x,end.y-start.y)*.13)};
    const head={x:q*q*start.x+2*q*p*control.x+p*p*end.x,y:q*q*start.y+2*q*p*control.y+p*p*end.y};
    return {start,end,control,head,progress:p};
  }
  function glow(ctx,point,radius,color,alpha) {
    if(radius<=0||alpha<=0)return;ctx.save();const gradient=ctx.createRadialGradient(point.x,point.y,0,point.x,point.y,radius);
    gradient.addColorStop(0,color);gradient.addColorStop(1,'transparent');ctx.globalAlpha*=clamp(alpha);ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function trail(ctx,route,color,width,alpha) {
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha*=clamp(alpha);ctx.lineCap='round';ctx.beginPath();
    for(let index=0;index<=22;index++){const p=route.progress*index/22,q=1-p,x=q*q*route.start.x+2*q*p*route.control.x+p*p*route.end.x,y=q*q*route.start.y+2*q*p*route.control.y+p*p*route.end.y;index?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();ctx.restore();
  }
  function slash(ctx,point,angle,size,color,alpha) {
    ctx.save();ctx.translate(point.x,point.y);ctx.rotate(angle);ctx.globalAlpha*=clamp(alpha);
    const fill=ctx.createLinearGradient(-size,0,size,0);fill.addColorStop(0,'transparent');fill.addColorStop(.55,color);fill.addColorStop(1,'#fff5d9');ctx.fillStyle=fill;
    ctx.beginPath();ctx.moveTo(-size,-size*.2);ctx.quadraticCurveTo(size*.2,-size*.6,size,size*.12);ctx.quadraticCurveTo(size*.1,-size*.18,-size,size*.16);ctx.closePath();ctx.fill();ctx.restore();
  }
  function contactEffect(ctx,action,target,route,now,color) {
    const age=now-target.impactAt,fade=1-clamp(age/Math.min(360,action.duration*.38));if(fade<=0)return;
    const p=route.end;
    if(target.kind==='heal'||target.kind==='blessing'||target.kind==='summon'){
      glow(ctx,{x:p.x,y:p.y-17},32,target.kind==='summon'?'#b9a9ef':'#9ce8b7',fade*.35);
      for(let i=0;i<9;i++){const rise=(age/550+i/9)%1,x=p.x+Math.sin(i*2.4)*23,y=p.y-rise*62;ctx.fillStyle=target.kind==='summon'?'#c5b7ee':'#b1ebbd';ctx.globalAlpha=fade*Math.sin(rise*Math.PI)*.8;ctx.beginPath();ctx.ellipse(x,y,2.3,5.5,.4,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    }else if(target.kind==='shield'){
      ctx.save();ctx.strokeStyle='#f2d687';ctx.fillStyle='rgba(232,190,96,.10)';ctx.globalAlpha*=fade*.9;ctx.lineWidth=2.4;ctx.beginPath();ctx.ellipse(p.x,p.y-27,25,39,0,Math.PI*.88,Math.PI*2.12);ctx.stroke();ctx.lineTo(p.x,p.y+8);ctx.closePath();ctx.fill();ctx.restore();
    }else{
      glow(ctx,p,27,color,fade*.52);const angle=Math.atan2(route.end.y-route.start.y,route.end.x-route.start.x);
      slash(ctx,p,angle+.65,20+Math.min(18,age*.05),color,fade*.95);
      if(action.skill.ult||action.style==='slash')slash(ctx,p,angle-.65,18+Math.min(12,age*.04),color,fade*.68);
      for(let i=0;i<9;i++){const a=i/9*Math.PI*2,spread=8+age*.055;ctx.save();ctx.globalAlpha*=fade*.8;ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*spread*.4,p.y+Math.sin(a)*spread*.4);ctx.lineTo(p.x+Math.cos(a)*spread,p.y+Math.sin(a)*spread);ctx.stroke();ctx.restore();}
    }
  }
  function drawEffects(ctx, viewport, now=clock()) {
    const action=current(now);if(!ctx||!action||action.reduced)return false;
    if(action.profile)return window.SkillPerformance.draw(ctx,viewport,action,now,(unit,mode)=>actorPoint(action,unit,now,mode));
    const color=COLORS[action.actor?.element] || COLORS.light;
    ctx.save();try{
      const width=Math.max(0,finite(viewport?.width)),height=Math.max(0,finite(viewport?.height));
      if(width&&height){ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();}
      if(now<action.launchAt){const p=clamp((now-action.start)/(action.launchAt-action.start));glow(ctx,actorPoint(action,action.actor,now,'weapon'),10+10*p,color,p*.45);}
      for(const target of action.targets){
        if(now<action.launchAt)continue;const route=flight(action,target,now);
        if(now>=target.impactAt){contactEffect(ctx,action,target,route,now,color);continue;}
        const support=['heal','shield','summon','blessing'].includes(target.kind),tone=support?target.kind==='shield'?'#f2d687':target.kind==='summon'?'#bca8ef':'#9de0b4':color;
        trail(ctx,route,tone,action.style==='spell'?5.5:2.6,.48);trail(ctx,route,'#fff1d6',1,.65);
        const angle=Math.atan2(route.head.y-route.start.y,route.head.x-route.start.x);
        if(action.style==='arrow'&&!support){ctx.save();ctx.translate(route.head.x,route.head.y);ctx.rotate(angle);ctx.fillStyle=tone;ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-4);ctx.lineTo(-3,0);ctx.lineTo(-6,4);ctx.closePath();ctx.fill();ctx.restore();}
        else if(action.style==='slash'&&!support)slash(ctx,route.head,angle+.4,17,tone,.9);
        else glow(ctx,route.head,support?9:13,tone,.62);
      }
    }finally{ctx.restore();}return true;
  }

  function inspect(now=clock()) {
    if(!active)return Object.freeze({active:false,token});
    return Object.freeze({active:!!current(now),token:active.token,actorUid:active.actorUid,skill:{...active.skill},style:active.style,
      profile:active.profile,selectedTargetUid:active.selectedTargetUid,start:active.start,time:now,launchAt:active.launchAt,impactAt:active.impactAt,endAt:active.endAt,duration:active.duration,reduced:active.reduced,
      targets:Object.freeze(active.targets.map(target=>Object.freeze({uid:target.uid,kind:target.kind,impactAt:target.impactAt,
        contacts:target.contacts?.map(beat=>({at:beat.at,event:beat.event?{...beat.event}:null})),before:{...target.before},after:{...target.after},...flight(active,target,now)}))) });
  }
  function clear() {
    window.SkillPerformance?.clear();
    active=null;token++;painted.clear();cells.clear();filters.clear();matteRoot?.remove();matteRoot=null;
  }
  window.BattleMotion=Object.freeze({snapshot,begin,pose,drawActor,drawEffects,sampleCast,drawCast,inspect,clear});
}());
