/* Image2 impact storyboard renderer. Reads presentation snapshots only. */
(function () {
  'use strict';
  const DURATION=8400, REDUCED_DURATION=1800;
  const MOTIONS={
    phoenix:{light:'#ffe5a6',shadow:'#ff742b',index:0},tide:{light:'#b9f6ff',shadow:'#4999ef',index:1},
    bastion:{light:'#fff0b0',shadow:'#e1ab47',index:2},spring:{light:'#d2ffe3',shadow:'#75d0a4',index:3},
    eclipse:{light:'#efceff',shadow:'#b868ed',index:4},legion:{light:'#c9ffec',shadow:'#68c9b0',index:5},
  };
  const STAGES=[['charge','聚能'],['manifest','显现'],['release','释放'],['impact','命中'],['aftershock','余波'],['settle','结果']];
  const STAGE_STARTS=[0,1400,3200,4700,6200,7600];
  let active=null,motionPreference='system';
  const clamp=value=>Math.max(0,Math.min(1,value));
  const ease=value=>1-(1-clamp(value))**3;
  const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  const visualValue=index=>{const value=Math.sin(index*12.9898+9.27)*43758.5453;return value-Math.floor(value);};
  function node(tag,className,text){const element=document.createElement(tag);element.className=className;if(text!==undefined)element.textContent=text;return element;}
  function format(value){return Math.round(number(value)).toLocaleString('zh-CN');}
  function clearComboCinematic(){
    const session=active;if(!session)return;active=null;
    if(session.raf!==null)window.cancelAnimationFrame(session.raf);
    if(session.timer!==null)window.clearTimeout(session.timer);
    if(session.keydown)document.removeEventListener('keydown',session.keydown,true);
    if(session.userCamera){session.arena.removeEventListener('wheel',session.userCamera);session.arena.removeEventListener('pointerdown',session.userCamera);session.arena.removeEventListener('touchstart',session.userCamera);}
    if(session.resize)window.removeEventListener('resize',session.resize);
    if(!session.preview&&!session.environmentReleased)window.ComboEnvironment?.releaseBattle({cancelled:true,token:session.environmentToken});
    session.root.remove();
    session.inertNodes.forEach(([element,wasInert])=>{if(element.isConnected){element.inert=wasInert;if(!wasInert)element.removeAttribute('inert');}});
    if(session.preview&&session.previousFocus?.isConnected)session.previousFocus.focus({preventScroll:true});
  }
  function getComboCinematicMotion(){return motionPreference;}
  function setComboCinematicMotion(mode){if(!['system','full','reduced'].includes(mode))return false;motionPreference=mode;return mode;}
  function copyTarget(source,index){
    const maxHp=Math.max(1,number(source.maxHp),number(source.hpBefore),number(source.hpAfter));
    return {uid:String(source.uid??index),name:String(source.name||'目标'),art:String(source.art||''),side:['ally','summon'].includes(source.side)?source.side:'enemy',
      hpBefore:number(source.hpBefore),hpAfter:number(source.hpAfter),maxHp,shieldBefore:number(source.shieldBefore),shieldAfter:number(source.shieldAfter),
      aliveBefore:source.aliveBefore!==false,aliveAfter:source.aliveAfter!==false,labels:Array.isArray(source.labels)?source.labels.map(String):[]};
  }
  function targetFeedback(target,preview){
    const parts=[],damage=target.hpBefore-target.hpAfter,shield=target.shieldAfter-target.shieldBefore;
    if(target.side==='summon'&&target.labels.includes('召唤入场'))parts.push(`召唤入场 · 生命 ${format(target.hpAfter)}`);
    else if(!target.aliveBefore&&target.aliveAfter)parts.push(`复苏 +${format(target.hpAfter)}`);
    else if(damage>0)parts.push(`生命 −${format(damage)}`);
    else if(damage<0)parts.push(`治疗 +${format(-damage)}`);
    if(shield>0)parts.push(`护盾 +${format(shield)}`);
    else if(shield<0)parts.push(`护盾减少 ${format(-shield)}`);
    if(!parts.length&&target.labels.length)parts.push(target.labels.join(' · '));
    if(!parts.length)parts.push('状态无变化');
    return `${preview?'演示 · ':''}${parts.join(' · ')}`;
  }
  function summaryText(summary,targets,preview){
    const parts=[];
    if(number(summary.damage)>0)parts.push(`生命伤害 ${format(summary.damage)}`);
    if(number(summary.healing)>0)parts.push(`治疗 ${format(summary.healing)}`);
    if(number(summary.shieldGain)>0)parts.push(`新增护盾 ${format(summary.shieldGain)}`);
    if(number(summary.revived)>0)parts.push(`复苏 ${format(summary.revived)} 名`);
    if(number(summary.summonsAdded)>0)parts.push(`新增召唤 ${format(summary.summonsAdded)} 名`);
    if(!parts.length)parts.push(targets.length?'目标状态见上方反馈':'未提供目标结算快照');
    return `${preview?'演示数值 · ':'实际结算 · '}${parts.join('　·　')}`;
  }
  function makeMeter(className,label,max,current){
    const meter=node('div',className);meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',label);meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',String(max));
    const fill=node('i',`${className}-fill`),text=node('span',`${className}-text`);meter.append(fill,text);
    const record={meter,fill,text,max};updateMeter(record,current);return record;
  }
  function updateMeter(record,value){
    const whole=Math.round(Math.max(0,Math.min(record.max,value)));
    record.meter.setAttribute('aria-valuenow',String(whole));record.fill.style.width=`${clamp(value/record.max)*100}%`;
    const full=`${format(whole)} / ${format(record.max)}`;
    record.meter.title=full;record.text.textContent=full;
    if(record.meter.clientWidth>0&&record.text.scrollWidth>record.meter.clientWidth){record.text.textContent=format(whole);record.meter.dataset.numberFormat='current';}
    else record.meter.dataset.numberFormat='current-and-max';
  }
  function createTarget(target,session){
    const card=node('article','combo-target');card.dataset.targetUid=target.uid;card.dataset.side=target.side;
    const tag=node('span','combo-target-tag',session.preview?(target.side==='enemy'?'训练靶 · 演示':'训练队员 · 演示'):(target.side==='enemy'?'敌方目标':target.side==='summon'?'己方召唤':'己方目标'));
    const name=node('h3','combo-target-name',target.name),figure=node('div','combo-target-figure');
    const art=node('img','combo-target-art');if(target.art)art.src=target.art;else art.hidden=true;art.alt=target.name;art.decoding='async';figure.append(art);
    const silhouette=node('span','combo-target-silhouette',target.side==='enemy'?'◇':'✦');silhouette.setAttribute('aria-hidden','true');figure.append(silhouette);
    const hp=makeMeter('combo-target-hp',`${session.preview?'演示 ':''}${target.name}生命`,target.maxHp,target.hpBefore);
    const shield=makeMeter('combo-target-shield',`${session.preview?'演示 ':''}${target.name}护盾`,Math.max(target.maxHp,target.shieldBefore,target.shieldAfter),target.shieldBefore);
    shield.meter.hidden=target.shieldBefore===0&&target.shieldAfter===0;
    const feedback=node('p','combo-target-feedback',targetFeedback(target,session.preview));
    const labels=node('p','combo-target-status',target.labels.join(' · ')||(!target.aliveAfter?'倒下':' '));
    const before=node('span','combo-target-before',`${session.preview?'演示 ':''}施放前 ${format(target.hpBefore)} 生命${target.shieldBefore?` · ${format(target.shieldBefore)} 盾`:''}`);
    const figureHost=node('div','combo-target-figure-host');figureHost.append(figure);
    card.append(figureHost,name,tag,hp.meter,shield.meter,before,feedback,labels);
    return {card,target,figure,figureHost,hp,shield,feedback,labels};
  }
  function point(element,rect){const box=element.getBoundingClientRect();return {x:box.left+box.width/2-rect.left,y:box.top+box.height/2-rect.top};}
  function contentPoint(element,arena){const p=point(element,arena.getBoundingClientRect());return {x:p.x+arena.scrollLeft,y:p.y+arena.scrollTop};}
  function effectRole(target){return target.side==='enemy'?'attack':target.side==='summon'&&target.labels.includes('召唤入场')?'summon':target.shieldAfter>target.shieldBefore?'shield':'heal';}
  function visibleTargets(targets){
    if(targets.length<=3)return targets;
    const priority=target=>effectRole(target)==='summon'?4:!target.aliveBefore&&target.aliveAfter?3:target.hpAfter>target.hpBefore||target.shieldAfter>target.shieldBefore?2:1;
    const enemies=targets.filter(target=>target.side==='enemy'),allies=targets.filter(target=>target.side!=='enemy').sort((a,b)=>priority(b)-priority(a));
    // Mixed ultimates must visibly show their allied branch, not hide it behind three enemy cards.
    if(enemies.length&&allies.length){const visibleEnemies=enemies.slice(0,2);return [...visibleEnemies,...allies.slice(0,3-visibleEnemies.length)];}
    return (enemies.length?enemies:allies).slice(0,3);
  }
  function setPoint(element,p){element.style.left=`${p.x}px`;element.style.top=`${p.y}px`;}
  function castingMatte(root,background){
    // Runtime material key, not a rewritten asset. Only the narrowly sampled
    // navy backdrop is removed; luminance/screen blending would erase dark armor.
    // SVG compositing also works for the offline file:// build without pixel reads.
    const ns='http://www.w3.org/2000/svg',make=(tag,attributes)=>{const element=document.createElementNS(ns,tag);Object.entries(attributes||{}).forEach(([key,value])=>element.setAttribute(key,String(value)));return element;};
    const rgb=/^#[\da-f]{6}$/i.test(background)?[1,3,5].map(offset=>parseInt(background.slice(offset,offset+2),16)):[5,15,26];
    const svg=make('svg',{width:0,height:0,'aria-hidden':'true',focusable:'false'}),defs=make('defs'),filter=make('filter',{id:'combo-casting-matte','color-interpolation-filters':'sRGB',x:'0%',y:'0%',width:'100%',height:'100%'});
    svg.style.cssText='position:absolute;pointer-events:none;overflow:hidden';
    const transfer=make('feComponentTransfer',{in:'SourceGraphic',result:'keyDistance'});
    ['R','G','B'].forEach((channel,index)=>transfer.append(make('feFunc'+channel,{type:'discrete',tableValues:Array.from({length:256},(_,value)=>clamp((Math.abs(value-rgb[index])-5)/7).toFixed(3)).join(' ')})));
    transfer.append(make('feFuncA',{type:'identity'}));filter.append(transfer);
    filter.append(make('feColorMatrix',{in:'keyDistance',type:'matrix',values:'0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 0',result:'keyAlpha'}));
    filter.append(make('feComposite',{in:'SourceGraphic',in2:'keyAlpha',operator:'in'}));
    defs.append(filter);svg.append(defs);root.append(svg);
  }
  function poseFrame(time){return time<1400?0:time<3200?1:time<5000?2:3;}
  function updateCasters(session,time){
    const pose=session.reduced?3:poseFrame(time);
    session.casters.forEach((caster,index)=>{
      if(caster.sheet&&caster.portrait.naturalWidth&&caster.portrait.naturalHeight)caster.figure.style.setProperty('--casting-aspect',String((caster.portrait.naturalWidth/4)/(caster.portrait.naturalHeight/2)));
      const local=pose===0?ease(time/1400):pose===1?ease((time-1400)/900):pose===2?ease((time-3200)/320):1-ease((time-5000)/1000);
      const advance=pose===2?local*13:pose===3?local*13:pose===1?local*3:0;
      const lift=pose===0?4*(1-local):pose===1?-local*3:pose===2?-3:0;
      const direction=window.innerWidth<=700&&index===1?-1:1;
      caster.figure.style.transform=session.reduced?'none':`translate(${advance*direction}px,${lift}px) rotate(${(pose===2?2.5*local:pose===3?local*2.5:0)*direction}deg)`;
      caster.card.dataset.pose=String(pose);caster.sprite.dataset.pose=String(pose);caster.card.classList.toggle('casting',pose<3);
      caster.card.dataset.facing=direction===1?'right':'left';
      caster.card.dataset.action=['蓄势','双人汇聚','协同发招','收势'][pose];
      if(caster.sheet){caster.portrait.style.left=`${-pose*100}%`;caster.portrait.style.top=`${-caster.row*100}%`;}
      const anchor=caster.anchors[pose]||[.75,.43];
      caster.emitter.style.left=`${clamp(Number(anchor[0]))*100}%`;caster.emitter.style.top=`${clamp(Number(anchor[1]))*100}%`;
      caster.emitter.style.opacity=session.reduced||time>=5000?'0':String(.55+Math.sin(time/150+index)*.2);
    });
  }
  function measureGeometry(session,time){
    const {arena}=session,width=arena.clientWidth;
    const groups=[session.casters[0]?.card.parentElement,session.manifestSpace,session.targetNodes[0]?.card.parentElement].filter(Boolean);
    const height=Math.max(arena.clientHeight,...groups.map(group=>group.offsetTop+group.offsetHeight+12));
    session.canvas.style.width=`${width}px`;session.canvas.style.height=`${height}px`;
    arena.style.setProperty('--arena-scene-height',`${height}px`);
    const sources=session.casters.map(caster=>{const box=caster.figure.getBoundingClientRect(),p=contentPoint(caster.figure,arena);return {...contentPoint(caster.emitter,arena),ground:{x:p.x,y:p.y+box.height*.36},characterId:caster.characterId,row:caster.row,pose:Number(caster.card.dataset.pose)};});
    const center=sources.length?{x:sources.reduce((sum,p)=>sum+p.x,0)/sources.length,y:sources.reduce((sum,p)=>sum+p.y,0)/sources.length}:contentPoint(session.manifestSpace,arena);
    const targetPoints=session.targetNodes.map((record,index)=>{
      const box=record.figureHost.getBoundingClientRect(),center=contentPoint(record.figureHost,arena),role=effectRole(record.target);
      const ground={x:center.x,y:center.y+box.height/2-8};
      return {x:center.x,y:role==='heal'||role==='summon'?ground.y:center.y,
        ground,bounds:{x:center.x-box.width/2,y:center.y-box.height/2,width:box.width,height:box.height},
        uid:record.target.uid,role,side:record.target.side,aliveBefore:record.target.aliveBefore,aliveAfter:record.target.aliveAfter,
        hpBefore:record.target.hpBefore,hpAfter:record.target.hpAfter,shieldBefore:record.target.shieldBefore,shieldAfter:record.target.shieldAfter,strike:4700+index*110};
    });
    const preferred=targetPoints.filter(target=>target.role==='attack'),receivers=preferred.length?preferred:targetPoints;
    const destination=receivers.length?{x:receivers.reduce((sum,p)=>sum+p.x,0)/receivers.length,y:receivers.reduce((sum,p)=>sum+p.y,0)/receivers.length}:{x:center.x+120,y:center.y};
    const dx=destination.x-center.x,dy=destination.y-center.y,distance=Math.max(1,Math.hypot(dx,dy));
    // The fusion seal is downstream of the actual hand/weapon emitters, never a screen-fixed point.
    const reach=Math.min(distance*.43,window.innerWidth<=700?210:220),desiredFusion={x:center.x+dx/distance*reach,y:center.y+dy/distance*reach};
    // The enlarged forming material has a real, measured staging volume. On
    // phones it sits between the pair and targets, clear of both sets of labels.
    if(window.innerWidth<=700){
      const gap=contentPoint(session.manifestSpace,arena);
      desiredFusion.x=gap.x;desiredFusion.y=gap.y;
    }
    const layoutKey=`${width}:${arena.clientHeight}:${height}`;
    if(!session.fusionMemory||session.geometryLayout!==layoutKey){session.fusionMemory={...desiredFusion};session.geometryLayout=layoutKey;}
    else if(time<3200){const blend=ease(Math.max(0,time-(session.geometryTime||0))/350);session.fusionMemory.x+=(desiredFusion.x-session.fusionMemory.x)*blend;session.fusionMemory.y+=(desiredFusion.y-session.fusionMemory.y)*blend;}
    // Once released, the seal remains planted: a caster recovering their weapon cannot drag the projectile origin.
    const fusion={...session.fusionMemory};session.geometryTime=time;
    const curve=width>700?38:24;
    const targets=targetPoints.map(target=>{const progress=clamp((time-3200)/(target.strike-3200));return {...target,start:{...fusion},progress,head:route(fusion,target,progress,curve)};});
    const primary=targets.find(target=>target.role==='attack')||targets[0];
    const entity={...fusion};
    const manifestRadius=window.innerWidth<=700?Math.min(104,width*.29):Math.min(138,width*.16,arena.clientHeight*.3);
    session.geometry={width,height,time,sources,fusion,targets,entity,curve,manifestRadius,primaryUid:primary?.uid||null};
    if(window.ComboChoreography){
      session.choreography=window.ComboChoreography.sample(session.geometry,session.motion,time,{artVariant:session.rig?.combat?.variant,facingState:(session.facingState ||= {})});
      session.geometry.choreography=session.choreography;
      targets.forEach((target,index)=>Object.assign(target,session.choreography.attacks[index]));
    }
    setPoint(session.fusionAnchor,fusion);session.fusionAnchor.style.opacity=session.reduced||time>=5000?'0':String(time<1400?ease(time/1000)*.6:.75);
    targets.forEach((target,index)=>{const marker=session.targetNodes[index].flightHead;setPoint(marker,target.head);marker.dataset.effectRole=target.role;marker.dataset.progress=String(target.progress);marker.style.opacity='0';session.targetNodes[index].card.dataset.effectRole=target.role;session.targetNodes[index].card.dataset.strike=String(target.strike);});
    session.root.dataset.geometry=JSON.stringify(session.geometry);
    return session.geometry;
  }
  function route(start,end,p,curve){return {x:start.x+(end.x-start.x)*p,y:start.y+(end.y-start.y)*p-Math.sin(p*Math.PI)*curve};}
  function drawCanvas(session,time){
    // No illustration-plane fallback: if the VFX module is unavailable, readable
    // poses and the exact result snapshot still complete without a fake giant image.
    if(window.ComboStageVFX&&typeof window.ComboStageVFX.draw==='function')window.ComboStageVFX.draw(session,time);
  }
  function updateEnvironment(session,time){
    const engine=window.ComboEnvironment;if(!engine)return;
    const sample=engine.sample(session.motion,time,{reduced:session.reduced});
    session.environmentSample=sample;session.root.dataset.environment=JSON.stringify(sample);
    if(!session.preview&&!session.environmentReleased)engine.syncBattle(session.motion,time,{token:session.environmentToken,reduced:session.reduced,now:session.start+time});
    const {width,height}=session.geometry,canvas=session.environmentCanvas,ctx=session.environmentCtx;
    const ratio=Math.min(2,window.devicePixelRatio||1),w=Math.round(width*ratio),h=Math.round(height*ratio);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    if(session.reduced)return;
    const grounds=[...session.geometry.sources.map(source=>source.ground.y),...session.geometry.targets.map(target=>target.ground.y)];
    const groundY=window.innerWidth<=700?height*.52:grounds.reduce((sum,y)=>sum+y,0)/Math.max(1,grounds.length);
    engine.draw(ctx,{width,height,groundY},sample,time);
  }
  function updateStageLight(session,time){
    // A localized floor reflection ties the forming material to the existing
    // battlefield. One smooth swell, never full-screen exposure or flashing.
    const {fusion,manifestRadius}=session.geometry;
    const buildup=ease((time-900)/1900),release=1-ease((time-3200)/850);
    const power=session.reduced?0:Math.max(buildup*release,(session.environmentSample?.strength||0)*.45);
    const radiance=session.radiance;
    radiance.style.left=`${fusion.x}px`;radiance.style.top=`${fusion.y+manifestRadius*.62}px`;
    radiance.style.width=`${manifestRadius*3}px`;radiance.style.height=`${manifestRadius*.72}px`;
    radiance.style.opacity=String(power*.64);
    session.casters.forEach(caster=>{caster.figure.style.filter=power>.001?`brightness(${1+power*.16})`:'none';});
  }
  function updateStage(session,time){
    const {arena}=session,narrow=window.innerWidth<=700;
    session.root.dataset.camera=session.reduced?'static':session.manualCamera?'manual':'follow';
    session.root.dataset.cameraManual=String(session.manualCamera);
    const percent=clamp(time/DURATION)*100;
    session.progress.style.setProperty('--stage-progress',percent+'%');
    session.progress.setAttribute('aria-valuenow',String(Math.round(percent)));
    session.progress.setAttribute('aria-valuetext',session.stageLabel.textContent);
    // Show the pair first, then ease the expanded formation into view; continue
    // from that same camera position toward the receivers after the launch.
    if(narrow&&!session.reduced&&!session.manualCamera){
      const group=session.targetNodes[0]?.card.parentElement;
      const top=group?Math.max(0,group.offsetTop-18):0;
      const formationTop=Math.max(0,session.geometry.fusion.y+session.geometry.manifestRadius*1.08-arena.clientHeight+24);
      const formationFollow=formationTop*ease((time-1900)/1100);
      // Hold the opening action, then follow its actual emitted material before
      // framing the hit. Never cut away from the mouth/wing as it starts moving.
      const primary=session.geometry.targets.find(target=>target.uid===session.choreography?.caster?.facingTargetUid)
        ||session.geometry.targets.find(target=>target.role==='attack')||session.geometry.targets[0];
      const flightTop=primary?Math.max(formationTop,Math.min(top,primary.head.y-arena.clientHeight*.48)):formationTop;
      const follow=time<3550?formationFollow:flightTop+(top-flightTop)*ease((time-3850)/850);
      arena.scrollTop=Math.min(Math.max(0,arena.scrollHeight-arena.clientHeight),follow);
    }
  }
  function renderFrame(session,elapsed){
    const time=Math.max(0,Math.min(elapsed,session.duration)),effective=session.reduced?DURATION:time;
    const stageIndex=session.reduced?5:STAGE_STARTS.reduce((index,start,next)=>time>=start?next:index,0),stage=STAGES[stageIndex][0];
    session.root.dataset.stage=stage;session.root.dataset.elapsed=String(Math.round(time));session.root.dataset.frame=String(++session.frame);
    session.stageLabel.textContent=STAGES.find(entry=>entry[0]===stage)[1];
    updateCasters(session,effective);measureGeometry(session,effective);updateStage(session,effective);updateEnvironment(session,effective);updateStageLight(session,effective);
    session.targetNodes.forEach((record,index)=>{
      const {target}=record,damage=target.hpBefore>target.hpAfter||target.shieldBefore>target.shieldAfter;
      const strike=session.geometry.targets[index].strike,progress=session.reduced?1:ease((time-strike)/1150);
      updateMeter(record.hp,target.hpBefore+(target.hpAfter-target.hpBefore)*progress);updateMeter(record.shield,target.shieldBefore+(target.shieldAfter-target.shieldBefore)*progress);
      const recoil=!session.reduced&&damage&&time>=strike&&time<strike+800?Math.sin((time-strike)/45)*(1-clamp((time-strike)/800)):0;
      record.figure.style.transform=`translate(${recoil*12}px,${Math.abs(recoil)*3}px) rotate(${recoil*7}deg)`;
      record.figure.style.filter=!session.reduced&&time>=strike&&time<strike+500?`brightness(${1+(1-clamp((time-strike)/500))*1.1})`:'none';
      record.figure.style.opacity=String(!target.aliveBefore&&effective<strike?.3:(!target.aliveAfter&&effective>=6200?.4:1));
      record.card.classList.toggle('impacted',effective>=strike);record.card.classList.toggle('defeated',!target.aliveAfter&&effective>=6200);
      record.feedback.style.opacity=effective>=strike?'1':'0';record.labels.style.opacity=effective>=6200?'1':'0';
    });
    const resultReady=effective>=6200;session.summary.classList.toggle('revealed',resultReady);
    const summary=resultReady?session.resultText:(session.preview?'演示数值 · 不消耗道具':'本次合击 · 实际结算');
    if(session.summary.textContent!==summary)session.summary.textContent=summary;
    if(!session.reduced)drawCanvas(session,time);
  }
  function finish(session,reason='finished'){
    if(active!==session||session.finished)return;
    if(session.raf!==null)window.cancelAnimationFrame(session.raf);session.raf=null;
    if(session.timer!==null)window.clearTimeout(session.timer);session.timer=null;
    if(reason==='skipped')session.manualCamera=false;
    renderFrame(session,session.duration);session.finished=true;session.root.dataset.finished='true';session.root.setAttribute('aria-busy','false');
    if(!session.preview){
      // Skips/reduced motion clear immediately; only the complete performance
      // leaves a short environmental afterglow on the real battle canvas.
      window.ComboEnvironment?.releaseBattle({cancelled:reason==='skipped'||session.reduced,token:session.environmentToken});session.environmentReleased=true;
      const callback=session.onComplete;clearComboCinematic();if(typeof callback==='function')callback({reason,duration:session.duration,motion:session.motion});
    }
  }
  function playComboCinematic(recipe,participants,options={}){
    clearComboCinematic();
    const safeRecipe=recipe||{},motion=Object.hasOwn(MOTIONS,safeRecipe.motion)?safeRecipe.motion:Object.hasOwn(MOTIONS,safeRecipe.theme)?safeRecipe.theme:'phoenix',palette=MOTIONS[motion];
    const requestedMode=options.motionMode&&options.motionMode!=='system'?options.motionMode:motionPreference;
    const preview=options.preview===true,reduced=requestedMode==='reduced'||requestedMode!=='full'&&Boolean(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches),duration=reduced?REDUCED_DURATION:DURATION;
    const targets=(Array.isArray(options.targets)?options.targets:[]).map(copyTarget),summary={...(options.summary||{})};
    const units=(Array.isArray(participants)?participants:[]).filter(Boolean).slice(0,2).map(unit=>({characterId:String(unit.characterId||unit.id||''),name:String(unit.name||'合击成员'),art:String(unit.art||'')}));
    const casting=options.casting||safeRecipe.casting||{},rig=options.rig||safeRecipe.rig||{};
    const root=node('div',`combo-cinematic combo-cinematic-v3 combo-epic combo-stage-v5 combo-art-v7 combo-motion-${motion}${preview?' combo-is-preview':''}${reduced?' combo-cinematic-reduced':''}`);
    root.id='combo-cinematic';root.dataset.renderer='art-rig-v7';root.dataset.motion=motion;root.dataset.preview=String(preview);root.dataset.finished='false';root.dataset.duration=String(duration);root.dataset.motionMode=reduced?'reduced':'full';root.setAttribute('aria-busy','true');
    root.dataset.rigSource=rig.src||'';
    root.style.setProperty('--combo-light',palette.light);root.style.setProperty('--combo-shadow',palette.shadow);
    root.style.setProperty('--combo-stage-bg',String(casting.background||'#07121f'));
    castingMatte(root,String(casting.background||'#05101b'));
    root.setAttribute('role',preview?'dialog':'status');root.setAttribute('aria-labelledby','combo-cinematic-title');if(preview){root.setAttribute('aria-modal','true');root.tabIndex=-1;}
    const shell=node('div','combo-impact-shell'),header=node('header','combo-impact-header'),identity=node('div','combo-impact-identity');
    const heading=node('div','combo-impact-heading'),kicker=node('p','combo-cinematic-kicker',preview?'合击演练 · 演示数值':'契约合击 · 实际结算'),title=node('h2','combo-cinematic-title',safeRecipe.name||'契约合击');title.id='combo-cinematic-title';
    const stageLabel=node('span','combo-current-stage','双人蓄力');heading.append(kicker,title);identity.append(heading,stageLabel);header.append(identity);
    const progress=node('div','combo-stage-progress');progress.setAttribute('role','progressbar');
    progress.setAttribute('aria-label','合击演出进度');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');header.append(progress);
    const arena=node('div','combo-combat-arena'),castersHost=node('div','combo-caster-team'),targetsHost=node('div','combo-target-team');targetsHost.dataset.targetCount=String(Math.min(3,targets.length));
    const manifestSpace=node('div','combo-manifest-space');manifestSpace.setAttribute('aria-hidden','true');
    const scene=node('img','combo-stage-backdrop');scene.src=!preview&&options.sceneArt?options.sceneArt:COMBO_STAGE_ART.arena;scene.alt='';scene.setAttribute('aria-hidden','true');
    root.dataset.sceneArt=scene.getAttribute('src');
    const environmentCanvas=node('canvas','combo-environment-canvas');environmentCanvas.setAttribute('aria-hidden','true');
    const radiance=node('div','combo-stage-radiance');radiance.setAttribute('aria-hidden','true');
    const vfxTexture=new Image();vfxTexture.src=COMBO_STAGE_ART.texture;vfxTexture.decoding='async';
    const rigImage=new Image();if(rig.src)rigImage.src=rig.src;rigImage.decoding='async';
    const combatImage=new Image();if(rig.combat?.src)combatImage.src=rig.combat.src;combatImage.decoding='async';
    const attackImage=new Image();attackImage.src=COMBO_STAGE_ART.attack;attackImage.decoding='async';
    const casters=units.map((unit,index)=>{
      const members=Array.isArray(casting.members)?casting.members:[],matched=members.findIndex(member=>String(member.id)===unit.characterId),row=matched>=0?matched:index,member=members[row]||{};
      const card=node('div','combo-caster'),ground=node('div','combo-caster-ground'),figure=node('div','combo-caster-figure combo-cinematic-participant'),sprite=node('div','combo-casting-sprite'),portrait=node('img','combo-participant-art'),emitter=node('span','combo-cast-emitter');
      const sheet=Boolean(casting.src&&members.length&&matched>=0);
      portrait.src=sheet?casting.src:unit.art;portrait.alt=`${unit.name} · 合击动作`;portrait.decoding='async';
      if(sheet){portrait.classList.add('combo-casting-sheet');portrait.style.filter='url(#combo-casting-matte)';card.classList.add('has-casting-sheet');}
      card.dataset.characterId=unit.characterId;card.dataset.castingRow=String(row);sprite.dataset.castingRow=String(row);sprite.dataset.castingSrc=sheet?casting.src:'';
      sprite.append(portrait,emitter);figure.append(sprite);ground.setAttribute('aria-hidden','true');emitter.setAttribute('aria-hidden','true');
      card.dataset.participant=String(index);card.append(ground,figure,node('p','combo-participant-name',unit.name));castersHost.append(card);
      return {card,figure,sprite,portrait,emitter,characterId:unit.characterId,row,sheet,anchors:Array.isArray(member.anchors)?member.anchors:[[.75,.43],[.75,.43],[.75,.43],[.75,.43]]};
    });
    const fusionAnchor=node('span','combo-fusion-anchor');fusionAnchor.setAttribute('aria-hidden','true');
    const canvas=node('canvas','combo-cinematic-canvas');canvas.dataset.renderer=motion;canvas.setAttribute('aria-hidden','true');
    const footer=node('footer','combo-impact-footer'),result=node('p','combo-cinematic-summary');result.id='combo-cinematic-summary';result.setAttribute('aria-live','polite');
    const targetCount=node('p','combo-target-total',targets.length?`共 ${targets.length} 个受影响目标${targets.length>3?' · 展示其中 3 个，汇总包含全部目标':''}`:'等待目标快照');
    targetCount.hidden=targets.length>0&&targets.length<=3;
    const disclaimer=node('p','combo-demo-disclaimer',preview?'演示数值，不消耗道具、能量或次数。':'本次真实结算，动画不重复扣费。');
    footer.append(result,targetCount,disclaimer);
    const controls=node('div','combo-preview-controls'),replay=node('button','btn combo-preview-replay','↻ 重播'),close=node('button','btn primary combo-preview-close','✕ 关闭');
    const skip=node('button','btn combo-skip',preview?'查看结果':'跳过演出');skip.type='button';skip.id=preview?'combo-preview-skip':'combo-battle-skip';
    const modeControls=node('div','combo-motion-controls'),fullButton=node('button','btn combo-motion-choice','完整演出'),reducedButton=node('button','btn combo-motion-choice','减少动态');
    fullButton.type='button';fullButton.id='combo-motion-full';fullButton.setAttribute('aria-pressed',String(!reduced));reducedButton.type='button';reducedButton.id='combo-motion-reduced';reducedButton.setAttribute('aria-pressed',String(reduced));
    modeControls.append(fullButton,reducedButton);replay.type='button';replay.id='combo-preview-replay';close.type='button';close.id='combo-preview-close';
    if(preview){controls.append(skip,replay,close);footer.append(modeControls,controls);}else{controls.className='combo-battle-controls';controls.append(skip);footer.append(controls);}
    const session={root,arena,radiance,environmentCanvas,environmentCtx:environmentCanvas.getContext('2d'),manifestSpace,casting,rig,rigImage,combatImage,rigCells:[],attackImage,attackCells:[],vfxTexture,fusionAnchor,canvas,ctx:canvas.getContext('2d'),palette,motion,preview,reduced,duration,targets,casters,targetNodes:[],stageLabel,progress,summary:result,resultText:summaryText(summary,targets,preview),raf:null,timer:null,frame:0,finished:false,inertNodes:[],previousFocus:document.activeElement,keydown:null,userCamera:null,manualCamera:false,resize:null,onComplete:options.onComplete,start:0};
    session.targetNodes=visibleTargets(targets).map(target=>createTarget(target,session));session.targetNodes.forEach(record=>{record.flightHead=node('span','combo-flight-head');record.flightHead.dataset.targetUid=record.target.uid;record.flightHead.setAttribute('aria-hidden','true');targetsHost.append(record.card);});
    if(!targets.length)targetsHost.append(node('p','combo-target-empty','本次没有可展示的目标快照'));
    arena.append(scene,environmentCanvas,radiance,castersHost,manifestSpace,targetsHost,canvas,fusionAnchor,...session.targetNodes.map(record=>record.flightHead));shell.append(header,arena,footer);root.append(shell);
    const host=document.getElementById('game')||document.body;host.append(root);active=session;
    if(preview){
      [...host.children].filter(element=>element!==root&&element instanceof HTMLElement).forEach(element=>{session.inertNodes.push([element,element.inert]);element.inert=true;});
      const replaySnapshot=()=>playComboCinematic(safeRecipe,units,{preview:true,targets,summary,casting});
      close.onclick=clearComboCinematic;replay.onclick=replaySnapshot;
      fullButton.onclick=()=>{setComboCinematicMotion('full');replaySnapshot();};reducedButton.onclick=()=>{setComboCinematicMotion('reduced');replaySnapshot();};
      session.userCamera=()=>{session.manualCamera=true;root.dataset.camera='manual';root.dataset.cameraManual='true';};
      arena.addEventListener('wheel',session.userCamera,{passive:true});arena.addEventListener('pointerdown',session.userCamera,{passive:true});arena.addEventListener('touchstart',session.userCamera,{passive:true});
      arena.tabIndex=0;arena.setAttribute('aria-label','演出场景，可滚动查看目标');
      session.keydown=event=>{if(active!==session)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();clearComboCinematic();return;}if(['PageDown','PageUp','ArrowDown','ArrowUp','Home','End'].includes(event.key)&&document.activeElement===arena)session.userCamera();if(event.key==='Tab'){const focusable=[...root.querySelectorAll('button:not([disabled]),[tabindex="0"]')].filter(element=>element.getClientRects().length),first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){event.preventDefault();first.focus();}}};
      document.addEventListener('keydown',session.keydown,true);close.focus({preventScroll:true});
    }
    skip.onclick=event=>{event.preventDefault();event.stopPropagation();finish(session,'skipped');};
    session.resize=()=>{if(active===session)renderFrame(session,session.finished?session.duration:performance.now()-session.start);};window.addEventListener('resize',session.resize);
    session.start=performance.now();
    if(!preview)session.environmentToken=window.ComboEnvironment?.beginBattle(motion,{reduced,now:session.start});
    renderFrame(session,0);
    if(!reduced){const tick=now=>{if(active!==session||session.finished)return;const elapsed=now-session.start;if(elapsed>=duration){finish(session);return;}renderFrame(session,elapsed);session.raf=window.requestAnimationFrame(tick);};session.raf=window.requestAnimationFrame(tick);}
    session.timer=window.setTimeout(()=>finish(session),duration);return duration;
  }
  window.playComboCinematic=playComboCinematic;window.clearComboCinematic=clearComboCinematic;
  window.getComboCinematicMotion=getComboCinematicMotion;window.setComboCinematicMotion=setComboCinematicMotion;
  if(window.SC)Object.assign(window.SC,{getComboCinematicMotion,setComboCinematicMotion});
}());
