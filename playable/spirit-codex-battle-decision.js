/* v14: read-only targeting plans; UI confirmation calls the existing resolver.
   Never roll RNG, advance a turn, or consume resources to render a preview. */
(function(){
  'use strict';
  let hovered=null,targetUid=null,lastActor=null,lastToken=null,takeover=null;
  const el=id=>document.getElementById(id),uid=u=>String(u.uid);
  function plan(actor,skill,target=null){
    if(!actor||!skill)return null;
    const enemies=state.enemies.filter(u=>u.alive),allies=state.allies.filter(u=>u.alive),formal=allies.filter(u=>!u.isSummon),marks=[],notes=[];
    const add=(u,role,possible=false)=>{if(u&&!marks.some(m=>m.uid===uid(u)&&m.role===role))marks.push({uid:uid(u),role,possible});};
    let title='';
    if(skill.type==='attack'){
      title=skill.chain?`单体首击 + 随机连锁 ${skill.chain} 次`:'单体攻击';
      if(target&&enemies.includes(target))add(target,'attack');else enemies.forEach(u=>add(u,'attack',true));
      if(skill.chain&&target)enemies.filter(u=>u!==target).forEach(u=>add(u,'attack',skill.chain<enemies.length-1));
    }else if(skill.type==='aoe'){title=`全体攻击 · ${enemies.length} 个敌人`;enemies.forEach(u=>add(u,'attack'));}
    else if(skill.type==='heal'){
      title=skill.single?'单体治疗':skill.revive?'全队治疗 / 复活':'全队治疗';
      (skill.single?(target&&formal.includes(target)?[target]:formal):formal).forEach(u=>add(u,'heal',!!skill.single&&!target));
      if(skill.revive)state.allies.filter(u=>!u.alive&&!u.isSummon).forEach(u=>add(u,'revive'));
      if(skill.cleanse)allies.filter(u=>u.debuffs.length).forEach(u=>add(u,'cleanse'));
    }else if(skill.type==='shield'){
      title='全队护盾';formal.forEach(u=>add(u,'shield'));
      if(skill.name==='冰霜护盾'){
        const priority=enemies.find(u=>canInterruptEnemy(skill,u));(priority?[priority]:enemies).forEach(u=>add(u,'control',true));notes.push(priority?'优先尝试冰冻蓄力目标；并非必定成功':'额外随机选择一名敌人尝试冰冻');
      }
      if(skill.evolutionControl==='frostwave')enemies.forEach(u=>add(u,'control',true));
    }else if(skill.type==='buff'){title=skill.selfOnly?'自身增益':'全队增益';(skill.selfOnly?[actor]:formal).forEach(u=>add(u,'buff'));}
    else if(skill.type==='cleanse'){title=skill.healPct?'全队净化 / 治疗':'全队净化';allies.forEach(u=>add(u,'cleanse'));if(skill.healPct)formal.forEach(u=>add(u,'heal'));}
    else if(skill.type==='summon')title='己方召唤位';
    if(skill.summon){const free=Math.max(0,MAX_ACTIVE_SUMMONS-allies.filter(u=>u.isSummon).length);notes.push(free?`召唤 ${Math.min(free,skill.summonCount||1)} 个${SUMMONS[skill.summon]?.name||'召唤物'}`:'召唤位已满，不能新增召唤物');}
    const control=skillInterruptProfile(skill),focus=target||enemies.find(u=>u.charging);
    if(control&&focus){
      if(focus.boss&&focus.controlResistTurns>0)notes.push(`${focus.name}免疫硬控，还剩 ${focus.controlResistTurns} 次行动`);
      else if(focus.charging)notes.push(`对${focus.name}主动控制约 ${Math.round(skillInterruptChance(skill,focus)*100)}%（含抵抗，不含被动）`);
    }
    if(!control&&focus?.boss&&focus.charging)notes.push(BossTactics.describe(focus));
    if(target?.isEnemy){
      if(target.shield>0)notes.push(`目标有 ${Math.round(target.shield)} 护盾，会先吸收伤害`);
      if(window.BossTactics?.multiplier(actor,target)>1)notes.push(`核心暴露：直接攻击 +${Math.round(target.coreExposure.bonus*100)}%`);
    }
    if(skill.type==='aoe'&&!target){const exposed=enemies.find(u=>window.BossTactics?.multiplier(actor,u)>1);if(exposed)notes.push(`${exposed.name}核心暴露：直接攻击 +${Math.round(exposed.coreExposure.bonus*100)}%`);}
    if(['attack','aoe'].includes(skill.type)){
      const guard=enemies.find(u=>u.guardState?.turns>0);if(guard&&marks.some(m=>m.uid!==uid(guard))){add(guard,'guard',true);notes.push('护卫可能分担同伴伤害');}
    }
    if(skill.hits>1)notes.push(`${skill.hits} 段命中`);
    return {actorUid:uid(actor),skillName:skill.name,title,marks,notes,summon:!!skill.summon};
  }
  function reset(){hovered=null;targetUid=null;takeover=null;lastActor=null;lastToken=null;}
  function current(){
    const actor=currentPlayerActor();if(!actor||autoBattle||el('battle-screen').inert)return null;
    const pending=state.target,skill=pending?.skill||hovered?.skill;
    if(!skill||(!pending&&hovered?.actor!==actor))return null;
    const target=[...state.allies,...state.enemies].find(u=>uid(u)===targetUid);
    return plan(actor,skill,target);
  }
  function refreshPreview(){
    // Hover only paints the range. Inserting text during pointer-down would
    // move the command under the pointer, especially on a two-column phone.
    const node=el('skill-preview');if(!node)return;const p=state.target?current():null;node.hidden=!p;
    if(!p)return;
    node.textContent=`${p.title}${p.marks.some(m=>m.possible)?'（虚线为候选/概率目标）':''}${p.notes.length?' · '+p.notes.join('；'):''}`;
    node.dataset.kind=p.marks.some(m=>m.role==='attack')?'attack':'support';
    node.title='实线：指定作用范围；虚线：待选或概率目标。实际命中受死亡、闪避和抵抗影响。';
  }
  function selectTarget(unit){targetUid=unit?uid(unit):null;refreshPreview();}
  function bind(){
    const actor=currentPlayerActor();
    if(lastActor!==actor||lastToken!==state.battleToken){hovered=null;targetUid=null;lastActor=actor;lastToken=state.battleToken;if(takeover?.token!==state.battleToken)takeover=null;}
    el('skill-bar')?.querySelectorAll('.skill-btn:not(.fuse)').forEach((button,index)=>{
      const skill=actor?.skills[index];button.onmouseenter=button.onfocus=()=>{hovered={actor,skill};refreshPreview();};
      button.onmouseleave=button.onblur=()=>{hovered=null;refreshPreview();};
    });refreshPreview();
  }
  function confirmGroup(){
    const pending=state.target,actor=currentPlayerActor();
    if(autoBattle||pending?.side!=='group'||actor!==pending.unit||!isSkillReady(actor,pending.skill,skillIndexOf(actor,pending.skill)))return false;
    state.target=null;state.selSkill=null;hovered=null;targetUid=null;el('target-chips').innerHTML='';return executePlayerSkill(actor,pending.skill,null);
  }
  function opportunities(){
    if(!state.run||!['player','enemy','anim'].includes(state.phase)||!state.enemies.some(u=>u.alive))return [];
    const members=comboFormalMembers(),out=[];
    for(const recipe of COMBO_RECIPES){for(const actor of members){if(!recipe.memberIds.includes(comboCharacterId(actor)))continue;
      const result=comboAvailability(recipe,actor,{ignoreTurn:true});if(result.ready){out.push({recipe,actor,now:comboAvailability(recipe,currentPlayerActor()).ready});break;}
    }}return out;
  }
  function takeOverCombo(){
    if(!autoBattle||el('battle-screen').inert||el('battle-report-modal').open)return false;
    const first=opportunities()[0];if(!first)return false;
    takeover={recipeId:first.recipe.id,token:state.battleToken};setAutoBattle(false);
    if(currentPlayerActor()){takeover=null;openComboModal();}
    refresh();return true;
  }
  function onPlayerTurn(){
    if(!takeover||takeover.token!==state.battleToken)return false;
    const id=takeover.recipeId;takeover=null;
    if(!autoBattle&&comboAvailability(id,currentPlayerActor()).ready)return openComboModal();
    if(!autoBattle)setTip('已接管；合击需对应成员行动且仍满足前置。');return false;
  }
  function refresh(){
    const node=el('combo-opportunity');if(node){
      const list=autoBattle&&!el('battle-screen').inert?opportunities():[];
      node.hidden=!list.length&&!takeover;node.disabled=!!takeover;
      node.textContent=takeover?'已接管 · 等待己方回合':list.length?`${list.some(x=>x.now)?'合击就绪':'合击条件已备'} · 接管`:'';
      node.title=list.map(x=>x.recipe.name).join('、')+'；接管不扣道具，确认施放才消耗';
    }
    const boss=state.enemies.find(u=>u.alive&&u.boss),summary=el('battle-intel-summary');
    if(boss&&(boss.charging||boss.coreExposure)&&summary)summary.textContent=BossTactics.describe(boss);
    const detail=el('boss-tactical-detail');if(detail){detail.hidden=!boss?.intentConfig?.coreExposure;detail.textContent=boss?BossTactics.describe(boss):'';}
    refreshPreview();
  }
  function draw(ctx,now){
    const p=current();if(!p)return;
    ctx.save();
    for(const mark of p.marks){const u=[...state.allies,...state.enemies].find(u=>uid(u)===mark.uid);if(!u)continue;
      const r=u._r||20,x=u._x,y=u._y+r*.72;
      ctx.strokeStyle=mark.role==='attack'?'#ffb785':mark.role==='control'?'#bbaaff':mark.role==='shield'||mark.role==='guard'?'#ffe2a0':'#91efcc';
      ctx.globalAlpha=mark.possible?.65:1;ctx.lineWidth=mark.possible?2:3;ctx.setLineDash(mark.possible?[5,5]:[]);
      ctx.beginPath();ctx.ellipse(x,y,r*1.38,r*.48,0,0,Math.PI*2);ctx.stroke();
      if(!mark.possible){ctx.beginPath();ctx.moveTo(x-5,y+9);ctx.lineTo(x,y+4);ctx.lineTo(x+5,y+9);ctx.stroke();}
    }
    if(p.summon){ctx.strokeStyle='#ba9bff';ctx.setLineDash([4,4]);const h=BattleHUD.playfieldHeight(BH);ctx.strokeRect(BW*.36,h*.28,BW*.1,h*.42);}
    ctx.restore();
  }
  window.BattleDecision=Object.freeze({plan,current,bind,refresh,reset,selectTarget,confirmGroup,opportunities,takeOverCombo,onPlayerTurn,draw});
  if(window.SC)Object.assign(SC,{BattleDecision:window.BattleDecision,BossTactics:window.BossTactics});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{el('battle-stage').style.setProperty('--battle-dock-height',el('battle-ui').getBoundingClientRect().height+'px');}).observe(el('battle-ui'));
  refresh();
}());
