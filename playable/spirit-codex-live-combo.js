/* v10: one real battlefield, one timeline. Rules resolve once in executeCombo;
 * this adapter only presents snapshots and never creates replacement units. */
(function(){
  'use strict';
  const DURATION=8400,STAGES=[[0,'双人聚能'],[1400,'灵体显现'],[3200,'绝招释放'],[4700,'命中目标'],[6000,'领域余波'],[7550,'收招']];
  let active=null;
  const clock=()=>window.BattleClock?.now()??performance.now();
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const ease=p=>{p=clamp(p);return p*p*(3-2*p);};
  const image=src=>{if(!src)return null;loadArt(src);const cached=loadedArt(src);if(cached)return cached;const img=new Image();img.decoding='async';img.src=src;return img;};
  function participantFacing(session,unit){
    const target=state.enemies.find(enemy=>session.targets.some(hit=>hit.side==='enemy'&&hit.uid===enemy.uid))||state.enemies[0];
    return window.BattleFacing?.direction(unit,target) || 1;
  }
  function rectFor(unit){
    const img=loadedArt(unit.art),maxW=unit._artWidth||unit._r*2,maxH=unit._artHeight||unit._r*2.7;
    const scale=img?Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight):1;
    const width=img?img.naturalWidth*scale:maxW,height=img?img.naturalHeight*scale:maxH;
    return {x:unit._x-width/2,y:unit._y+unit._r*.72-height,width,height};
  }
  function measure(session,time){
    const units=[...state.allies,...state.enemies],width=BW,height=BH;
    const sources=session.participants.map(unit=>{
      const rect=rectFor(unit);rect.y+=unit.alive?Math.sin((session.startTime+time)/600+unit.uid)*1.3:0;
      const cast=window.BattleMotion?.sampleCast(unit,session.casting,time/DURATION,rect,{facingX:participantFacing(session,unit),now:time});
      return {uid:unit.uid,...(cast?.anchor||{x:rect.x+rect.width*.8,y:rect.y+rect.height*.35}),ground:{x:unit._x,y:rect.y+rect.height}};
    });
    const targets=session.targets.map((target,index)=>{
      const unit=units.find(u=>u.uid===target.uid);if(!unit)return null;
      const rect=rectFor(unit),visual=pose(unit,session.startTime+time),role=target.side==='enemy'?'attack':target.side==='summon'?'summon':target.shieldAfter>target.shieldBefore?'shield':'heal';
      rect.x+=visual?.dx||0;rect.y+=(visual?.alive?Math.sin((session.startTime+time)/600+unit.uid)*1.3:0)+(visual?.dy||0);
      return {...target,role,x:rect.x+rect.width*.5,y:rect.y+rect.height*(role==='heal'||role==='summon'?1:.45),ground:{x:rect.x+rect.width*.5,y:rect.y+rect.height},bounds:{...rect,left:rect.x,top:rect.y,right:rect.x+rect.width,bottom:rect.y+rect.height},strike:4700+index*110};
    }).filter(Boolean);
    session.geometry={width,height,time,layout:'opposed',sources,targets,fusion:{x:width*.50,y:height*.48},manifestRadius:Math.min(126,width*.165,height*.30),primaryUid:targets.find(t=>t.side==='enemy')?.uid||targets[0]?.uid};
    session.choreography=window.ComboChoreography.sample(session.geometry,session.motion,time,{artVariant:session.rig?.combat?.variant||'',facingState:session.facingState});
    session.geometry.choreography=session.choreography;
    session.geometry.targets=session.geometry.targets.map(target=>({...target,...session.choreography.attacks.find(attack=>attack.uid===target.uid)}));
  }
  function frame(now=clock()){
    const session=active;if(!session)return null;
    const elapsed=clamp(now-session.startTime,0,session.duration);
    if(elapsed>=session.duration){finish('complete');return null;}
    session.elapsed=elapsed;const time=session.reduced?DURATION:elapsed;
    measure(session,time);
    window.ComboEnvironment?.syncBattle(session.motion,time,{token:session.environmentToken,reduced:session.reduced,now});
    const phase=session.reduced?'结果':STAGES.filter(s=>time>=s[0]).at(-1)[1];
    if(session.label.textContent!==phase)session.label.textContent=phase;
    session.root.dataset.phase=phase;session.root.dataset.elapsed=String(Math.round(elapsed));
    return {time,geometry:session.geometry,choreography:session.choreography};
  }
  function pose(unit,now=clock()){
    const session=active;if(!session)return null;
    const target=session.targets.find(t=>t.uid===unit.uid),elapsed=Math.max(0,now-session.startTime);
    if(!target)return null;
    const strike=session.reduced?0:4700+session.targets.indexOf(target)*110,hit=elapsed-strike,p=session.reduced?1:ease(hit/950);
    const damaged=target.hpAfter<target.hpBefore||target.shieldAfter<target.shieldBefore;
    return {hp:Math.round(target.hpBefore+(target.hpAfter-target.hpBefore)*p),shield:Math.round(target.shieldBefore+(target.shieldAfter-target.shieldBefore)*p),alive:p<1?target.aliveBefore:target.aliveAfter,
      opacity:target.side==='summon'&&!target.aliveBefore&&target.aliveAfter?p:1,dx:!session.reduced&&damaged&&hit>0&&hit<650?Math.sin(hit/34)*Math.min(10,BW*.012)*(1-hit/650):0,
      dy:0,rotation:0,scaleX:1,scaleY:1,flash:damaged&&hit>0?clamp(1-hit/500):0};
  }
  function drawActor(ctx,unit,rect,now){
    const session=active;if(!session||!session.participants.includes(unit)||session.reduced)return false;
    const result=window.BattleMotion?.drawCast(ctx,unit,rect,session.casting,clamp((now-session.startTime)/DURATION),loadedArt,{facingX:participantFacing(session,unit),now:now-session.startTime});
    return result?.drawn===true;
  }
  function draw(ctx,now){
    const session=active;if(!session)return false;
    if(session.reduced)return true;
    window.ComboStageVFX.draw(session,clamp(now-session.startTime,0,DURATION));
    ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.drawImage(session.canvas,0,0,BW,BH);ctx.restore();
    const battlefield=document.getElementById('battle-canvas');
    battlefield.dataset.liveCombo=session.recipe.id; battlefield.dataset.comboTime=String(Math.round(session.elapsed));
    return true;
  }
  function dispose(session,cancelled){
    if(window.BattleClock)window.BattleClock.cancel(session.timer);else clearTimeout(session.timer);session.root.remove();
    window.ComboEnvironment?.releaseBattle({cancelled:cancelled||session.reduced,token:session.environmentToken});
    const canvas=document.getElementById('battle-canvas');if(canvas){delete canvas.dataset.liveCombo;delete canvas.dataset.comboTime;}
  }
  function finish(reason='complete'){
    const session=active;if(!session||session.finished)return false;
    session.finished=true;active=null;dispose(session,reason==='skipped');
    // A skip fast-forwards presentation, not the already committed gameplay.
    session.events.forEach(event=>{event.revealAt=clock();});
    renderAll();session.onComplete?.({reason,duration:session.duration,preview:false});return true;
  }
  function clear(){if(!active)return false;const session=active;active=null;session.finished=true;dispose(session,true);const owned=new Set(session.events);state.particles=state.particles.filter(event=>!owned.has(event));state.floats=state.floats.filter(event=>!owned.has(event));return true;}
  function play(recipe,participants,options={}){
    clear();window.BattleMotion?.clear();layoutUnits();
    const root=document.createElement('div');root.id='live-combo';root.className='live-combo-status';root.setAttribute('aria-live','polite');
    const title=document.createElement('strong');title.textContent=recipe.name;
    const label=document.createElement('span');label.textContent='双人聚能';
    const skip=document.createElement('button');skip.id='live-combo-skip';skip.type='button';skip.className='btn';skip.textContent='跳过演出';skip.onclick=()=>finish('skipped');
    root.append(title,label,skip);document.getElementById('battle-ui').prepend(root);
    const requested=options.motionMode||window.getComboCinematicMotion?.()||'system';
    const canvas=document.createElement('canvas'),reduced=requested==='reduced'||requested!=='full'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const session={root,label,canvas,ctx:canvas.getContext('2d'),live:true,recipe,participants:[...participants],targets:options.targets||[],casting:recipe.casting,rig:recipe.rig,
      motion:recipe.motion||recipe.theme,rigImage:image(recipe.rig?.src),combatImage:image(recipe.rig?.combat?.src),rigCells:[],attackImage:image(COMBO_STAGE_ART.attack),attackCells:[],vfxTexture:image(COMBO_STAGE_ART.texture),
      duration:reduced?1800:DURATION,reduced,finished:false,facingState:{},startTime:clock(),elapsed:0,onComplete:options.onComplete,events:options.events||[]};
    session.start=session.startTime;session.environmentToken=window.ComboEnvironment?.beginBattle(session.motion,{reduced,now:session.startTime});
    active=session;measure(session,0);session.events.forEach(event=>{const index=Math.max(0,session.targets.findIndex(target=>String(target.uid)===String(event.uid)));event.revealAt=session.startTime+(reduced?0:4700+index*110);});
    session.timer=(window.BattleClock?.schedule||setTimeout)(()=>{if(active===session)finish('complete');},session.duration);
    renderAll();return session;
  }
  window.LiveCombo=Object.freeze({play,clear,finish,frame,pose,draw,drawActor,get current(){return active;}});
  if(window.SC)window.SC.LiveCombo=window.LiveCombo;
}());
