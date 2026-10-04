/* v13: observe during playback; issue commands only on a controllable turn.
 * This adapter never resolves actions, consumes resources, or advances a turn. */
(function(){
  'use strict';
  const el=id=>document.getElementById(id),owner='battle-report',tabs=['intel','team','log'];
  const report=el('battle-report-modal'),dock=el('battle-ui'),commands=el('battle-commands');
  let previousFocus=null,ownsPause=false;
  function refresh(){
    if(!dock)return;
    const actor=currentPlayerActor(),live=!!window.LiveCombo?.current;
    const manual=!!actor&&!autoBattle&&!live,selecting=manual&&!!state.target;
    dock.dataset.mode=live?'cinematic':selecting?'target':manual?'command':'observe';
    commands.hidden=!manual;dock.dataset.fusion=String(!!el('skill-bar')?.querySelector('.fuse'));
    el('skill-bar').hidden=selecting;el('target-chips').hidden=!selecting;
    el('combo-battle-btn').parentElement.hidden=!manual||selecting;
    const tip=el('target-tip'),feedback=tip.textContent.trim();
    tip.hidden=!manual||(!selecting&&(!feedback||/^(手动模式|单步模式|选择技能|请选择目标)/.test(feedback)));
    el('battle-command-label').textContent=selecting?(state.target.side==='group'?'确认范围':'选择目标'):manual?'轮到你了':autoBattle?'自动战斗':state.phase==='anim'?'技能演出':'等待己方回合';
    const danger=state.enemies?.some(enemy=>enemy.alive&&(enemy.charging||enemy.coreExposure));
    el('battle-stage').dataset.bossTactics=String(state.enemies?.some(enemy=>enemy.boss&&enemy.intentConfig?.coreExposure)||false);
    el('battle-threat').hidden=!danger||live||selecting;
    // Playing a skill clears the input hit surface even if renderSkillBar exits
    // early. Old target callbacks must never survive an auto/manual transition.
    if(!selecting&&typeof battleCanvas!=='undefined'&&battleCanvas){battleCanvas.onclick=null;battleCanvas.onpointermove=null;battleCanvas.onpointerleave=null;battleCanvas.style.pointerEvents='none';battleCanvas.style.cursor='default';}
    window.BattleDecision?.refresh();
  }
  function selectReportTab(id){
    if(!tabs.includes(id))return false;
    report.querySelectorAll('[data-report-tab]').forEach(node=>{const active=node.dataset.reportTab===id;node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;});
    report.querySelectorAll('[data-report-panel]').forEach(node=>{node.hidden=node.dataset.reportPanel!==id;});
    report.querySelector('.battle-report-body').scrollTop=0;return true;
  }
  function release({restoreFocus=true}={}){
    if(ownsPause){ownsPause=false;window.BattleClock?.resume(owner);}
    const focus=previousFocus;previousFocus=null;
    if(restoreFocus&&focus?.isConnected&&focus.getClientRects().length)focus.focus({preventScroll:true});
  }
  function openReport(id='intel'){
    if(report.open)return selectReportTab(id);
    if(!inBattle||!el('battle-screen').classList.contains('active')||el('battle-screen').inert||state.fusionCtx||['done','decision','intermission'].includes(state.phase))return false;
    if(!tabs.includes(id))return false;
    previousFocus=document.activeElement;selectReportTab(id);ownsPause=!!window.BattleClock?.pause(owner);
    try{updateHUD();updateTurnOrder();updateEnemyIntentUI();report.showModal();el('battle-report-close').focus({preventScroll:true});return true;}catch(error){release();throw error;}
  }
  function closeReport(options={}){const wasOpen=report.open;if(wasOpen)report.close();release(options);return wasOpen;}
  report.addEventListener('cancel',event=>{event.preventDefault();closeReport();});
  report.addEventListener('close',()=>{if(!report.open)release();});
  report.addEventListener('click',event=>{if(event.target!==report)return;const r=report.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeReport();});
  report.querySelectorAll('[data-report-tab]').forEach((node,index)=>{
    node.onclick=()=>selectReportTab(node.dataset.reportTab);
    node.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;selectReportTab(tabs[next]);el('battle-report-tab-'+tabs[next]).focus();};
  });
  // Reserve one stable action-safe floor band, irrespective of whose turn it is.
  // The full scene remains painted behind the dock; portraits never sit beneath it.
  function playfieldHeight(height){const reserve=parseFloat(getComputedStyle(el('battle-stage')).getPropertyValue('--battle-command-reserve'))||176;return Math.max(90,height-Math.min(reserve,height*.55));}
  window.BattleHUD=Object.freeze({refresh,openReport,closeReport,selectReportTab,playfieldHeight});
  Object.assign(window.SC,{BattleHUD:window.BattleHUD});selectReportTab('intel');refresh();
}());
