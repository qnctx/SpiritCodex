/* 一次性触媒合击。只有玩家确认才消费，自动策略不会调用此执行入口。 */
let comboModalPreviousFocus=null;
let lastEquippedComboId=null;

function comboRecipeById(recipeOrId){
  const id=typeof recipeOrId==='string'?recipeOrId:recipeOrId?.id;
  return COMBO_RECIPES.find(recipe=>recipe.id===id)||null;
}
function comboCharacterId(unit){return unit?.characterId||CHARACTERS[unit?.characterIndex]?.id||unit?.id||null;}
function comboInventoryCount(itemId){return safeWhole(state.progression?.inventory?.[itemId],0,0,COMBO_RULES.inventoryCap);}
function comboFormalMembers(){return state.allies.filter(unit=>!unit.isEnemy&&!unit.isSummon);}
function comboConditionMet(recipe,participants=[]){
  const enemies=state.enemies.filter(unit=>unit.alive),formal=comboFormalMembers();
  switch(recipe.id){
    case 'phoenix':return enemies.some(unit=>hasStatus(unit,'burn'))||state.allies.some(unit=>unit.alive&&unit.isSummon&&unit.element==='wind');
    case 'leviathan':return enemies.some(unit=>hasStatus(unit,'slow'));
    case 'bastion':return participants.some(unit=>unit?.alive&&unit.shield>0);
    case 'spring':return formal.some(unit=>!unit.alive||unit.curHp<=unit.maxHp*0.5);
    case 'eclipse':return enemies.some(unit=>unit.debuffs.length>0||unit.charging);
    case 'legion':return state.allies.some(unit=>unit.alive&&unit.isSummon);
    default:return false;
  }
}
function comboAvailability(recipeOrId,actor,{formationOnly=false,ignoreTurn=false}={}){
  const recipe=comboRecipeById(recipeOrId),reasons=[];
  if(!recipe)return {ready:false,reasons:['未知合击配方'],actor:null,partner:null,recipe:null};
  const members=formationOnly
    ?activeFormationIndices().map(index=>CHARACTERS[index]).filter(Boolean)
    :comboFormalMembers();
  const participants=recipe.memberIds.map(id=>members.find(unit=>comboCharacterId(unit)===id));
  const names=recipe.memberIds.map(id=>CHARACTERS.find(character=>character.id===id)?.name||id);
  participants.forEach((unit,index)=>{if(!unit)reasons.push(`${names[index]} 未在主战位`);});
  let chosen=actor||(!formationOnly?state.turnOrder[state.curIdx]:participants[0])||null;
  let partner=participants.find(unit=>unit&&unit!==chosen)||null;
  if(comboInventoryCount(recipe.itemId)<1)reasons.push(`${COMBO_ITEMS[recipe.itemId].name}不足`);
  if(formationOnly)return {ready:reasons.length===0,reasons,actor:chosen,partner,recipe};
  if((!ignoreTurn&&state.phase!=='player')||!state.run)reasons.push('等待正式队员行动');
  if(!state.enemies.some(unit=>unit.alive))reasons.push('当前波次已结束，没有可交战的敌人');
  if(!chosen||!participants.includes(chosen)||(!ignoreTurn&&(chosen!==state.turnOrder[state.curIdx]||chosen._acted)))reasons.push('等待合击成员行动');
  if(chosen&&participants.includes(chosen))partner=participants.find(unit=>unit&&unit!==chosen)||null;
  participants.forEach((unit,index)=>{
    if(!unit)return;
    if(!unit.alive)reasons.push(`${names[index]} 已倒下`);
    else if(hasStatus(unit,'freeze')||hasStatus(unit,'stun'))reasons.push(`${names[index]} 正受控制`);
  });
  if(chosen&&participants.includes(chosen)&&chosen.energy<COMBO_RULES.actorEnergy)reasons.push(`${chosen.name}还缺 ${COMBO_RULES.actorEnergy-chosen.energy} 能量（行动者 ${chosen.energy}/${COMBO_RULES.actorEnergy}）`);
  if(partner&&partner.energy<COMBO_RULES.partnerEnergy)reasons.push(`${partner.name}还缺 ${COMBO_RULES.partnerEnergy-partner.energy} 能量（协力者 ${partner.energy}/${COMBO_RULES.partnerEnergy}）`);
  if(state.run?.comboUsedIds?.includes(recipe.id))reasons.push('本局已施放此合击');
  if((state.run?.comboCasts||0)>=COMBO_RULES.maxCasts)reasons.push('本局两次合击已用完');
  if(state.run?.fusionLockRounds>0)reasons.push(`融合锁还剩 ${state.run.fusionLockRounds} 回合`);
  if(!comboConditionMet(recipe,participants))reasons.push(`前置：${recipe.condition}`);
  return {ready:reasons.length===0,reasons:[...new Set(reasons)],actor:chosen,partner,recipe};
}
function comboGroupDamage(recipe,participants,mult){
  let total=0;
  state.enemies.filter(enemy=>enemy.alive).forEach(enemy=>{
    participants.forEach(source=>{if(enemy.alive)total+=dealDamage(source,{name:recipe.name,mult},enemy,true,{noCounter:true});});
  });
  return total;
}
function applyComboEffect(recipe,actor,partner){
  const participants=[actor,partner];
  switch(recipe.id){
    case 'phoenix':
      comboGroupDamage(recipe,participants,1.65);applyDotAll('burn',3,actor);break;
    case 'leviathan':
      comboGroupDamage(recipe,participants,1.25);applyStatusAllEnemies('stun',1,0.7,actor);break;
    case 'bastion':
      comboGroupDamage(recipe,participants,0.85);shieldTeam(actor,0.30);cleanseTeam(99);break;
    case 'spring':
      healTeam(actor,0.45);reviveTeam();cleanseTeam(99);break;
    case 'eclipse':{
      const target=state.enemies.filter(enemy=>enemy.alive).sort((left,right)=>Number(!!right.charging)-Number(!!left.charging)||left.curHp/left.maxHp-right.curHp/right.maxHp||left.uid-right.uid)[0];
      if(target){participants.forEach(source=>{if(target.alive)dealDamage(source,{name:recipe.name,mult:3},target,true,{ignoreShield:true,noCounter:true});});if(target.alive)applyStatus(target,'defBreak',actor,1,2);}
      break;
    }
    case 'legion':{
      comboGroupDamage(recipe,participants,1.1);
      const summoner=participants.find(unit=>comboCharacterId(unit)==='D2')||actor;
      if(state.allies.filter(unit=>unit.alive&&unit.isSummon).length<MAX_ACTIVE_SUMMONS)summonUnits(summoner,{summon:'skeleton',summonCount:1});
      state.allies.filter(unit=>unit.alive&&unit.isSummon).forEach(unit=>{applyBuffTo(unit,{type:'atk',val:0.35,turns:3});unit.remainingRounds=Math.max(0,unit.remainingRounds||0)+2;spawnFloat(unit,'军势强化','#a8e5c0');});
      break;
    }
  }
}
const COMBO_IMPACT_ATLAS='assets/combos/combo-impact-atlas-v2.png';
function comboVisualSnapshot(){
  return [...state.enemies,...state.allies].map(unit=>({
    uid:unit.uid,name:unit.name,art:unit.art,side:unit.isEnemy?'enemy':unit.isSummon?'summon':'ally',
    hp:Math.max(0,unit.curHp||0),maxHp:unit.maxHp,shield:Math.max(0,unit.shield||0),alive:!!unit.alive,
    debuffs:(unit.debuffs||[]).map(status=>({...status})),buffs:(unit.buffs||[]).map(buff=>({...buff})),remainingRounds:unit.remainingRounds||0
  }));
}
// Presentation receives immutable before/after values; it never rolls damage or modifies combat.
function comboImpactPresentation(recipe,before,after){
  const summary={damage:0,healing:0,shieldGain:0,revived:0,summonsAdded:0};
  const targets=after.flatMap(unit=>{
    const previous=before.find(item=>item.uid===unit.uid),old=previous||{...unit,hp:0,shield:0,alive:false,debuffs:[],buffs:[],remainingRounds:0};
    const damage=Math.max(0,old.hp-unit.hp),healing=Math.max(0,unit.hp-old.hp),shieldGain=Math.max(0,unit.shield-old.shield),labels=[];
    if(unit.side==='enemy')summary.damage+=damage;
    else{summary.healing+=previous?healing:0;summary.shieldGain+=shieldGain;if(previous&&!old.alive&&unit.alive)summary.revived++;}
    if(unit.side==='summon'&&!previous){summary.summonsAdded++;labels.push('召唤入场');}
    if(previous&&!old.alive&&unit.alive)labels.push('复苏');
    if(old.alive&&!unit.alive)labels.push('击倒');
    if(unit.shield<old.shield)labels.push(`护盾减少 ${old.shield-unit.shield}`);
    if(old.debuffs.length>unit.debuffs.length)labels.push('净化');
    unit.debuffs.forEach(status=>{if(!old.debuffs.some(item=>item.type===status.type&&item.turns>=status.turns))labels.push(STATUS[status.type]?.name||status.type);});
    if(unit.side==='summon'&&JSON.stringify(old.buffs)!==JSON.stringify(unit.buffs))labels.push('攻击强化');
    if(previous&&unit.side==='summon'&&unit.remainingRounds>old.remainingRounds)labels.push(`持续 +${unit.remainingRounds-old.remainingRounds} 回合`);
    if(!damage&&!healing&&!shieldGain&&!labels.length)return [];
    return [{uid:unit.uid,name:unit.name,art:unit.art,side:unit.side,hpBefore:old.hp,hpAfter:unit.hp,maxHp:unit.maxHp,shieldBefore:old.shield,shieldAfter:unit.shield,aliveBefore:old.alive,aliveAfter:unit.alive,labels}];
  });
  // Keep a representative secondary effect visible beside the main hit.
  if(recipe.id==='bastion'||recipe.id==='legion'){
    targets.sort((a,b)=>(a.side==='enemy'?0:1)-(b.side==='enemy'?0:1));
    const secondary=targets.findIndex(target=>target.side!=='enemy');
    if(secondary>1)targets.splice(1,0,targets.splice(secondary,1)[0]);
  }
  return {targets,summary,sequence:recipe.sequence,casting:recipe.casting,impactAtlas:{src:COMBO_IMPACT_ATLAS,columns:3,rows:2,index:COMBO_RECIPES.indexOf(recipe)}};
}
function comboPreviewPresentation(recipe){
  const guardian=ENEMIES[1][1],hero=CHARACTERS.find(character=>character.id===recipe.memberIds[0]);
  const enemy={uid:'demo-enemy',name:'演练守卫',art:guardian.art,side:'enemy',hpBefore:1200,hpAfter:460,maxHp:1200,shieldBefore:0,shieldAfter:0,aliveBefore:true,aliveAfter:true,labels:['演示伤害']};
  const ally={uid:'demo-ally',name:'演练队友',art:hero.art,side:'ally',hpBefore:350,hpAfter:350,maxHp:1000,shieldBefore:0,shieldAfter:0,aliveBefore:true,aliveAfter:true,labels:[]};
  let targets=[enemy],summary={damage:740,healing:0,shieldGain:0,revived:0,summonsAdded:0};
  if(recipe.id==='phoenix')enemy.labels=['灼烧'];
  if(recipe.id==='leviathan'){enemy.hpAfter=600;enemy.labels=['麻痹 · 演示命中'];summary.damage=600;}
  if(recipe.id==='eclipse'){enemy.hpAfter=120;enemy.labels=['破防'];summary.damage=1080;}
  if(recipe.id==='bastion'){enemy.hpAfter=850;targets=[enemy,{...ally,shieldAfter:300,labels:['护盾展开','净化']}];summary.damage=350;summary.shieldGain=300;}
  if(recipe.id==='spring'){
    const revived=CHARACTERS.find(character=>character.id==='H2'); // The fallen teammate is not one of the two active casters.
    targets=[{...ally,hpAfter:800,labels:['治疗','净化']},{...ally,uid:'demo-revived',name:'倒下的队友',art:revived.art,hpBefore:0,hpAfter:400,aliveBefore:false,labels:['复苏']}];
    summary={damage:0,healing:850,shieldGain:0,revived:1,summonsAdded:0};
  }
  if(recipe.id==='legion'){
    enemy.hpAfter=650;targets=[enemy,{...ally,uid:'demo-summon',name:'骷髅战士',art:SUMMONS.skeleton.art,side:'summon',hpBefore:0,hpAfter:640,maxHp:640,aliveBefore:false,labels:['召唤入场','攻击强化','持续 +2 回合']}];summary.damage=550;summary.summonsAdded=1;
  }
  return {preview:true,targets,summary,sequence:recipe.sequence,casting:recipe.casting,impactAtlas:{src:COMBO_IMPACT_ATLAS,columns:3,rows:2,index:COMBO_RECIPES.indexOf(recipe)}};
}
function executeCombo(id){
  const availability=comboAvailability(id,currentPlayerActor());
  if(!availability.ready||autoBattle){renderComboModal();return false;}
  const {recipe,actor,partner}=availability;
  const committed=commitProgression(draft=>{
    if(!draft.inventory||safeWhole(draft.inventory[recipe.itemId],0)<1)return false;
    draft.inventory[recipe.itemId]--;return true;
  });
  if(!committed){renderComboModal();setComboMessage('本机存档未能保存，触媒和能量均未消耗。','error');return false;}
  closeComboModal();closeFusion();invalidateAutoDecision();state.phase='anim';state.target=null;state.selSkill=null;
  if($('target-chips'))$('target-chips').innerHTML='';
  actor.energy-=COMBO_RULES.actorEnergy;partner.energy-=COMBO_RULES.partnerEnergy;
  state.run.comboUsedIds=[...(state.run.comboUsedIds||[]),recipe.id];state.run.comboCasts=(state.run.comboCasts||0)+1;
  state.run.fusionLockRounds=COMBO_RULES.lockRounds;
  state.run.stats=state.run.stats||{};state.run.stats.comboCasts=(state.run.stats.comboCasts||0)+1;
  actor._acted=true;
  setBanner(`✦ ${actor.name} × ${partner.name}【${recipe.name}】`,'anim');setTip('');
  pushLog(`✦ ${actor.name} 与 ${partner.name} 施放【${recipe.name}】，消耗 ${COMBO_ITEMS[recipe.itemId].name} ×1`);
  const visualBefore=comboVisualSnapshot();
  const eventStart={particles:state.particles.length,floats:state.floats.length};
  applyComboEffect(recipe,actor,partner);
  const presentation=comboImpactPresentation(recipe,visualBefore,comboVisualSnapshot());
  const events=[...state.particles.slice(eventStart.particles),...state.floats.slice(eventStart.floats)];
  actor._hasActedEver=true;renderAll();renderComboFormation();
  const battleToken=state.battleToken,run=state.run,flowEpoch=run?.flowEpoch??0;
  let continued=false;
  const continueOnce=()=>{
    if(continued)return;continued=true;
    if(state.battleToken!==battleToken||state.run!==run||(run?.flowEpoch??0)!==flowEpoch||state.phase!=='anim'||!inBattle)return;
    scheduleBattle(afterPlayer,120);
  };
  if(typeof window.LiveCombo?.play==='function'){
    try{window.LiveCombo.play(recipe,[actor,partner],{...presentation,events,onComplete:continueOnce});}
    catch(error){window.LiveCombo.clear();spawnBurst(actor,recipe.color,24);scheduleBattle(continueOnce,1400);}
  }else{spawnBurst(actor,recipe.color,24);scheduleBattle(continueOnce,1400);}
  return true;
}
function setComboMessage(message='',type=''){
  const host=$('combo-craft-message');if(host){host.textContent=message;host.className=`combo-craft-message${type?' '+type:''}`;}
  const summary=$('combo-modal-summary');if(summary&&message)summary.textContent=message;
}
function craftComboItem(id){
  const item=COMBO_ITEMS[id];
  if(!item||inBattle)return false;
  if(comboInventoryCount(id)>=COMBO_RULES.inventoryCap){setComboMessage(`${item.name}库存已满。`,'error');return false;}
  const resources=state.progression.resources;
  if(resources.ink<item.cost.ink||resources.elementDust<item.cost.elementDust){setComboMessage('材料不足：每件需要 20 灵墨和 3 元素尘；完成远征可获取材料。','error');return false;}
  const committed=commitProgression(draft=>{
    if(!draft.inventory||draft.inventory[id]>=COMBO_RULES.inventoryCap||draft.resources.ink<item.cost.ink||draft.resources.elementDust<item.cost.elementDust)return false;
    draft.resources.ink-=item.cost.ink;draft.resources.elementDust-=item.cost.elementDust;draft.inventory[id]++;return true;
  });
  if(!committed){setComboMessage('合成未保存成功，材料没有扣除。','error');return false;}
  renderProgression();renderComboFormation();setComboMessage(`已合成 ${item.name} ×1；当前持有 ${comboInventoryCount(id)} 件。`,'success');return true;
}
function equipComboTeam(id){
  const recipe=comboRecipeById(id);if(!recipe||inBattle)return false;
  const required=recipe.memberIds.map(memberId=>CHARACTERS.findIndex(character=>character.id===memberId));
  if(required.some(index=>index<0))return false;
  const slots=cloneFormationSlots(state.formationSlots),positions=[['front',0],['front',1],['back',0],['back',1]],displaced=[];
  const active=new Set(positions.map(([zone,index])=>slots[zone][index]));
  const completePairs=COMBO_RECIPES.filter(candidate=>candidate.id!==id&&!candidate.memberIds.some(memberId=>recipe.memberIds.includes(memberId)))
    .map(candidate=>({id:candidate.id,indices:candidate.memberIds.map(memberId=>CHARACTERS.findIndex(character=>character.id===memberId))}))
    .filter(candidate=>candidate.indices.every(index=>active.has(index)));
  const existingPair=(completePairs.find(candidate=>candidate.id===lastEquippedComboId)||completePairs[0])?.indices;
  const protectedIndices=new Set(existingPair||[]);
  required.forEach(characterIndex=>{
    if(positions.some(([zone,index])=>slots[zone][index]===characterIndex))return;
    slots.reserve=slots.reserve.map(value=>value===characterIndex?null:value);
    const preferredZone=CHARACTERS[characterIndex].pos;
    const empty=positions.filter(([zone,index])=>slots[zone][index]==null);
    const replaceable=[...positions].reverse().filter(([zone,index])=>!required.includes(slots[zone][index])&&!protectedIndices.has(slots[zone][index]));
    const target=empty.find(([zone])=>zone===preferredZone)||empty[0]||replaceable.find(([zone])=>zone===preferredZone)||replaceable[0];
    if(!target)return;
    const [zone,index]=target;if(Number.isInteger(slots[zone][index]))displaced.push(slots[zone][index]);slots[zone][index]=characterIndex;
  });
  displaced.forEach(characterIndex=>{const free=slots.reserve.indexOf(null);if(free>=0)slots.reserve[free]=characterIndex;});
  state.formationSlots=slots;state.selectedFormationSlot=null;lastEquippedComboId=id;syncTeamFromFormation();buildFormation();
  setComboMessage(`已将「${recipe.name}」的两名成员放入主战位${existingPair?'，并保留原有的一组完整合击':''}；可继续自由调整前后排与其余队员。`,'success');return true;
}
let comboPreviewRequest=0;
function cancelComboPreview(){
  comboPreviewRequest++;
  if($('combo-cinematic')?.dataset.preview==='true'&&typeof window.clearComboCinematic==='function')window.clearComboCinematic();
}
async function previewCombo(id){
  const recipe=comboRecipeById(id);
  const canPreview=()=>!inBattle&&$('formation-screen')?.classList.contains('active')&&(!window.currentPreparationView||window.currentPreparationView()==='combos');
  if(!recipe||!canPreview()||typeof window.playComboCinematic!=='function')return false;
  const request=++comboPreviewRequest;
  const participants=recipe.memberIds.map(memberId=>({...CHARACTERS.find(character=>character.id===memberId),characterId:memberId}));
  setComboMessage(`正在准备「${recipe.name}」演出预览，不消耗道具。`);
  const presentation=comboPreviewPresentation(recipe);
  await preloadArt([COMBO_STAGE_ART.arena,COMBO_STAGE_ART.texture,COMBO_STAGE_ART.attack,recipe.casting?.src,recipe.rig?.src,recipe.rig?.combat?.src,...participants.map(character=>character.art),...presentation.targets.map(target=>target.art)].filter(Boolean));
  if(request!==comboPreviewRequest||!canPreview())return false;
  window.playComboCinematic(recipe,participants,presentation);
  setComboMessage(`「${recipe.name}」仅预览动态，不消耗道具、能量或合击次数。`,'success');
  return true;
}
function comboCardMarkup(recipe,{battle=false}={}){
  const availability=comboAvailability(recipe,undefined,{formationOnly:!battle}),item=COMBO_ITEMS[recipe.itemId];
  const pair=recipe.memberIds.map(id=>CHARACTERS.find(character=>character.id===id)?.name||id).join(' × ');
  const status=battle?(availability.ready?'可以施放':availability.reasons.join('；')):(availability.ready?'阵容已解锁，战斗中满足前置即可施放':availability.reasons.join('；'));
  return `<article class="combo-recipe-card${availability.ready?' ready':''}" data-combo="${recipe.id}" style="--combo-color:${recipe.color}">
    <img class="combo-recipe-art" src="${recipe.image}" alt="${escapeHtml(recipe.name)}合击" loading="lazy">
    <div class="combo-recipe-body"><div class="combo-recipe-kicker">${recipe.symbol} 限定双人合击</div><h4>${recipe.name}</h4>
    <p class="combo-recipe-pair">${escapeHtml(pair)}</p>
    <p class="combo-recipe-status" role="status">${escapeHtml(status)}</p>
    <details class="combo-recipe-details"${battle?' open':''}><summary>条件与效果</summary>
    <p class="combo-recipe-effect">${escapeHtml(recipe.effect)}</p><p class="combo-recipe-cost">${item.name} ×1（持有 ${comboInventoryCount(item.id)}） · 行动者 60 能量 + 协力者 40 能量</p>
    <p class="combo-recipe-requirements">前置：${escapeHtml(recipe.condition)}</p><p class="combo-recipe-setup">${escapeHtml(recipe.setup)}</p></details>
    ${battle?`<button class="btn combo-cast-btn" type="button" data-cast-combo="${recipe.id}" ${availability.ready&&!autoBattle?'':'disabled'}>消耗 ${item.name} ×1 · 施放</button>`:`<div class="combo-recipe-actions"><button class="btn combo-equip-btn" type="button" data-equip-combo="${recipe.id}" ${inBattle?'disabled':''}>加入主战</button><button class="btn combo-preview-btn" type="button" data-preview-combo="${recipe.id}" ${inBattle?'disabled':''}>预览绝招 · 免费</button></div>`}</div></article>`;
}
function renderComboFormation(){
  const inventory=$('combo-inventory'),list=$('combo-formation-list');
  if(inventory){
    const resources=state.progression.resources;
    inventory.innerHTML=Object.values(COMBO_ITEMS).map(item=>{
      const count=comboInventoryCount(item.id),disabled=inBattle||count>=COMBO_RULES.inventoryCap||resources.ink<item.cost.ink||resources.elementDust<item.cost.elementDust;
      return `<div class="combo-item" data-combo-item="${item.id}" style="--combo-color:${item.color}"><span class="combo-item-name">${item.symbol} ${item.name}</span><b class="combo-item-count">${count} 件</b><span class="combo-item-cost">20 灵墨 + 3 元素尘</span><button class="btn combo-craft-btn" type="button" data-craft-combo="${item.id}" ${disabled?'disabled':''}>合成 1 件</button></div>`;
    }).join('');
    inventory.querySelectorAll('[data-craft-combo]').forEach(button=>button.onclick=()=>craftComboItem(button.dataset.craftCombo));
  }
  if(list){
    list.innerHTML=COMBO_RECIPES.map(recipe=>comboCardMarkup(recipe)).join('');
    list.querySelectorAll('[data-equip-combo]').forEach(button=>button.onclick=()=>equipComboTeam(button.dataset.equipCombo));
    list.querySelectorAll('[data-preview-combo]').forEach(button=>button.onclick=()=>previewCombo(button.dataset.previewCombo));
  }
  if(typeof window.renderPreparationSummary==='function')window.renderPreparationSummary();
  return !!(inventory||list);
}
function renderComboBattleButton(){
  const button=$('combo-battle-btn');if(!button)return false;
  const actor=currentPlayerActor(),ready=actor?COMBO_RECIPES.filter(recipe=>comboAvailability(recipe,actor).ready).length:0;
  button.disabled=!actor;button.classList.toggle('ready',ready>0);button.dataset.readyCount=String(ready);
  button.textContent=`契约合击${ready?` · 可用 ${ready} 种`:''} · 本局余 ${Math.max(0,COMBO_RULES.maxCasts-(state.run?.comboCasts||0))} 次`;
  const cost=document.createElement('small');cost.className='combo-reason';
  const pair=actor&&COMBO_RECIPES.find(recipe=>recipe.memberIds.includes(comboCharacterId(actor))&&recipe.memberIds.every(id=>comboFormalMembers().some(u=>comboCharacterId(u)===id)));
  cost.textContent=ready?'确认后消耗 1 件触媒':pair?(comboAvailability(pair,actor).reasons[0]||'查看前置条件'):'指定搭档 · 消耗触媒';button.append(cost);
  button.title=autoBattle?'查看合击会切换为手动；确认施放才消耗触媒':'查看限定组合、前置与触媒消耗';button.onclick=openComboModal;return true;
}
function renderComboModal(){
  const list=$('combo-modal-list');if(!list)return false;
  list.innerHTML=COMBO_RECIPES.map(recipe=>comboCardMarkup(recipe,{battle:true})).join('');
  list.querySelectorAll('[data-cast-combo]').forEach(button=>button.onclick=()=>executeCombo(button.dataset.castCombo));
  const summary=$('combo-modal-summary');if(summary)summary.textContent=`当前已切换为手动，返回战斗后仍保持手动；可点击「自动」恢复。每配方每局 1 次，全局最多 ${COMBO_RULES.maxCasts} 次，与元素融合共享 2 回合融合锁。替补不参与；确认后才消耗道具。`;
  return true;
}
function comboModalKeydown(event){
  const modal=$('combo-modal');if(!modal||modal.hidden)return;
  if(event.key==='Escape'){event.preventDefault();closeComboModal();return;}
  if(event.key!=='Tab')return;
  const nodes=[...modal.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),[tabindex="0"]')].filter(node=>node.getClientRects().length);
  if(!nodes.length){event.preventDefault();modal.focus();return;}
  const first=nodes[0],last=nodes[nodes.length-1];
  if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus();}
}
function openComboModal(){
  if(!currentPlayerActor())return false;
  const modal=$('combo-modal');if(!modal)return false;
  if(!modal.hidden)return true;
  comboModalPreviousFocus=document.activeElement;
  state.target=null;state.selSkill=null;if($('target-chips'))$('target-chips').innerHTML='';
  if(battleCanvas)battleCanvas.style.cursor='default';
  setAutoBattle(false);closeFusion();hideDetail();
  renderComboModal();modal.hidden=false;modal.classList.add('active');
  const battle=$('battle-screen');if(battle)battle.inert=true;
  const close=$('combo-modal-close');if(close){close.onclick=closeComboModal;close.textContent='返回战斗（手动）';}
  document.addEventListener('keydown',comboModalKeydown);(close||modal).focus({preventScroll:true});return true;
}
function closeComboModal({resume=false}={}){
  const modal=$('combo-modal');if(modal){modal.hidden=true;modal.classList.remove('active');}
  const battle=$('battle-screen');if(battle){battle.inert=false;battle.removeAttribute('inert');}
  document.removeEventListener('keydown',comboModalKeydown);
  if(comboModalPreviousFocus?.isConnected)comboModalPreviousFocus.focus({preventScroll:true});comboModalPreviousFocus=null;
  return true;
}

Object.assign(window.SC,{COMBO_RULES,COMBO_ITEMS,COMBO_RECIPES,comboRecipeById,comboCharacterId,comboConditionMet,comboAvailability,executeCombo,craftComboItem,equipComboTeam,previewCombo,cancelComboPreview,openComboModal,closeComboModal,renderComboFormation,renderComboBattleButton,renderComboModal});
renderComboFormation();renderComboBattleButton();
