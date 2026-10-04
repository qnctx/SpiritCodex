'use strict';

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let randomOverride=null,runRandomSource=null;
const random=()=>(randomOverride||runRandomSource||Math.random)();
const choice=arr=>arr[Math.floor(random()*arr.length)];
const ELEMENT_ORDER=['fire','water','wind','thunder','dark','light'];
function fuseKey(arr){ return [...new Set(arr)].sort((a,b)=>ELEMENT_ORDER.indexOf(a)-ELEMENT_ORDER.indexOf(b)).join('+'); }
function fusionEntry(table,els){
  const key=fuseKey(els);
  const entry=Object.entries(table).find(([candidate])=>fuseKey(candidate.split('+'))===key);
  return entry?entry[1]:null;
}

const state = {
  team:[], allEnemiesSeen:false,
  formationSlots:{front:[null,null],back:[null,null],reserve:[null,null]},
  formationStyleId:'bulwark',
  selectedFormationSlot:null,
  reserves:[],
  reserveUnits:[],
  wave:0, turn:0, kills:0, log:[],
  allies:[], enemies:[],
  turnOrder:[], curIdx:0,
  phase:'idle', target:null, selSkill:null,
  particles:[], floats:[],
  fusionCtx:null,
  run:null,
  progression:null,
  progressionCharacterIndex:0,
  progressionPendingBranchId:null,
  battleToken:0,
};

const DEFAULT_TEAM = [1,8,2,10,0,5];
const DEFAULT_FORMATION_SLOTS = {front:[1,8],back:[2,10],reserve:[0,5]};
const MAX_ACTIVE_SUMMONS = 2;
const MAX_SHIELD_RATIO = 0.4;
const ACTIVE_SLOT_COUNT = 4;
const RESERVE_SLOT_COUNT = 2;
const WAVE_REWARD_MILESTONES = [30,65,100];
const HARD_CONTROL_TYPES = new Set(['freeze','stun']);
const DOT_RATES = {burn:0.05, corrupt:0.06, frostbite:0.04};

function hashSeed(value){
  let hash=2166136261;
  for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}
function createSeededRandom(seed){
  let value=seed>>>0;
  return ()=>{value=(value+0x6D2B79F5)>>>0;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function dailySeedKey(value=new Date()){
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const date=value instanceof Date?value:new Date(value);
  return new Date(date.getTime()+8*60*60*1000).toISOString().slice(0,10);
}
function prepareRunRandom(settings){
  const daily=settings.seedMode==='daily',key=daily?dailySeedKey():`run-${Date.now()}-${Math.floor((randomOverride||Math.random)()*1e9)}`;
  const seed=hashSeed(`SpiritCodex:${key}`);runRandomSource=createSeededRandom(seed);
  return {mode:daily?'daily':'random',key,seed};
}

/* ═══════════════════════════════════════════════════════════════
   跨局成长 / 本地存档
   ═══════════════════════════════════════════════════════════════ */
function blankCharacterProgress(){return {masteryXp:0,skillLevels:[0,0,0,0],unlockedBranches:[],activeBranch:null};}
function createDefaultProgression(){
  return {
    version:PROGRESSION_RULES.version,
    resources:{ink:0,elementDust:0,essence:0},
    inventory:Object.fromEntries(Object.keys(COMBO_ITEMS).map(id=>[id,COMBO_RULES.starterCount])),
    codexLevel:PROGRESSION_RULES.codex.minLevel,
    characters:Object.fromEntries(CHARACTERS.map(character=>[character.id,blankCharacterProgress()])),
    settings:{difficultyId:EXPEDITION_RULES.defaultDifficulty,contractIds:[],seedMode:EXPEDITION_RULES.defaultSeedMode,autoStrategyId:EXPEDITION_RULES.defaultAutoStrategy},
    stats:{runs:0,wins:0,bestClearedWaves:0},
  };
}
function safeWhole(value,fallback=0,min=0,max=Number.MAX_SAFE_INTEGER){
  const number=Number(value);return Number.isFinite(number)?clamp(Math.floor(number),min,max):fallback;
}
function normalizeProgression(raw){
  const next=createDefaultProgression(),source=raw&&typeof raw==='object'?raw:{};
  next.codexLevel=safeWhole(source.codexLevel,next.codexLevel,PROGRESSION_RULES.codex.minLevel,PROGRESSION_RULES.codex.maxLevel);
  ['ink','elementDust','essence'].forEach(key=>{next.resources[key]=safeWhole(source.resources?.[key],0);});
  const oldInventory=source.inventory;
  if(oldInventory&&typeof oldInventory==='object'){
    Object.keys(COMBO_ITEMS).forEach(key=>{next.inventory[key]=safeWhole(oldInventory[key],0,0,COMBO_RULES.inventoryCap);});
  }
  ['runs','wins','bestClearedWaves'].forEach(key=>{next.stats[key]=safeWhole(source.stats?.[key],0);});
  const difficultyIds=new Set(EXPEDITION_DIFFICULTIES.map(item=>item.id)),contractIds=new Set(EXPEDITION_CONTRACTS.map(item=>item.id)),strategyIds=new Set(AUTO_STRATEGIES.map(item=>item.id));
  if(difficultyIds.has(source.settings?.difficultyId))next.settings.difficultyId=source.settings.difficultyId;
  if(['random','daily'].includes(source.settings?.seedMode))next.settings.seedMode=source.settings.seedMode;
  if(strategyIds.has(source.settings?.autoStrategyId))next.settings.autoStrategyId=source.settings.autoStrategyId;
  next.settings.contractIds=[...new Set(Array.isArray(source.settings?.contractIds)?source.settings.contractIds:[])].filter(id=>contractIds.has(id)).slice(0,EXPEDITION_RULES.maxContracts);
  CHARACTERS.forEach(character=>{
    const saved=source.characters?.[character.id],entry=next.characters[character.id];
    entry.masteryXp=safeWhole(saved?.masteryXp,0);
    entry.skillLevels=character.skills.map((skill,index)=>safeWhole(saved?.skillLevels?.[index],0,PROGRESSION_RULES.skill.minLevel,PROGRESSION_RULES.skill.maxLevel));
    const validBranches=new Set((EVOLUTION_BRANCHES[character.id]||[]).map(branch=>branch.id));
    entry.unlockedBranches=[...new Set(Array.isArray(saved?.unlockedBranches)?saved.unlockedBranches:[])].filter(id=>validBranches.has(id));
    entry.activeBranch=entry.unlockedBranches.includes(saved?.activeBranch)?saved.activeBranch:null;
  });
  return next;
}
function loadProgression(){
  try{return normalizeProgression(JSON.parse(localStorage.getItem(PROGRESSION_RULES.saveKey)||'null'));}
  catch(error){return createDefaultProgression();}
}
function setProgressionSaveStatus(mode='saved',text='本地保存'){
  const host=$('progression-save-status');if(!host)return;
  host.classList.toggle('error',mode==='error');host.classList.toggle('saving',mode==='saving');
  const label=host.querySelector('span');if(label)label.textContent=text;
}
function setProgressionMessage(text='',type=''){
  const host=$('progression-message');if(!host)return;
  host.textContent=text;host.className=`progression-message${type?' '+type:''}`;
}
function persistProgression(profile){
  if(window.SC?.BattleLab?.isActive())return true;
  try{localStorage.setItem(PROGRESSION_RULES.saveKey,JSON.stringify(profile));setProgressionSaveStatus('saved','已保存到本机');return true;}
  catch(error){setProgressionSaveStatus('error','保存失败');return false;}
}
function saveProgression(){return persistProgression(state.progression);}
function commitProgression(mutator){
  const draft=normalizeProgression(JSON.parse(JSON.stringify(state.progression)));
  if(mutator(draft)===false||!persistProgression(draft))return false;
  state.progression=draft;return true;
}
function expeditionSettings(){return state.progression.settings;}
function currentDifficulty(){
  const id=state.run?.expeditionConfig?.difficultyId||expeditionSettings().difficultyId;
  return EXPEDITION_DIFFICULTIES.find(item=>item.id===id)||EXPEDITION_DIFFICULTIES.find(item=>item.id===EXPEDITION_RULES.defaultDifficulty);
}
function currentContracts(){
  const ids=state.run?.expeditionConfig?.contractIds||expeditionSettings().contractIds;
  return ids.map(id=>EXPEDITION_CONTRACTS.find(item=>item.id===id)).filter(Boolean);
}
function currentAutoStrategy(){return AUTO_STRATEGIES.find(item=>item.id===expeditionSettings().autoStrategyId)||AUTO_STRATEGIES.find(item=>item.id===EXPEDITION_RULES.defaultAutoStrategy);}
function contractEffects(kind){return currentContracts().flatMap(contract=>contract.effects||[]).filter(effect=>effect.kind===kind);}
function expeditionRewardMultiplier(config=state.run?.expeditionConfig){
  const difficulty=EXPEDITION_DIFFICULTIES.find(item=>item.id===(config?.difficultyId||expeditionSettings().difficultyId))||currentDifficulty();
  const ids=config?.contractIds||expeditionSettings().contractIds;
  const bonus=ids.map(id=>EXPEDITION_CONTRACTS.find(item=>item.id===id)?.rewardBonus||0).reduce((sum,value)=>sum+value,0);
  const contractScale=Number.isFinite(difficulty.contractRewardScale)?difficulty.contractRewardScale:1;
  return Number((difficulty.rewardMultiplier*(1+bonus*contractScale)).toFixed(3));
}
function expeditionMasteryMultiplier(config=state.run?.expeditionConfig){
  const id=config?.difficultyId||expeditionSettings().difficultyId;
  const difficulty=EXPEDITION_DIFFICULTIES.find(item=>item.id===id)||currentDifficulty();
  return Number.isFinite(difficulty.masteryMultiplier)?difficulty.masteryMultiplier:1;
}
function setDifficulty(id){
  if(inBattle||!EXPEDITION_DIFFICULTIES.some(item=>item.id===id))return false;
  if(!commitProgression(draft=>{draft.settings.difficultyId=id;}))return false;
  renderExpeditionConfig();buildFormation();return true;
}
function toggleExpeditionContract(id){
  if(inBattle||!EXPEDITION_CONTRACTS.some(item=>item.id===id))return false;
  const selected=expeditionSettings().contractIds,removing=selected.includes(id);
  if(!removing&&selected.length>=EXPEDITION_RULES.maxContracts){setExpeditionConfigMessage(`最多同时选择 ${EXPEDITION_RULES.maxContracts} 个契约。`,'error');return false;}
  if(!commitProgression(draft=>{draft.settings.contractIds=removing?draft.settings.contractIds.filter(item=>item!==id):[...draft.settings.contractIds,id];}))return false;
  renderExpeditionConfig();return true;
}
function setSeedMode(mode){
  if(inBattle||!['random','daily'].includes(mode))return false;
  if(!commitProgression(draft=>{draft.settings.seedMode=mode;}))return false;
  renderExpeditionConfig();return true;
}
function setAutoStrategy(id){
  if(!AUTO_STRATEGIES.some(item=>item.id===id)||!commitProgression(draft=>{draft.settings.autoStrategyId=id;}))return false;
  invalidateAutoDecision();renderExpeditionConfig();updateBattleExpeditionStatus();
  const actor=currentPlayerActor();if(autoBattle&&actor)scheduleAutoDecision(actor,220);
  return true;
}
function resetProgression(){
  if(window.SC?.BattleLab?.isActive())return false;
  try{localStorage.removeItem(PROGRESSION_RULES.saveKey);}
  catch(error){setProgressionSaveStatus('error','保存不可用');setProgressionMessage('无法访问本地存档，成长记录没有被重置。','error');return false;}
  state.progression=createDefaultProgression();state.progressionPendingBranchId=null;
  renderProgression();setProgressionMessage('已重置本机成长记录。','success');return state.progression;
}
function characterProgress(characterOrIndex){
  const character=typeof characterOrIndex==='number'?CHARACTERS[characterOrIndex]:characterOrIndex;
  if(!character)return null;
  return state.progression?.characters?.[character.id]||blankCharacterProgress();
}
function masteryLevelFromXp(xp){
  const thresholds=PROGRESSION_RULES.mastery.xpThresholds;
  let level=PROGRESSION_RULES.mastery.minLevel;
  thresholds.forEach((threshold,index)=>{if(xp>=threshold)level=Math.min(PROGRESSION_RULES.mastery.maxLevel,index+1);});
  return level;
}
function masteryLevel(characterOrIndex){return masteryLevelFromXp(characterProgress(characterOrIndex)?.masteryXp||0);}
function codexUpgradeCost(level=state.progression?.codexLevel||1){
  if(level>=PROGRESSION_RULES.codex.maxLevel)return null;
  return PROGRESSION_RULES.codex.baseCost+(level-PROGRESSION_RULES.codex.minLevel)*PROGRESSION_RULES.codex.costStep;
}
function skillUpgradeCost(characterIndex,skillIndex){
  const level=characterProgress(characterIndex)?.skillLevels?.[skillIndex];
  if(!Number.isInteger(level)||level>=PROGRESSION_RULES.skill.maxLevel)return null;
  return PROGRESSION_RULES.skill.baseCost+level*PROGRESSION_RULES.skill.costStep;
}
function evolutionBranch(characterOrIndex){
  const character=typeof characterOrIndex==='number'?CHARACTERS[characterOrIndex]:characterOrIndex;
  const active=characterProgress(character)?.activeBranch;
  return (EVOLUTION_BRANCHES[character?.id]||[]).find(branch=>branch.id===active)||null;
}
function upgradeCodex(){
  if(inBattle){setProgressionMessage('战斗中不能进行图谱升级。','error');return false;}
  const cost=codexUpgradeCost();if(cost==null||state.progression.resources.ink<cost){setProgressionMessage(cost==null?'图谱已经达到最高等级。':'灵墨不足，完成远征即可获得。','error');return false;}
  if(!commitProgression(draft=>{draft.resources.ink-=cost;draft.codexLevel++;})){setProgressionMessage('本地存档写入失败，本次没有扣除灵墨。','error');return false;}
  renderProgression();setProgressionMessage(`图谱提升至 Lv.${state.progression.codexLevel}，所有正式角色的生命、攻击和防御已提高。`,'success');buildRoster();buildFormation();return true;
}
function upgradeSkill(characterIndex,skillIndex){
  if(inBattle){setProgressionMessage('战斗中不能强化技能。','error');return false;}
  const character=CHARACTERS[characterIndex],progress=characterProgress(characterIndex),cost=skillUpgradeCost(characterIndex,skillIndex);
  if(!character||!progress||!character.skills[skillIndex]||cost==null||state.progression.resources.elementDust<cost){setProgressionMessage(cost==null?'该技能已经强化至最高级。':'元素尘不足，完成远征即可获得。','error');return false;}
  if(!commitProgression(draft=>{draft.resources.elementDust-=cost;draft.characters[character.id].skillLevels[skillIndex]++;})){setProgressionMessage('本地存档写入失败，本次没有扣除元素尘。','error');return false;}
  renderProgression();setProgressionMessage(`【${character.skills[skillIndex].name}】强化完成，下一场战斗立即生效。`,'success');return true;
}
function chooseEvolution(characterIndex,branchId){
  const character=CHARACTERS[characterIndex],progress=characterProgress(characterIndex);
  const branch=(EVOLUTION_BRANCHES[character?.id]||[]).find(item=>item.id===branchId);
  if(inBattle||!character||!progress||!branch||state.progression.codexLevel<PROGRESSION_RULES.evolution.unlockCodexLevel||progress.activeBranch===branchId){setProgressionMessage(inBattle?'战斗中不能改变进化分支。':'当前尚未满足进化条件。','error');return false;}
  const unlocked=progress.unlockedBranches.includes(branchId);
  const cost=unlocked?PROGRESSION_RULES.evolution.switchCost:PROGRESSION_RULES.evolution.unlockCost;
  if(state.progression.resources.essence<cost){setProgressionMessage('角色精华不足，继续完成远征后再来。','error');return false;}
  if(!commitProgression(draft=>{
    const entry=draft.characters[character.id];draft.resources.essence-=cost;
    if(!entry.unlockedBranches.includes(branchId))entry.unlockedBranches.push(branchId);
    entry.activeBranch=branchId;
  })){setProgressionMessage('本地存档写入失败，本次没有扣除角色精华。','error');return false;}
  state.progressionPendingBranchId=null;
  renderProgression();setProgressionMessage(`${character.name} 已启用「${branch.name}」，对应技能机制将在下一场战斗生效。`,'success');buildRoster();buildFormation();return true;
}
function progressionStatMultiplier(character){
  const levelBonus=(state.progression.codexLevel-PROGRESSION_RULES.codex.minLevel)*PROGRESSION_RULES.codex.statGrowthPerLevel;
  const masteryBonus=masteryLevel(character)>=2?PROGRESSION_RULES.mastery.rank2StatBonus:0;
  return 1+levelBonus+masteryBonus;
}
function buildProgressedSkills(character){
  const progress=characterProgress(character),mastery=masteryLevel(character),active=evolutionBranch(character);
  return character.skills.map((source,index)=>{
    let skill={...source,buff:source.buff?{...source.buff}:undefined,intent:source.intent?{...source.intent}:undefined};
    if(active?.skillIndex===index){skill={...skill,...active.patch,buff:active.patch.buff?{...active.patch.buff}:skill.buff,evolutionBranchId:active.id};}
    const rank=progress.skillLevels[index]||0,growth=1+rank*PROGRESSION_RULES.skill.powerGrowthPerLevel;
    ['mult','healPct','shieldPct'].forEach(key=>{if(Number.isFinite(skill[key]))skill[key]=Number((skill[key]*growth).toFixed(4));});
    if(skill.buff&&Number.isFinite(skill.buff.val))skill.buff.val=Number((skill.buff.val*growth).toFixed(4));
    if(rank>=PROGRESSION_RULES.skill.cooldownReductionAtLevel&&skill.cooldown>1)skill.cooldown--;
    if(mastery>=4&&index===1&&skill.cooldown>1)skill.cooldown=Math.max(1,skill.cooldown-PROGRESSION_RULES.mastery.rank4CooldownReduction);
    skill.upgradeLevel=rank;return skill;
  });
}
function progressionRewardFor(clearedWaves,multiplier=1,masteryMultiplier=1){
  const cleared=clamp(safeWhole(clearedWaves,0),0,ENEMIES.length);
  const reward=PROGRESSION_RULES.rewards.find(item=>item.clearedWaves===cleared);
  const masteryXp=cleared?Math.max(1,Math.round(reward.masteryXp*masteryMultiplier)):0;
  return {...reward,ink:Math.round(reward.ink*multiplier),elementDust:Math.round(reward.elementDust*multiplier),essence:Math.round(reward.essence*multiplier),masteryXp};
}
function awardExpeditionProgression(){
  if(window.SC?.BattleLab?.isActive())return {ink:0,elementDust:0,essence:0,masteryXp:0,persisted:false,training:true};
  if(!state.run||state.run.progressionClaimed)return state.run?.progressionReward||progressionRewardFor(0);
  const reward=progressionRewardFor(state.run.clearedWaves,expeditionRewardMultiplier(state.run.expeditionConfig),expeditionMasteryMultiplier(state.run.expeditionConfig));
  const participantIds=[...new Set(state.run.participantIds||[])].filter(id=>state.progression.characters[id]);
  const comboLoot={};
  const persisted=commitProgression(draft=>{
    draft.resources.ink+=reward.ink;draft.resources.elementDust+=reward.elementDust;draft.resources.essence+=reward.essence;
    ['ember','tide','soul'].slice(0,state.run.clearedWaves).forEach(id=>{
      comboLoot[id]=Math.min(1,COMBO_RULES.inventoryCap-draft.inventory[id]);draft.inventory[id]+=comboLoot[id];
    });
    participantIds.forEach(id=>{draft.characters[id].masteryXp+=reward.masteryXp;});
    draft.stats.runs++;if(state.run.clearedWaves>=ENEMIES.length)draft.stats.wins++;
    draft.stats.bestClearedWaves=Math.max(draft.stats.bestClearedWaves,state.run.clearedWaves);
  });
  if(!persisted)return {...reward,persisted:false};
  state.run.progressionClaimed=true;state.run.comboLoot=comboLoot;state.run.progressionReward={...reward,persisted:true};return state.run.progressionReward;
}

function createRunState(expeditionConfig=null,seedInfo=null){
  const startingFormationSlots=cloneFormationSlots(state.formationSlots);
  return {formulas:[],formulaOffers:[],intermission:null,reward:0,clearedWaves:0,waveRound:0,triggerUsage:{},
    startingFormationSlots,formationSlots:cloneFormationSlots(startingFormationSlots),formationStyleId:state.formationStyleId,
    participantIds:activeFormationIndices().map(index=>CHARACTERS[index]?.id).filter(Boolean),
    expeditionConfig,seedInfo,
    comboUsedIds:[],comboCasts:0,
    flowEpoch:0,fusionAssistDiscountUsed:false,fusionLockRounds:0,tripleFusionUsed:false,criticalSeen:{},criticalDecision:null,
    stats:{damageDealt:0,damageTaken:0,healing:0,fusions:0,autoFusions:0,criticalPauses:0,swaps:0,damageSources:{},lastDefeat:null,largestHit:null}};
}

function emptyFormationSlots(){return {front:[null,null],back:[null,null],reserve:[null,null]};}
function cloneFormationSlots(slots=DEFAULT_FORMATION_SLOTS){
  return {front:[...(slots.front||[])].slice(0,2),back:[...(slots.back||[])].slice(0,2),reserve:[...(slots.reserve||[])].slice(0,2)};
}
function formationSlotEntries(){
  return ['front','back','reserve'].flatMap(zone=>(state.formationSlots[zone]||[]).map((characterIndex,slotIndex)=>({zone,slotIndex,characterIndex})));
}
function findFormationSlot(characterIndex){return formationSlotEntries().find(entry=>entry.characterIndex===characterIndex)||null;}
function runFormationSlotEntries(){
  const slots=state.run?.formationSlots||state.formationSlots;
  return ['front','back','reserve'].flatMap(zone=>(slots[zone]||[]).map((characterIndex,slotIndex)=>({zone,slotIndex,characterIndex})));
}
function findRunFormationSlot(characterIndex){return runFormationSlotEntries().find(entry=>entry.characterIndex===characterIndex)||null;}
function runActiveFormationIndices(){return runFormationSlotEntries().filter(entry=>entry.zone!=='reserve').map(entry=>entry.characterIndex).filter(Number.isInteger);}
function runReserveFormationIndices(){return runFormationSlotEntries().filter(entry=>entry.zone==='reserve').map(entry=>entry.characterIndex).filter(Number.isInteger);}
function syncTeamFromFormation(){
  state.team=formationSlotEntries().map(entry=>entry.characterIndex).filter(index=>Number.isInteger(index)&&CHARACTERS[index]);
  return state.team;
}
function normalizeFormationSlots(indices=state.team,{reset=false}={}){
  const team=[...new Set(indices)].filter(index=>Number.isInteger(index)&&CHARACTERS[index]).slice(0,ACTIVE_SLOT_COUNT+RESERVE_SLOT_COUNT);
  const next=reset?emptyFormationSlots():cloneFormationSlots(state.formationSlots);
  ['front','back','reserve'].forEach(zone=>{next[zone]=next[zone].map(index=>team.includes(index)?index:null);});
  const assigned=new Set(['front','back','reserve'].flatMap(zone=>next[zone]).filter(Number.isInteger));
  team.forEach(index=>{
    if(assigned.has(index))return;
    const preferred=CHARACTERS[index].pos==='front'?'front':'back';
    const alternate=preferred==='front'?'back':'front';
    const zone=[preferred,alternate,'reserve'].find(candidate=>next[candidate].some(value=>value==null));
    if(!zone)return;
    next[zone][next[zone].findIndex(value=>value==null)]=index;
    assigned.add(index);
  });
  state.formationSlots=next;
  if(reset||!state.selectedFormationSlot||!next[state.selectedFormationSlot.zone]||state.selectedFormationSlot.slotIndex<0||state.selectedFormationSlot.slotIndex>1)state.selectedFormationSlot=null;
  syncTeamFromFormation();
  return next;
}
function activeFormationIndices(){
  const active=new Set([...state.formationSlots.front,...state.formationSlots.back].filter(Number.isInteger));
  return state.team.filter(index=>active.has(index));
}
function reserveFormationIndices(){
  const reserve=new Set(state.formationSlots.reserve.filter(Number.isInteger));
  return state.team.filter(index=>reserve.has(index));
}
function formationPosition(characterIndex){
  const slot=findFormationSlot(characterIndex);
  return slot&&slot.zone!=='reserve'?slot.zone:(CHARACTERS[characterIndex]?.pos||'back');
}
function setTeamIndices(indices){normalizeFormationSlots(indices,{reset:true});buildFormation();return state.team;}

// ── Image2 资产加载：Canvas 与 DOM 共用同一清单；失败只降级，不中断玩法。──
const REQUIRED_ART = [...new Set([
  ...CHARACTERS.map(character=>character.art),
  ...COMBO_RECIPES.map(recipe=>recipe.art),
  ...COMBO_RECIPES.filter(recipe=>recipe.casting).map(recipe=>recipe.casting.src),
  COMBO_STAGE_ART.arena,COMBO_STAGE_ART.texture,COMBO_STAGE_ART.attack,
  ...COMBO_RECIPES.map(recipe=>recipe.rig.src),
  ...COMBO_RECIPES.map(recipe=>recipe.rig.combat?.src).filter(Boolean),
  ...ENEMIES.flat().map(enemy=>enemy.art),
  ...Object.values(SUMMONS).map(summon=>summon.art),
  ART.backgrounds.title,ART.backgrounds.town,ART.backgrounds.roster,ART.backgrounds.formation,
  ...ART.backgrounds.battle,
].filter(Boolean))];
const TOWN_SEAL_ART = [
  ['town-map-seal',ART.ui.mapSeal,'灵素图谱徽记','⚔️'],
  ['town-roster-seal',ART.ui.rosterSeal,'角色阁徽记','🧙'],
  ['town-recruit-seal',ART.ui.recruitSeal,'招贤阁徽记','🎴'],
  ['town-forge-seal',ART.ui.forgeSeal,'铁匠铺徽记','⚒️'],
  ['town-apothecary-seal',ART.ui.apothecarySeal,'炼药铺徽记','⚗️'],
  ['town-evolution-seal',ART.ui.evolutionSeal,'进化塔徽记','🔮'],
];
const ART_CACHE = new Map();

function loadArt(src){
  if(!src)return Promise.resolve({src,status:'missing',image:null});
  if(ART_CACHE.has(src))return ART_CACHE.get(src).promise;
  if(typeof Image==='undefined'){
    const record={src,status:'unavailable',image:null,promise:null};
    record.promise=Promise.resolve(record);ART_CACHE.set(src,record);return record.promise;
  }
  const image=new Image();
  const record={src,status:'loading',image,promise:null};
  record.promise=new Promise(resolve=>{
    image.onload=()=>{record.status='loaded';resolve(record);};
    image.onerror=()=>{record.status='failed';record.image=null;resolve(record);};
  });
  ART_CACHE.set(src,record);image.decoding='async';image.src=src;
  return record.promise;
}
function preloadArt(paths=REQUIRED_ART){return Promise.all(paths.map(loadArt));}
function loadedArt(src){const record=ART_CACHE.get(src);return record&&record.status==='loaded'?record.image:null;}
function artStatus(){return [...ART_CACHE.values()].map(({src,status,image})=>({src,status,width:image?.naturalWidth||0,height:image?.naturalHeight||0}));}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function artMarkup(src,alt,fallback,variant=''){
  return `<span class="art-stack ${variant}"><span class="art-fallback" aria-hidden="true">${escapeHtml(fallback)}</span>${src?`<img data-art src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" draggable="false" decoding="async">`:''}</span>`;
}
document.addEventListener('load',event=>{const image=event.target;if(image instanceof HTMLImageElement&&image.matches('img[data-art]'))image.parentElement?.classList.add('loaded');},true);
document.addEventListener('error',event=>{const image=event.target;if(image instanceof HTMLImageElement&&image.matches('img[data-art]'))image.remove();},true);
let requiredArtReady=null;
function whenArtReady(){return requiredArtReady||(requiredArtReady=preloadArt());}
preloadArt([ART.backgrounds.title,ART.ui.emblem,ART.ui.panelGrain]);
function setUiArt(id,src,alt,fallback,variant){const host=$(id);if(host)host.innerHTML=artMarkup(src,alt,fallback,variant);}

function scheduleBattle(callback, delay){
  const token=state.battleToken;
  const flowEpoch=state.run?.flowEpoch??0;
  return (window.BattleClock?.schedule||setTimeout)(()=>{ if(token===state.battleToken&&(state.run?.flowEpoch??0)===flowEpoch&&state.phase!=='done'&&state.phase!=='intermission') callback(); },delay);
}
const battleNow=()=>window.BattleClock?.now()??performance.now();
function updateBattleSpeedButton(){document.querySelectorAll('.battle-speed-btn').forEach(button=>{const fast=window.BattleClock?.rate===2;button.textContent=button.dataset.compact?'×'+(fast?2:1):fast?'×2 加速':'×1 常速';button.setAttribute('aria-label',`战斗速度 ${fast?2:1} 倍，点击切换至 ${fast?1:2} 倍`);button.setAttribute('aria-pressed',String(fast));button.classList.toggle('on',fast);});}
function setBattleSpeed(value){const result=window.BattleClock?.setRate(value);updateBattleSpeedButton();return result;}
function toggleBattleSpeed(){return setBattleSpeed(window.BattleClock?.rate===2?1:2);}

// ── 单位建模 ──
let UID=0;
function makeUnit(src, isEnemy, summonDef){
  const m = isEnemy ? 1 : (RARITY[src.rarity]?RARITY[src.rarity].mult:1);
  const base = summonDef || src;
  const isProgressedHero=!isEnemy&&!summonDef&&!!src.id;
  const heroMastery=isProgressedHero?masteryLevel(src):1;
  const growth=isProgressedHero?progressionStatMultiplier(src):1;
  const progressedSkills=isProgressedHero?buildProgressedSkills(src):(base.skills||[]).map(skill=>({...skill,buff:skill.buff?{...skill.buff}:undefined,intent:skill.intent?{...skill.intent}:undefined}));
  const u = {
    uid:++UID,characterId:isProgressedHero?src.id:null,
    name: base.name, element: base.element, art:base.art||src.art||'', isEnemy:!!isEnemy, isSummon:!!summonDef, boss:!!base.boss,
    pos: base.pos || (isEnemy?'front':'back'),
    role: base.role || '',
    rarity: base.rarity || (isEnemy?'':''),
    maxHp: Math.floor((base.hp||base.maxHp||100)*m*growth),
    atk: Math.floor((base.atk||10)*m*growth),
    def: Math.floor((base.def||5)*m*growth),
    spd: base.spd||50, crt: base.crt||10, ctd: base.ctd||150, res: base.res||20,
    em: base.em||20, int: base.int||20,
    maxEnergy:100, energy: isEnemy?0:(heroMastery>=5?PROGRESSION_RULES.mastery.rank5StartingEnergy:0),
    skills: progressedSkills,
    cooldowns: progressedSkills.map(()=>0),
    passive: base.passive?{...base.passive}:null,
    intentConfig: base.intent?{...base.intent}:null,
    plannedIntent:null,
    patternStep:0,
    bossStage:base.boss?1:0,
    controlResistTurns:0,
    charging:null,
    guardState:null,
    remainingRounds:summonDef?3:null,
    debuffs:[], buffs:[],
    shield:0, alive:true, curHp:0,
    codexLevel:isProgressedHero?state.progression.codexLevel:1,
    masteryLevel:heroMastery,
    activeEvolution:isProgressedHero?(characterProgress(src).activeBranch||null):null,
    masteryBasicEnergyBonus:isProgressedHero&&heroMastery>=3?PROGRESSION_RULES.mastery.rank3BasicEnergyBonus:0,
    _x:0,_y:0,_r:26,_hit:null, _acted:false, _hasActedEver:false,
  };
  u.curHp = u.maxHp;
  return u;
}

/* ═══════════════════════════════════════════════════════════════
   战斗流程
   ═══════════════════════════════════════════════════════════════ */
let battleCanvas,bctx,BW=0,BH=0,dpr=1,inBattle=false,battleRAF=0;
// 自动战斗是页面会话偏好：跨战斗保留，但刷新页面恢复默认开启。
// 决策令牌独立于 battleToken，确保切手动只取消尚未提交的自动动作。
let autoBattle=true,autoDecisionToken=0;
function invalidateAutoDecision(){autoDecisionToken++;return autoDecisionToken;}
function currentPlayerActor(){
  const u=state.turnOrder[state.curIdx];
  return state.phase==='player'&&u&&u.alive&&!u._acted&&!u.isEnemy&&!u.isSummon?u:null;
}
function updateAutoBattleButton(){
  const button=$('auto-battle-btn');if(!button)return;
  button.textContent=autoBattle?'自动：开':'手动';
  button.classList.toggle('on',autoBattle);
  button.setAttribute('aria-pressed',String(autoBattle));
  button.title=autoBattle?'点击切换为手动战斗':'点击开启自动战斗';
  window.BattleHUD?.refresh();
}
function setAutoBattle(enabled){
  autoBattle=!!enabled;
  invalidateAutoDecision();
  updateAutoBattleButton();
  const u=currentPlayerActor();
  if(!u){return autoBattle;}
  if(!autoBattle){
    setBanner('⚔ 你的回合 · '+u.name,'player');
    setTip(state.target?'请选择目标':'手动模式：选择技能');
    renderSkillBar();
    return autoBattle;
  }
  // 手动选靶尚未提交时，开启自动应收拢该状态并从合法动作重新决策。
  state.target=null;state.selSkill=null;$('target-chips').innerHTML='';closeFusion();renderSkillBar();
  scheduleAutoDecision(u);
  return autoBattle;
}
function toggleAutoBattle(){return setAutoBattle(!autoBattle);}
function showScreen(id){
  if(id!=='battle-screen')window.BattleHUD?.closeReport({restoreFocus:false});
  if(typeof cancelComboPreview==='function')cancelComboPreview();
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
  if(id==='town-screen'){
    TOWN_SEAL_ART.forEach(([hostId,src,alt,fallback])=>{if(!$(hostId)?.querySelector('img[data-art]'))setUiArt(hostId,src,alt,fallback,'building-art');});
    preloadArt([ART.backgrounds.town]);
    renderProgression();
  }
  if(id==='roster-screen'){preloadArt([ART.backgrounds.roster,...CHARACTERS.map(character=>character.art)]);buildRoster();}
  if(id==='formation-screen'){
    preloadArt([ART.backgrounds.formation,...CHARACTERS.map(character=>character.art)]);buildFormation();
    if(typeof window.navigatePreparation==='function')window.navigatePreparation('team');
  }
  if(id==='progression-screen'){preloadArt([ART.backgrounds.roster,...CHARACTERS.map(character=>character.art)]);renderProgression();}
}
function preloadWaveArt(index){
  const wave=ENEMIES[index]||[];
  return preloadArt([ART.backgrounds.battle[index],...wave.map(enemy=>enemy.art)].filter(Boolean));
}

function makeExpeditionEnemy(source){
  const unit=makeUnit(source,true),difficulty=currentDifficulty();
  const multiplier=stat=>difficulty.enemy[stat]*contractEffects('enemyStatMultiplier').filter(effect=>effect.stat===stat).reduce((value,effect)=>value*(Number(effect.value)||1),1);
  unit.maxHp=Math.max(1,Math.floor(unit.maxHp*multiplier('hp')));unit.curHp=unit.maxHp;
  unit.atk=Math.max(1,Math.floor(unit.atk*multiplier('atk')));unit.def=Math.max(0,Math.floor(unit.def*multiplier('def')));unit.spd=Math.max(1,Math.floor(unit.spd*multiplier('spd')));
  return unit;
}
function applyWaveStartContracts(){
  contractEffects('waveStartStatus').forEach(effect=>{
    state.allies.filter(unit=>unit.alive&&!unit.isSummon).forEach(unit=>addStatus(unit,effect.status,effect.turns||STATUS[effect.status]?.turns||1,null,null));
  });
}

function startBattle(){
  normalizeFormationSlots();
  const activeTeam=activeFormationIndices();
  if(activeTeam.length!==ACTIVE_SLOT_COUNT) return false;
  window.BattleDecision?.reset();
  window.BattleHUD?.closeReport({restoreFocus:false});
  window.BattleClock?.clear();
  window.LiveCombo?.clear();window.BattleMotion?.clear();
  closeIntermission();closeCriticalDecision();
  if(typeof closeComboModal==='function')closeComboModal({resume:false});
  if(typeof window.clearComboCinematic==='function')window.clearComboCinematic();
  preloadArt([ART.ui.victoryCrest,ART.ui.defeatCrest,...activeTeam.map(index=>CHARACTERS[index].art)]);
  const activeIds=new Set(activeTeam.map(index=>CHARACTERS[index].id));
  preloadArt([COMBO_STAGE_ART.arena,COMBO_STAGE_ART.texture,COMBO_STAGE_ART.attack,...COMBO_RECIPES.filter(recipe=>recipe.memberIds.some(id=>activeIds.has(id))).flatMap(recipe=>[recipe.art,recipe.casting?.src,recipe.rig?.src,recipe.rig?.combat?.src].filter(Boolean))]);
  preloadWaveArt(0);
  state.battleToken++;
  invalidateAutoDecision();
  const settings=expeditionSettings(),expeditionConfig={difficultyId:settings.difficultyId,contractIds:[...settings.contractIds],seedMode:settings.seedMode};
  const seedInfo=prepareRunRandom(settings);
  state.wave=0; state.turn=0; state.kills=0; state.log=[];state.run=createRunState(expeditionConfig,seedInfo);
  state.reserves=reserveFormationIndices();
  state.allies=activeTeam.map(i=>{
    const unit=makeUnit(CHARACTERS[i],false);
    unit.characterIndex=i;
    unit.pos=formationPosition(i);
    return unit;
  });
  state.reserveUnits=state.reserves.map(i=>{const unit=makeUnit(CHARACTERS[i],false);unit.characterIndex=i;unit.pos='reserve';return unit;});
  // 赛巴斯 被动：开局全队按配置值加速
  state.allies.forEach(a=>{ if(a.passive&&a.passive.type==='teamHaste'){ state.allies.forEach(x=>{ if(x.alive) addStatus(x,'haste',a.passive.turns,a.passive.val,a); }); } });
  state.enemies=ENEMIES[0].map(makeExpeditionEnemy);applyWaveStartContracts();
  state.phase='idle'; state.target=null; state.selSkill=null;
  state.particles=[]; state.floats=[];
  showScreen('battle-screen');
  updateAutoBattleButton();
  updateBattleExpeditionStatus();
  initBattleCanvas();
  setBanner('⚔ 战斗开始','player');
  pushLog('⚔ 战斗开始！');
  nextTurn();
  return true;
}

function nextTurn(){
  const heroes=state.allies.filter(u=>u.alive&&!u.isSummon),a=state.allies.filter(u=>u.alive),e=state.enemies.filter(u=>u.alive);
  if(heroes.length===0) return endBattle(false);
  if(e.length===0)return completeWave();
  const all=[...a,...e];
  all.forEach(u=>u._acted=false);
  state.turnOrder=all.map((unit,index)=>({unit,index,jitter:(random()-0.5)*6}))
    .sort((left,right)=>(effSpd(right.unit)+right.jitter)-(effSpd(left.unit)+left.jitter)||left.index-right.index)
    .map(entry=>entry.unit);
  state.curIdx=0; state.turn++;if(state.run)state.run.waveRound++;
  planEnemyIntents();
  processTurn();
}

function currentFormation(){
  const id=state.run?.formationStyleId||state.formationStyleId;
  return BATTLE_FORMATIONS.find(formation=>formation.id===id)||BATTLE_FORMATIONS[0];
}
function formationTargetMatches(effect,unit,context={}){
  if(!state.run||!effect||!unit||unit.isEnemy)return false;
  if(effect.target==='frontAllies')return !unit.isSummon&&unit.pos==='front';
  if(effect.target==='backAllies')return !unit.isSummon&&unit.pos==='back';
  if(effect.target==='activeAllies')return unit.alive;
  if(effect.target==='heroAllies')return !unit.isSummon;
  if(effect.target==='alliedSummons')return unit.isSummon;
  if(effect.target==='heroBasicAttacks')return !unit.isSummon&&context.isBasic;
  return false;
}
function formationMultiplier(kind,stat,unit,context={}){
  if(!state.run)return 1;
  return currentFormation().effects.filter(effect=>effect.kind===kind&&(!stat||effect.stat===stat)&&formationTargetMatches(effect,unit,context))
    .filter(effect=>!effect.durationRounds||state.run.waveRound<=effect.durationRounds)
    .reduce((value,effect)=>value*(Number(effect.value)||1),1);
}
function formationResourceGainMultiplier(unit,resource){
  if(!state.run)return 1;
  return currentFormation().effects.filter(effect=>effect.kind==='resourceGainMultiplier'&&effect.resource===resource&&formationTargetMatches(effect,unit))
    .reduce((value,effect)=>value*(Number(effect.value)||1),1);
}
function formationFusionAssistCostMultiplier(){
  if(!state.run||state.run.fusionAssistDiscountUsed)return 1;
  const effect=currentFormation().effects.find(item=>item.kind==='resourceCostMultiplier'&&item.target==='fusionAssist'&&item.resource==='energy');
  return effect?Number(effect.value)||1:1;
}
function formationSummonDurationDelta(){
  if(!state.run)return 0;
  return currentFormation().effects.filter(effect=>effect.kind==='durationDelta'&&effect.target==='alliedSummons'&&effect.stat==='durationRounds')
    .reduce((value,effect)=>value+(Number(effect.value)||0),0);
}
function hasFormula(id){return !!state.run?.formulas?.includes(id);}
function formulaById(id){return TEMPORARY_FORMULAS.find(formula=>formula.id===id)||null;}
function sampleUnique(items,count){
  const pool=[...items],result=[];
  while(pool.length&&result.length<count)result.push(pool.splice(Math.floor(random()*pool.length),1)[0]);
  return result;
}
function consumeFormulaTrigger(id,key,limit=1){
  if(!hasFormula(id)||!state.run)return false;
  const usageKey=`${id}:${key}`,used=state.run.triggerUsage[usageKey]||0;
  if(used>=limit)return false;
  state.run.triggerUsage[usageKey]=used+1;return true;
}
function expeditionHeroes(){return [...state.allies.filter(unit=>!unit.isSummon),...state.reserveUnits];}

function completeWave(){
  if(window.SC?.BattleLab?.onWaveComplete())return true;
  if(!state.run)state.run=createRunState();
  const cleared=state.wave+1;
  if(state.run.clearedWaves>=cleared||state.phase==='intermission')return false;
  state.run.clearedWaves=cleared;
  state.run.reward=WAVE_REWARD_MILESTONES[Math.min(state.wave,WAVE_REWARD_MILESTONES.length-1)];
  pushLog(`✦ 第 ${cleared} 波完成，已锁定 ${state.run.reward} 灵尘`);updateHUD();
  if(cleared>=ENEMIES.length){endBattle(true);return true;}
  openIntermission(cleared===EXPEDITION_CHOICE_RULES.formula.afterWave?'formula':'camp');
  return true;
}
let intermissionPreviousFocus=null;
function intermissionFocusable(){
  const modal=$('intermission-modal');if(!modal||modal.hidden)return [];
  return [...modal.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(element=>element.getClientRects().length>0);
}
function focusIntermissionStart(){const first=intermissionFocusable()[0];if(first)first.focus({preventScroll:true});}
function openIntermission(type){
  invalidateAutoDecision();closeFusion();state.run.flowEpoch++;state.phase='intermission';state.target=null;state.selSkill=null;state.turnOrder=[];state.curIdx=0;
  if(type==='formula')state.run.formulaOffers=sampleUnique(TEMPORARY_FORMULAS,EXPEDITION_CHOICE_RULES.formula.draw);
  state.run.intermission={type,mode:'options',outgoingUid:null,incomingUid:null};
  setBanner(type==='formula'?'✦ 波间炼成 · 选择灵方':'⛺ 决战前整备','anim');setTip('');$('target-chips').innerHTML='';renderAll();
  intermissionPreviousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  renderIntermission();const modal=$('intermission-modal');if(modal)modal.hidden=false;
  const battle=$('battle-screen');if(battle)battle.inert=true;
  focusIntermissionStart();
}
function closeIntermission(){
  const shouldRestore=state.phase==='intermission',modal=$('intermission-modal');if(modal)modal.hidden=true;
  const swap=$('intermission-swap');if(swap)swap.hidden=true;
  const battle=$('battle-screen');if(battle){battle.inert=false;battle.removeAttribute('inert');}
  if(shouldRestore&&intermissionPreviousFocus?.isConnected)intermissionPreviousFocus.focus({preventScroll:true});
  intermissionPreviousFocus=null;
}
document.addEventListener('keydown',event=>{
  const modal=$('intermission-modal');if(!modal||modal.hidden)return;
  if(event.key==='Escape'){event.preventDefault();return;}
  if(event.key!=='Tab')return;
  const focusable=intermissionFocusable();if(!focusable.length){event.preventDefault();return;}
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  else if(!focusable.includes(document.activeElement)){event.preventDefault();first.focus();}
});
function intermissionButton(item,disabled=false){
  const button=document.createElement('button');button.type='button';button.className='intermission-option';button.disabled=disabled;
  button.innerHTML=`<span class="option-icon" aria-hidden="true">${escapeHtml(item.symbol||'◇')}</span><span class="option-name">${escapeHtml(item.name)}</span><span class="option-desc">${escapeHtml(item.desc)}</span><span class="option-tag">${escapeHtml(item.category||'构筑')}</span>`;
  return button;
}
function renderIntermission(){
  const ctx=state.run?.intermission,options=$('intermission-options'),panel=$('intermission-swap');if(!ctx||!options)return;
  panel.hidden=true;panel.innerHTML='';options.hidden=false;options.innerHTML='';
  if(ctx.type==='formula'){
    $('intermission-kicker').textContent='第一波完成 · 已锁定 30 灵尘';$('intermission-title').textContent='炼成一份临时灵方';
    $('intermission-desc').textContent='本局余下两波持续生效。三种选项会改变打法，而不是只增加面板数值。';
    state.run.formulaOffers.forEach(formula=>{const button=intermissionButton(formula);button.onclick=()=>chooseFormula(formula.id);options.appendChild(button);});
    focusIntermissionStart();
    return;
  }
  $('intermission-kicker').textContent='第二波完成 · 已锁定 65 灵尘';$('intermission-title').textContent='决战前的营地选择';
  $('intermission-desc').textContent='生命、能量、冷却和召唤状态都已从前两波继承；现在只能选择一项整备。';
  CAMP_OPTIONS.forEach(option=>{
    const unavailable=option.action.type==='swap'&&!state.reserveUnits.some(unit=>unit.alive)||option.action.type==='charge'&&!state.allies.some(unit=>unit.alive&&!unit.isSummon&&unit.energy<unit.maxEnergy);
    const button=intermissionButton(option,unavailable);button.onclick=()=>chooseCampOption(option.id);options.appendChild(button);
  });
  focusIntermissionStart();
}
function chooseFormula(id){
  const ctx=state.run?.intermission,formula=formulaById(id);
  if(ctx?.type!=='formula'||!formula||!state.run.formulaOffers.some(item=>item.id===id))return false;
  state.run.formulas.push(id);pushLog(`⚗ 获得临时灵方【${formula.name}】`);advanceWave();return true;
}
function chooseCampOption(id){
  const ctx=state.run?.intermission,option=CAMP_OPTIONS.find(item=>item.id===id);if(ctx?.type!=='camp'||!option)return false;
  if(option.action.type==='recover'){
    let total=0;expeditionHeroes().filter(unit=>unit.alive).forEach(unit=>{total+=healUnit(unit,unit.maxHp*option.action.maxHpPct);});
    pushLog(`⛺ 灵泉休整，全队共恢复 ${total} 生命`);advanceWave();return true;
  }
  ctx.mode=option.action.type;ctx.outgoingUid=null;ctx.incomingUid=null;renderCampSelection();return true;
}
function swapUnitButton(unit,side,selected){
  const button=document.createElement('button');button.type='button';button.className=`swap-unit${selected?' selected':''}`;
  const hp=Math.round(unit.curHp/unit.maxHp*100),energy=Math.round(unit.energy||0);
  button.innerHTML=`<b>${escapeHtml(unit.name)}</b><span>${side==='active'?unit.pos==='front'?'前排':'后排':'替补'} · 生命 ${hp}% · 能量 ${energy}</span>`;
  button.onclick=()=>selectCampUnit(side,unit.uid);return button;
}
function renderCampSelection(){
  const ctx=state.run?.intermission,options=$('intermission-options'),panel=$('intermission-swap');if(ctx?.type!=='camp'||!panel)return;
  options.hidden=true;panel.hidden=false;
  if(ctx.mode==='charge'){
    const living=state.allies.filter(unit=>unit.alive&&!unit.isSummon&&unit.energy<unit.maxEnergy);
    panel.innerHTML='<div class="swap-guidance">选择一名存活主战角色，使其获得 40 能量（不超过 100）。</div><div class="swap-group"><h4>主战角色</h4><div class="swap-unit-list" id="camp-charge-list"></div></div><div class="swap-actions"><button class="btn" id="camp-back">返回三选一</button></div>';
    const list=$('camp-charge-list');living.forEach(unit=>{const button=swapUnitButton(unit,'active',false);button.onclick=()=>applyCampCharge(unit.uid);list.appendChild(button);});
  }else{
    const active=state.allies.filter(unit=>!unit.isSummon),reserves=state.reserveUnits.filter(unit=>unit.alive);
    panel.innerHTML='<div class="swap-guidance">各选一人完成交换。离场角色不再行动或参与融合；双方生命、能量和冷却原样保留。</div><div class="swap-groups"><div class="swap-group"><h4>选择离场主战</h4><div class="swap-unit-list" id="camp-active-list"></div></div><div class="swap-group"><h4>选择入场替补</h4><div class="swap-unit-list" id="camp-reserve-list"></div></div></div><div class="swap-actions"><button class="btn" id="camp-back">返回三选一</button><button class="btn primary" id="camp-swap-confirm" disabled>确认换人</button></div>';
    const activeList=$('camp-active-list'),reserveList=$('camp-reserve-list');
    active.forEach(unit=>activeList.appendChild(swapUnitButton(unit,'active',ctx.outgoingUid===unit.uid)));
    reserves.forEach(unit=>reserveList.appendChild(swapUnitButton(unit,'reserve',ctx.incomingUid===unit.uid)));
    const confirm=$('camp-swap-confirm');confirm.disabled=!(ctx.outgoingUid&&ctx.incomingUid);confirm.onclick=confirmCampSwap;
  }
  $('camp-back').onclick=()=>{ctx.mode='options';renderIntermission();};
  focusIntermissionStart();
}
function selectCampUnit(side,uid){
  const ctx=state.run?.intermission;if(ctx?.type!=='camp'||ctx.mode!=='swap')return false;
  if(side==='active'&&state.allies.some(unit=>!unit.isSummon&&unit.uid===uid))ctx.outgoingUid=uid;
  if(side==='reserve'&&state.reserveUnits.some(unit=>unit.alive&&unit.uid===uid))ctx.incomingUid=uid;
  renderCampSelection();return true;
}
function applyCampCharge(uid){
  const ctx=state.run?.intermission,unit=state.allies.find(item=>item.uid===uid&&item.alive&&!item.isSummon);if(ctx?.mode!=='charge'||!unit)return false;
  const gained=Math.min(40,unit.maxEnergy-unit.energy);unit.energy+=gained;if(gained>0)spawnFloat(unit,'⚡+'+gained,'#f7dc6f');
  pushLog(`⛺ ${unit.name} 冥想聚能，能量 +${gained}`);advanceWave();return true;
}
function swapActiveWithReserve(outgoingUid,incomingUid){
  const activeIndex=state.allies.findIndex(unit=>!unit.isSummon&&unit.uid===outgoingUid),reserveIndex=state.reserveUnits.findIndex(unit=>unit.uid===incomingUid);
  if(activeIndex<0||reserveIndex<0)return false;
  const outgoing=state.allies[activeIndex],incoming=state.reserveUnits[reserveIndex];if(!incoming.alive)return false;
  const activeSlot=findRunFormationSlot(outgoing.characterIndex),reserveSlot=findRunFormationSlot(incoming.characterIndex);
  if(!activeSlot||activeSlot.zone==='reserve'||!reserveSlot||reserveSlot.zone!=='reserve')return false;
  state.run.formationSlots[activeSlot.zone][activeSlot.slotIndex]=incoming.characterIndex;state.run.formationSlots[reserveSlot.zone][reserveSlot.slotIndex]=outgoing.characterIndex;
  incoming.pos=activeSlot.zone;outgoing.pos='reserve';incoming._acted=false;outgoing._acted=false;
  state.allies[activeIndex]=incoming;state.reserveUnits[reserveIndex]=outgoing;state.reserves=runReserveFormationIndices();
  if(state.run&&!state.run.participantIds.includes(CHARACTERS[incoming.characterIndex]?.id))state.run.participantIds.push(CHARACTERS[incoming.characterIndex].id);
  if(state.run)state.run.stats.swaps++;return true;
}
function confirmCampSwap(){
  const ctx=state.run?.intermission;if(ctx?.mode!=='swap'||!swapActiveWithReserve(ctx.outgoingUid,ctx.incomingUid))return false;
  const incoming=state.allies.find(unit=>unit.uid===ctx.incomingUid);pushLog(`⇄ 替补换阵，${incoming?.name||'替补'} 加入主战`);advanceWave();return true;
}
function advanceWave(){
  if(!state.run?.intermission)return false;
  window.LiveCombo?.clear();window.BattleMotion?.clear();
  window.ComboEnvironment?.releaseBattle({cancelled:true});
  closeIntermission();state.run.intermission=null;state.run.flowEpoch++;state.wave++;state.run.waveRound=0;state.phase='idle';state.turnOrder=[];state.curIdx=0;
  preloadWaveArt(state.wave);state.enemies=ENEMIES[state.wave].map(makeExpeditionEnemy);applyWaveStartContracts();
  pushLog(`🌊 第 ${state.wave+1} 波敌人出现！`);setBanner(`🌊 第 ${state.wave+1} 波敌人出现！`,'enemy');renderAll();scheduleBattle(nextTurn,420);return true;
}

function processTurn(){
  if(window.SC?.BattleLab?.beforeProcessTurn())return;
  invalidateAutoDecision();
  const heroes=state.allies.filter(u=>u.alive&&!u.isSummon),a=state.allies.filter(u=>u.alive),e=state.enemies.filter(u=>u.alive);
  if(heroes.length===0) return endBattle(false);
  if(e.length===0) return nextTurn();
  // 复活单位可能仍在本轮后续行动序中；_acted=true 时必须直接跳过，避免进入无法操作的玩家回合。
  while(state.curIdx<state.turnOrder.length && (!state.turnOrder[state.curIdx] || !state.turnOrder[state.curIdx].alive || state.turnOrder[state.curIdx]._acted)) state.curIdx++;
  if(state.curIdx>=state.turnOrder.length){ processDOT(); return; }
  const u=state.turnOrder[state.curIdx];
  window.BossTactics?.beforeTurn(u);
  if(u.alive&&(hasStatus(u,'freeze')||hasStatus(u,'stun'))){
    const controlType=hasStatus(u,'freeze')?'freeze':'stun';
    spawnFloat(u,controlType==='freeze'?'冰冻':'麻痹','#7ec8e3');
    consumeStatus(u,controlType);
    if(u.boss){
      u.controlResistTurns=Math.max(u.controlResistTurns,2);
      if(u.charging){pushLog(`⛓ ${u.name} 的蓄力被打断`);window.BossTactics?.open(u,'interrupted');u.charging=null;u.patternStep++;}
    }
    u.plannedIntent=null;
    // 被控制跳过不算“首次行动”，首次行动增伤保留到真正施放技能时。
    u._acted=true;
    updateEnemyIntentUI();state.curIdx++;scheduleBattle(processTurn,300);return;
  }
  state.target=null; state.selSkill=null;
  // 召唤物必须先进入非玩家态再渲染，否则会短暂暴露可点击技能栏并引发双行动。
  state.phase=u.isEnemy?'enemy':u.isSummon?'anim':'player';
  updateHUD(); updateTurnOrder(); renderSkillBar();
  if(u.isEnemy){
    const intent=u.plannedIntent||planEnemyIntent(u);
    setBanner('👁 '+u.name+' · '+(intent?.label||'行动中…'),'enemy');
    setTip(''); $('target-chips').innerHTML='';
    const sk=$('skill-bar'); sk.innerHTML='<div class="target-tip" style="color:var(--ink2)">敌人行动中…</div>';
    scheduleBattle(()=>enemyAction(u),420);
  } else if(u.isSummon){
    setBanner('🌑 '+u.name+' 召唤中…','anim');
    setTip(''); $('target-chips').innerHTML='';
    $('skill-bar').innerHTML='<div class="target-tip" style="color:var(--ink2)">召唤物行动中…</div>';
    scheduleBattle(()=>summonAction(u),400);
  } else {
    if(window.BattleDecision?.onPlayerTurn())return;
    if(autoBattle){
      const decision=detectCriticalDecision(u);
      if(decision)openCriticalDecision(decision);
      else scheduleAutoDecision(u);
    }
    else {setBanner('⚔ 你的回合 · '+u.name,'player');setTip('手动模式：选择技能');}
  }
}

function processDOT(){
  [...state.allies,...state.enemies].forEach(u=>{
    if(!u.alive)return;
    const dots=u.debuffs.filter(d=>DOT_RATES[d.type]);
    const deferredDots=new Set();
    dots.forEach(d=>{
      if(d._deferTick){delete d._deferTick;deferredDots.add(d);return;}
      const base=u.maxHp*DOT_RATES[d.type];
      const dmg=Math.max(1,Math.floor(base*(1+(d.sourceEm||0)/200)));
      const dotSource=[...state.allies,...state.reserveUnits,...state.enemies].find(unit=>unit.uid===d.sourceUid)||null;
      applyDamageToUnit(u,dmg,null,{noCounter:true,sourceName:dotSource?.name||'持续伤害',sourceIsEnemy:dotSource?.isEnemy,skillName:STATUS[d.type]?.name||d.type});
      if(d.type==='burn'&&u.isEnemy&&consumeFormulaTrigger('ember_spores',`target:${u.uid}`,1)){
        const alive=state.enemies.filter(enemy=>enemy.alive&&enemy!==u&&!hasStatus(enemy,'burn')),index=state.enemies.indexOf(u);
        const adjacent=alive.sort((a,b)=>Math.abs(state.enemies.indexOf(a)-index)-Math.abs(state.enemies.indexOf(b)-index))[0];
        if(adjacent){
          const source=[...state.allies,...state.reserveUnits].find(unit=>unit.uid===d.sourceUid)||null;
          applyDot(adjacent,'burn',1,source);const spread=adjacent.debuffs.find(status=>status.type==='burn');if(spread&&state.enemies.indexOf(adjacent)>index)spread._deferTick=true;
          pushLog(`🔥 余烬孢子将灼烧扩散至 ${adjacent.name}`);
        }
      }
    });
    if(u.alive&&hasStatus(u,'regen'))healUnit(u,Math.floor(u.maxHp*0.03));
    if(u.alive&&u.passive&&u.passive.type==='selfRegen')healUnit(u,Math.floor(u.maxHp*u.passive.val));
    u.debuffs=u.debuffs.filter(d=>deferredDots.has(d)||--d.turns>0);
    u.buffs=u.buffs.filter(b=>--b.turns>0);
    u.cooldowns=(u.cooldowns||[]).map(turns=>Math.max(0,turns-1));
    if(u.guardState&&--u.guardState.turns<=0)u.guardState=null;
    if(u.isSummon&&u._acted&&Number.isFinite(u.remainingRounds)&&--u.remainingRounds<=0){u.alive=false;u.curHp=0;pushLog(`🜂 ${u.name} 的召唤时间结束`);}
  });
  if(state.run?.fusionLockRounds>0)state.run.fusionLockRounds--;
  updateHUD();
  scheduleBattle(nextTurn,350);
}

/* ═══════════════════════════════════════════════════════════════
   属性计算（含被动/状态/增益）
   ═══════════════════════════════════════════════════════════════ */
function hasStatus(u,type){ return u.debuffs.some(d=>d.type===type)||u.buffs.some(b=>b.type===type); }
function getBuffValue(u,type){ return u.buffs.filter(b=>b.type===type).reduce((sum,b)=>sum+(b.val||0),0); }
function addStatus(u,type,turns,val,src){
  const st=STATUS[type]; if(!st) return false;
  const arr=st.kind==='buff'?u.buffs:u.debuffs;
  const duration=Math.max(1,turns||st.turns||1);
  const ex=arr.find(d=>d.type===type);
  const data={type,turns:duration,val:val||0,sourceUid:src?src.uid:null,sourceEm:src?src.em||0:0};
  if(ex) Object.assign(ex,data,{turns:Math.max(ex.turns,duration)}); else arr.push(data);
  return true;
}
function addBuff(u,buff){
  if(!u||!u.alive||!buff) return false;
  const ex=u.buffs.find(b=>b.type===buff.type);
  const data={type:buff.type,turns:Math.max(1,buff.turns||1),val:buff.val||0};
  if(ex) Object.assign(ex,data,{turns:Math.max(ex.turns,data.turns),val:Math.max(ex.val||0,data.val)}); else u.buffs.push(data);
  return true;
}
function consumeBuff(u,type){ const i=u.buffs.findIndex(b=>b.type===type); if(i>=0)u.buffs.splice(i,1); }
function consumeStatus(u,type){ let i=u.debuffs.findIndex(d=>d.type===type); if(i>=0){u.debuffs.splice(i,1);return;} consumeBuff(u,type); }
function effAtk(u){
  let a=u.atk;
  if(u.passive&&u.passive.type==='lowhp'&&u.curHp/u.maxHp<u.passive.threshold)a*=1+u.passive.val;
  if(u.passive&&u.passive.type==='firstAct'&&!u._hasActedEver)a*=1+u.passive.val;
  if(hasStatus(u,'curse'))a*=0.8;
  a*=1+getBuffValue(u,'atk');
  a*=1+getBuffValue(u,'nextDamage');
  if(u.boss)a*=1+bossPhaseBonus(u,'atkBonus');
  return a;
}
function effSpd(u){
  let s=u.spd*(1+getBuffValue(u,'spd'));
  if(hasStatus(u,'slow'))s*=0.6;
  if(hasStatus(u,'haste'))s*=1+(getBuffValue(u,'haste')||0.4);
  if(u.boss)s*=1+bossPhaseBonus(u,'spdBonus');
  s*=formationMultiplier('statMultiplier','spd',u);
  return s;
}
function effCrt(u){ let c=u.crt+getBuffValue(u,'crt'); if(u.passive&&u.passive.type==='crtUp')c+=u.passive.val; if(hasStatus(u,'nextCrit'))c+=100; return c; }
function effDef(u){ let d=u.def*(1+getBuffValue(u,'def')); if(hasStatus(u,'defBreak'))d*=0.6; return Math.max(0,d); }
function effRes(u){
  let r=(u.res||0)*(1+getBuffValue(u,'res'));
  if(u.passive&&u.passive.type==='resUp')r*=1+u.passive.val;
  return Math.max(0,r);
}
function effCtd(u){ return (u.ctd||150)*(1+getBuffValue(u,'ctd')); }
function gainEnergy(u,amount,reason){
  if(!u||u.isEnemy||u.isSummon||!u.alive||amount<=0)return 0;
  let adjusted=amount*formationResourceGainMultiplier(u,'energy');if(hasStatus(u,'overload'))adjusted*=0.5;
  adjusted=Math.max(1,Math.round(adjusted));
  const before=u.energy; u.energy=clamp(u.energy+adjusted,0,u.maxEnergy);
  const gained=u.energy-before;
  if(gained>0){ spawnFloat(u,'⚡+'+gained,'#f7dc6f'); if(reason)pushLog(`${u.name} ${reason}，能量 +${gained}`); }
  return gained;
}
function skillIndexOf(u,sk,index){return Number.isInteger(index)?index:(u?.skills||[]).indexOf(sk);}
function skillCooldown(u,sk,index){
  const skillIndex=skillIndexOf(u,sk,index);
  return skillIndex>=0?Math.max(0,u.cooldowns?.[skillIndex]||0):0;
}
function isSkillReady(u,sk,index){return !!u&&!!sk&&skillCooldown(u,sk,index)<=0&&(!sk.ult||u.energy>=u.maxEnergy);}
function startSkillCooldown(u,sk,index){
  const skillIndex=skillIndexOf(u,sk,index);
  if(skillIndex<0)return 0;
  if(!u.cooldowns)u.cooldowns=u.skills.map(()=>0);
  const contractDelta=!u.isEnemy&&!u.isSummon&&skillIndex>0&&!sk.ult?contractEffects('skillCooldownDelta').reduce((sum,effect)=>sum+(Number(effect.value)||0),0):0;
  const turns=Math.max(0,Math.floor(sk.cooldown||0)+contractDelta);
  u.cooldowns[skillIndex]=turns;
  return turns;
}

/* ═══════════════════════════════════════════════════════════════
   伤害 / 效果结算
   ═══════════════════════════════════════════════════════════════ */
function applyStatus(tgt,type,src,chance,turns){
  chance=chance==null?1:chance;
  if(!tgt||!tgt.alive||random()>chance)return false;
  if(tgt.boss&&HARD_CONTROL_TYPES.has(type)&&tgt.controlResistTurns>0){
    spawnFloat(tgt,'免疫'+(STATUS[type]?.name||'控制'),'#f7dc6f');pushLog(`${tgt.name} 免疫${STATUS[type]?.name||'控制'}，控制抗性还剩 ${tgt.controlResistTurns} 次行动`);
    return false;
  }
  if(STATUS[type]&&STATUS[type].kind==='debuff'){
    const resist=clamp(effRes(tgt)/100*0.6,0,0.7);
    if(random()<resist){spawnFloat(tgt,'抵抗'+(STATUS[type]?.name||''),'#a59ec4');pushLog(`${tgt.name} 抵抗了${STATUS[type]?.name||type}`);return false;}
  }
  return addStatus(tgt,type,turns||STATUS[type].turns,null,src);
}
function applyDot(tgt,type,turns,src){ return addStatus(tgt,type,turns||STATUS[type].turns,null,src); }
function markDead(tgt){
  if(!tgt.alive)return false;
  tgt.curHp=0;tgt.alive=false;tgt.shield=0;
  if(tgt.isEnemy)state.kills++;
  spawnBurst(tgt,'#e0493b',12);
  if(!tgt.isEnemy){
    state.allies.forEach(al=>{if(al.alive&&al.passive&&al.passive.type==='guardian')addShieldToUnit(al,al.maxHp*al.passive.val);});
  }
  return true;
}
let pendingVisualAction=null;
function applyDamageToUnit(tgt,dmg,src,opts={}){
  if(!tgt||!tgt.alive||state.phase==='done')return {dealt:0,absorbed:0,killed:false};
  let remaining=Math.max(1,Math.floor(dmg)),absorbed=0,redirected=0;
  if(!tgt.isEnemy&&!tgt.isSummon)remaining=Math.max(1,Math.floor(remaining*formationMultiplier('statMultiplier','damageTaken',tgt)));
  if(tgt.isEnemy&&!opts.ignoreGuard){
    const guard=state.enemies.find(enemy=>enemy.alive&&enemy!==tgt&&enemy.guardState?.turns>0);
    if(guard){
      redirected=Math.floor(remaining*clamp(guard.guardState.redirectPct||0,0,0.8));
      if(redirected>0){remaining-=redirected;applyDamageToUnit(guard,redirected,src,{...opts,ignoreGuard:true,noCounter:true});spawnFloat(tgt,'护卫','#7ec8e3');}
    }
  }
  const shieldBefore=tgt.shield,hpBefore=tgt.curHp;
  if(!opts.ignoreShield&&tgt.shield>0){absorbed=Math.min(tgt.shield,remaining);tgt.shield-=absorbed;remaining-=absorbed;spawnFloat(tgt,'盾吸收 '+absorbed,'#f7dc6f');pushLog(`${tgt.name} 护盾吸收 ${absorbed} 伤害${tgt.shield===0?'，护盾击破':''}`);}
  const dealt=Math.min(tgt.curHp,remaining);
  if(dealt>0){tgt.curHp-=dealt;spawnFloat(tgt,'-'+dealt,'#ff6464');}
  if(pendingVisualAction)pendingVisualAction.hits.push({uid:tgt.uid,sourceUid:src?.uid,hpBefore,hpAfter:tgt.curHp,shieldBefore,shieldAfter:tgt.shield});
  const sourceName=opts.sourceName||src?.name||'持续伤害',sourceIsEnemy=opts.sourceIsEnemy??src?.isEnemy,skillName=opts.skillName||'攻击';
  if(state.run&&dealt>0){
    if(tgt.isEnemy&&sourceIsEnemy===false)state.run.stats.damageDealt+=dealt;
    else if(!tgt.isEnemy){
      const stats=state.run.stats;stats.damageTaken+=dealt;stats.damageSources[sourceName]=(stats.damageSources[sourceName]||0)+dealt;
      if(!stats.largestHit||dealt>stats.largestHit.damage)stats.largestHit={target:tgt.name,source:sourceName,skill:skillName,damage:dealt,wave:state.wave+1};
    }
  }
  if(!tgt.isEnemy&&!tgt.isSummon&&(dealt>0||absorbed>0))gainEnergy(tgt,10,'受击');
  const killed=tgt.curHp<=0?markDead(tgt):false;
  if(killed&&!tgt.isEnemy&&state.run)state.run.stats.lastDefeat={target:tgt.name,source:sourceName,skill:skillName,wave:state.wave+1};
  if(tgt.boss&&!killed)updateBossStage(tgt);
  if(src&&dealt>0&&src.passive&&src.passive.type==='lifesteal')healUnit(src,Math.floor(dealt*src.passive.val));
  if(src&&dealt>0&&tgt.alive&&!opts.noCounter&&tgt.passive&&tgt.passive.type==='counter'){
    dealRaw(tgt,src,Math.floor(effAtk(tgt)*tgt.passive.val),{noCounter:true});
  }
  if(!opts.noFormula&&!tgt.isEnemy&&!tgt.isSummon&&shieldBefore>0&&tgt.shield<=0&&src?.alive&&consumeFormulaTrigger('thorned_aegis',`target:${tgt.uid}:round:${state.turn}`,1)){
    const reflected=Math.max(1,Math.floor(shieldBefore*0.35));dealRaw(tgt,src,reflected,{noCounter:true,noFormula:true});pushLog(`🛡 ${tgt.name} 的棘甲反弹 ${reflected} 伤害`);
  }
  if(!opts.noFormula&&!tgt.isEnemy&&!tgt.isSummon&&tgt.alive&&dealt>=tgt.maxHp*0.25&&consumeFormulaTrigger('emergency_crystal',`target:${tgt.uid}:round:${state.turn}`,1)){
    addShieldToUnit(tgt,tgt.maxHp*0.10);pushLog(`◇ ${tgt.name} 触发应激晶壳`);
  }
  return {dealt,absorbed,redirected,killed};
}
function dealRaw(src,tgt,dmg,opts={}){ return applyDamageToUnit(tgt,dmg,src,opts).dealt; }
function dealDamage(src,sk,tgt,fromPlayer,opts={}){
  if(!src||!src.alive||!tgt||!tgt.alive)return 0;
  if(hasStatus(src,'blind')&&random()<0.25){spawnFloat(src,'MISS','#fff');return 0;}
  const advantage=getAdvantage(src.element,tgt.element),isBasic=(src.skills||[])[0]===sk;
  let dmg=effAtk(src)*(sk.mult||1)*advantage;
  dmg*=window.BossTactics?.multiplier(src,tgt)||1;
  dmg*=formationMultiplier('damageMultiplier',null,src,{isBasic});
  if(!src.isEnemy&&!src.isSummon&&tgt.debuffs.length&&hasFormula('flaw_hunter'))dmg*=1.15;
  if(src.passive&&src.passive.type==='sanction'&&tgt.debuffs.length)dmg*=1+src.passive.val;
  const crit=random()<((sk.crt!=null?sk.crt:effCrt(src))/100);
  if(crit)dmg*=effCtd(src)/100;
  dmg*=120/(120+effDef(tgt));
  const result=applyDamageToUnit(tgt,Math.max(1,Math.floor(dmg)),src,{ignoreShield:opts.ignoreShield,noCounter:opts.noCounter,skillName:sk.name||'攻击'});
  spawnBurst(tgt,ELEMENTS[src.element].glow,10);
  if(crit)spawnFloat(tgt,'暴击!','#ffd54a');
  if(sk.dot&&tgt.alive)applyDot(tgt,sk.dot,sk.dotTurns||2,src);
  if(sk.status&&tgt.alive)applyStatus(tgt,sk.status,src,sk.statusChance,sk.statusTurns);
  if(result.dealt>0&&tgt.alive&&src.passive&&src.passive.type==='shock'){
    applyStatus(tgt,'stun',src,src.passive.val,1);
  }
  if(result.dealt>0&&!src.isEnemy&&!src.isSummon&&advantage>1&&consumeFormulaTrigger('counterflow_cell',`actor:${src.uid}:round:${state.turn}`,1))gainEnergy(src,8,'克制蓄能');
  if(result.dealt>0&&!src.isEnemy&&!src.isSummon&&isBasic){
    const candidates=src.cooldowns.map((turns,index)=>({turns,index})).filter(item=>item.turns>0&&!src.skills[item.index]?.ult).sort((a,b)=>b.turns-a.turns);
    if(candidates.length&&consumeFormulaTrigger('echo_caliper',`actor:${src.uid}:round:${state.turn}`,1)){src.cooldowns[candidates[0].index]--;pushLog(`⌛ ${src.name} 的【${src.skills[candidates[0].index].name}】冷却 -1`);}
  }
  if(hasStatus(src,'nextCrit'))consumeBuff(src,'nextCrit');
  if(getBuffValue(src,'nextDamage')>0)consumeBuff(src,'nextDamage');
  return result.dealt;
}
function healUnit(u,amt){
  if(!u||!u.alive)return 0;
  if(!u.isEnemy&&!u.isSummon)amt*=contractEffects('allyHealingMultiplier').reduce((value,effect)=>value*(Number(effect.value)||1),1);
  const beforePct=u.curHp/u.maxHp;
  const healed=Math.min(u.maxHp-u.curHp,Math.max(0,Math.floor(amt)));
  if(healed>0){
    u.curHp+=healed;spawnFloat(u,'+'+healed,'#46c46a');if(state.run&&!u.isEnemy)state.run.stats.healing+=healed;
    if(!u.isEnemy&&!u.isSummon&&beforePct<=0.40&&u.debuffs.length&&consumeFormulaTrigger('clear_spring',`target:${u.uid}:round:${state.turn}`,1)){
      const removed=u.debuffs.shift();pushLog(`💧 澄泉引净化 ${u.name} 的【${STATUS[removed.type]?.name||removed.type}】`);
    }
  }
  return healed;
}
function healTeam(src,pct){let total=0;state.allies.forEach(a=>{if(a.alive&&!a.isSummon)total+=healUnit(a,Math.floor(a.maxHp*pct));});return total;}
function addShieldToUnit(u,amount,capRatio=MAX_SHIELD_RATIO){
  if(!u||!u.alive)return 0;
  if(!u.isEnemy){amount*=formationMultiplier('statMultiplier','shieldReceived',u);if(!u.isSummon)amount*=contractEffects('allyShieldMultiplier').reduce((value,effect)=>value*(Number(effect.value)||1),1);}
  const cap=Math.max(0,Math.floor(u.maxHp*capRatio));
  const before=Math.min(u.shield,cap);
  u.shield=Math.min(cap,before+Math.max(0,Math.floor(amount)));
  const gained=u.shield-before;
  if(gained>0)spawnFloat(u,'🛡'+gained,'#f7dc6f');
  return gained;
}
function shieldTeam(src,pct){let total=0;state.allies.forEach(a=>{if(a.alive&&!a.isSummon)total+=addShieldToUnit(a,a.maxHp*pct);});return total;}
function buffTeam(buff){let count=0;state.allies.forEach(a=>{if(a.alive&&!a.isSummon&&applyBuffTo(a,buff))count++;});return count;}
function applyBuffTo(u,buff){return addBuff(u,buff);}
function cleanseTeam(n){let total=0;state.allies.forEach(a=>{if(a.alive){const cnt=Math.min(n,a.debuffs.length);a.debuffs.splice(0,cnt);total+=cnt;}});return total;}
function aoeEnemies(src,mult,advFn,ignoreShield){
  let total=0;
  state.enemies.filter(e=>e.alive).forEach(e=>{const extra=advFn?advFn(e):1;total+=dealDamage(src,{mult:mult*extra},e,!src.isEnemy,{ignoreShield});});
  return total;
}
function applyDotAll(type,turns,src){state.enemies.forEach(e=>{if(e.alive)applyDot(e,type,turns,src);});}
function applyStatusAllEnemies(type,turns,chance,src){state.enemies.forEach(e=>{if(e.alive)applyStatus(e,type,src,chance,turns);});}

/* ═══════════════════════════════════════════════════════════════
   玩家操作
   ═══════════════════════════════════════════════════════════════ */
function autoFormalAllies(){return state.allies.filter(a=>a.alive&&!a.isSummon);}
function autoLowestHealthAlly(){return autoFormalAllies().sort((a,b)=>a.curHp/a.maxHp-b.curHp/b.maxHp)[0]||null;}
function autoAttackTarget(u,sk){
  const enemies=state.enemies.filter(e=>e.alive);
  return enemies.sort((a,b)=>{
    const score=t=>{
      const raw=effAtk(u)*(sk.mult||1)*Math.max(1,sk.hits||1)*getAdvantage(u.element,t.element)*120/(120+effDef(t));
      return (raw>=t.curHp?500:0)+(t.charging?220:0)+getAdvantage(u.element,t.element)*90+(1-t.curHp/t.maxHp)*80-((t.curHp+t.shield)/t.maxHp)*12;
    };
    return score(b)-score(a);
  })[0]||null;
}
function skillInterruptProfile(skill){
  if(!skill)return null;
  if(skill.status&&HARD_CONTROL_TYPES.has(skill.status))return {type:skill.status,chance:skill.statusChance==null?1:skill.statusChance,targetMode:skill.type==='attack'?'single':'all'};
  if(skill.name==='冰霜护盾')return {type:'freeze',chance:0.5,targetMode:'priority'};
  return null;
}
function canInterruptEnemy(skill,enemy){
  return !!(skillInterruptProfile(skill)&&enemy?.alive&&enemy.charging&&!(enemy.boss&&enemy.controlResistTurns>0));
}
function skillInterruptChance(skill,enemy){
  const profile=skillInterruptProfile(skill);if(!profile||!canInterruptEnemy(skill,enemy))return 0;
  const resist=STATUS[profile.type]?.kind==='debuff'?clamp(effRes(enemy)/100*0.6,0,0.7):0;
  return clamp(profile.chance*(1-resist),0,1);
}
function autoSkillScore(u,sk,index){
  if(!sk||!isSkillReady(u,sk,index))return -Infinity;
  const strategy=currentAutoStrategy(),damageWeight=strategy.damageWeight||1,supportWeight=strategy.supportWeight||1;
  const allies=autoFormalAllies(),enemies=state.enemies.filter(e=>e.alive);
  if(!enemies.length)return -Infinity;
  // 炼成策略会保留满能量，等待任一异元素队友攒够协力能量；否则大招会抢先清空融合资源。
  if(strategy.fusionPolicy==='auto'&&sk.ult&&u.energy>=u.maxEnergy&&state.allies.some(ally=>ally.alive&&!ally.isSummon&&ally!==u&&ally.element!==u.element))return -Infinity;
  const missing=allies.reduce((sum,a)=>sum+(a.maxHp-a.curHp)/a.maxHp,0);
  const lowest=autoLowestHealthAlly(),lowestMissing=lowest?1-lowest.curHp/lowest.maxHp:0;
  const dead=state.allies.filter(a=>!a.alive&&!a.isSummon).length;
  const debuffs=allies.reduce((sum,a)=>sum+a.debuffs.length,0);
  const ultimateBonus=sk.ult?500:0;
  const interruptBonus=enemies.some(enemy=>canInterruptEnemy(sk,enemy))?260:0;
  if(sk.type==='attack')return (ultimateBonus+interruptBonus+(sk.mult||1)*Math.max(1,sk.hits||1)*100+(sk.chain||0)*55+(sk.status?25:0)+(sk.dot?20:0))*damageWeight;
  if(sk.type==='aoe')return (ultimateBonus+interruptBonus+(sk.mult||1)*Math.max(1,sk.hits||1)*100*Math.max(1,enemies.length*.75)+(sk.status?35:0)+(sk.dot?30:0))*damageWeight;
  if(sk.type==='heal'){
    const teamThreshold=strategy.id==='steady'?.07:strategy.id==='assault'?.20:.12,singleThreshold=strategy.id==='steady'?.05:strategy.id==='assault'?.14:.08;
    const usefulHealing=sk.single?lowestMissing>=singleThreshold:missing>=teamThreshold;
    if(!usefulHealing&&!(sk.revive&&dead)&&!(sk.cleanse&&debuffs))return -Infinity;
    return (ultimateBonus+190+(sk.single?lowestMissing:missing)*420+dead*420+debuffs*90)*supportWeight;
  }
  if(sk.type==='cleanse'){
    if(!debuffs&&missing<.12)return -Infinity;
    return (ultimateBonus+170+debuffs*180+missing*260)*supportWeight;
  }
  if(sk.type==='shield'){
    const needsShield=allies.some(a=>a.shield<a.maxHp*.2);
    const buffUseful=sk.buff&&allies.some(a=>!a.buffs.some(b=>b.type===sk.buff.type));
    if(!needsShield&&!buffUseful)return -Infinity;
    return (ultimateBonus+interruptBonus+215+missing*90+(buffUseful?45:0))*supportWeight;
  }
  if(sk.type==='buff'){
    const recipients=sk.selfOnly?[u]:allies;
    if(!sk.buff||recipients.every(a=>a.buffs.some(b=>b.type===sk.buff.type)))return -Infinity;
    return (ultimateBonus+210)*supportWeight;
  }
  if(sk.type==='summon'){
    const slots=MAX_ACTIVE_SUMMONS-state.allies.filter(a=>a.alive&&a.isSummon).length;
    return slots>0?(ultimateBonus+230+slots*12)*supportWeight:-Infinity;
  }
  return -Infinity;
}
function chooseAutoAction(u){
  if(!u||u.isEnemy||u.isSummon||!u.alive||u._acted)return null;
  const choices=u.skills.map((skill,index)=>({skill,index,score:autoSkillScore(u,skill,index)})).filter(action=>Number.isFinite(action.score));
  choices.sort((a,b)=>b.score-a.score||a.index-b.index);
  const action=choices[0];if(!action)return null;
  action.target=action.skill.type==='attack'?autoAttackTarget(u,action.skill):action.skill.type==='heal'&&action.skill.single?autoLowestHealthAlly():null;
  if((action.skill.type==='attack'||(action.skill.type==='heal'&&action.skill.single))&&!action.target)return null;
  return action;
}
function runAutoDecision(u,token){
  if(token!==autoDecisionToken||!autoBattle||currentPlayerActor()!==u)return false;
  const bypassCritical=!!state.run?.criticalBypassOnce;if(state.run)state.run.criticalBypassOnce=false;
  const critical=bypassCritical?null:detectCriticalDecision(u);
  if(critical)return openCriticalDecision(critical);
  if(currentAutoStrategy().fusionPolicy==='auto'){
    const fusion=recommendFusion(u);
    if(fusion&&executeFusionAction(fusion,{source:'auto'}))return true;
  }
  const action=chooseAutoAction(u);
  if(action){
    state.selSkill=action.index;
    if(executePlayerSkill(u,action.skill,action.target))return true;
  }
  // 数据或局势在决策与提交之间变化时，必须回退到一个可用普攻，不能滞留选靶态。
  if(token!==autoDecisionToken||!autoBattle||currentPlayerActor()!==u)return false;
  state.target=null;state.selSkill=null;$('target-chips').innerHTML='';
  const index=u.skills.findIndex((sk,skillIndex)=>!sk.ult&&isSkillReady(u,sk,skillIndex)&&(sk.type==='attack'||sk.type==='aoe'));
  const skill=u.skills[index];const target=skill&&skill.type==='attack'?autoAttackTarget(u,skill):null;
  if(skill&&executePlayerSkill(u,skill,target)){pushLog(`⚙ ${u.name} 自动决策回退为【${skill.name}】`);return true;}
  // 极端坏数据也必须交出回合；正常角色数据会在上面的普攻分支完成。
  state.phase='anim';u._acted=true;u._hasActedEver=true;pushLog(`⚙ ${u.name} 无可用行动，跳过回合`);renderAll();scheduleBattle(afterPlayer,160);return true;
}
function scheduleAutoDecision(u,delay=360){
  const token=++autoDecisionToken;
  setBanner('⚙ 自动回合 · '+u.name,'player');setTip('自动战斗：正在选择行动…');
  scheduleBattle(()=>runAutoDecision(u,token),delay);
  return token;
}
function playerSelectSkill(idx,{preview=false}={}){
  if(state.phase!=='player'||autoBattle) return;
  const u=state.turnOrder[state.curIdx];
  if(!u||!u.alive||u._acted) return;
  const sk=u.skills[idx];
  if(!sk) return;
  if(!isSkillReady(u,sk,idx)) return;
  if(state.selSkill===idx){ state.selSkill=null; state.target=null; renderSkillBar(); setTip('选择技能'); $('target-chips').innerHTML=''; return; }
  state.selSkill=idx;
  if(preview&&window.BattleDecision&&sk.type!=='attack'&&!(sk.type==='heal'&&sk.single)){
    state.target={unit:u,skill:sk,side:'group'};renderSkillBar();setTip('');renderTargetChips();return;
  }
  if(sk.type==='heal'&&sk.single){
    state.target={unit:u,skill:sk,side:'ally'};
    renderSkillBar();setTip('🎯 选择一名存活队友进行治疗（战场或下方按钮）');renderTargetChips();return;
  }
  if(sk.type==='heal'||sk.type==='shield'||sk.type==='buff'||sk.type==='cleanse'){
    executePlayerSkill(u,sk,null); return;
  }
  if(sk.type==='summon'){ executePlayerSkill(u,sk,null); return; }
  // attack / aoe: aoe 自动全体，attack 需选敌
  if(sk.type==='aoe'){ executePlayerSkill(u,sk,null); return; }
  // 单体攻击 → 进入选敌
  state.target={unit:u,skill:sk,side:'enemy'};
  renderSkillBar(); setTip('🎯 点击战场敌人选择目标（或下方按钮）'); renderTargetChips();
}
function targetCandidates(side){
  return side==='ally'
    ? state.allies.filter(u=>u.alive&&!u.isSummon)
    : state.enemies.filter(u=>u.alive);
}
function renderTargetChips(){
  const box=$('target-chips'); box.innerHTML='';
  const side=state.target&&state.target.side;
  if(side==='group'){
    const confirm=document.createElement('button');confirm.className='tgt show target-confirm';confirm.textContent='确认施放 · '+state.target.skill.name;confirm.onclick=()=>window.BattleDecision?.confirmGroup();box.appendChild(confirm);
  }
  (side==='group'?[]:targetCandidates(side)).forEach(unit=>{
    const b=document.createElement('button'); b.className='tgt show';
    b.textContent=ELEMENTS[unit.element].symbol+unit.name+' '+unit.curHp+'/'+unit.maxHp;
    b.onmouseenter=b.onfocus=()=>window.BattleDecision?.selectTarget(unit);b.onmouseleave=b.onblur=()=>window.BattleDecision?.selectTarget(null);
    b.onclick=()=>resolveTarget(unit); box.appendChild(b);
  });
  const cancel=document.createElement('button'); cancel.className='tgt show';
  cancel.textContent='✕ 取消'; cancel.onclick=()=>{state.selSkill=null;state.target=null;window.BattleDecision?.selectTarget(null);renderSkillBar();setTip('选择技能');$('target-chips').innerHTML='';};
  box.appendChild(cancel);
}
function resolveTarget(target){
  if(!state.target||state.target.side==='group'||!targetCandidates(state.target.side).includes(target))return;
  const pending=state.target;state.target=null;$('target-chips').innerHTML='';executePlayerSkill(pending.unit,pending.skill,target);
}

function executePlayerSkill(u,sk,target){
  if(state.phase!=='player'||!u||!sk||!u.alive||u._acted||u.isEnemy||u.isSummon||state.turnOrder[state.curIdx]!==u)return false;
  const skillIndex=skillIndexOf(u,sk);
  if(!isSkillReady(u,sk,skillIndex))return false;
  state.phase='anim';state.selSkill=null;renderSkillBar();setTip('');
  setBanner('✨ '+u.name+' 施放【'+sk.name+'】','anim');
  const visual=captureBattleAction();
  visual.selectedTargetUid=target?.uid;
  visual.expectedTargetUids=sk.type==='attack'?[target?.uid].filter(Boolean):sk.type==='aoe'?state.enemies.filter(e=>e.alive).map(e=>e.uid)
    :sk.type==='summon'?[]:sk.selfOnly?[u.uid]:sk.single?[target?.uid].filter(Boolean):state.allies.filter(a=>!a.isSummon&&(a.alive||sk.revive)).map(a=>a.uid);
  const outcome=resolveSkill(u,sk,target,true);
  if(outcome===false){pendingVisualAction=null;state.phase='player';renderSkillBar();setTip('该技能当前无法生效，请选择其他技能');return false;}
  startSkillCooldown(u,sk,skillIndex);
  if(sk.ult)u.energy=0;
  else{
    const baseGain=outcome&&outcome.support?15:20;
    const masteryBonus=skillIndex===0?(u.masteryBasicEnergyBonus||0):0;
    gainEnergy(u,baseGain+masteryBonus,outcome&&outcome.support?'辅助施法':'施放技能');
  }
  u._acted=true;u._hasActedEver=true;
  const duration=animateBattleAction(u,sk,visual);
  renderAll();
  scheduleBattle(afterPlayer,duration);
  return true;
}
function afterPlayer(){ state.curIdx++; processTurn(); }

function summonUnits(u,sk){
  const def=SUMMONS[sk.summon];if(!def)return 0;
  loadArt(def.art);
  const active=state.allies.filter(a=>a.alive&&a.isSummon).length;
  const count=Math.min(sk.summonCount||1,Math.max(0,MAX_ACTIVE_SUMMONS-active));
  for(let i=0;i<count;i++){
    const summon=makeUnit(def,false,def);
    const inheritedGrowth=1+Math.max(0,(u.codexLevel||1)-1)*PROGRESSION_RULES.codex.statGrowthPerLevel*0.5;
    summon.maxHp=Math.floor(summon.maxHp*inheritedGrowth);summon.curHp=summon.maxHp;summon.atk=Math.floor(summon.atk*inheritedGrowth);summon.def=Math.floor(summon.def*inheritedGrowth);
    if(Number.isFinite(sk.summonAtkMultiplier))summon.atk=Math.floor(summon.atk*sk.summonAtkMultiplier);
    summon.remainingRounds+=formationSummonDurationDelta()+(Number(sk.summonDurationDelta)||0);
    state.allies.push(summon);spawnFloat(u,'召唤 '+def.name,'#b388ff');
  }
  pushLog(count?`🌑 ${u.name} 召唤 ${count} 个【${def.name}】`:'🌑 召唤位已满');
  return count;
}
function reviveTeam(){
  let count=0;
  state.allies.forEach(al=>{if(!al.alive&&!al.isSummon){al.alive=true;al.curHp=Math.max(1,Math.floor(al.maxHp*0.4));al.debuffs=[];al.shield=0;al._acted=true;spawnFloat(al,'复活','#46c46a');count++;}});
  return count;
}
function resolveSkill(u,sk,target,fromPlayer){
  let affected=0,support=false;
  if(sk.type==='heal'){
    if(sk.revive)affected+=reviveTeam();
    if(sk.single){const t=target&&target.alive&&!target.isSummon?target:state.allies.filter(a=>a.alive&&!a.isSummon).sort((x,y)=>x.curHp/x.maxHp-y.curHp/y.maxHp)[0];if(t)affected+=healUnit(t,Math.floor(t.maxHp*sk.healPct));}
    else affected+=healTeam(u,sk.healPct||0);
    if(sk.cleanse)affected+=cleanseTeam(99);
    support=true;spawnBurst(u,'#46c46a',16);
  } else if(sk.type==='cleanse'){
    affected+=cleanseTeam(99);if(sk.healPct)affected+=healTeam(u,sk.healPct);support=true;spawnBurst(u,'#7ec8e3',14);
  } else if(sk.type==='shield'){
    affected+=shieldTeam(u,sk.shieldPct||0);if(sk.buff)affected+=buffTeam(sk.buff);
    if(sk.name==='冰霜护盾'){
      const enemies=state.enemies.filter(enemy=>enemy.alive),e=enemies.find(enemy=>canInterruptEnemy(sk,enemy))||choice(enemies);
      if(e&&applyStatus(e,'freeze',u,0.5,1))affected++;
    }
    if(sk.evolutionControl==='frostwave')state.enemies.filter(enemy=>enemy.alive).forEach(enemy=>{if(applyStatus(enemy,'slow',u,1,2))affected++;});
    support=true;spawnBurst(u,'#f7dc6f',16);
  } else if(sk.type==='buff'){
    affected+=sk.selfOnly?(applyBuffTo(u,sk.buff)?1:0):buffTeam(sk.buff);support=true;spawnBurst(u,'#b8e994',14);
  } else if(sk.type==='summon'){
    affected+=summonUnits(u,sk);support=true;spawnBurst(u,'#b388ff',18);
  } else if(sk.type==='aoe'){
    const hitSkill={...sk,dot:null,status:null};
    if(sk.hits&&sk.hits>1){for(let h=0;h<sk.hits;h++)state.enemies.filter(e=>e.alive).forEach(e=>{affected+=dealDamage(u,hitSkill,e,fromPlayer);});}
    else affected+=aoeEnemies(u,sk.mult||1);
    applyAoeSideEffects(u,sk);
  } else {
    if(!target||!target.alive)target=state.enemies.find(e=>e.alive);
    if(!target)return false;
    if(sk.hits&&sk.hits>1){for(let h=0;h<sk.hits&&target.alive;h++)affected+=dealDamage(u,sk,target,fromPlayer);}
    else affected+=dealDamage(u,sk,target,fromPlayer);
    if(sk.chain){const pool=state.enemies.filter(e=>e.alive&&e!==target);for(let j=0;j<sk.chain&&pool.length;j++){const nx=pool.splice(Math.floor(random()*pool.length),1)[0];affected+=dealDamage(u,{mult:(sk.mult||1)*0.6},nx,fromPlayer);spawnFloat(nx,'连锁','#c89bff');}}
  }
  if(sk.summon&&sk.type!=='summon')affected+=summonUnits(u,sk);
  pushLog(`${support?'✨':'⚔'} ${u.name} 施放【${sk.name}】`);
  return {affected,support};
}
function applyAoeSideEffects(u,sk){if(sk.dot)applyDotAll(sk.dot,sk.dotTurns||2,u);if(sk.status)applyStatusAllEnemies(sk.status,sk.statusTurns||2,sk.statusChance,u);}

/* ═══════════════════════════════════════════════════════════════
   元素融合
   ═══════════════════════════════════════════════════════════════ */
function fusionAssistCandidates(actor,requireEnergy=false){
  if(!actor)return [];
  const assistCost=Math.round(20*formationFusionAssistCostMultiplier()),byElement=new Map();
  state.allies.forEach((ally,index)=>{
    if(!ally.alive||ally.isSummon||ally===actor||ally.element===actor.element||(requireEnergy&&ally.energy<assistCost))return;
    const current=byElement.get(ally.element);
    if(!current||ally.energy>current.unit.energy)byElement.set(ally.element,{unit:ally,index});
  });
  return [...byElement.values()].sort((left,right)=>right.unit.energy-left.unit.energy||left.index-right.index).map(entry=>entry.unit);
}
function listFusionActions(actor){
  if(!actor||!actor.alive||actor.isEnemy||actor.isSummon||actor._acted||actor.energy<actor.maxEnergy||state.run?.fusionLockRounds>0)return [];
  const assistants=fusionAssistCandidates(actor,true),assistCost=Math.round(20*formationFusionAssistCostMultiplier());
  const maxAssistants=actor.int>=60&&!state.run?.tripleFusionUsed?2:1,groups=assistants.map(assistant=>[assistant]);
  if(maxAssistants>1){
    for(let i=0;i<assistants.length;i++)for(let j=i+1;j<assistants.length;j++)groups.push([assistants[i],assistants[j]]);
  }
  return groups.map(group=>{
    const elements=[actor.element,...group.map(assistant=>assistant.element)],info=fusionInfo(elements);
    return info?{kind:'fusion',actorUid:actor.uid,assistantUids:group.map(assistant=>assistant.uid),elements,key:fuseKey(elements),assistCost,name:info.name,emoji:info.emoji,info}:null;
  }).filter(Boolean);
}
function fusionActionScore(action){
  if(!action)return -Infinity;
  const text=`${action.name||''} ${action.info?.desc||''}`,allies=state.allies.filter(unit=>unit.alive&&!unit.isSummon);
  const missing=allies.reduce((sum,unit)=>sum+Math.max(0,1-unit.curHp/unit.maxHp),0),dead=state.allies.filter(unit=>!unit.alive&&!unit.isSummon).length;
  const charging=state.enemies.some(enemy=>enemy.alive&&enemy.charging&&!(enemy.boss&&enemy.controlResistTurns>0));
  let score=200+action.assistantUids.length*95;
  if(/复活|治疗|回复|护盾|净化|祝福/.test(text))score+=missing*260+dead*520;
  if(charging&&/冰冻|麻痹/.test(text))score+=380;
  if(/极高|超大|高伤|双倍|即死|无视护盾/.test(text))score+=110;
  if(action.key==='dark+light')score-=35;
  return score;
}
function recommendFusion(actor){
  return listFusionActions(actor).map(action=>({...action,score:fusionActionScore(action)}))
    .sort((left,right)=>right.score-left.score||right.assistantUids.length-left.assistantUids.length||left.key.localeCompare(right.key,'en'))[0]||null;
}
function fusionPropertyDelta(key,property){
  if(!state.run)return 0;
  return (state.run.formulas||[]).map(formulaById).filter(Boolean)
    .flatMap(formula=>formula.effects||[])
    .filter(effect=>effect.kind==='fusionPropertyDelta'&&effect.target===key&&effect.property===property)
    .reduce((sum,effect)=>sum+(Number(effect.value)||0),0);
}
function validateFusionAction(action){
  if(!action||action.kind!=='fusion'||state.phase!=='player')return false;
  const actor=state.allies.find(unit=>unit.uid===action.actorUid),current=state.turnOrder[state.curIdx];
  if(!actor||actor!==current||!actor.alive||actor._acted||actor.isEnemy||actor.isSummon||actor.energy<actor.maxEnergy||state.run?.fusionLockRounds>0)return false;
  const ids=Array.isArray(action.assistantUids)?action.assistantUids:[];
  const maxAssistants=actor.int>=60?2:1;
  if(ids.length<1||ids.length>maxAssistants||new Set(ids).size!==ids.length||(ids.length===2&&state.run?.tripleFusionUsed))return false;
  const assistants=ids.map(uid=>state.allies.find(unit=>unit.uid===uid));
  const assistCost=Math.round(20*formationFusionAssistCostMultiplier());
  if(assistants.some(unit=>!unit||!unit.alive||unit.isEnemy||unit.isSummon||unit===actor||unit.energy<assistCost))return false;
  const elements=[actor.element,...assistants.map(unit=>unit.element)];
  return new Set(elements).size===elements.length&&(!action.key||action.key===fuseKey(elements))&&!!fusionInfo(elements);
}
function executeFusionAction(action,{source='manual'}={}){
  if(!validateFusionAction(action))return false;
  const actor=state.allies.find(unit=>unit.uid===action.actorUid),assistants=action.assistantUids.map(uid=>state.allies.find(unit=>unit.uid===uid));
  const elements=[actor.element,...assistants.map(unit=>unit.element)],key=fuseKey(elements),info=fusionInfo(elements),assistCost=Math.round(20*formationFusionAssistCostMultiplier());
  const overloadDelta=Math.max(0,Math.floor(fusionPropertyDelta(key,'overloadTurns')));
  closeFusion();state.phase='anim';state.target=null;state.selSkill=null;$('target-chips').innerHTML='';renderSkillBar();setTip('');
  setBanner('✦ '+actor.name+' 元素融合【'+info.name+'】','anim');
  actor.energy=0;assistants.forEach(ally=>{ally.energy=Math.max(0,ally.energy-assistCost);});
  if(state.run){
    state.run.fusionAssistDiscountUsed=true;state.run.fusionLockRounds=Math.max(state.run.fusionLockRounds||0,2+overloadDelta);
    if(assistants.length===2)state.run.tripleFusionUsed=true;
    state.run.stats=state.run.stats||{};state.run.stats.fusions=(state.run.stats.fusions||0)+1;
    if(source==='auto')state.run.stats.autoFusions=(state.run.stats.autoFusions||0)+1;
  }
  const visual=captureBattleAction();
  pushLog(`${source==='auto'?'⚙ ':''}✦ ${actor.name} 融合【${info.name}】`);spawnBurst(actor,'#f7dc6f',24);
  info.apply(actor);addStatus(actor,'overload',1+overloadDelta,0,actor);
  actor._acted=true;actor._hasActedEver=true;const duration=animateBattleAction(actor,{name:info.name,type:'aoe',ult:true},visual);renderAll();scheduleBattle(afterPlayer,duration);return true;
}
function openFusion(){
  if(state.phase!=='player'||autoBattle)return false;
  const u=state.turnOrder[state.curIdx];
  if(!u||!u.alive||u._acted||u.energy<u.maxEnergy||state.run?.fusionLockRounds>0)return false;
  const assistCost=Math.round(20*formationFusionAssistCostMultiplier());
  state.fusionCtx={u,picks:[],max:u.int>=60&&!state.run?.tripleFusionUsed?2:1,assistCost};
  $('fusion-desc').textContent=`以 ${ELEMENTS[u.element].symbol}${ELEMENTS[u.element].cn} 为基底，选择 1 个队友元素进行双元素融合${state.fusionCtx.max>1?'，或选择 2 个进行本局唯一的三元素融合':state.run?.tripleFusionUsed?'；本局三元素融合已使用':'；当前智力仅支持双元素融合'}；每位协力者消耗 ${assistCost} 能量。`;
  const opts=fusionAssistCandidates(u,false).map(a=>({el:a.element,label:a.name,ally:true,unit:a,eligible:a.energy>=assistCost}));
  const box=$('fusion-chips');box.innerHTML='';
  opts.forEach((o,i)=>{
    const el=ELEMENTS[o.el];
    const c=document.createElement('button');c.type='button';c.className='fchip';c.disabled=!o.eligible;c.style.setProperty('--ec',el.color);c.style.setProperty('--ecg',el.glow);
    c.innerHTML=`<div class="fs">${el.symbol}</div><div class="fn">${el.cn}<br><span style="opacity:.7">${o.label} · ${Math.round(o.unit.energy)}/${assistCost}</span></div>`;
    if(!o.eligible)c.title=`协力能量不足：需要 ${assistCost}`;
    c.onclick=()=>toggleFuse(i);c._opt=o;c.dataset.idx=i;box.appendChild(c);
  });
  state.fusionCtx.chips=[...box.children];
  $('fusion-go').disabled=true;
  $('fusion-preview').innerHTML=opts.some(option=>option.eligible)?'选择 1 个能量充足的元素以预览双融合':opts.length?`队友能量不足，每位协力者需要 ${assistCost} 能量`:'当前没有可融合的存活队友元素';
  $('fusion-modal').classList.add('show');return true;
}
function toggleFuse(i){
  const ctx=state.fusionCtx;if(!ctx)return;
  const chip=ctx.chips[i];if(!chip||chip.disabled)return;
  const idx=ctx.picks.indexOf(i);
  if(idx>=0){ctx.picks.splice(idx,1);chip.classList.remove('sel');}
  else{
    if(ctx.picks.length>=ctx.max){const removed=ctx.picks.shift();ctx.chips[removed].classList.remove('sel');}
    ctx.picks.push(i);chip.classList.add('sel');
  }
  const els=[ctx.u.element,...ctx.picks.map(p=>ctx.chips[p]._opt.el)];
  const info=fusionInfo(els);
  if(info){$('fusion-preview').innerHTML=`${info.emoji} <b>${info.name}</b> — ${info.desc}`;$('fusion-go').disabled=false;}
  else{$('fusion-preview').innerHTML=ctx.picks.length?'该元素组合尚未解锁，请更换选择':'选择 1 个元素以预览双融合';$('fusion-go').disabled=true;}
}
function fusionInfo(els){
  const unique=[...new Set(els)];
  if(unique.length!==els.length)return null;
  const source=els.length===3?FUSION3:els.length===2?FUSION2:null;
  const entry=source?fusionEntry(source,els):null;
  return entry?{...entry}:null;
}
function confirmFusion(){
  const ctx=state.fusionCtx;if(!ctx)return;
  const u=state.turnOrder[state.curIdx];
  if(state.phase!=='player'||u!==ctx.u||!u.alive||u._acted||u.energy<u.maxEnergy)return;
  if(ctx.picks.length<1||ctx.picks.length>ctx.max)return;
  const els=[u.element,...ctx.picks.map(p=>ctx.chips[p]._opt.el)];
  const info=fusionInfo(els);if(!info)return;
  const assistants=ctx.picks.map(p=>ctx.chips[p]._opt.unit).filter(Boolean);
  const action={kind:'fusion',actorUid:u.uid,assistantUids:assistants.map(ally=>ally.uid),elements:els,key:fuseKey(els),assistCost:ctx.assistCost,name:info.name,emoji:info.emoji,info};
  if(!executeFusionAction(action,{source:'manual'}))$('fusion-preview').textContent='战场状态已变化，当前无法施放该融合';
}
function closeFusion(){ $('fusion-modal')?.classList.remove('show'); state.fusionCtx=null; }

let criticalPreviousFocus=null;
function criticalSkillRecommendation(actor,chargingEnemy){
  if(!actor||!chargingEnemy)return null;
  const candidate=actor.skills.map((skill,index)=>({skill,index,chance:skillInterruptChance(skill,chargingEnemy)}))
    .filter(item=>isSkillReady(actor,item.skill,item.index)&&item.chance>0)
    .sort((left,right)=>right.chance-left.chance||left.index-right.index)[0];
  if(!candidate)return null;
  const target=candidate.skill.type==='attack'?chargingEnemy:null;
  return {kind:'skill',actorUid:actor.uid,skillIndex:candidate.index,targetUid:target?.uid||null,name:candidate.skill.name,
    label:`${candidate.skill.name}${target?` → ${target.name}`:candidate.skill.name==='冰霜护盾'?'（威胁优先控制）':'（范围控制）'}`};
}
function detectCriticalDecision(actor){
  if(currentAutoStrategy().fusionPolicy!=='pauseCritical'||state.phase!=='player'||currentPlayerActor()!==actor||!state.run)return null;
  state.run.criticalSeen=state.run.criticalSeen||{};
  const charging=state.enemies.find(enemy=>enemy.alive&&enemy.charging);
  if(charging){
    const key=`charge:${state.wave}:${charging.uid}:${charging.patternStep||0}`;
    if(!state.run.criticalSeen[key]){
      const action=criticalSkillRecommendation(actor,charging)||recommendFusion(actor);
      if(action)return {id:key,type:'boss-charge',title:'Boss 正在蓄力',desc:`${charging.name} 即将施放【${charging.skills[charging.charging.skillIndex]?.name||'高危技能'}】，现在是打断或抢先爆发的关键窗口。`,action,
        recommendation:action.kind==='fusion'?`${action.emoji} 融合【${action.name}】`:`⛓ 施放【${action.name}】`};
    }
  }
  if(!state.run.criticalSeen['fusion:first']){
    const action=recommendFusion(actor);
    if(action)return {id:'fusion:first',type:'fusion-ready',title:'首次融合已就绪',desc:'稳健策略检测到本局第一个合法融合。你可以采用推荐，也可以切手动保留能量。',action,
      recommendation:`${action.emoji} ${actor.name} + ${action.assistantUids.map(uid=>state.allies.find(unit=>unit.uid===uid)?.name).filter(Boolean).join(' + ')} → 【${action.name}】`};
  }
  return null;
}
function criticalFocusable(){
  const modal=$('critical-decision-modal');if(!modal||modal.hidden)return [];
  return [...modal.querySelectorAll('button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length>0);
}
function openCriticalDecision(decision){
  const modal=$('critical-decision-modal');if(!decision||!modal||!state.run)return false;
  invalidateAutoDecision();closeFusion();state.target=null;state.selSkill=null;$('target-chips').innerHTML='';
  state.run.criticalSeen=state.run.criticalSeen||{};state.run.criticalSeen[decision.id]=true;
  if(decision.action?.kind==='fusion')state.run.criticalSeen['fusion:first']=true;
  state.run.criticalDecision=decision;
  state.run.stats=state.run.stats||{};state.run.stats.criticalPauses=(state.run.stats.criticalPauses||0)+1;
  state.phase='decision';setBanner(`◇ 关键决策 · ${decision.title}`,'anim');setTip('自动战斗已暂停，等待你的确认');renderSkillBar();
  $('critical-decision-title').textContent=decision.title;$('critical-decision-desc').textContent=decision.desc;
  $('critical-decision-recommendation').textContent=decision.recommendation;
  $('critical-use-recommendation').onclick=()=>resolveCriticalDecision('recommended');
  $('critical-manual').onclick=()=>resolveCriticalDecision('manual');
  $('critical-continue-auto').onclick=()=>resolveCriticalDecision('continue');
  criticalPreviousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;modal.hidden=false;
  const battle=$('battle-screen');if(battle)battle.inert=true;
  requestAnimationFrame(()=>($('critical-use-recommendation')||modal.querySelector('[tabindex]'))?.focus({preventScroll:true}));
  return true;
}
function closeCriticalDecision({restoreFocus=false}={}){
  const modal=$('critical-decision-modal'),wasOpen=!!modal&&!modal.hidden;if(modal)modal.hidden=true;
  const battle=$('battle-screen');if(battle){battle.inert=false;battle.removeAttribute('inert');}
  if(wasOpen&&restoreFocus&&criticalPreviousFocus?.isConnected)criticalPreviousFocus.focus({preventScroll:true});
  criticalPreviousFocus=null;if(state.run)state.run.criticalDecision=null;
}
function resolveCriticalDecision(mode){
  if(!['recommended','manual','continue'].includes(mode)||state.phase!=='decision'||!state.run?.criticalDecision)return false;
  const decision=state.run.criticalDecision,actor=state.allies.find(unit=>unit.uid===decision.action?.actorUid);
  state.phase='player';closeCriticalDecision({restoreFocus:mode==='manual'});renderAll();
  if(mode==='manual'){
    setAutoBattle(false);pushLog('◇ 已在关键节点切换为手动战斗');return true;
  }
  if(mode==='recommended'){
    if(decision.action.kind==='fusion'&&executeFusionAction(decision.action,{source:'recommended'}))return true;
    if(decision.action.kind==='skill'&&actor===currentPlayerActor()){
      const skill=actor.skills[decision.action.skillIndex],target=decision.action.targetUid?state.enemies.find(unit=>unit.uid===decision.action.targetUid&&unit.alive):null;
      if(skill&&executePlayerSkill(actor,skill,target))return true;
    }
  }
  if(autoBattle&&actor===currentPlayerActor()){
    state.run.criticalBypassOnce=true;
    const token=++autoDecisionToken;setBanner('⚙ 自动回合 · '+actor.name,'player');setTip('自动战斗：继续执行当前策略…');
    return runAutoDecision(actor,token);
  }
  return mode==='continue';
}
document.addEventListener('keydown',event=>{
  const modal=$('critical-decision-modal');if(!modal||modal.hidden)return;
  if(event.key==='Escape'){event.preventDefault();resolveCriticalDecision('manual');return;}
  if(event.key!=='Tab')return;
  const focusable=criticalFocusable();if(!focusable.length){event.preventDefault();return;}
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  else if(!focusable.includes(document.activeElement)){event.preventDefault();first.focus();}
});

/* ═══════════════════════════════════════════════════════════════
   敌方意图 / Boss 阶段 / 敌方与召唤行动
   ═══════════════════════════════════════════════════════════════ */
function getBossPhaseConfig(u,stage=u?.bossStage||1){
  const phases=u?.intentConfig?.phases;
  if(Array.isArray(phases))return phases[stage-1]||null;
  if(phases&&typeof phases==='object')return phases[stage]||phases[String(stage)]||null;
  return null;
}
function bossPhaseBonus(u,key){
  const phases=u?.intentConfig?.phases;
  if(!Array.isArray(phases))return Math.max(0,(u?.bossStage||1)-1)*(key==='atkBonus'?0.15:0.08);
  return phases.slice(0,u?.bossStage||1).reduce((sum,phase)=>sum+(Number(phase?.[key])||0),0);
}
function updateBossStage(u){
  if(!u||!u.boss||!u.alive)return 0;
  const ratio=u.curHp/u.maxHp;
  const phases=u.intentConfig?.phases;
  const phaseIndex=Array.isArray(phases)?phases.findIndex(phase=>ratio>=(phase.minHpPct??0)):-1;
  const nextStage=phaseIndex>=0?phaseIndex+1:ratio<=0.35?3:ratio<=0.70?2:1;
  if(nextStage<=u.bossStage)return u.bossStage;
  // A telegraphed storm remains a promise across an HP phase transition.
  // Only control or the actual release may end this Boss's charged attack.
  const retainedCharge=u.intentConfig?.coreExposure?u.charging:null;
  u.bossStage=nextStage;u.patternStep=0;u.charging=retainedCharge;u.plannedIntent=null;
  const phase=getBossPhaseConfig(u,nextStage);
  if(phase?.element&&ELEMENTS[phase.element])u.element=phase.element;
  pushLog(`⚠ ${u.name} 进入第 ${nextStage} 阶段，攻击与速度提升`);
  if(retainedCharge)pushLog('混沌风暴仍在蓄力，切换阶段不会取消已预告的攻击');
  setBanner(`⚠ Boss 阶段 ${nextStage} · ${phase?.label||phase?.id||'混沌调谐'}`,'enemy');
  planEnemyIntent(u,true);updateEnemyIntentUI();
  return nextStage;
}
function enemyChooseTarget(rule='front'){
  const visible=state.allies.filter(a=>a.alive&&!hasStatus(a,'invis'));
  if(!visible.length)return null;
  const front=visible.filter(a=>a.pos==='front');
  const back=visible.filter(a=>a.pos==='back');
  if(rule==='back')return choice(back.length?back:(front.length?front:visible));
  if(rule==='lowest')return [...visible].sort((a,b)=>a.curHp/a.maxHp-b.curHp/b.maxHp)[0];
  if(rule==='random')return choice(visible);
  return choice(front.length?front:(back.length?back:visible));
}
function enemyPattern(u){
  const phase=getBossPhaseConfig(u);
  return phase?.pattern||u.intentConfig?.pattern||[];
}
function patternSkillIndex(u,entry){
  if(Number.isInteger(entry))return entry;
  const key=typeof entry==='object'?(entry.skill??entry.id??entry.name):entry;
  if(typeof key!=='string')return -1;
  return u.skills.findIndex(skill=>skill.id===key||skill.name===key||skill.intent?.id===key||skill.intent?.type===key);
}
function availableEnemySkillIndices(u){return u.skills.map((skill,index)=>isSkillReady(u,skill,index)?index:-1).filter(index=>index>=0);}
function chooseEnemySkillIndex(u){
  if(u.charging)return u.charging.skillIndex;
  const available=availableEnemySkillIndices(u);
  if(!available.length)return -1;
  const pattern=enemyPattern(u);
  for(let offset=0;offset<pattern.length;offset++){
    const index=patternSkillIndex(u,pattern[(u.patternStep+offset)%pattern.length]);
    if(available.includes(index))return index;
  }
  return [...available].sort((a,b)=>(u.skills[b].intent?.priority||0)-(u.skills[a].intent?.priority||0)||a-b)[0];
}
function planEnemyIntent(u,force=false){
  if(!u||!u.alive)return null;
  if(u.plannedIntent&&!force)return u.plannedIntent;
  const skillIndex=chooseEnemySkillIndex(u);
  if(skillIndex<0){u.plannedIntent={skillIndex:-1,label:'观察战场',type:'wait',targetRule:'none',targetUid:null};return u.plannedIntent;}
  const sk=u.skills[skillIndex],meta=sk.intent||{};
  const phase=getBossPhaseConfig(u);
  const rawTargetRule=meta.target||u.intentConfig?.targetRule||(sk.type==='aoe'?'all':'front');
  const targetRule=['all','allEnemies','allAllies'].includes(rawTargetRule)?'all':rawTargetRule;
  const target=targetRule==='all'||targetRule==='none'?null:enemyChooseTarget(targetRule);
  const isRelease=!!u.charging;
  const chargeTurns=Math.max(0,Math.floor(sk.chargeTurns??meta.chargeTurns??(meta.type==='charge'?1:0)));
  u.plannedIntent={skillIndex,label:isRelease?`释放 ${sk.name}`:(meta.label||sk.name),type:isRelease?'release':(meta.type||sk.type),targetRule,targetUid:target?.uid||null,targetName:target?.name||'',telegraph:meta.telegraph||'',chargeTurns,isRelease,phaseLabel:phase?.label||''};
  return u.plannedIntent;
}
function planEnemyIntents(){state.enemies.filter(enemy=>enemy.alive).forEach(enemy=>planEnemyIntent(enemy,true));updateEnemyIntentUI();}
function updateEnemyIntentUI(){
  const host=$('enemy-intents');
  if(host){
    const living=state.enemies.filter(enemy=>enemy.alive);
    host.innerHTML=living.length?living.map(enemy=>{
      const intent=enemy.plannedIntent||planEnemyIntent(enemy);
      const target=intent?.targetName?intent.targetName:intent?.targetRule==='all'?'全体':'';
      const warning=intent?.chargeTurns&&!intent?.isRelease?'蓄力 1 回合':intent?.isRelease?'即将释放':'';
      const icon={attack:'⚔',debuff:'◈',defend:'🛡',buff:'💨',charge:'⚠',release:'☄',aoe:'☄',wait:'…'}[intent?.type]||'◆';
      return `<div class="enemy-intent-card intent-card ${intent?.chargeTurns||intent?.isRelease?'danger':''}" data-intent="${escapeHtml(intent?.type||'wait')}" title="${escapeHtml(intent?.telegraph||'')}"><span class="intent-icon">${icon}</span><span class="intent-copy"><span class="intent-actor intent-enemy">${escapeHtml(enemy.name)}</span><span class="intent-action">${escapeHtml(intent?.label||'观察')}</span></span>${target?`<span class="intent-target">→ ${escapeHtml(target)}</span>`:''}${warning?`<span class="intent-countdown">${warning}</span>`:''}</div>`;
    }).join(''):'<div class="intent-empty">当前波次已清除</div>';
  }
  const bossHost=$('boss-state'),boss=state.enemies.find(enemy=>enemy.alive&&enemy.boss);
  if(bossHost){
    if(!boss){bossHost.hidden=true;}
    else{
      bossHost.hidden=false;
      const phase=getBossPhaseConfig(boss);
      const phaseName=phase?.label||phase?.id||'暗影调谐';
      const nameNode=$('boss-name'),phaseNode=$('boss-phase'),tenacityFill=$('boss-tenacity-fill'),tenacityValue=$('boss-tenacity-value'),chargeFill=$('boss-charge-fill'),chargeValue=$('boss-charge-value');
      if(nameNode)nameNode.textContent=boss.name;
      if(phaseNode)phaseNode.textContent=`阶段 ${boss.bossStage||1} · ${phaseName}`;
      if(tenacityFill)tenacityFill.style.width=`${clamp((boss.controlResistTurns||0)/2*100,0,100)}%`;
      if(tenacityValue)tenacityValue.textContent=boss.controlResistTurns?`控制抗性 ${boss.controlResistTurns}`:'可被控制打断';
      if(chargeFill)chargeFill.style.width=boss.charging?'100%':'0%';
      if(chargeValue)chargeValue.textContent=boss.charging?(boss.controlResistTurns>0?'正在蓄力 · 当前免疫硬控':'正在蓄力 · 可尝试打断'):'未蓄力';
      if(!nameNode&&!phaseNode)bossHost.innerHTML=`<b>混沌 Boss · 阶段 ${boss.bossStage||1}</b><span>${escapeHtml(phaseName)} · 控制抗性 ${boss.controlResistTurns||0} 回合${boss.charging?' · 正在蓄力':''}</span>`;
    }
  }
}
function enemyPackMultiplier(u){
  const archetype=u.intentConfig?.archetype;
  if(!archetype)return 1;
  const config=u.intentConfig?.packBonus;
  if(!config)return 1;
  const allyArchetype=typeof config==='object'?(config.allyArchetype||archetype):archetype;
  const peerCount=state.enemies.filter(enemy=>enemy.alive&&enemy!==u&&enemy.intentConfig?.archetype===allyArchetype).length;
  const stacks=Math.min(peerCount,typeof config==='object'?(config.maxStacks||peerCount):peerCount);
  const perAlly=typeof config==='object'?(config.damagePerAlly||0):config;
  return 1+Math.max(0,stacks)*Math.max(0,perAlly);
}
function resolveEnemySkill(u,sk,intent){
  if(sk.type==='aoe'){aoeEnemiesToAllies(u,sk);return true;}
  if(sk.type==='shield'){
    state.enemies.filter(enemy=>enemy.alive).forEach(enemy=>addShieldToUnit(enemy,enemy.maxHp*(sk.shieldPct||0.2)));
    if(sk.guard)u.guardState={redirectPct:clamp(sk.guard.redirectPct||0,0,0.8),turns:Math.max(1,(sk.guard.turns||1)+1)};
    return true;
  }
  if(sk.type==='buff'){
    state.enemies.filter(enemy=>enemy.alive).forEach(enemy=>applyBuffTo(enemy,sk.buff||{type:'haste',val:0.2,turns:2}));
    return true;
  }
  if(sk.type==='heal'){
    const target=[...state.enemies].filter(enemy=>enemy.alive).sort((a,b)=>a.curHp/a.maxHp-b.curHp/b.maxHp)[0];
    if(target)healUnit(target,target.maxHp*(sk.healPct||0.2));
    return !!target;
  }
  if(sk.type==='cleanse'){
    state.enemies.filter(enemy=>enemy.alive).forEach(enemy=>{enemy.debuffs=[];});
    return true;
  }
  let target=state.allies.find(ally=>ally.alive&&ally.uid===intent?.targetUid&&!hasStatus(ally,'invis'));
  if(!target)target=enemyChooseTarget(intent?.targetRule||'front');
  if(!target)return false;
  const packMultiplier=enemyPackMultiplier(u);
  dealDamage(u,packMultiplier===1?sk:{...sk,mult:(sk.mult||1)*packMultiplier},target,false);
  return true;
}
function finishEnemyAction(u,sk,intent,delay=360){
  startSkillCooldown(u,sk,intent?.skillIndex);
  u.patternStep++;u.plannedIntent=null;u._acted=true;u._hasActedEver=true;
  if(u.controlResistTurns>0)u.controlResistTurns--;
  renderAll();scheduleBattle(()=>{state.curIdx++;processTurn();},delay);
}
function enemyAction(u){
  if(!u.alive){state.curIdx++;return processTurn();}
  if(!state.allies.some(ally=>ally.alive)){state.curIdx++;return processTurn();}
  state.phase='anim';renderSkillBar();
  const intent=u.plannedIntent||planEnemyIntent(u),sk=intent&&u.skills[intent.skillIndex];
  if(!sk){pushLog(`👁 ${u.name} 观察战场`);u.plannedIntent=null;u._acted=true;renderAll();scheduleBattle(()=>{state.curIdx++;processTurn();},240);return;}
  if(intent.chargeTurns>0&&!intent.isRelease){
    u.charging={skillIndex:intent.skillIndex,turns:intent.chargeTurns};
    u.plannedIntent={...intent,label:`蓄力中：${sk.name}`,isRelease:true,type:'release'};
    u._acted=true;u._hasActedEver=true;
    pushLog(`⚠ ${u.name} 开始蓄力【${sk.name}】，${u.controlResistTurns>0?'当前免疫硬控，准备护盾承伤':'可尝试控制打断'}`);
    setBanner(`⚠ ${u.name} 蓄力【${sk.name}】`,'enemy');renderAll();
    scheduleBattle(()=>{state.curIdx++;processTurn();},360);return;
  }
  const visual=captureBattleAction();
  const resolved=resolveEnemySkill(u,sk,intent);
  if(resolved){pushLog(`☠ ${u.name} 使用【${sk.name}】`);}
  else{pushLog(`👁 ${u.name} 未能发现目标`);}
  u.charging=null;
  if(resolved&&intent.isRelease)window.BossTactics?.open(u,'released');
  const duration=animateBattleAction(u,sk,visual);
  if(u.coreExposure&&intent.isRelease)u.coreExposure.visibleAt=window.BattleMotion?.inspect()?.impactAt||battleNow();
  finishEnemyAction(u,sk,intent,duration);
}
function aoeEnemiesToAllies(src,sk){
  state.allies.filter(a=>a.alive&&!hasStatus(a,'invis')).forEach(a=>dealDamage(src,sk,a,false));
}
function summonAction(u){
  if(!u.alive){ state.curIdx++; return processTurn(); }
  state.phase='anim'; renderSkillBar();
  const visual=captureBattleAction();
  const es=state.enemies.filter(e=>e.alive); const tgt=es.length?choice(es):null;
  if(tgt){ const sk=u.skills[0]; dealDamage(u,sk,tgt,false); pushLog(`🜂 ${u.name} 攻击`); }
  u._acted=true;u._hasActedEver=true;const duration=animateBattleAction(u,u.skills[0],visual);renderAll();
  scheduleBattle(()=>{ state.curIdx++; processTurn(); },duration);
}

/* ═══════════════════════════════════════════════════════════════
   胜负结算
   ═══════════════════════════════════════════════════════════════ */
function endBattle(won){
  if(window.SC?.BattleLab?.onBattleEnd(won))return;
  if(state.phase==='done') return;
  window.LiveCombo?.clear();window.BattleMotion?.clear();
  window.ComboEnvironment?.releaseBattle({cancelled:true});
  if(typeof closeComboModal==='function')closeComboModal({resume:false});
  if(typeof window.clearComboCinematic==='function')window.clearComboCinematic();
  if(state.run)state.run.flowEpoch++;
  const progressionReward=awardExpeditionProgression();
  state.battleToken++;
  invalidateAutoDecision();
  state.phase='done'; inBattle=false; cancelAnimationFrame(battleRAF);
  closeFusion();closeIntermission();closeCriticalDecision();
  if(battleCanvas){battleCanvas.onclick=null;battleCanvas.style.pointerEvents='none';battleCanvas.style.cursor='default';}
  $('target-chips').innerHTML='';setTip('');
  setBanner(won?'✨ 胜 利 ✨':'💀 败 北 💀', won?'win':'lose');
  showScreen('result-screen');
  const t=$('result-title'); t.className='result-title '+(won?'win':'lose');
  t.textContent=won?'✨ 胜 利 ✨':'💀 败 北 💀';
  $('result-crest').className='result-crest '+(won?'win-state':'lose-state');
  setUiArt('result-crest',won?ART.ui.victoryCrest:ART.ui.defeatCrest,won?'胜利徽记':'败北徽记',won?'✦':'◆','crest-art '+(won?'win':'lose'));
  $('result-sub').textContent=won?'你完成了三波远征，灵方、阵式和波间整备共同构成了本局路线。':'本局奖励已按已通关波次锁定；可原阵容再战，或一键换入替补重试。';
  $('rs-wave').textContent=state.run?.clearedWaves||0;
  $('rs-kill').textContent=state.kills;
  $('rs-reward').textContent=state.run?.reward||0;
  const progressionRewardNode=$('result-progression-reward');
  if(progressionRewardNode){
    progressionRewardNode.hidden=false;
    progressionRewardNode.classList.toggle('save-error',progressionReward.persisted===false);
    progressionRewardNode.textContent=progressionReward.persisted===false
      ?'本局成长存档写入失败，资源没有扣取或假装入账；请检查浏览器存储权限后重试本关。'
      :progressionReward.ink||progressionReward.elementDust||progressionReward.essence
      ?`本局已入账（远征倍率 ×${expeditionRewardMultiplier(state.run?.expeditionConfig)}）：灵墨 +${progressionReward.ink} · 元素尘 +${progressionReward.elementDust} · 角色精华 +${progressionReward.essence}`
      :'本局尚未完成波次，没有获得跨局资源。';
    if(progressionReward.persisted!==false){
      const loot=Object.entries(state.run?.comboLoot||{}).filter(([,count])=>count>0).map(([id,count])=>`${COMBO_ITEMS[id].name} +${count}`);
      if(loot.length)progressionRewardNode.textContent+=` · 合击道具：${loot.join(' / ')}`;
    }
  }
  $('result-review').textContent=buildResultReview(won);
  $('retry-same-btn').disabled=activeFormationIndices().length!==ACTIVE_SLOT_COUNT;
  $('retry-swap-btn').disabled=!reserveFormationIndices().length;
  if(won) sfx('win'); else sfx('lose');
}
function buildResultReview(won){
  const formation=currentFormation(),formulas=(state.run?.formulas||[]).map(id=>formulaById(id)?.name).filter(Boolean),stats=state.run?.stats||{};
  const difficulty=EXPEDITION_DIFFICULTIES.find(item=>item.id===state.run?.expeditionConfig?.difficultyId)||currentDifficulty();
  const contracts=(state.run?.expeditionConfig?.contractIds||[]).map(id=>EXPEDITION_CONTRACTS.find(item=>item.id===id)?.name).filter(Boolean);
  const seed=state.run?.seedInfo,strategy=currentAutoStrategy(),rewardMultiplier=expeditionRewardMultiplier(state.run?.expeditionConfig);
  const active=state.allies.filter(unit=>!unit.isSummon),fallen=active.filter(unit=>!unit.alive).length;
  const route=`${difficulty.name}难度 · ${contracts.length?`契约【${contracts.join('、')}】`:'无契约'} · ${seed?.mode==='daily'?`每日种子 ${seed.key}`:'随机种子'} · 奖励 ×${rewardMultiplier} · 阵式【${formation.name}】 · 结束策略【${strategy.name}】${formulas.length?` · 灵方【${formulas.join('、')}】`:' · 尚未取得灵方'}`;
  const combos=(state.run?.comboUsedIds||[]).map(id=>COMBO_RECIPES.find(recipe=>recipe.id===id)?.name).filter(Boolean);
  const numbers=`造成 ${Math.round(stats.damageDealt||0)} 伤害 · 承受 ${Math.round(stats.damageTaken||0)} 伤害 · 治疗 ${Math.round(stats.healing||0)} · 融合 ${stats.fusions||0} 次（自动 ${stats.autoFusions||0}） · 契约合击 ${state.run?.comboCasts||0} 次${combos.length?`【${combos.join('、')}】`:''} · 关键暂停 ${stats.criticalPauses||0} 次`;
  const topSource=Object.entries(stats.damageSources||{}).sort((a,b)=>b[1]-a[1])[0];
  const pressure=topSource?`主要压力：${topSource[0]} 共造成 ${Math.round(topSource[1])} 伤害。`:'';
  let advice;
  if(won)advice='复盘建议：更换阵式或灵方，可用同一队伍验证另一条构筑路线。';
  else if(stats.lastDefeat)advice=`关键失误：第 ${stats.lastDefeat.wave} 波，${stats.lastDefeat.target} 被 ${stats.lastDefeat.source} 的【${stats.lastDefeat.skill}】击倒；下次为该意图预留控制、护盾或换位。`;
  else if(fallen)advice=`复盘建议：有 ${fallen} 名主战倒下，优先换入替补或在第二波选择恢复。`;
  else if(stats.largestHit)advice=`最大单次伤害来自 ${stats.largestHit.source} 的【${stats.largestHit.skill}】；建议手动接管该回合。`;
  else advice='复盘建议：队伍仍有战力，手动打断高危蓄力并保留融合能量。';
  return `${route}。${numbers}。${pressure}${advice}`;
}
function retryBattle(useReserve=false){
  if(state.phase!=='done')return false;
  if(useReserve){
    const reserveIndex=reserveFormationIndices()[0],persistentActive=new Set(activeFormationIndices());
    const active=expeditionHeroes().filter(unit=>persistentActive.has(unit.characterIndex)).sort((a,b)=>a.curHp/a.maxHp-b.curHp/b.maxHp)[0];
    const activeSlot=active&&findFormationSlot(active.characterIndex);if(!Number.isInteger(reserveIndex)||!activeSlot||activeSlot.zone==='reserve')return false;
    moveFormationCharacter(reserveIndex,{zone:activeSlot.zone,slotIndex:activeSlot.slotIndex});
  }
  return startBattle();
}
function requestExitBattle(){
  if(state.phase==='done'){returnTown();return;}
  if(window.confirm('确定退出本场战斗并返回城镇吗？本场进度不会保留。'))returnTown();
}
function clearBattleSession(){
  window.BattleDecision?.reset();
  window.BattleHUD?.closeReport({restoreFocus:false});
  window.BattleClock?.clear();
  pendingVisualAction=null;
  window.LiveCombo?.clear();window.BattleMotion?.clear();
  window.ComboEnvironment?.releaseBattle({cancelled:true});
  if(typeof closeComboModal==='function')closeComboModal({resume:false});
  if(typeof window.clearComboCinematic==='function')window.clearComboCinematic();
  state.battleToken++;invalidateAutoDecision();if(state.run)state.run.flowEpoch++;inBattle=false;cancelAnimationFrame(battleRAF);closeFusion();closeIntermission();closeCriticalDecision();hideDetail();closeHelp();runRandomSource=null;
  if(battleCanvas){battleCanvas.onclick=null;battleCanvas.style.pointerEvents='none';battleCanvas.style.cursor='default';}
  Object.assign(state,{wave:0,turn:0,kills:0,log:[],allies:[],enemies:[],reserves:[],reserveUnits:[],turnOrder:[],curIdx:0,phase:'idle',target:null,selSkill:null,selectedFormationSlot:null,particles:[],floats:[],fusionCtx:null,run:null});
}
function returnTown(){if(window.SC?.BattleLab?.isActive())return window.closeBattleLab({screen:'town-screen'});clearBattleSession();showScreen('town-screen');}
function goToProgressionFromResult(){if(window.SC?.BattleLab?.isActive())return window.closeBattleLab({screen:'progression-screen'});clearBattleSession();return openProgression();}
function resetGame(){
  if(window.SC?.BattleLab?.isActive())return window.closeBattleLab({screen:'title-screen'});
  clearBattleSession();
  state.progressionPendingBranchId=null;
  state.team=[...DEFAULT_TEAM];
  state.formationSlots=cloneFormationSlots(DEFAULT_FORMATION_SLOTS);
  state.formationStyleId='bulwark';
  showScreen('title-screen');
}

/* ═══════════════════════════════════════════════════════════════
   战斗 Canvas 渲染循环
   ═══════════════════════════════════════════════════════════════ */
function initBattleCanvas(){
  window.ComboEnvironment?.releaseBattle({cancelled:true});
  battleCanvas=$('battle-canvas'); bctx=battleCanvas.getContext('2d');
  resizeBattle();
  if(typeof ResizeObserver!=='undefined' && !battleCanvas._ro){ const ro=new ResizeObserver(resizeBattle); battleCanvas._ro=ro; ro.observe(battleCanvas); }
  window.removeEventListener('resize', resizeBattle);
  window.addEventListener('resize', resizeBattle);
  inBattle=true;updateBattleSpeedButton();cancelAnimationFrame(battleRAF);battleLoop(performance.now());
}
function resizeBattle(){
  if(!battleCanvas) return;
  dpr=Math.min(window.devicePixelRatio||1,2);
  const w=battleCanvas.clientWidth||battleCanvas.parentElement.clientWidth;
  const h=battleCanvas.clientHeight||(battleCanvas.parentElement.clientHeight*0.5);
  BW=w; BH=h;
  battleCanvas.width=Math.max(1,Math.floor(w*dpr)); battleCanvas.height=Math.max(1,Math.floor(h*dpr));
  bctx.setTransform(dpr,0,0,dpr,0,0);
}
function battleLoop(t){ if(!inBattle){return;} drawScene(t); battleRAF=requestAnimationFrame(battleLoop); }

function layoutUnits(now=battleNow()){
  // Opposing, staggered ranks. Each actor owns a full-height cell including its
  // name/HP plate; portrait height can never exceed the available row spacing.
  const playfieldHeight=window.BattleHUD?.playfieldHeight(BH)??BH;
  const place=(units,x,rows=2)=>{
    const count=Math.max(rows,units.length),cell=(playfieldHeight-16)/count;
    units.forEach((u,i)=>{
      u._r=Math.max(8,Math.min(32,cell*.22,BW*.045));
      u._x=BW*x;u._y=12+cell*(i+1)-u._r*.72-8;
      u._artHeight=Math.max(23,Math.min(u.boss?145:134,cell-39));
      u._artWidth=Math.min(BW*.145,u._artHeight*(u.boss?1.2:.95));
    });
  };
  const heroes=state.allies.filter(u=>!u.isSummon),front=heroes.filter(u=>u.pos==='front'),back=heroes.filter(u=>u.pos!=='front');
  place(back,.12);place(front,.29);
  place(state.allies.filter(u=>u.isSummon&&(u.alive||battleVisual(u,now).alive)),.41,3);
  const ef=state.enemies.filter(u=>u.pos!=='back'),eb=state.enemies.filter(u=>u.pos==='back');
  while(ef.length>2&&eb.length<2)eb.push(ef.pop());
  place(ef,.72);place(eb,.90);
}
function drawCoverImage(ctx,image,x,y,w,h,focusY=.5){
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const scale=Math.max(w/iw,h/ih),sw=w/scale,sh=h/scale;
  const sx=(iw-sw)/2,sy=clamp(ih*focusY-sh/2,0,Math.max(0,ih-sh));
  ctx.drawImage(image,sx,sy,sw,sh,x,y,w,h);
}
function drawScene(t){
  t=window.BattleClock?.now(Number.isFinite(t)?t:performance.now())??t;
  const ctx=bctx; if(!ctx) return;
  layoutUnits(t);
  window.LiveCombo?.frame(t);
  ctx.clearRect(0,0,BW,BH);
  const scene=loadedArt(ART.backgrounds.battle[clamp(state.wave,0,ART.backgrounds.battle.length-1)]);
  if(scene)drawCoverImage(ctx,scene,0,0,BW,BH,[.30,.42,.32][state.wave]??.5);
  else{
    const bg=ctx.createLinearGradient(0,0,0,BH);
    bg.addColorStop(0,'#0a0718');bg.addColorStop(.45,'#160d33');bg.addColorStop(1,'#0a0718');
    ctx.fillStyle=bg;ctx.fillRect(0,0,BW,BH);
  }
  const shade=ctx.createLinearGradient(0,0,0,BH);
  shade.addColorStop(0,'rgba(4,3,12,.26)');shade.addColorStop(.48,'rgba(8,5,20,.04)');shade.addColorStop(1,'rgba(4,3,12,.48)');
  ctx.fillStyle=shade;ctx.fillRect(0,0,BW,BH);
  // The exact cinematic environment continues on the real battlefield, behind
  // all units, names and health bars. No second clock, damage or battle RNG.
  const environment=window.ComboEnvironment?.battleFrame(t);
  if(environment)window.ComboEnvironment.draw(ctx,{width:BW,height:BH,groundY:BH*.55},environment,environment.elapsed);
  if(battleCanvas)battleCanvas.dataset.comboEnvironment=environment?JSON.stringify(environment):'';
  const units=[...state.enemies,...state.allies.filter(a=>a.alive||!a.isSummon||battleVisual(a,t).alive)].sort((a,b)=>a._y-b._y);
  units.forEach(u=>drawUnit(ctx,u,u.isEnemy,t));
  window.BossTactics?.draw(ctx,t);window.BattleDecision?.draw(ctx,t);
  window.BattleMotion?.drawEffects(ctx,{width:BW,height:BH},t);
  window.LiveCombo?.draw(ctx,t);
  units.forEach(u=>drawUnitHud(ctx,u,u.isEnemy,t));
  drawParticles(ctx,t);
  const healthKey=state.allies.map(u=>{const v=battleVisual(u,t);return `${u.uid}:${Math.round(v.hp)}:${v.alive}`;}).join('|');
  if(battleCanvas._healthKey!==healthKey){battleCanvas._healthKey=healthKey;updateHUD();}
}
function battleVisual(u,t=battleNow()){
  return {hp:u.curHp,shield:u.shield,alive:u.alive,dx:0,dy:0,rotation:0,scaleX:1,scaleY:1,opacity:1,...(window.LiveCombo?.pose(u,t)||window.BattleMotion?.pose(u,t)||{})};
}
function drawUnit(ctx,u,enemy,t){
  const x=u._x,y=u._y,R=u._r;const el=ELEMENTS[u.element];
  const visual=battleVisual(u,t),bob=visual.alive?Math.sin(t/600+u.uid)*1.3:0;
  const cur=state.turnOrder[state.curIdx]===u && u.alive && (state.phase==='player'||state.phase==='enemy');
  const targetable=u.alive&&state.target&&((state.target.side==='ally'&&!enemy&&!u.isSummon)||(state.target.side==='enemy'&&enemy));
  const image=loadedArt(u.art);
  const maxH=u._artHeight||R*3.45;
  const maxW=u._artWidth||R*2.75;
  let artW=maxW,artH=maxH;
  if(image){const scale=Math.min(maxW/image.naturalWidth,maxH/image.naturalHeight);artW=image.naturalWidth*scale;artH=image.naturalHeight*scale;}
  const baseY=y+R*.72,top=baseY-artH,left=x-artW/2;
  u._artRect={x:left,y:top,width:artW,height:artH};
  u._visual={...visual,bob,baseY,top,left,artW,artH};
  const hitPad=Math.max(8,R*.35);
  u._hit={left:left-hitPad+visual.dx,top:top-hitPad+bob+visual.dy,right:left+artW+hitPad+visual.dx,bottom:baseY+hitPad+bob+visual.dy};
  if(visual.opacity<=0)return;
  ctx.save();ctx.translate(0,bob);
  // 脚下投影和元素光晕，让透明立绘在复杂背景上保持轮廓。
  ctx.fillStyle='rgba(2,1,8,.58)';ctx.beginPath();ctx.ellipse(x,baseY,R*1.05,R*.28,0,0,7);ctx.fill();
  if(enemy&&window.SC?.BattleLab?.targetUid?.()===u.uid){ctx.strokeStyle='#ffc990';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,baseY,R*1.23,R*.38,0,0,7);ctx.stroke();}
  const g=ctx.createRadialGradient(x,y,R*.15,x,y,R*1.65);
  g.addColorStop(0,el.glow+'58');g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,R*1.65,0,7);ctx.fill();
  if(targetable){
    ctx.fillStyle=state.target.side==='ally'?'rgba(121,228,154,.10)':'rgba(255,140,66,.11)';
    rrect(ctx,left-hitPad,top-hitPad,artW+hitPad*2,artH+hitPad*2,R*.35);ctx.fill();
    ctx.strokeStyle=state.target.side==='ally'?'#79e49a':'#ff9c57';ctx.lineWidth=3;ctx.setLineDash([7,4]);ctx.lineDashOffset=-t/35;
    rrect(ctx,left-hitPad,top-hitPad,artW+hitPad*2,artH+hitPad*2,R*.35);ctx.stroke();ctx.setLineDash([]);
  }
  if(cur){ctx.strokeStyle='#f7dc6f';ctx.lineWidth=2.5;ctx.setLineDash([4,4]);ctx.lineDashOffset=-t/40;rrect(ctx,left-5,top-5,artW+10,artH+10,R*.3);ctx.stroke();ctx.setLineDash([]);}
  if(image){
    ctx.globalAlpha=(visual.alive?1:.34)*visual.opacity;ctx.filter=visual.alive?'none':'grayscale(1)';
    ctx.shadowColor=cur?'rgba(247,220,111,.95)':el.glow;ctx.shadowBlur=cur?20:9;
    if(!window.LiveCombo?.drawActor(ctx,u,u._artRect,t)){
      ctx.save();ctx.translate(x+visual.dx,baseY+visual.dy);ctx.rotate(visual.rotation);ctx.scale(visual.scaleX,visual.scaleY);ctx.translate(-x,-baseY);
      if(!window.BattleMotion?.drawActor(ctx,u,u._artRect,t,loadedArt))ctx.drawImage(image,left,top,artW,artH);
      // The actor renderer owns the mirror, including the hit flash; drawing the
      // original portrait again here would flash an opposite-facing ghost.
      if(visual.flash>0){ctx.globalAlpha=visual.flash*.20;ctx.globalCompositeOperation='screen';window.BattleMotion?.drawActor(ctx,u,u._artRect,t,loadedArt);}
      ctx.restore();
    }
    ctx.shadowBlur=0;ctx.filter='none';ctx.globalAlpha=1;
  }else{
    ctx.fillStyle='#0c0820';ctx.beginPath();ctx.arc(x,y,R,0,7);ctx.fill();
    ctx.lineWidth=3;ctx.strokeStyle=el.color;ctx.shadowColor=el.glow;ctx.shadowBlur=cur?22:10;ctx.stroke();ctx.shadowBlur=0;
    ctx.font=`${R*1.1}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=el.glow;ctx.fillText(el.symbol,x,y+1);
  }
  if(visual.shield>0){ctx.strokeStyle='rgba(247,220,111,.72)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,top+artH*.55,artW*.58,artH*.57,0,0,7);ctx.stroke();}
  if(!visual.alive){ctx.fillStyle='rgba(6,5,14,.35)';rrect(ctx,left,top,artW,artH,R*.25);ctx.fill();ctx.fillStyle='#ff7567';ctx.font='bold 18px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('×',x,y);}
  ctx.restore();
}
function drawUnitHud(ctx,u,enemy,t){
  if(!u._visual)return;
  const {bob,baseY,top}=u._visual,visual=battleVisual(u,t),x=u._x,R=u._r,el=ELEMENTS[u.element];
  if(visual.opacity<=0)return;
  const cur=state.turnOrder[state.curIdx]===u&&visual.alive&&(state.phase==='player'||state.phase==='enemy');
  // 名牌、血条和状态始终最后绘制，避免被真实立绘吞掉。
  const compact=R<24,displayName=compact&&u.name.includes('·')?u.name.split('·').pop():u.name;
  const fontSize=clamp(R*.38,9,12),labelY=Math.max(fontSize+3,top-10+bob);
  ctx.font=`bold ${fontSize}px "PingFang SC",sans-serif`;ctx.textAlign='center';ctx.textBaseline='alphabetic';
  const plateW=Math.max(48,Math.min(R*2.7,ctx.measureText((u.boss?'★':'')+displayName).width+13));
  ctx.fillStyle='rgba(5,3,14,.82)';rrect(ctx,x-plateW/2,labelY-fontSize-3,plateW,fontSize+6,5);ctx.fill();
  ctx.strokeStyle=cur?'rgba(247,220,111,.9)':el.color+'aa';ctx.lineWidth=1;rrect(ctx,x-plateW/2,labelY-fontSize-3,plateW,fontSize+6,5);ctx.stroke();
  ctx.fillStyle=visual.alive?'#f4f0fb':'#998fa8';ctx.fillText((u.boss?'★':'')+displayName,x,labelY);
  const bw=Math.max(46,R*2.35),bh=6,bx=x-bw/2,by=labelY+4;
  ctx.fillStyle='#080513';rrect(ctx,bx,by,bw,bh,3);ctx.fill();
  const hp=visual.hp/u.maxHp;ctx.fillStyle=hp>.5?'#46c46a':hp>.25?'#e8a33d':'#e0493b';rrect(ctx,bx,by,bw*clamp(hp,0,1),bh,3);ctx.fill();
  ctx.strokeStyle='rgba(240,214,138,.65)';ctx.lineWidth=1;rrect(ctx,bx,by,bw,bh,3);ctx.stroke();
  if(!enemy&&!u.isSummon){const ew=bw*.82,ex=x-ew/2,ey=by+bh+3;ctx.fillStyle='#080513';rrect(ctx,ex,ey,ew,3,2);ctx.fill();ctx.fillStyle='#f7dc6f';rrect(ctx,ex,ey,ew*(u.energy/u.maxEnergy),3,2);ctx.fill();}
  let sx=x-bw/2;const statusY=by+bh+(enemy||u.isSummon?10:15);const drawEmo=e=>{ctx.font=`${compact?9:11}px sans-serif`;ctx.textAlign='left';ctx.fillText(e,sx,statusY);sx+=compact?10:13;};
  u.debuffs.forEach(d=>drawEmo(STATUS[d.type]?STATUS[d.type].emoji:'•'));u.buffs.forEach(b=>drawEmo(STATUS[b.type]?STATUS[b.type].emoji:'•'));
  if(visual.shield>0){ctx.fillStyle='#f7dc6f';ctx.font=`${compact?9:10}px sans-serif`;ctx.textAlign='center';ctx.fillText('🛡'+Math.round(visual.shield),x,Math.min(BH-3,baseY+12));}
  u._hud={left:x-bw/2-4,right:x+bw/2+4,top:labelY-fontSize-4,bottom:statusY+3};
}
function unitContainsPoint(unit,x,y){const hit=unit._hit;return hit?x>=hit.left&&x<=hit.right&&y>=hit.top&&y<=hit.bottom:Math.hypot(unit._x-x,unit._y-y)<unit._r+14;}
function pickUnitAtPoint(candidates,x,y){return candidates.filter(unit=>unitContainsPoint(unit,x,y)).sort((a,b)=>Math.hypot(a._x-x,a._y-y)-Math.hypot(b._x-x,b._y-y))[0]||null;}
function rrect(ctx,x,y,w,h,r){ r=Math.min(r,h/2,w/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

/* ═══════════════════════════════════════════════════════════════
   粒子 / 飘字
   ═══════════════════════════════════════════════════════════════ */
function spawnBurst(u,color,n){ for(let i=0;i<n;i++){ const a=Math.random()*7,sp=1+Math.random()*3; state.particles.push({uid:u.uid,x:u._x,y:u._y,ox:u._x,oy:u._y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,bornAt:battleNow(),life:1,color}); } }
function spawnFloat(u,txt,color){ state.floats.push({uid:u.uid,x:u._x,y:u._y-20,oy:u._y-20,bornAt:battleNow(),txt,color,life:1}); }
function captureBattleAction(){
  const capture={before:window.BattleMotion?.snapshot([...state.allies,...state.enemies]),particles:state.particles.length,floats:state.floats.length,hits:[]};
  pendingVisualAction=capture;return capture;
}
function delayBattleEvents(capture,revealAt,targets=[]){
  const damageIndices=new Map();
  const delay=event=>{const target=targets.find(target=>String(target.uid)===String(event.uid));let when=target?.impactAt||revealAt;
    if(event.txt&&/^-\d/.test(event.txt)&&target?.contacts?.length){const index=damageIndices.get(String(event.uid))||0;when=target.contacts[Math.min(index,target.contacts.length-1)].at;damageIndices.set(String(event.uid),index+1);}
    event.revealAt=when;};
  state.particles.slice(capture.particles).forEach(delay);
  state.floats.slice(capture.floats).forEach(delay);
}
function animateBattleAction(actor,skill,capture){
  pendingVisualAction=null;
  const motionMode=window.getComboCinematicMotion?.()||'system';
  const reduced=motionMode==='reduced'||motionMode!=='full'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration=window.BattleMotion?.begin(actor,skill,capture.before,[...state.allies,...state.enemies],{now:battleNow(),reduced,selectedTargetUid:capture.selectedTargetUid,hitEvents:capture.hits,expectedTargetUids:capture.expectedTargetUids})||900;
  const action=window.BattleMotion?.inspect();
  delayBattleEvents(capture,action?.impactAt||battleNow()+duration*.55,action?.targets);
  return duration;
}
function drawParticles(ctx,now=battleNow()){
  state.particles=state.particles.filter(p=>{const frames=Math.max(0,now-(p.revealAt??p.bornAt??now))/(1000/60);if(p.revealAt>now)return true;p.ox??=p.x;p.oy??=p.y;p.x=p.ox+p.vx*frames;p.y=p.oy+p.vy*frames+.06*frames*frames;p.life=1-frames*.03;if(p.life<=0)return false;
    ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,7); ctx.fill(); ctx.globalAlpha=1; return true; });
  state.floats=state.floats.filter(f=>{const frames=Math.max(0,now-(f.revealAt??f.bornAt??now))/(1000/60);if(f.revealAt>now)return true;f.oy??=f.y;f.y=f.oy-.6*frames;f.life=1-frames*.018;if(f.life<=0)return false;
    ctx.globalAlpha=Math.max(0,f.life); ctx.fillStyle=f.color; ctx.font='bold 14px "PingFang SC",sans-serif'; ctx.textAlign='center'; ctx.fillText(f.txt,f.x,f.y); ctx.globalAlpha=1; return true; });
}

/* ═══════════════════════════════════════════════════════════════
   HUD / 技能栏渲染
   ═══════════════════════════════════════════════════════════════ */
function updateHUD(){
  $('hud-wave').textContent=(state.wave+1)+'/'+ENEMIES.length;
  $('hud-turn').textContent=state.turn;
  if($('hud-reward'))$('hud-reward').textContent=window.SC?.BattleLab?.isActive()?'训练无奖励':state.run?.reward||0;
  const phaseLabels={player:'玩家回合',enemy:'敌人行动',anim:'技能结算',idle:'准备中',intermission:'波间整备',done:'战斗结束'};
  $('hud-phase').textContent=phaseLabels[state.phase]||'准备中';
  const ts=$('team-status'),rosterKey=state.allies.map(a=>`${a.uid}:${a.name}:${a.art}`).join('|');
  if(ts.dataset.roster!==rosterKey){ts.dataset.roster=rosterKey;ts.innerHTML=state.allies.map(a=>{
    const el=ELEMENTS[a.element],visual=battleVisual(a); const hp=visual.hp/a.maxHp;
    const cur=state.turnOrder[state.curIdx]===a&&a.alive&&(state.phase==='player'||state.phase==='enemy');
    return `<div data-unit="${a.uid}" class="member ${visual.alive?'':'dead'} ${cur?'cur':''}">
      ${artMarkup(a.art,a.name+'头像',el.symbol,'member-art')}
      <div class="member-copy"><div class="mn">${a.name}</div>
      <div class="mb"><i style="width:${clamp(hp*100,0,100)}%;background:${hp>.5?'#46c46a':hp>.25?'#e8a33d':'#e0493b'}"></i></div>
      <div class="me"><i style="width:${a.energy/a.maxEnergy*100}%"></i></div>
      <div class="member-vitals"></div><div class="member-effects"></div></div></div>`;
  }).join('');}
  [...ts.children].forEach((member,index)=>{
    const a=state.allies[index],visual=battleVisual(a),hp=clamp(visual.hp/a.maxHp,0,1);
    member.classList.toggle('dead',!visual.alive);member.classList.toggle('cur',state.turnOrder[state.curIdx]===a&&a.alive&&(state.phase==='player'||state.phase==='enemy'));
    const bar=member.querySelector('.mb i'),energy=member.querySelector('.me i');
    if(bar){bar.style.width=(hp*100)+'%';bar.style.background=hp>.5?'#46c46a':hp>.25?'#e8a33d':'#e0493b';}if(energy)energy.style.width=(a.energy/a.maxEnergy*100)+'%';
    const vitals=member.querySelector('.member-vitals'),effects=member.querySelector('.member-effects');
    if(vitals)vitals.textContent=`生命 ${Math.max(0,Math.round(visual.hp))}/${a.maxHp} · 能量 ${a.energy}/${a.maxEnergy}`+(visual.shield>0?` · 护盾 ${Math.round(visual.shield)}`:'');
    if(effects)effects.textContent=!visual.alive?'已倒下':[...(a.buffs||[]),...(a.debuffs||[])].map(s=>`${STATUS[s.type]?.name||({atk:'攻击提升',def:'防御提升',spd:'速度提升',nextDamage:'下次伤害提升'}[s.type])||s.type} ${s.turns} 回合`).join(' · ')||(a.isSummon?'召唤物':'无额外状态');
  });
  const threat=state.enemies.filter(u=>u.alive&&u.charging);const summary=$('battle-intel-summary');if(summary){summary.textContent=threat.length?'警告：'+threat.map(u=>u.name+'正在蓄力').join('、'):'敌方意图 · 行动序 · 远征规则';summary.classList.toggle('warning',threat.length>0);}
  window.BattleHUD?.refresh();
}
function updateTurnOrder(){
  const to=$('turn-order'); to.innerHTML='<span class="lbl">行动序</span>';
  state.turnOrder.forEach((u,i)=>{
    const el=ELEMENTS[u.element]; const d=document.createElement('div');
    d.className='to-icon'+(i===state.curIdx&&u.alive?' on':'')+(u.alive?'':' dead');
    d.style.borderColor=i===state.curIdx&&u.alive?'#f7dc6f':el.color+'88';
    d.style.background=el.color+'22';d.innerHTML=artMarkup(u.art,u.name+'头像',el.symbol,'turn-art');d.title=u.name;
    const label=document.createElement('span');label.className='turn-order-name';label.textContent=`${i+1}. ${u.name} · ${!u.alive?'已倒下':i<state.curIdx?'已行动':i===state.curIdx?'当前':'待行动'}`;d.appendChild(label);
    to.appendChild(d);
  });
}
function renderSkillBar(){
  try{
  const bar=$('skill-bar'); bar.innerHTML='';
  if(typeof renderComboBattleButton==='function')renderComboBattleButton();
  if(state.phase!=='player'){ return; }
  const u=state.turnOrder[state.curIdx]; if(!u||!u.alive||u.isEnemy||u.isSummon) return;
  const el=ELEMENTS[u.element];
  u.skills.forEach((sk,i)=>{
    const ult=sk.ult; const cooldown=skillCooldown(u,sk,i); const ready=isSkillReady(u,sk,i);
    const b=document.createElement('button');
    b.className='skill-btn'+(ult?' ult':'')+(cooldown>0?' cooling':'')+(state.selSkill===i?' sel':'');
    b.style.setProperty('--ec',el.color); b.style.setProperty('--ecg',el.glow+'88');
    b.disabled=!ready||autoBattle;
    let sub = cooldown>0?`冷却 ${cooldown} 回合`:ult?(u.energy>=u.maxEnergy?'大招 能量满':'大招 能量'+u.energy+'/100'):(sk.type==='heal'?'治疗':sk.type==='shield'?'护盾':sk.type==='buff'?'增益':sk.type==='cleanse'?'净化':sk.type==='summon'?'召唤':i===0?'普攻 · 蓄能':'战术技能');
    b.innerHTML=`<div class="sn">${ult?'✦ ':''}${sk.name}</div><div class="sc">${sub}</div>${cooldown>0?`<span class="skill-cooldown" aria-label="剩余冷却 ${cooldown} 回合">${cooldown}</span>`:''}`;
    b.onclick=()=>playerSelectSkill(i,{preview:true});
    bar.appendChild(b);
  });
  // 融合按钮
  if(u.energy>=u.maxEnergy&&!autoBattle){
    const fusionLock=state.run?.fusionLockRounds||0;
    const fb=document.createElement('button'); fb.className='skill-btn fuse';
    fb.disabled=fusionLock>0;fb.classList.toggle('cooling',fusionLock>0);
    fb.innerHTML=`<div class="sn">✦ 元素融合</div><div class="sc">${fusionLock>0?`全队过载 · ${fusionLock} 次回合结算`:'只耗能量 · 无需触媒'}</div>${fusionLock>0?`<span class="skill-cooldown" aria-label="融合锁定 ${fusionLock}">${fusionLock}</span>`:''}`;
    fb.onclick=()=>openFusion();
    bar.appendChild(fb);
  }
  // 选敌态：canvas 点击
  if(state.target&&state.target.side!=='group'){ battleCanvas.style.cursor='crosshair'; battleCanvas.style.pointerEvents='auto';
    battleCanvas.onpointermove=ev=>{const r=battleCanvas.getBoundingClientRect();window.BattleDecision?.selectTarget(pickUnitAtPoint(targetCandidates(state.target?.side),ev.clientX-r.left,ev.clientY-r.top));};
    battleCanvas.onpointerleave=()=>window.BattleDecision?.selectTarget(null);
    battleCanvas.onclick=(ev)=>{ if(!state.target) return; const r=battleCanvas.getBoundingClientRect(); const x=ev.clientX-r.left,y=ev.clientY-r.top;
      const unit=pickUnitAtPoint(targetCandidates(state.target.side),x,y);if(unit)resolveTarget(unit); };
  } else { battleCanvas.style.cursor='default'; battleCanvas.style.pointerEvents='none'; battleCanvas.onclick=null;battleCanvas.onpointermove=null;battleCanvas.onpointerleave=null; }
  }finally{window.BattleHUD?.refresh();window.BattleDecision?.bind();}
}
function setTip(t){ $('target-tip').textContent=t;window.BattleHUD?.refresh(); }
function setBanner(t,cls){ const b=$('turn-banner'); if(!b)return; b.textContent=t; b.className='turn-banner'+(cls?(' '+cls):'');window.BattleHUD?.refresh(); }
function pushLog(t){ state.log.push(t); if(state.log.length>6)state.log.shift(); $('log').innerHTML=state.log.map(text=>`<b>${escapeHtml(text)}</b>`).join(''); }
function renderAll(){ updateHUD(); updateTurnOrder(); updateEnemyIntentUI(); renderSkillBar(); window.SC?.BattleLab?.refresh(); }

/* ═══════════════════════════════════════════════════════════════
   图鉴 / 详情 / 编队
   ═══════════════════════════════════════════════════════════════ */
function openProgression(characterIndex=state.progressionCharacterIndex){
  if(Number.isInteger(characterIndex)&&CHARACTERS[characterIndex]&&state.progressionCharacterIndex!==characterIndex){state.progressionCharacterIndex=characterIndex;state.progressionPendingBranchId=null;}
  showScreen('progression-screen');return true;
}
function selectProgressionCharacter(characterIndex){
  if(!Number.isInteger(characterIndex)||!CHARACTERS[characterIndex])return false;
  state.progressionCharacterIndex=characterIndex;state.progressionPendingBranchId=null;renderProgression();setProgressionMessage('');return true;
}
function selectEvolutionBranch(characterIndex,branchId){
  const character=CHARACTERS[characterIndex],branch=(EVOLUTION_BRANCHES[character?.id]||[]).find(item=>item.id===branchId);
  if(inBattle||!branch||state.progression.codexLevel<PROGRESSION_RULES.evolution.unlockCodexLevel||characterProgress(character).activeBranch===branchId)return false;
  state.progressionCharacterIndex=characterIndex;state.progressionPendingBranchId=branchId;renderProgression();setProgressionMessage(`已选择「${branch.name}」。确认前不会消耗角色精华。`);$('confirm-evolution-btn')?.focus({preventScroll:true});return true;
}
function confirmEvolution(){
  const id=state.progressionPendingBranchId;
  return id?chooseEvolution(state.progressionCharacterIndex,id):false;
}
function progressedStatPreview(character){
  const rarity=RARITY[character.rarity]?.mult||1,multiplier=progressionStatMultiplier(character);
  return {hp:Math.floor(character.hp*rarity*multiplier),atk:Math.floor(character.atk*rarity*multiplier),def:Math.floor(character.def*rarity*multiplier)};
}
function progressionSkillPowerText(skill){
  const values=[];
  if(Number.isFinite(skill.mult))values.push(`倍率 ${Math.round(skill.mult*100)}%`);
  if(Number.isFinite(skill.healPct))values.push(`治疗 ${Math.round(skill.healPct*100)}%`);
  if(Number.isFinite(skill.shieldPct))values.push(`护盾 ${Math.round(skill.shieldPct*100)}%`);
  if(skill.hits>1)values.push(`${skill.hits} 段`);
  values.push(skill.ult?'100 能量':skill.cooldown?`冷却 ${skill.cooldown}`:'无冷却');
  return values.join(' · ');
}
function renderProgression(){
  if(!$('progression-screen')||!state.progression)return false;
  const resources=state.progression.resources;
  if($('resource-ink'))$('resource-ink').textContent=resources.ink;
  if($('resource-dust'))$('resource-dust').textContent=resources.elementDust;
  if($('resource-essence'))$('resource-essence').textContent=resources.essence;
  const townSummary=$('town-progression-summary');if(townSummary)townSummary.textContent=`图谱 Lv.${state.progression.codexLevel} · 灵墨 ${resources.ink} · 元素尘 ${resources.elementDust} · 精华 ${resources.essence}`;

  const roster=$('progression-roster');
  if(roster){
    roster.innerHTML='';
    CHARACTERS.forEach((character,index)=>{
      const element=ELEMENTS[character.element],progress=characterProgress(character),branch=evolutionBranch(character);
      const button=document.createElement('button');button.type='button';button.className=`progression-character${index===state.progressionCharacterIndex?' selected':''}`;
      button.dataset.characterIndex=String(index);button.style.setProperty('--ec',element.color);button.style.setProperty('--ecg',element.glow+'44');button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===state.progressionCharacterIndex));
      button.innerHTML=`${artMarkup(character.art,character.name+'头像',element.symbol,'progression-roster-art')}<span class="progression-character-copy"><b>${escapeHtml(character.name)}</b><small>${element.symbol}${element.cn} · 专精 ${masteryLevel(character)}/5${branch?` · ${escapeHtml(branch.name)}`:''}</small></span>`;
      button.onclick=()=>selectProgressionCharacter(index);roster.appendChild(button);
      if(progress.activeBranch)button.classList.add('evolved');
    });
  }

  const character=CHARACTERS[state.progressionCharacterIndex]||CHARACTERS[0],progress=characterProgress(character),element=ELEMENTS[character.element];
  if(!character||!progress)return false;
  if($('progression-empty'))$('progression-empty').hidden=true;
  if($('progression-content'))$('progression-content').hidden=false;
  const heroCard=$('progression-content')?.querySelector('.progression-hero');if(heroCard){heroCard.style.setProperty('--ec',element.color);heroCard.style.setProperty('--ecg',element.glow+'44');}
  const portrait=$('progression-portrait');if(portrait)portrait.innerHTML=artMarkup(character.art,character.name+'立绘',element.symbol,'progression-main-art');
  if($('progression-name'))$('progression-name').textContent=character.name;
  const preview=progressedStatPreview(character),branch=evolutionBranch(character);
  if($('progression-meta'))$('progression-meta').textContent=`${element.symbol}${element.cn} · ${character.role} · 生命 ${preview.hp} / 攻击 ${preview.atk} / 防御 ${preview.def}${branch?` · 当前分支：${branch.name}`:''}`;

  const codexLevel=state.progression.codexLevel,codexCost=codexUpgradeCost(codexLevel);
  if($('codex-level'))$('codex-level').textContent=`Lv.${codexLevel}`;
  if($('codex-xp-text'))$('codex-xp-text').textContent=codexCost==null?'图谱等级已满':`灵墨 ${resources.ink} / ${codexCost}`;
  if($('codex-xp-fill'))$('codex-xp-fill').style.width=`${codexCost==null?100:clamp(resources.ink/codexCost*100,0,100)}%`;
  const codexButton=$('upgrade-codex-btn');if(codexButton){codexButton.disabled=codexCost==null||resources.ink<codexCost;codexButton.textContent=codexCost==null?'已满级':`提升图谱 · ${codexCost} 灵墨`;codexButton.onclick=upgradeCodex;}

  const mastery=masteryLevel(character),thresholds=PROGRESSION_RULES.mastery.xpThresholds,nextThreshold=thresholds[mastery]??null,currentThreshold=thresholds[mastery-1]||0;
  if($('mastery-level'))$('mastery-level').textContent=`专精 ${mastery}/5`;
  if($('mastery-xp-text'))$('mastery-xp-text').textContent=nextThreshold==null?'专精已满':`远征熟练 ${progress.masteryXp} / ${nextThreshold}`;
  if($('mastery-xp-fill'))$('mastery-xp-fill').style.width=`${nextThreshold==null?100:clamp((progress.masteryXp-currentThreshold)/(nextThreshold-currentThreshold)*100,0,100)}%`;

  const skills=$('progression-skills');
  if(skills){
    skills.innerHTML='';const progressed=buildProgressedSkills(character);
    progressed.forEach((skill,index)=>{
      const rank=progress.skillLevels[index]||0,cost=skillUpgradeCost(state.progressionCharacterIndex,index),row=document.createElement('article');row.className='progression-skill';
      row.innerHTML=`<div class="progression-skill-copy"><div class="progression-skill-title"><b>${escapeHtml(skill.name)}</b><span>强化 ${rank}/${PROGRESSION_RULES.skill.maxLevel}${skill.evolutionBranchId?' · 已进化':''}</span></div><p>${escapeHtml(skill.desc||'')}</p><small>${escapeHtml(progressionSkillPowerText(skill))}</small></div><button class="btn skill-upgrade-btn" type="button" data-skill-index="${index}">${cost==null?'已满级':`${cost} 元素尘`}</button>`;
      const button=row.querySelector('button');button.disabled=cost==null||resources.elementDust<cost;button.onclick=()=>upgradeSkill(state.progressionCharacterIndex,index);skills.appendChild(row);
    });
  }

  const branches=EVOLUTION_BRANCHES[character.id]||[],branchHost=$('evolution-branches'),unlockedAt=PROGRESSION_RULES.evolution.unlockCodexLevel;
  if($('evolution-status')){
    $('evolution-status').textContent=!branches.length?'该角色的玩法分支将在下一批开放。':codexLevel<unlockedAt?`灵启 I 将在图谱 Lv.${unlockedAt} 解锁。`:branch?`已激活「${branch.name}」，可在城镇切换已解锁分支。`:'可消耗角色精华选择首个进化分支。';
    $('evolution-status').classList.toggle('ready',!!branches.length&&codexLevel>=unlockedAt);
  }
  if(branchHost){
    branchHost.innerHTML='';
    branches.forEach(item=>{
      const unlocked=progress.unlockedBranches.includes(item.id),active=progress.activeBranch===item.id,selected=state.progressionPendingBranchId===item.id,cost=unlocked?PROGRESSION_RULES.evolution.switchCost:PROGRESSION_RULES.evolution.unlockCost;
      const button=document.createElement('button');button.type='button';button.className=`evolution-branch${unlocked?' unlocked':''}${active?' active':''}${selected?' selected':''}`;button.dataset.branchId=item.id;button.setAttribute('role','radio');button.setAttribute('aria-checked',String(selected||(!state.progressionPendingBranchId&&active)));
      button.innerHTML=`<span class="evolution-symbol" aria-hidden="true">${escapeHtml(item.symbol)}</span><span class="evolution-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.role)}</small><p>${escapeHtml(item.desc)}</p><em>${active?'当前启用':unlocked?`切换 · ${cost} 精华`:`解锁 · ${cost} 精华`}</em></span>`;
      button.disabled=active||codexLevel<unlockedAt;button.onclick=()=>selectEvolutionBranch(state.progressionCharacterIndex,item.id);branchHost.appendChild(button);
    });
  }
  const confirmButton=$('confirm-evolution-btn'),costNode=$('evolution-cost');
  if(confirmButton){
    const selected=branches.find(item=>item.id===state.progressionPendingBranchId),unlocked=selected&&progress.unlockedBranches.includes(selected.id),cost=selected?(unlocked?PROGRESSION_RULES.evolution.switchCost:PROGRESSION_RULES.evolution.unlockCost):null;
    confirmButton.disabled=!selected||resources.essence<cost||codexLevel<unlockedAt;confirmButton.textContent=selected?`确认${unlocked?'切换':'进化'}`:'先选择分支';confirmButton.onclick=confirmEvolution;
    if(costNode)costNode.textContent=selected?`将消耗 ${cost} 角色精华；战斗中不可切换。`:'选择一条分支后再确认，不会因比较路线而扣费。';
  }
  return true;
}

function buildRoster(){
  const grid=$('team-roster'); grid.innerHTML='';
  CHARACTERS.forEach((c,i)=>{
    const el=ELEMENTS[c.element];
    const card=document.createElement('div'); card.className='char-card';
    card.style.setProperty('--ec',el.color); card.style.setProperty('--ecg',el.glow+'66');
    card.innerHTML=`<div class="portrait">${artMarkup(c.art,c.name+'立绘',el.symbol,'roster-art')}</div>
      <div class="nm">${c.name}</div>
      <div class="stars">${'★'.repeat(RARITY[c.rarity].stars)}</div>
      <div class="meta">
        <span class="tag el" style="border-color:${el.color};color:${el.color}">${el.symbol}${el.cn}</span>
        <span class="tag role">${c.role}</span>
        <span class="tag row">${c.pos==='front'?'前排':'后排'}</span>
        <span class="tag progression-tag">图谱 ${state.progression.codexLevel} · 专精 ${masteryLevel(c)}</span>
      </div>`;
    card.onclick=()=>showDetail(i);
    grid.appendChild(card);
  });
}
function showDetail(i){
  const c=CHARACTERS[i]; const el=ELEMENTS[c.element];
  const el2=ELEMENTS[c.element2];
  const statPreview=progressedStatPreview(c),progress=characterProgress(c),activeBranch=evolutionBranch(c);
  const card=$('detail-card');
  card.style.setProperty('--ec',el.color); card.style.setProperty('--ecg',el.glow+'55');
  const skRows=buildProgressedSkills(c).map((s,idx)=>{
    const tag = s.ult?'<span style="color:var(--fire-g)">大招</span>':(s.type==='heal'?'<span style="color:#46c46a">治疗</span>':s.type==='shield'?'<span style="color:#f7dc6f">护盾</span>':s.type==='buff'?'<span style="color:#b8e994">增益</span>':s.type==='cleanse'?'<span style="color:#7ec8e3">净化</span>':s.type==='summon'?'<span style="color:#b388ff">召唤</span>':'<span style="color:var(--ink3)">主动</span>');
    return `<div class="skill-row">
      <div class="skill-ic">${el.symbol}</div>
      <div class="skill-info"><div class="sn">${s.name} ${tag}</div>
        <div class="sd">${s.desc||''} · 强化 ${progress.skillLevels[idx]}/${PROGRESSION_RULES.skill.maxLevel} · ${s.ult?'100 能量':s.cooldown?`冷却 ${s.cooldown} 回合`:'无冷却'}</div>
        <div class="sf">特效：${s.fx||''}</div></div></div>`;
  }).join('');
  const evo=(EVOLUTION_BRANCHES[c.id]||[]).map(branch=>`<div class="evo-row${branch.id===activeBranch?.id?' active':''}"><span class="en">${branch.symbol} ${branch.name}</span><span>${branch.desc}${progress.unlockedBranches.includes(branch.id)?' · 已解锁':''}</span></div>`).join('')
    ||'<div class="evo-row"><span class="en">后续开放</span><span>该角色将在下一批获得两条玩法分支。</span></div>';
  card.innerHTML=`<button class="detail-close" onclick="hideDetail()">✕</button>
    <div class="detail-head">
      <div class="detail-portrait">${artMarkup(c.art,c.name+'立绘',el.symbol,'detail-art')}</div>
      <div>
        <div class="detail-name">${c.name}</div>
        <div class="detail-sub">${el.symbol}${el.cn}主元素 · ${el2.symbol}${el2.cn}共鸣（Lv.20 后开放） · 图谱 Lv.${state.progression.codexLevel} · 专精 ${masteryLevel(c)}/5 · ${RARITY[c.rarity].stars}★ ${c.rarity}</div>
      </div>
    </div>
    <div class="detail-intro">“${c.intro}”</div>
    <div class="stat-grid">
      <div class="stat-cell"><div class="k">生命</div><div class="v">${statPreview.hp}</div></div>
      <div class="stat-cell"><div class="k">攻击</div><div class="v">${statPreview.atk}</div></div>
      <div class="stat-cell"><div class="k">防御</div><div class="v">${statPreview.def}</div></div>
      <div class="stat-cell"><div class="k">速度</div><div class="v">${c.spd}</div></div>
      <div class="stat-cell"><div class="k">暴击</div><div class="v">${c.crt}%</div></div>
      <div class="stat-cell"><div class="k">暴伤</div><div class="v">${c.ctd}%</div></div>
      <div class="stat-cell"><div class="k">韧性</div><div class="v">${c.res}</div></div>
      <div class="stat-cell"><div class="k">元素精通</div><div class="v">${c.em}</div></div>
      <div class="stat-cell"><div class="k">智力</div><div class="v">${c.int}</div></div>
      <div class="stat-cell"><div class="k">能量</div><div class="v">100</div></div>
    </div>
    <div class="sec-title">技能</div>
    ${skRows}
    <div class="sec-title">被动</div>
    <div class="passive-box"><div class="pn">${c.passive.name}</div><div class="pd">${c.passive.desc}</div></div>
    <div class="sec-title">进化方向（养成系统）</div>
    ${evo}
    <div style="text-align:center;margin-top:14px"><button class="btn" onclick="hideDetail()">关闭</button> <button class="btn primary" onclick="hideDetail();openProgression(${i})">前往进化塔</button></div>`;
  $('detail-modal').classList.add('show');
}
function hideDetail(){ $('detail-modal').classList.remove('show'); }

function firstEmptyFormationSlot(preferredZone){
  const zones=preferredZone?[preferredZone,preferredZone==='front'?'back':'front','reserve']:['front','back','reserve'];
  for(const zone of zones){const slotIndex=state.formationSlots[zone].findIndex(value=>value==null);if(slotIndex>=0)return {zone,slotIndex};}
  return null;
}
function sameFormationSlot(a,b){return !!a&&!!b&&a.zone===b.zone&&a.slotIndex===b.slotIndex;}
function moveFormationCharacter(characterIndex,target){
  if(!target||!state.formationSlots[target.zone]||target.slotIndex<0||target.slotIndex>1)return false;
  const source=findFormationSlot(characterIndex),targetCharacter=state.formationSlots[target.zone][target.slotIndex];
  if(source){
    state.formationSlots[source.zone][source.slotIndex]=targetCharacter;
    state.formationSlots[target.zone][target.slotIndex]=characterIndex;
  }else{
    if(state.team.length>=ACTIVE_SLOT_COUNT+RESERVE_SLOT_COUNT&&targetCharacter==null)return false;
    if(targetCharacter!=null&&state.team.length<ACTIVE_SLOT_COUNT+RESERVE_SLOT_COUNT){
      const fallback=firstEmptyFormationSlot(CHARACTERS[targetCharacter]?.pos);
      if(fallback&&!sameFormationSlot(fallback,target))state.formationSlots[fallback.zone][fallback.slotIndex]=targetCharacter;
    }
    state.formationSlots[target.zone][target.slotIndex]=characterIndex;
  }
  syncTeamFromFormation();state.selectedFormationSlot=null;return true;
}
function selectFormationSlot(zone,slotIndex){
  const target={zone,slotIndex};
  if(!state.selectedFormationSlot){state.selectedFormationSlot=target;buildFormation();return;}
  if(sameFormationSlot(state.selectedFormationSlot,target)){state.selectedFormationSlot=null;buildFormation();return;}
  const source=state.selectedFormationSlot;
  const sourceCharacter=state.formationSlots[source.zone][source.slotIndex];
  const targetCharacter=state.formationSlots[target.zone][target.slotIndex];
  state.formationSlots[source.zone][source.slotIndex]=targetCharacter;
  state.formationSlots[target.zone][target.slotIndex]=sourceCharacter;
  state.selectedFormationSlot=null;syncTeamFromFormation();buildFormation();
}
function removeFormationCharacter(characterIndex){
  const slot=findFormationSlot(characterIndex);if(!slot)return false;
  state.formationSlots[slot.zone][slot.slotIndex]=null;state.selectedFormationSlot=null;syncTeamFromFormation();buildFormation();return true;
}
function chooseFormationCharacter(characterIndex){
  const existing=findFormationSlot(characterIndex);
  if(state.selectedFormationSlot){moveFormationCharacter(characterIndex,state.selectedFormationSlot);buildFormation();return;}
  if(existing){state.selectedFormationSlot={zone:existing.zone,slotIndex:existing.slotIndex};buildFormation();return;}
  const target=firstEmptyFormationSlot(CHARACTERS[characterIndex].pos);
  if(target){moveFormationCharacter(characterIndex,target);buildFormation();}
}
function selectFormationStyle(id){
  if(inBattle||!BATTLE_FORMATIONS.some(formation=>formation.id===id))return false;
  state.formationStyleId=id;buildFormationStyles();return true;
}
function setExpeditionConfigMessage(text='',type=''){
  const summary=$('expedition-config-summary');if(!summary)return;
  summary.textContent=text;summary.classList.toggle('error',type==='error');
}
function renderExpeditionConfig(){
  const panel=$('expedition-config-panel');if(!panel||!state.progression)return false;
  const settings=expeditionSettings(),difficulty=EXPEDITION_DIFFICULTIES.find(item=>item.id===settings.difficultyId)||currentDifficulty(),contracts=settings.contractIds.map(id=>EXPEDITION_CONTRACTS.find(item=>item.id===id)).filter(Boolean),strategy=currentAutoStrategy();
  panel.querySelectorAll('.difficulty-option').forEach(button=>{
    const selected=button.dataset.difficulty===difficulty.id;button.classList.toggle('selected',selected);button.setAttribute('aria-checked',String(selected));button.onclick=()=>setDifficulty(button.dataset.difficulty);
  });
  panel.querySelectorAll('.contract-option').forEach(button=>{
    const contract=EXPEDITION_CONTRACTS.find(item=>item.id===button.dataset.contract),selected=settings.contractIds.includes(button.dataset.contract);
    let reward=button.querySelector('.contract-reward');if(!reward){reward=document.createElement('span');reward.className='contract-reward';button.appendChild(reward);}
    reward.textContent=`+${Math.round((contract?.rewardBonus||0)*100)}%`;reward.title='基础货币奖励加成';
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));button.onclick=()=>toggleExpeditionContract(button.dataset.contract);
  });
  panel.querySelectorAll('.seed-mode-option').forEach(button=>{
    const selected=button.dataset.seedMode===settings.seedMode;button.classList.toggle('selected',selected);button.setAttribute('aria-checked',String(selected));button.onclick=()=>setSeedMode(button.dataset.seedMode);
  });
  panel.querySelectorAll('.auto-strategy-option').forEach(button=>{
    const selected=button.dataset.autoStrategy===strategy.id;button.classList.toggle('selected',selected);button.setAttribute('aria-checked',String(selected));button.onclick=()=>setAutoStrategy(button.dataset.autoStrategy);
  });
  const multiplier=expeditionRewardMultiplier();
  setExpeditionConfigMessage(`${difficulty.name} · ${contracts.length?contracts.map(item=>item.name).join(' / '):'无契约'} · ${settings.seedMode==='daily'?'每日挑战':'随机远征'} · ${strategy.name} · 奖励 ×${multiplier}`);
  const count=$('contract-summary');if(count)count.textContent=`已选 ${contracts.length}/${EXPEDITION_RULES.maxContracts} · 奖励 ×${multiplier}`;
  const seedPreview=$('seed-preview');if(seedPreview)seedPreview.textContent=settings.seedMode==='daily'?`每日挑战 ${dailySeedKey()} · 固定随机序列`:'随机远征 · 每局重掷';
  const select=$('battle-auto-strategy-select');if(select){select.value=strategy.id;select.onchange=()=>setAutoStrategy(select.value);}
  if(typeof window.renderPreparationSummary==='function')window.renderPreparationSummary();
  return true;
}
function updateBattleExpeditionStatus(){
  if(!$('battle-expedition-status')||!state.progression)return false;
  const difficulty=currentDifficulty(),contracts=currentContracts(),seed=state.run?.seedInfo,strategy=currentAutoStrategy();
  if($('hud-difficulty'))$('hud-difficulty').textContent=difficulty.name;
  if($('hud-contracts'))$('hud-contracts').textContent=contracts.length?contracts.map(item=>item.name).join('、'):'无';
  if($('hud-seed-mode'))$('hud-seed-mode').textContent=seed?.mode==='daily'?`每日 ${seed.key.slice(5)}`:'随机';
  const select=$('battle-auto-strategy-select');if(select){select.value=strategy.id;select.onchange=()=>setAutoStrategy(select.value);}
  return true;
}
function buildFormationStyles(){
  const list=$('formation-style-list'),summary=$('formation-style-summary');if(!list)return;
  list.innerHTML='';
  BATTLE_FORMATIONS.forEach(formation=>{
    const selected=formation.id===state.formationStyleId,button=document.createElement('button');button.type='button';
    button.className=`formation-style${selected?' selected':''}`;button.setAttribute('role','radio');button.setAttribute('aria-checked',String(selected));
    button.innerHTML=`<span class="style-name"><span aria-hidden="true">${escapeHtml(formation.symbol)}</span>${escapeHtml(formation.name)}</span><span class="style-desc">${escapeHtml(formation.desc)}</span>`;
    button.onclick=()=>selectFormationStyle(formation.id);list.appendChild(button);
  });
  const formation=currentFormation();if(summary)summary.textContent=`${formation.name} · ${formation.desc}`;
}
function buildFormation(){
  normalizeFormationSlots();
  buildFormationStyles();
  renderExpeditionConfig();
  const labels={front:'前排',back:'后排',reserve:'替补'};
  ['front','back','reserve'].forEach(zone=>{
    const container=$(`slot-${zone}`);if(!container)return;
    container.innerHTML='';
    for(let slotIndex=0;slotIndex<2;slotIndex++){
      const characterIndex=state.formationSlots[zone][slotIndex],selected=sameFormationSlot(state.selectedFormationSlot,{zone,slotIndex});
      const slot=document.createElement('div');
      slot.dataset.zone=zone;slot.dataset.slot=String(slotIndex);
      slot.className=`slot ${characterIndex==null?'empty':'filled'}${selected?' selected':''}`;
      if(characterIndex==null){
        slot.innerHTML=`<div class="slot-empty-mark">＋</div><div class="slot-empty-copy">${labels[zone]} ${slotIndex+1}</div>`;
      }else{
        const c=CHARACTERS[characterIndex],el=ELEMENTS[c.element];
        slot.style.setProperty('--ec',el.color);slot.style.setProperty('--ecg',el.glow+'55');
        slot.innerHTML=`<div class="sg">${artMarkup(c.art,c.name+'头像',el.symbol,'slot-art')}</div><div class="sinfo"><div class="snm">${c.name}</div><div class="srole">${el.cn}·${c.role} · ${labels[zone]}</div></div><button class="srm" type="button" title="移出队伍" aria-label="移出 ${escapeHtml(c.name)}">✕</button>`;
        slot.querySelector('.srm').onclick=event=>{event.stopPropagation();removeFormationCharacter(characterIndex);};
      }
      slot.onclick=()=>selectFormationSlot(zone,slotIndex);
      container.appendChild(slot);
    }
  });
  const pool=$('char-pool');pool.innerHTML='';
  CHARACTERS.forEach((c,i)=>{
    const el=ELEMENTS[c.element],assigned=findFormationSlot(i);
    const m=document.createElement('button');m.type='button';m.className='mini'+(assigned?' in':'');
    m.style.setProperty('--ec',el.color);m.style.setProperty('--ecg',el.glow+'55');
    m.innerHTML=`${artMarkup(c.art,c.name+'立绘',el.symbol,'mini-art')}<div class="mn">${c.name}</div><div class="ms">${'★'.repeat(RARITY[c.rarity].stars)} ${el.cn} · Lv.${state.progression.codexLevel}${assigned?' · '+labels[assigned.zone]:''}</div>`;
    m.onclick=()=>chooseFormationCharacter(i);pool.appendChild(m);
  });
  const activeCount=activeFormationIndices().length,reserveCount=reserveFormationIndices().length;
  const summary=$('formation-summary');if(summary)summary.textContent=`主战 ${activeCount}/4 · 替补 ${reserveCount}/2；先点槽位，再点角色或另一槽位即可调整`;
  const start=$('start-battle-btn');
  start.disabled=activeCount!==ACTIVE_SLOT_COUNT;
  start.textContent=activeCount===ACTIVE_SLOT_COUNT?'开始远征':`请补满主战 · ${activeCount}/4`;
  start.title=activeCount===ACTIVE_SLOT_COUNT?'以当前四人阵型出征':'需要填满 2 个前排与 2 个后排主战位';
  start.setAttribute('aria-label',start.title);
  if(typeof renderComboFormation==='function')renderComboFormation();
}
/* ═══════════════════════════════════════════════════════════════
   玩法说明 / 音效
   ═══════════════════════════════════════════════════════════════ */
function openHelp(){ $('help-modal').style.display='flex'; }
function closeHelp(){ $('help-modal').style.display='none'; }
function showComingSoon(name){
  const notice=$('town-notice');if(!notice)return;
  notice.textContent=`${name} 正在按设计文档制作。本阶段先保证灵素图谱战斗完整可玩。`;
  notice.classList.remove('pulse-notice');void notice.offsetWidth;notice.classList.add('pulse-notice');
}
let soundOn=true, actx=null;
function toggleSound(){ soundOn=!soundOn; }
function sfx(type){
  if(!soundOn) return;
  try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    const o=actx.createOscillator(), g=actx.createGain(); o.connect(g); g.connect(actx.destination);
    const map={click:[520,0.06],hit:[180,0.08],win:[660,0.3],lose:[120,0.4]};
    const [f,d]=map[type]||[440,0.08]; o.frequency.value=f; o.type=type==='win'?'triangle':'square';
    g.gain.setValueAtTime(0.08,actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+d);
    o.start(); o.stop(actx.currentTime+d);
  }catch(e){}
}
document.addEventListener('click',e=>{ if(e.target.closest('.btn,.start-btn,.char-card,.mini,.slot,.skill-btn,.tgt,.fchip')) sfx('click'); },true);

/* ═══════════════════════════════════════════════════════════════
   背景粒子
   ═══════════════════════════════════════════════════════════════ */
(function bgInit(){
  const cv=$('bg-canvas'); const ctx=cv.getContext('2d'); let w,h,parts=[];
  function rs(){ w=cv.width=innerWidth; h=cv.height=innerHeight; parts=Array.from({length:46},()=>({x:Math.random()*w,y:Math.random()*h,r:Math.random()*2+0.5,s:Math.random()*0.4+0.1,a:Math.random()*0.5+0.2})); }
  rs(); addEventListener('resize',rs);
  (function loop(){ ctx.clearRect(0,0,w,h);
    for(const p of parts){ p.y-=p.s; if(p.y<0)p.y=h; ctx.globalAlpha=p.a; ctx.fillStyle='#c9a24b'; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); }
    ctx.globalAlpha=1; requestAnimationFrame(loop); })();
})();

function validateGameData(){
  const errors=[];
  errors.push(...(window.BattleFacing?.validate([...CHARACTERS,...ENEMIES.flat(),...Object.values(SUMMONS)])||[]));
  const ids=new Set();
  const validArt=src=>typeof src==='string'&&src.startsWith('assets/')&&src.endsWith('.png');
  const validTypes=new Set(['attack','aoe','heal','shield','buff','cleanse','summon']);
  const validPassives=new Set(['lowhp','counter','selfRegen','resUp','crtUp','teamHaste','firstAct','shock','lifesteal','guardian','sanction']);
  CHARACTERS.forEach((c,index)=>{
    if(!c.id||ids.has(c.id))errors.push(`角色 ${index+1} 的 ID 缺失或重复`);else ids.add(c.id);
    if(!ELEMENTS[c.element]||!ELEMENTS[c.element2])errors.push(`${c.name} 的元素配置无效`);
    if(!RARITY[c.rarity])errors.push(`${c.name} 的稀有度无效`);
    if(!validArt(c.art))errors.push(`${c.name} 缺少有效立绘路径`);
    if(!c.passive||!validPassives.has(c.passive.type))errors.push(`${c.name} 的被动类型无效`);
    if(!Array.isArray(c.skills)||c.skills.length!==4)errors.push(`${c.name} 必须配置 4 个技能`);
    (c.skills||[]).forEach((sk,skillIndex)=>{
      if(!validTypes.has(sk.type))errors.push(`${c.name}/${sk.name} 的技能类型无效`);
      if(!Number.isInteger(sk.cooldown)||sk.cooldown<0)errors.push(`${c.name}/${sk.name} 缺少有效冷却`);
      const expectedCooldown=[0,2,3,0][skillIndex];if(sk.cooldown!==expectedCooldown)errors.push(`${c.name}/${sk.name} 冷却应为 ${expectedCooldown}`);
      if(sk.summon&&!SUMMONS[sk.summon])errors.push(`${c.name}/${sk.name} 引用了未知召唤物`);
      if(sk.status&&!STATUS[sk.status])errors.push(`${c.name}/${sk.name} 引用了未知状态`);
      if(sk.dot&&!STATUS[sk.dot])errors.push(`${c.name}/${sk.name} 引用了未知 DOT`);
    });
  });
  Object.entries(SUMMONS).forEach(([id,summon])=>{if(!ELEMENTS[summon.element]||!['front','back'].includes(summon.pos)||!summon.skills?.length||!validArt(summon.art))errors.push(`召唤物 ${id} 配置无效`);});
  ENEMIES.flat().forEach(e=>{
    if(!ELEMENTS[e.element]||!e.skills?.length||!validArt(e.art))errors.push(`敌人 ${e.name} 配置无效`);
    if(!e.intent?.archetype||!Array.isArray(e.intent.pattern))errors.push(`敌人 ${e.name} 缺少意图配置`);
    (e.skills||[]).forEach(sk=>{if(!Number.isInteger(sk.cooldown)||!sk.intent?.label||!sk.intent?.target)errors.push(`敌人 ${e.name}/${sk.name} 的冷却或意图无效`);});
  });
  if(ART.backgrounds.battle.length!==ENEMIES.length||Object.values(ART.backgrounds).flat().some(src=>!validArt(src)))errors.push('场景背景资产配置无效');
  Object.keys(FUSION2).forEach(k=>{if(k.split('+').length!==2)errors.push(`双元素融合键无效: ${k}`);});
  Object.keys(FUSION3).forEach(k=>{if(k.split('+').length!==3)errors.push(`三元素融合键无效: ${k}`);});
  if(Object.keys(FUSION2).length!==15)errors.push('双元素融合必须恰好 15 种');
  if(Object.keys(FUSION3).length!==4)errors.push('三元素融合必须恰好 4 种');
  if(COMBO_RECIPES.length<6||new Set(COMBO_RECIPES.map(recipe=>recipe.id)).size!==COMBO_RECIPES.length)errors.push('契约合击至少配置六套且 ID 唯一');
  COMBO_RECIPES.forEach(recipe=>{
    if(recipe.memberIds?.length!==2||new Set(recipe.memberIds).size!==2||recipe.memberIds.some(id=>!ids.has(id))||!COMBO_ITEMS[recipe.itemId]||!validArt(recipe.art)||!recipe.condition||!recipe.effect)errors.push(`契约合击 ${recipe.id} 配置无效`);
  });
  if(BATTLE_FORMATIONS.length!==4||new Set(BATTLE_FORMATIONS.map(item=>item.id)).size!==4||BATTLE_FORMATIONS.some(item=>!item.effects?.length))errors.push('战前阵式必须恰好 4 种且效果完整');
  if(TEMPORARY_FORMULAS.length<6||new Set(TEMPORARY_FORMULAS.map(item=>item.id)).size!==TEMPORARY_FORMULAS.length||TEMPORARY_FORMULAS.some(item=>!item.effects?.length))errors.push('临时灵方配置无效');
  if(CAMP_OPTIONS.map(item=>item.action?.type).join(',')!=='recover,charge,swap')errors.push('营地三选一配置无效');
  const difficultyIds=new Set(EXPEDITION_DIFFICULTIES.map(item=>item.id)),contractIds=new Set(EXPEDITION_CONTRACTS.map(item=>item.id)),strategyIds=new Set(AUTO_STRATEGIES.map(item=>item.id));
  if(EXPEDITION_DIFFICULTIES.length!==3||difficultyIds.size!==EXPEDITION_DIFFICULTIES.length||EXPEDITION_DIFFICULTIES.some(item=>!item.name||item.rewardMultiplier<=0||!(item.masteryMultiplier>0)||(item.contractRewardScale!=null&&!(item.contractRewardScale>=0))||['hp','atk','def','spd'].some(stat=>!(item.enemy?.[stat]>0))))errors.push('远征难度配置无效');
  if(EXPEDITION_CONTRACTS.length<6||contractIds.size!==EXPEDITION_CONTRACTS.length||EXPEDITION_CONTRACTS.some(item=>!item.name||item.rewardBonus<0||!item.effects?.length))errors.push('远征契约配置无效');
  if(AUTO_STRATEGIES.length!==3||strategyIds.size!==AUTO_STRATEGIES.length||AUTO_STRATEGIES.some(item=>!['ultimate','pauseCritical','auto'].includes(item.fusionPolicy)))errors.push('自动策略配置无效');
  if(!difficultyIds.has(EXPEDITION_RULES.defaultDifficulty)||!strategyIds.has(EXPEDITION_RULES.defaultAutoStrategy)||!['random','daily'].includes(EXPEDITION_RULES.defaultSeedMode)||EXPEDITION_RULES.maxContracts!==3)errors.push('远征默认规则配置无效');
  const progressionRewards=PROGRESSION_RULES.rewards;
  const rewardSteps=progressionRewards.map(reward=>reward.clearedWaves).join(',');
  const rewardValuesValid=progressionRewards.every(reward=>['ink','elementDust','essence','masteryXp'].every(key=>Number.isInteger(reward[key])&&reward[key]>=0));
  if(progressionRewards.length!==ENEMIES.length+1||rewardSteps!==Array.from({length:ENEMIES.length+1},(_,index)=>index).join(',')||!rewardValuesValid||PROGRESSION_RULES.codex.maxLevel!==30||PROGRESSION_RULES.codex.baseCost<=0||PROGRESSION_RULES.skill.baseCost<=0||PROGRESSION_RULES.evolution.unlockCost<=0||PROGRESSION_RULES.mastery.xpThresholds.length!==5)errors.push('跨局成长规则配置无效');
  const evolutionIds=new Set();
  ['H1','H2','W1','A1'].forEach(characterId=>{
    const character=CHARACTERS.find(item=>item.id===characterId),branches=EVOLUTION_BRANCHES[characterId];
    if(!character||!Array.isArray(branches)||branches.length!==2){errors.push(`${characterId} 必须配置两条进化分支`);return;}
    branches.forEach(branch=>{
      if(!branch.id||evolutionIds.has(branch.id)||!Number.isInteger(branch.skillIndex)||!character.skills[branch.skillIndex]||!branch.patch||!Object.keys(branch.patch).length)errors.push(`${characterId}/${branch.name||'未命名'} 进化分支无效`);
      evolutionIds.add(branch.id);
    });
  });
  if(errors.length)throw new Error('游戏数据校验失败：\n'+errors.join('\n'));
  return true;
}

/* 测试钩子（供浏览器验证；正式玩法与测试共用同一规则管线） */
window.SC={
  get state(){return state;},get autoBattle(){return autoBattle;},get autoDecisionToken(){return autoDecisionToken;},
  startBattle,playerSelectSkill,resolveTarget,openFusion,confirmFusion,toggleFuse,listFusionActions,validateFusionAction,executeFusionAction,recommendFusion,setAutoBattle,toggleAutoBattle,chooseAutoAction,runAutoDecision,setBattleSpeed,toggleBattleSpeed,
  detectCriticalDecision,openCriticalDecision,closeCriticalDecision,resolveCriticalDecision,skillInterruptProfile,canInterruptEnemy,skillInterruptChance,
  makeUnit,dealDamage,applyDamageToUnit,addShieldToUnit,applyStatus,gainEnergy,effSpd,effRes,hasStatus,skillCooldown,isSkillReady,processTurn,reviveTeam,summonUnits,fusionInfo,validateGameData,unitContainsPoint,pickUnitAtPoint,
  planEnemyIntent,planEnemyIntents,updateBossStage,enemyChooseTarget,activeFormationIndices,reserveFormationIndices,runActiveFormationIndices,runReserveFormationIndices,moveFormationCharacter,
  completeWave,chooseFormula,chooseCampOption,applyCampCharge,selectCampUnit,confirmCampSwap,swapActiveWithReserve,advanceWave,retryBattle,selectFormationStyle,currentFormation,hasFormula,goToProgressionFromResult,
  openProgression,selectProgressionCharacter,selectEvolutionBranch,confirmEvolution,renderProgression,upgradeCodex,upgradeSkill,chooseEvolution,characterProgress,masteryLevel,codexUpgradeCost,skillUpgradeCost,evolutionBranch,buildProgressedSkills,progressedStatPreview,progressionRewardFor,awardExpeditionProgression,saveProgression,resetProgression,
  expeditionSettings,currentDifficulty,currentContracts,currentAutoStrategy,contractEffects,expeditionRewardMultiplier,expeditionMasteryMultiplier,setDifficulty,toggleExpeditionContract,setSeedMode,setAutoStrategy,makeExpeditionEnemy,hashSeed,createSeededRandom,dailySeedKey,fusionPropertyDelta,
  CHARACTERS,ENEMIES,SUMMONS,STATUS,FUSION2,FUSION3,ELEMENTS,RARITY,getAdvantage,ART,REQUIRED_ART,BATTLE_FORMATIONS,TEMPORARY_FORMULAS,CAMP_OPTIONS,EXPEDITION_CHOICE_RULES,PROGRESSION_RULES,EVOLUTION_BRANCHES,EXPEDITION_DIFFICULTIES,EXPEDITION_CONTRACTS,AUTO_STRATEGIES,EXPEDITION_RULES,
  get progression(){return state.progression;},
  preloadArt,artStatus,whenArtReady,
  setRandomSource:(fn)=>{randomOverride=typeof fn==='function'?fn:null;},
  resetRandomSource:()=>{randomOverride=null;},
  setTeam:setTeamIndices,
  forceEnergy:()=>{const u=state.turnOrder[state.curIdx];if(u&&!u.isEnemy&&!u.isSummon){u.energy=u.maxEnergy;renderAll();}},
  snapshot:()=>JSON.parse(JSON.stringify({team:state.team,formationSlots:state.formationSlots,formationStyleId:state.formationStyleId,reserves:state.reserves,reserveUnits:state.reserveUnits,wave:state.wave,turn:state.turn,kills:state.kills,phase:state.phase,run:state.run,allies:state.allies,enemies:state.enemies}))
};

window.onerror=function(msg,src,line,col,err){
  const overlay=$('err-overlay'), message=$('err-msg');
  if(overlay&&message){
    message.textContent=(msg||'')+'\n'+(err&&err.stack?err.stack:'')+'\n@'+src+':'+line+':'+col;
    overlay.classList.add('show');
  }
  return false;
};
window.addEventListener('unhandledrejection',e=>{
  const overlay=$('err-overlay'), message=$('err-msg');
  if(overlay&&message){
    message.textContent='Promise rejection: '+((e.reason&&e.reason.stack)||e.reason||'');
    overlay.classList.add('show');
  }
});

// 初始队伍（演示）
state.progression=loadProgression();
validateGameData();
state.team=[...DEFAULT_TEAM];
state.formationSlots=cloneFormationSlots(DEFAULT_FORMATION_SLOTS);
setUiArt('title-emblem',ART.ui.emblem,'六元素炼金徽记','⚗️','emblem-art');
updateAutoBattleButton();
