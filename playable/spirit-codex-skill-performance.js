/* v11. Explicit skill direction, not damage-multiplier-driven cosmetics.
 * All coordinates and timings below are visual; the battle engine owns rules. */
(function(){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const lerp=(a,b,t)=>a+(b-a)*t,TAU=Math.PI*2;
  const rows={
    H1:[['炎棘箭','draw','arrow',900,'weapon','拉弦瞄准 → 单箭直射'],['烈焰穿刺','aim','fire-pierce',2100,'line','压弓蓄焰 → 穿透箭 → 三段地火'],['焚天箭雨','skybow','arrow-rain',3100,'sky','举弓仰射 → 三轮箭雨'],['炎棘陨落','skyritual','meteor',4600,'sky','举弓凝聚火核 → 流星锁定敌阵']],
    H2:[['炼火斩','slash','fire-slash',900,'melee','踏步接敌 → 横斩'],['熔岩护盾','guard','lava-ward',2200,'ground','横剑驻地 → 岩甲逐层结盾'],['爆燃冲锋','charge','fire-charge',2500,'melee','俯身蓄力 → 冲锋撞击 → 回位'],['炉火之怒','slam','eruption',4200,'ground','跃起砸剑 → 敌阵熔岩喷发']],
    W1:[['涌泉','push','water-jet',900,'weapon','推杖 → 水流冲击'],['治愈之泉','channel','healing-spring',2300,'ground','法杖引泉 → 队友脚下涌泉'],['冰霜护盾','ward','ice-ward',2500,'ground','展掌 → 冰晶沿队友周身闭合'],['深澜之颂','ritual','tidal-hymn',4300,'ground','吟唱引潮 → 多层治愈水波']],
    W2:[['三叉刺','thrust','trident',900,'melee','蹬步接敌 → 三叉戟突刺'],['潮汐锁链','bind','water-chain',2200,'weapon','回提三叉戟 → 水链缚住选定敌人'],['深渊漩涡','stir','maelstrom',3000,'ground','旋戟搅流 → 敌阵漩涡收拢'],['海神降临','raise','tidal-wave',4500,'ground','高举战戟 → 巨浪推进及水柱爆发']],
    A1:[['风羽刃','cut','wind-blade',900,'weapon','侧身开弓 → 月牙风刃'],['风鹰召唤','beckon','eagle-arrival',2300,'summon','抬手呼唤 → 风鹰俯冲入位'],['暴风眼','whirl','cyclone',3100,'ground','转身引风 → 龙卷锁定敌阵'],['风羽风暴','volley','blade-storm',4300,'weapon','展弓连续释放 → 旋转风刃群']],
    A2:[['风灵弹','orb','wind-orb',900,'weapon','掌心聚风 → 螺旋风弹'],['风之祝福','bless','wind-blessing',2200,'ground','抬杖点名 → 队友攻击风纹'],['顺风领域','spread','tailwind',2500,'ground','横扫法杖 → 己方顺风领域'],['风神庇佑','shelter','wind-ward',4000,'ground','撑杖展开 → 环流穹顶护盾']],
    T1:[['雷鸣斩','quickslash','thunder-slash',900,'melee','雷步接敌 → 电刃斩击'],['雷霆一击','cleave','thunderbolt',2400,'sky','举剑指天 → 雷柱劈中选定敌人'],['电磁脉冲','punch','electric-pulse',2700,'ground','沉肩聚电 → 敌阵脉冲扩散'],['万雷天牢','swordraise','thunder-prison',4500,'sky','引雷举剑 → 雷柱围困敌阵']],
    T2:[['闪电弹','zap','thunder-orb',900,'weapon','抬杖点射 → 带电法球'],['静电场','groundstaff','static-field',2400,'ground','法杖点地 → 敌阵电场展开'],['连锁闪电','chaincast','chain-lightning',2900,'chain','先命中选定敌人 → 按真实次序跳跃'],['电磁风暴','stormchannel','electric-storm',4300,'sky','双臂引电 → 敌阵电磁风暴']],
    D1:[['暗影刺','stab','shadow-stab',900,'melee','低伏突进 → 匕首刺击'],['影遁','fade','shadow-veil',1900,'self','收刃下潜 → 自身化影归位'],['暗蚀','lunge','corruption',2400,'weapon','挥出暗印 → 触须侵蚀选定敌人'],['暗影之舞','dance','shadow-dance',4200,'melee','闪身接敌 → 四段交错斩 → 回位']],
    D2:[['魂火','soulthrow','soul-fire',900,'weapon','引魂推掌 → 魂火追击'],['亡灵召唤','summon','grave-arrival',2500,'summon','驻杖结印 → 骷髅从阵中爬出'],['暗影壁垒','boneguard','bone-ward',2500,'ground','合掌凝骨 → 骨纹护盾闭合'],['冥府之门','gate','hell-gate',4600,'ground','展臂开门 → 冥潮冲敌及亡灵入场']],
    L1:[['圣光箭','lightshot','holy-arrow',900,'weapon','举杖凝光 → 圣光箭'],['治愈之光','pray','healing-beam',2200,'sky','朝受益队友祈祷 → 单体光柱'],['净化之光','cleanse','purification',2600,'ground','舒臂净化 → 消散负面光屑'],['神圣洗礼','resurrect','resurrection',4500,'sky','高举祷杖 → 队友光柱及复苏光翼']],
    L2:[['圣光斩','swordslash','holy-slash',900,'melee','持剑接敌 → 金白横斩'],['光明制裁','overhead','judgment-sword',2400,'sky','双手举刃 → 巨型圣剑斩落'],['神圣之光','flash','radiance',2800,'ground','展剑释光 → 敌阵放射光爆'],['神圣裁决','judge','judgment-rain',4500,'sky','持剑立誓 → 多道审判光剑']],
  };
  const profiles=Object.freeze(Object.fromEntries(Object.entries(rows).map(([id,list])=>[id,Object.freeze(list.map(([name,gesture,effect,duration,route,description],index)=>Object.freeze({id:`${id}:${index}`,characterId:id,index,name,gesture,effect,duration,route,description,impact:index===0?.60:effect==='arrow-rain'?.48:effect==='shadow-dance'?.40:effect==='chain-lightning'?.46:.59,launch:index===0?.34:.31}))) ])));
  const melee=new Set(['slash','thrust','quickslash','stab','swordslash','charge','dance']);
  const aerial=new Set(['skybow','skyritual','cleave','swordraise','overhead','judge','raise','resurrect','stormchannel']);
  const stationary=new Set(['guard','ward','ritual','channel','bless','spread','shelter','summon','boneguard','gate','pray','cleanse']);
  function profileFor(actor,skill){const list=profiles[actor?.characterId];if(!list)return null;return list.find(p=>p.name===skill?.name)||null;}
  function home(unit){const r=unit?._artRect;return r?{x:r.x+r.width/2,y:r.y+r.height*.50,ground:r.y+r.height,width:r.width,height:r.height}:{x:unit?._x||0,y:unit?._y||0,ground:(unit?._y||0)+(unit?._r||20)*.72,width:40,height:75};}
  function primary(action){return action.targets.find(t=>t.uid===action.selectedTargetUid)||action.targets.find(t=>t.unit.isEnemy!==action.actor.isEnemy&&['damage','status'].includes(t.kind))||action.targets.find(t=>t.unit!==action.actor)||action.targets[0];}
  function actorPose(action,now){
    const p=clamp((now-action.start)/action.duration),profile=action.profile,g=profile.gesture,from=home(action.actor),target=primary(action),to=home(target?.unit||action.actor),facing=to.x>=from.x?1:-1;
    const wind=smooth(p/.28),release=smooth((p-.28)/.18),returning=1-smooth((p-.78)/.22),power=release*returning;
    const pose={dx:0,dy:0,rotation:0,scaleX:1,scaleY:1,opacity:1,facingX:target?.unit===action.actor?(action.actor.isEnemy?-1:1):facing,actionFrame:p<.15?0:p<.31?1:p<.78?2:3};
    if(melee.has(g)){
      const contactX=to.x-facing*(to.width*.40+from.width*.28),approach=smooth((p-.19)/.24)*returning;
      pose.dx=(contactX-from.x)*approach;pose.dy=(to.ground-from.ground)*approach;
      pose.rotation=facing*(-.10*wind+.16*power);pose.dy-=Math.sin(approach*Math.PI)*Math.min(24,from.height*.18);
      if(g==='charge'){pose.rotation=facing*.22*power;pose.scaleX=1+.08*power;}
      if(g==='dance') {const beat=clamp((p-.35)/.42)*4,side=Math.floor(beat)%2?-1:1;pose.dx+=Math.sin(beat*Math.PI)*from.width*.33;pose.dy-=Math.abs(Math.sin(beat*Math.PI))*from.height*.19;pose.rotation+=side*.16*power;pose.actionFrame=p<.31?1:p>.78?3:Math.floor(beat)%2?1:2;}
    }else{
      pose.dx=pose.facingX*(-from.width*.035*wind+from.width*.11*power);
      pose.dy=-Math.sin(p*Math.PI)*(aerial.has(g)?from.height*.16:3);
      pose.rotation=pose.facingX*(stationary.has(g)?.025: .075)*Math.sin(p*TAU);
      if(aerial.has(g)){pose.actionFrame=p<.13?0:p<.65?1:p<.86?2:3;pose.rotation=-pose.facingX*.055*wind*returning;}
      if(g==='skybow'||g==='volley'){const beat=(p-.32)*12;pose.actionFrame=p<.16?0:p<.32?1:p>.81?3:Math.floor(beat)%2?1:2;}
      if(g==='slam'){pose.dy=-Math.sin(clamp((p-.15)/.48)*Math.PI)*from.height*.65;pose.rotation=pose.facingX*.20*Math.sin(p*TAU);}
      if(g==='whirl'||g==='stir'){pose.rotation=Math.sin(p*TAU*2)*.13*power;pose.dx+=Math.sin(p*TAU)*from.width*.15;}
      if(g==='fade'){pose.opacity=1-.78*Math.sin(p*Math.PI);pose.dy=from.height*.20*Math.sin(p*Math.PI);pose.scaleY=1-.25*Math.sin(p*Math.PI);}
      if(g==='gate'){pose.scaleX=1+.08*power;pose.rotation=0;pose.dy=-6*power;}
    }
    return pose;
  }
  // Pose-local joint deformation: the feet stay planted while shoulders and the
  // weapon hand articulate. BattleMotion uses this same mesh to locate sockets.
  function deform(profile,u,v,p,anchor){
    const g=profile.gesture,beat=Math.sin(clamp((p-.1)/.8)*Math.PI),top=1-smooth((v-.50)/.35),edge=Math.sin(Math.PI*u);
    const wrist=Math.exp(-((u-anchor[0])**2/.09+(v-anchor[1])**2/.08))*(1-smooth((v-.74)/.24));
    const sky=aerial.has(g)||g==='skybow',sweep=['slash','quickslash','swordslash','cut','whirl','stir','dance','spread','cleanse','flash'].includes(g);
    const pulse=['skybow','volley','dance','chaincast'].includes(g)?Math.sin(p*TAU*3)*.6+.4:1;
    const down=['channel','groundstaff','slam'].includes(g),spread=['shelter','boneguard','guard','gate','cleanse'].includes(g),pull=['bind','chaincast','lunge'].includes(g);
    const result={u:u+(sweep?.055*Math.sin(p*TAU*1.5):spread?(u-.5)*.10*beat:.027*beat)*top*edge+(pull?.065*Math.sin(p*TAU):.032*beat)*wrist*pulse,
      v:v-(down?-.065:sky?.11:g==='pray'?.025:stationary.has(g)?.055:.022)*beat*wrist+.018*Math.sin(p*TAU)*top*edge};
    if(sky){const weight=smooth((u-.38)/.40)*(1-smooth((v-.60)/.27)),angle=-.58*beat*weight,x=result.u-.44,y=result.v-.44;result.u=.44+x*Math.cos(angle)-y*Math.sin(angle);result.v=.44+x*Math.sin(angle)+y*Math.cos(angle);}
    return result;
  }
  function beats(action,target){
    const list=action.hitEvents?.filter(e=>String(e.uid)===target.uid)||[];
    const count=Math.max(1,list.length),profile=action.profile;
    const order=action.targets.filter(t=>t.unit.isEnemy!==action.actor.isEnemy).indexOf(target);
    const offset=profile.route==='chain'?Math.max(0,order)*action.duration*.14:Math.min(Math.max(0,order)*65,195);
    return Array.from({length:count},(_,i)=>({at:action.start+action.duration*(profile.impact+(count>1?i*.30/(count-1):0))+offset,event:list[i]||null}));
  }
  function route(action,target,now,start,end,paintedPoint){
    const profile=action.profile,source={...start},destination={...end};let launch=action.launchAt;
    const enemy=target.unit.isEnemy!==action.actor.isEnemy,ground=home(target.unit).ground;
    if(profile.route==='sky'){source.x=destination.x-(profile.effect==='meteor'?75:profile.effect==='arrow-rain'?22:0);source.y=Math.max(5,Math.min(destination.y-95,home(action.actor).y-65));}
    if(profile.route==='ground'||profile.route==='summon'||!enemy&&profile.route!=='weapon'){destination.y=ground;source.x=destination.x;source.y=ground;}
    if(profile.route==='chain'){
      const enemies=action.targets.filter(t=>t.unit.isEnemy!==action.actor.isEnemy),index=enemies.indexOf(target);
      if(index>0){const previous=enemies[index-1],point=paintedPoint?.(previous.unit)||home(previous.unit);source.x=point.x;source.y=point.y;launch=previous.impactAt;}
    }
    if(profile.route==='melee'){source.x=start.x;source.y=start.y;launch=target.impactAt-160;}
    const progress=clamp((now-launch)/Math.max(1,target.impactAt-launch)),control={x:(source.x+destination.x)/2,y:(source.y+destination.y)/2-(profile.effect==='soul-fire'?35:profile.route==='weapon'?12:0)};
    const q=1-progress,head={x:q*q*source.x+2*q*progress*control.x+progress*progress*destination.x,y:q*q*source.y+2*q*progress*control.y+progress*progress*destination.y};
    return {start:source,end:destination,control,head,progress,launch};
  }
  function glow(ctx,x,y,r,color,alpha=1){if(r<=0||alpha<=0)return;ctx.save();ctx.globalAlpha*=clamp(alpha);const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,color);grad.addColorStop(.30,color+'b0');grad.addColorStop(1,color+'00');ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
  function path(ctx,a,b,color,width=2,alpha=1,bend=0){ctx.save();ctx.globalAlpha*=clamp(alpha);const g=ctx.createLinearGradient(a.x,a.y,b.x+.01,b.y+.01);g.addColorStop(0,color+'00');g.addColorStop(.3,color+'70');g.addColorStop(.85,color);g.addColorStop(1,'#fff1d5');ctx.strokeStyle=g;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2+bend,b.x,b.y);ctx.stroke();ctx.restore();}
  function ring(ctx,x,y,r,color,alpha,aspect=.36,angle=0){ctx.save();ctx.globalAlpha*=clamp(alpha)*.6;ctx.translate(x,y);ctx.scale(1,aspect);ctx.rotate(angle);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();if(aspect<.5){ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,r,i*TAU/3,i*TAU/3+.22);ctx.stroke();}}ctx.restore();}
  const brushCache=new Map();let brushRoot=null;
  function clear(){brushCache.clear();brushRoot?.remove();brushRoot=null;}
  // Reuse authored smoke, flame, water and blade brush textures. Colorize their
  // luminance into alpha once, so file:// works without pixel reads or black plates.
  function brush(index,color){
    const image=window.loadedArt?.('assets/combos/vfx-brush-atlas-v5.png');if(!image||typeof document==='undefined')return null;
    const key=index+color;if(brushCache.has(key))return brushCache.get(key);
    const ns='http://www.w3.org/2000/svg',element=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,v);return n;};
    if(!brushRoot){brushRoot=element('svg',{width:0,height:0,'aria-hidden':'true'});brushRoot.style.cssText='position:absolute;pointer-events:none;overflow:hidden';document.body.append(brushRoot);}
    const value=parseInt(color.slice(1),16),id='skill-brush-'+index+'-'+value,filter=element('filter',{id,'color-interpolation-filters':'sRGB',x:'0%',y:'0%',width:'100%',height:'100%'});
    filter.append(element('feColorMatrix',{type:'matrix',values:`0 0 0 0 ${(value>>16&255)/255} 0 0 0 0 ${(value>>8&255)/255} 0 0 0 0 ${(value&255)/255} .3333 .3333 .3333 0 0`}));brushRoot.append(filter);
    const cell=document.createElement('canvas');cell.width=cell.height=192;cell.dataset.skillBrush=key;const ctx=cell.getContext('2d'),w=image.naturalWidth/4,h=image.naturalHeight/2;ctx.filter=`url(#${id})`;ctx.drawImage(image,index%4*w,Math.floor(index/4)*h,w,h,0,0,192,192);ctx.filter='none';brushCache.set(key,cell);return cell;
  }
  function stamp(ctx,index,x,y,w,h,angle,color,alpha=1){const image=brush(index,color);if(!image||alpha<=0)return;ctx.save();ctx.globalAlpha*=clamp(alpha);ctx.globalCompositeOperation='screen';ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(image,-w/2,-h/2,w,h);ctx.restore();}
  function shard(ctx,x,y,size,angle,color,alpha=1){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha*=clamp(alpha);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(-size*.58,-size*.25);ctx.lineTo(-size*.20,0);ctx.lineTo(-size*.58,size*.25);ctx.closePath();ctx.fill();ctx.restore();}
  function arc(ctx,x,y,r,angle,color,alpha=1){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha*=clamp(alpha);ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,r*.12);ctx.beginPath();ctx.arc(0,0,r,-.9,.9);ctx.stroke();ctx.lineWidth=1;ctx.strokeStyle='#fff6df';ctx.beginPath();ctx.arc(0,0,r*.84,-.82,.82);ctx.stroke();ctx.restore();}
  function bolt(ctx,a,b,time,color,width=3){const points=9;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);for(let i=1;i<=points;i++){const p=i/points,offset=Math.sin(i*12.3+Math.floor(time/65)*2.7)*Math.sin(p*Math.PI)*12;ctx.lineTo(lerp(a.x,b.x,p)+offset,lerp(a.y,b.y,p));}ctx.stroke();ctx.strokeStyle='#edebff';ctx.lineWidth=1;ctx.stroke();ctx.restore();}
  function motes(ctx,x,y,r,time,color,count=14,up=false){for(let i=0;i<count;i++){const p=(time/1000+i/count)%1,a=i*2.399;shard(ctx,x+Math.cos(a)*r*(up?.55:p),y+(up?-p*r*2:Math.sin(a)*r*p),2.5*(1-p)+.7,a,color,Math.sin(p*Math.PI));}}
  function column(ctx,x,ground,height,width,color,p,alpha=1){ctx.save();ctx.globalAlpha*=clamp(alpha);const g=ctx.createLinearGradient(x,ground-height*p,x,ground);g.addColorStop(0,color+'00');g.addColorStop(.45,color+'88');g.addColorStop(1,color);ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-width,ground);ctx.quadraticCurveTo(x-width*.8,ground-height*.5*p,x,ground-height*p);ctx.quadraticCurveTo(x+width*.8,ground-height*.5*p,x+width,ground);ctx.closePath();ctx.fill();path(ctx,{x,y:ground},{x,y:ground-height*.92*p},'#fff3cb',2,alpha);ctx.restore();}
  function blade(ctx,x,y,size,angle,color,alpha=1){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha*=clamp(alpha);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(-size*.28,-size*.11);ctx.lineTo(-size*.43,0);ctx.lineTo(-size*.28,size*.11);ctx.closePath();ctx.fill();path(ctx,{x:-size*.25,y:-size*.27},{x:-size*.25,y:size*.27},color,4);path(ctx,{x:-size*.30,y:0},{x:-size*.67,y:0},'#d5c49b',4);path(ctx,{x:0,y:0},{x:size*.9,y:0},'#fffbe3',2);ctx.restore();}
  function ward(ctx,point,radius,time,color,kind,alpha){
    const x=point.x,y=point.y-radius*.72;
    ring(ctx,x,y,radius,color,alpha,1.15,Math.sin(time/350)*.035);
    for(let i=0;i<6;i++){const a=i/6*TAU+time/1600,px=x+Math.cos(a)*radius*.82,py=y+Math.sin(a)*radius;
      if(kind==='ice-ward')shard(ctx,px,py,10,a,color,alpha);
      else if(kind==='bone-ward'){path(ctx,{x:px-5,y:py-7},{x:px+5,y:py+7},'#dbd2e6',3,alpha);ring(ctx,px,py,6,color,alpha,1);}
      else if(kind==='lava-ward'){path(ctx,{x:px,y:py},{x:x+Math.cos(a+.3)*radius*.6,y:y+Math.sin(a+.3)*radius*.6},color,4,alpha);}
      else arc(ctx,x,y,radius*(.70+i*.06),a,color,alpha*.7);
    }
    glow(ctx,x,y,radius,color,alpha*.18);
  }
  function draw(ctx,viewport,action,now,point){
    const profile=action.profile;if(!profile||action.reduced)return false;
    const p=clamp((now-action.start)/action.duration),time=now-action.start,origin=point(action.actor,'weapon'),actor=home(action.actor),color={fire:'#ff9148',water:'#65d9f8',wind:'#92efb1',thunder:'#b699ff',dark:'#b58bf2',light:'#ffdf8c'}[action.actor.element]||'#ffdf8c';
    const fade=1-smooth((p-.84)/.16),power=smooth(p/.30)*fade,effect=profile.effect;
    ctx.save();try{
      ctx.beginPath();ctx.rect(0,0,viewport.width,viewport.height);ctx.clip();
      if(profile.index===3){
        const shade=ctx.createRadialGradient(actor.x,actor.y,20,actor.x,actor.y,viewport.width);shade.addColorStop(0,color+'08');shade.addColorStop(1,'#0104119c');ctx.globalAlpha=power*.55;ctx.fillStyle=shade;ctx.fillRect(0,0,viewport.width,viewport.height);ctx.globalAlpha=1;
        ring(ctx,actor.x,actor.ground,Math.min(70,viewport.width*.1),color,power,.28,time/3200);
      }
      // A weapon-specific charge remains connected to the real articulated hand.
      if(p<.55){glow(ctx,origin.x,origin.y,12+profile.index*5,color,Math.sin(clamp(p/.55)*Math.PI)*.6);stamp(ctx,6,origin.x,origin.y,35+profile.index*9,35+profile.index*9,time/2000,color,power*.8);if(profile.index>0)for(let i=0;i<6;i++)shard(ctx,origin.x+Math.cos(i+time/220)*22*(1-p),origin.y+Math.sin(i+time/220)*22*(1-p),3,i,color,power);}
      if(['skybow','skyritual'].includes(profile.gesture)&&p>.18&&p<.54){const rise=smooth((p-.18)/.36),tip={x:origin.x+35*rise,y:lerp(origin.y,7,rise)};path(ctx,origin,tip,color,profile.index===3?5:2,.8);shard(ctx,tip.x,tip.y,12,-1.1,color);}
      if(effect==='hell-gate'){
        const x=lerp(actor.x,viewport.width*.49,smooth(p/.32)),r=Math.min(viewport.height*.35,85)*smooth(p/.34);
        ring(ctx,x,viewport.height*.5,r,color,power,1.55,time/4500);ring(ctx,x,viewport.height*.5,r*.83,'#79e1bb',power*.8,1.55,-time/3500);glow(ctx,x,viewport.height*.5,r*.8,'#664180',power*.5);motes(ctx,x,viewport.height*.5,r,time,color,20);
      }
      for(const target of action.targets){
        const friendly=target.unit.isEnemy===action.actor.isEnemy,body=point(target.unit,'body'),ground=point(target.unit,'ground'),route=action.routes(target,now),start=route.start,end=route.end;
        const contacts=target.contacts?.length?target.contacts:[{at:target.impactAt}],age=now-target.impactAt,hit=smooth(age/120)*(1-smooth((age-350)/700));
        const scale=Math.max(18,Math.min(65,home(target.unit).height*.65)),localFade=(1-smooth((age-400)/850))*fade,show=p>.26;
        if(target.uid===action.actorUid&&target.kind==='damage'){
          if(now>=action.launchAt&&age<0){path(ctx,start,route.head,'#ffa77d',2,.6);shard(ctx,route.head.x,route.head.y,9,Math.atan2(end.y-start.y,end.x-start.x),'#ffc59b');}
          if(age>=0&&age<400)arc(ctx,body.x,body.y,scale*.65,time/200,'#ffaf87',1-age/400);
          continue;
        }
        if(friendly||target.kind==='heal'||target.kind==='shield'||target.kind==='summon'||target.kind==='blessing'){
          const tone=effect.includes('bone')||effect.includes('grave')||effect==='hell-gate'?'#c099ef':effect.includes('wind')||effect==='tailwind'||effect==='eagle-arrival'?'#99ebc1':action.actor.element==='water'?'#83e9f4':'#ffe4a0';
          if(!show)continue;
          const grow=smooth((p-.28)/.32);
          if(p<.58&&effect!=='shadow-veil')path(ctx,origin,ground,tone,1.2,Math.sin((p-.26)/.32*Math.PI)*.45,-24);
          if(target.kind==='shield')ward(ctx,ground,scale*.63,time,tone,effect,grow*fade);
          else if(target.kind==='summon'){
            ring(ctx,ground.x,ground.y,scale,tone,grow*fade,.3,time/800);ring(ctx,ground.x,ground.y,scale*.70,tone,grow*fade,.3,-time/700);
            if(effect==='eagle-arrival'){const q=clamp((now-action.launchAt)/(target.impactAt-action.launchAt));path(ctx,{x:ground.x-40,y:Math.max(4,ground.y-scale*3)},{x:ground.x,y:lerp(ground.y-scale*3,ground.y,q)},tone,5,fade);for(let k=0;k<5;k++)arc(ctx,ground.x,ground.y-scale*(1-q),scale*.5+k*3,time/200+k,tone,.45*fade);}
            else{for(let i=0;i<8;i++){const a=i/8*TAU;column(ctx,ground.x+Math.cos(a)*scale*.7,ground.y+Math.sin(a)*scale*.2,scale*1.8,2,tone,grow,fade*.55);}}
          }else if(effect==='shadow-veil') {motes(ctx,body.x,ground.y,scale*1.1,time,'#ab80d2',22,true);ring(ctx,ground.x,ground.y,scale,'#9777d6',fade,.24);}
          else if(['healing-beam','resurrection'].includes(effect)){
            column(ctx,ground.x,ground.y,Math.min(viewport.height,scale*3),scale*.42,tone,grow,fade*.65);ring(ctx,body.x,body.y-scale*.7,scale*.5,tone,fade,.25);
            if(effect==='resurrection')for(const side of [-1,1])for(let k=0;k<5;k++)shard(ctx,body.x+side*scale*(.2+k*.09),body.y-k*scale*.08,scale*.50,side<0?Math.PI-.35:.35,tone,grow*fade*.65);
          }else if(['healing-spring','tidal-hymn'].includes(effect)){
            for(let k=0;k<(effect==='tidal-hymn'?4:2);k++){ring(ctx,ground.x,ground.y,(scale*.3+((time/900+k*.25)%1)*scale),tone,fade*.65,.30);column(ctx,ground.x+Math.sin(k*2.4)*scale*.33,ground.y,scale*(1.0+k*.35),scale*.16,tone,grow,fade*.35);}
            motes(ctx,body.x,ground.y,scale,time,tone,16,true);
          }else if(effect==='purification'){ring(ctx,body.x,body.y,scale*(.4+((time/900)%1)),tone,fade,.9);motes(ctx,body.x,body.y,scale,time,'#9884b4',12);motes(ctx,body.x,ground.y,scale,time,tone,16,true);}
          else if(effect==='tailwind'){for(let k=0;k<5;k++)path(ctx,{x:ground.x-scale,y:ground.y-k*8},{x:ground.x+scale,y:ground.y-k*8-12},tone,2,fade*.6,Math.sin(time/160+k)*8);}
          else {ring(ctx,ground.x,ground.y,scale*grow,tone,fade,.30,time/1200);motes(ctx,body.x,ground.y,scale,time,tone,12,true);if(effect==='wind-blessing')for(const side of [-1,1])path(ctx,{x:body.x+side*8,y:body.y+12},{x:body.x,y:body.y-10},tone,3,fade);}
          continue;
        }
        // Target marker appears before arrival, but never changes HP itself.
        if(show&&profile.index>0)ring(ctx,ground.x,ground.y,scale*.62,color,Math.min(.65,power)* (age<0?1:localFade),.23,time/4000);
        if(profile.route==='sky'){
          if(p>.27&&p<.50)path(ctx,origin,{x:start.x,y:start.y},color,1,power*.22,-25);
          for(let beat=0;beat<contacts.length;beat++){
            const strike=contacts[beat].at,launch=strike-(effect==='meteor'?1000:650),travel=clamp((now-launch)/(strike-launch)),impactAge=now-strike;
            const count=effect==='arrow-rain'?7:effect==='judgment-rain'?3:1;
            for(let k=0;k<count;k++){
              const spread=(k-(count-1)/2)*scale*.23,tip={x:lerp(start.x+spread,body.x+spread,travel),y:lerp(start.y,body.y,travel*travel)};
              if(now>=launch&&now<strike){
                if(effect==='meteor'){const angle=Math.atan2(body.y-start.y,body.x-start.x)-Math.PI*.75;stamp(ctx,7,tip.x,tip.y,scale*2.2,scale*2.5,angle,'#ff762f',.95);stamp(ctx,7,tip.x,tip.y,scale*1.4,scale*1.8,angle,'#ffe7b2',.85);glow(ctx,tip.x,tip.y,scale*.25,'#fff0c9',.8);}
                else if(effect==='thunderbolt'||effect==='thunder-prison'||effect==='electric-storm')bolt(ctx,start,tip,time+beat*29,color,effect==='thunderbolt'?7:4);
                else if(effect==='judgment-sword'||effect==='judgment-rain')blade(ctx,tip.x,tip.y,scale*(effect==='judgment-sword'?1.4:.9),Math.PI/2,'#ffe4a0');
                else {path(ctx,{x:tip.x-9,y:tip.y-30},tip,color,2,.8);shard(ctx,tip.x,tip.y,11,1.27,'#ffc86f');}
              }
              if(impactAge>=0&&impactAge<650){const a=1-impactAge/650;glow(ctx,body.x+spread,body.y,scale*(effect==='meteor'?1.0:.4),color,a*.35);if(k===Math.floor(count/2)){ring(ctx,ground.x,ground.y,scale*(.3+impactAge/700),color,a*.5,.28);stamp(ctx,effect==='meteor'?3:2,body.x,body.y+scale*.28,scale*2.2,scale*(1.2+impactAge/700),impactAge/1400,color,a*.9);}motes(ctx,body.x+spread,ground.y,scale*.65,impactAge,color,5);}
            }
          }
          if(effect==='thunder-prison'&&age>-180)for(let k=0;k<6;k++){const a=k/6*TAU,x=ground.x+Math.cos(a)*scale,y=ground.y+Math.sin(a)*scale*.22;bolt(ctx,{x,y:Math.max(5,y-scale*2.8)},{x,y},time+k*73,color,2);ring(ctx,ground.x,ground.y-scale*1.4,scale,color,localFade,.25,time/600);}
          if(effect==='electric-storm'&&show){for(let k=0;k<5;k++)ring(ctx,body.x,body.y,scale*(.4+k*.13),color,fade*.4,.4,time/500+k*.5);}
        }else if(profile.route==='melee'){
          if(effect==='fire-charge'&&p>.24&&age<350){const foot=point(action.actor,'ground');for(let k=0;k<8;k++){const q=(k+.3)/8;stamp(ctx,0,lerp(actor.x,foot.x,q),lerp(actor.ground,foot.y,q),scale*(.6+q),scale*.55,-.2,color,power*q*.65);}motes(ctx,foot.x,foot.y,scale,time,color,12);}
          if(now>target.impactAt-200){for(let k=0;k<contacts.length;k++){const a=now-contacts[k].at;if(a< -150||a>450)continue;const strength=Math.sin(clamp((a+150)/600)*Math.PI);arc(ctx,body.x,body.y,scale*.8,lerp(-2,1.2,clamp((a+150)/380))+(k%2?Math.PI:0),color,strength);if(effect==='trident')for(let j=-1;j<=1;j++)path(ctx,{x:body.x-25,y:body.y+j*7},{x:body.x+17,y:body.y+j*7},color,3,strength);if(effect==='shadow-stab'||effect==='shadow-dance')blade(ctx,body.x,body.y,scale*.6,k%2?2.4:-.5,color,strength);}}
        }else if(profile.route==='ground'){
          if(!show)continue;const grow=smooth((p-.27)/.30);
          if(p<.56)path(ctx,origin,ground,color,1.4,Math.sin((p-.26)/.30*Math.PI)*.55,-26);
          if(effect==='eruption'){for(let k=-1;k<=1;k++)column(ctx,ground.x+k*scale*.4,ground.y,scale*(1.6+(k===0?.6:0)),scale*.25,color,smooth((p-.38-k*.025)/.25),fade*.8);motes(ctx,ground.x,ground.y,scale,time,'#ffc777',18,true);}
          else if(effect==='maelstrom'||effect==='cyclone'){
            const h=scale*2.6*grow;for(let k=0;k<14;k++){const t=k/13,r=scale*(effect==='cyclone'?.26+.7*t:1-.65*t);ring(ctx,ground.x+Math.sin(time/260+t*4)*r*.12,ground.y-h*t,r,color,fade*.60,.22,time/800+t);for(let j=0;j<2;j++)shard(ctx,ground.x+Math.cos(time/120+k+j*3)*r,ground.y-h*t,3,time/200,color,fade);}
          }else if(effect==='tidal-wave'){for(let k=0;k<5;k++){const a=(time/1800+k*.14)%1,x=ground.x-scale+scale*2*a;column(ctx,x,ground.y,scale*2.5*Math.sin(a*Math.PI),scale*.24,color,grow,fade*.55);}ring(ctx,ground.x,ground.y,scale*1.2,color,fade,.3);}
          else if(effect==='electric-pulse'||effect==='static-field'){for(let k=0;k<4;k++){const r=scale*((time/1000+k*.25)%1);ring(ctx,ground.x,ground.y,r,color,fade*.8,.38);if(effect==='static-field')for(let j=0;j<4;j++){const a=j/4*TAU+time/1700;bolt(ctx,ground,{x:ground.x+Math.cos(a)*r,y:ground.y+Math.sin(a)*r*.35},time+j,color,1.4);}}}
          else if(effect==='radiance'){for(let k=0;k<12;k++){const a=k/12*TAU+time/6000;path(ctx,body,{x:body.x+Math.cos(a)*scale*grow,y:body.y+Math.sin(a)*scale*grow},'#ffe5a6',3,fade*.6);}glow(ctx,body.x,body.y,scale,'#ffe0a0',hit*.8);}
          else if(effect==='ice-ward'){for(let k=0;k<6;k++){const a=k/6*TAU;shard(ctx,body.x+Math.cos(a)*scale*.65,body.y+Math.sin(a)*scale*.8,scale*.35,a,color,grow*fade);}ring(ctx,ground.x,ground.y,scale*.8,color,fade,.3);}
          else if(effect==='hell-gate'){for(let k=0;k<3;k++){const q=clamp((p-.35-k*.035)/.26),source={x:viewport.width*.49,y:viewport.height*.5},tip={x:lerp(source.x,body.x,q),y:lerp(source.y,body.y+k*7,q)};path(ctx,source,tip,color,8-k*2,fade*.5);shard(ctx,tip.x,tip.y,17,Math.atan2(body.y-source.y,body.x-source.x),'#adf0cc',fade);}}
        }else if(profile.route==='chain'){
          if(now>=route.launch){bolt(ctx,start,route.head,time,color,4);glow(ctx,route.head.x,route.head.y,16,color,.8);if(age>=0&&age<600)ring(ctx,body.x,body.y,scale*.65,color,localFade,.8,time/300);}
        }else{
          if(now>=route.launch&&age<250){const tip=route.head,angle=Math.atan2(end.y-start.y,end.x-start.x);
            if(effect==='water-chain'){for(let k=0;k<15;k++){const q=route.progress*k/14,x=lerp(start.x,end.x,q),y=lerp(start.y,end.y,q)+Math.sin(q*12+time/120)*7;ring(ctx,x,y,5,color,.8,.65,angle);}}
            else if(effect==='water-jet'){for(let k=0;k<4;k++)path(ctx,{x:start.x,y:start.y+k*2},{x:tip.x,y:tip.y+k*2},color,4-k*.7,.65,Math.sin(time/140+k)*9);glow(ctx,tip.x,tip.y,14,'#baedff',.6);}
            else if(effect==='wind-blade'||effect==='blade-storm'){const n=effect==='blade-storm'?6:1;for(let k=0;k<n;k++){const q=clamp((now-route.launch-k*80)/(target.impactAt-route.launch)),x=lerp(start.x,end.x,q),y=lerp(start.y,end.y,q)+(n>1?Math.sin(k*2+time/140)*17:0);arc(ctx,x,y,16+k,angle+time/800,color,fade);}}
            else if(effect==='corruption'){for(let k=0;k<4;k++)path(ctx,{x:start.x,y:start.y+k*3},{x:tip.x,y:tip.y},color,3,fade,Math.sin(time/160+k)*24);}
            else if(effect==='wind-orb'||effect==='thunder-orb'||effect==='soul-fire'){path(ctx,start,tip,color,5,.5,Math.sin(time/250)*8);glow(ctx,tip.x,tip.y,19,color,.7);for(let k=0;k<3;k++)ring(ctx,tip.x,tip.y,9+k*3,color,.85,.45,time/180+k);if(effect==='thunder-orb')for(let k=0;k<3;k++)bolt(ctx,tip,{x:tip.x+Math.cos(time/170+k*2)*20,y:tip.y+Math.sin(time/170+k*2)*20},time+k*53,color,1);}
            else{path(ctx,start,tip,color,effect==='fire-pierce'?5:2,.7);shard(ctx,tip.x,tip.y,effect==='fire-pierce'?22:13,angle,effect==='holy-arrow'?'#fff1b8':'#ffd09b');}
          }
          if(effect==='fire-pierce'&&show)for(let k=0;k<3;k++){const q=.45+k*.25,x=lerp(actor.x,body.x,q),y=lerp(actor.ground,ground.y,q),startTime=action.start+action.duration*(.34+k*.12);column(ctx,x,y,scale*(.9+k*.28),scale*.15,color,smooth((now-startTime)/260),fade*.78);}
          if(effect==='water-chain'&&age>=0)for(let k=0;k<4;k++)ring(ctx,body.x,body.y+(k-1.5)*8,scale*.55,color,localFade,.28,time/650+k);
          if(effect==='corruption'&&age>=0)for(let k=0;k<5;k++){const a=k/5*TAU;path(ctx,{x:body.x+Math.cos(a)*scale,y:ground.y},{x:body.x+Math.cos(a+time/700)*scale*.4,y:body.y-scale*.5},color,4,localFade,Math.sin(time/250+k)*20);}
        }
        if(age>=0&&age<550){glow(ctx,body.x,body.y,scale*.55,color,hit*.25);stamp(ctx,profile.route==='melee'?1:6,body.x,body.y,scale*1.8,scale*1.8,time/600,color,hit*.8);motes(ctx,body.x,body.y,scale,time,color,8);}
      }
    }finally{ctx.restore();}
    return true;
  }
  window.SkillPerformance=Object.freeze({profiles,profileFor,actorPose,deform,beats,route,draw,clear});
}());
