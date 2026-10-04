'use strict';

const ELEMENTS = {
  fire:    {cn:'火', symbol:'🔥', color:'#e84530', glow:'#ff8c42', aux:'#ffe66d', en:'Fire'},
  water:   {cn:'水', symbol:'💧', color:'#2e86ab', glow:'#7ec8e3', aux:'#a0e7e5', en:'Water'},
  wind:    {cn:'风', symbol:'🌪', color:'#90be6d', glow:'#b8e994', aux:'#f0f8e8', en:'Wind'},
  thunder: {cn:'雷', symbol:'⚡', color:'#5b5ea6', glow:'#c89bff', aux:'#f9ca24', en:'Thunder'},
  dark:    {cn:'暗', symbol:'🌑', color:'#9b59b6', glow:'#b388ff', aux:'#4a4a5c', en:'Dark'},
  light:   {cn:'光', symbol:'☀️', color:'#f7dc6f', glow:'#fff3c4', aux:'#ffffff', en:'Light'},
};
// 干净克制环: 火>风>雷>水>火 ; 暗↔光 互克
const ADV_CYCLE = {fire:'wind', wind:'thunder', thunder:'water', water:'fire'};
function getAdvantage(a, d){
  if (ADV_CYCLE[a] === d) return 1.25;
  if (ADV_CYCLE[d] === a) return 0.80;
  if ((a==='dark'&&d==='light')||(a==='light'&&d==='dark')) return 1.30;
  return 1.0;
}

// 稀有度倍率（原型采用温和曲线，避免 SSR 碾压队友）
// 稀有度主要提供机制与容错差异；同养成下 SR→SSR 的纯属性差控制在 10%。
const RARITY = {N:{stars:1,mult:0.88}, R:{stars:2,mult:0.94}, SR:{stars:3,mult:1.0}, SSR:{stars:4,mult:1.10}};

// ── 单局构筑数据（Slice B）──
// effect.kind 是逻辑层的分发键；value 使用最终乘数（0.88 = 受到伤害 -12%）。
// formation 的效果持续整次远征，temporary formula 只在本次远征生效。
const BATTLE_FORMATIONS = [
  {
    id:'bulwark', name:'坚壁阵', symbol:'🛡', category:'sustain',
    desc:'前排受到伤害 -12%，但后排速度 -8%。',
    effects:[
      {kind:'statMultiplier', target:'frontAllies', stat:'damageTaken', value:0.88, polarity:'benefit'},
      {kind:'statMultiplier', target:'backAllies', stat:'spd', value:0.92, polarity:'cost'},
    ],
  },
  {
    id:'gale', name:'疾风阵', symbol:'💨', category:'tempo',
    desc:'每波首轮全队速度 +15%，但获得的护盾量 -15%。',
    effects:[
      {kind:'statMultiplier', target:'activeAllies', stat:'spd', value:1.15, durationRounds:1, refresh:'waveStart', polarity:'benefit'},
      {kind:'statMultiplier', target:'activeAllies', stat:'shieldReceived', value:0.85, polarity:'cost'},
    ],
  },
  {
    id:'alchemy', name:'炼成阵', symbol:'⚗', category:'fusion',
    desc:'本次远征首次融合的协力能量消耗减半，但正式角色获得能量 -10%。',
    effects:[
      {kind:'resourceCostMultiplier', target:'fusionAssist', resource:'energy', value:0.50, uses:1, refresh:'expedition', polarity:'benefit'},
      {kind:'resourceGainMultiplier', target:'heroAllies', resource:'energy', value:0.90, polarity:'cost'},
    ],
  },
  {
    id:'spirit_calling', name:'召灵阵', symbol:'🜁', category:'summon',
    desc:'召唤物伤害 +20%、持续时间 +1 回合，但正式角色普攻伤害 -10%。',
    effects:[
      {kind:'damageMultiplier', target:'alliedSummons', value:1.20, polarity:'benefit'},
      {kind:'durationDelta', target:'alliedSummons', stat:'durationRounds', value:1, polarity:'benefit'},
      {kind:'damageMultiplier', target:'heroBasicAttacks', value:0.90, polarity:'cost'},
    ],
  },
];

// 第一波结束后从池中抽取 3 个、选择 1 个；所有触发次数按 effect.limitScope 限制。
const TEMPORARY_FORMULAS = [
  {
    id:'ember_spores', name:'余烬孢子', symbol:'🔥', category:'element',
    desc:'灼烧在目标身上首次结算时，将 1 回合灼烧扩散给一个相邻敌人。',
    effects:[{kind:'spreadStatus', trigger:'dotTick', status:'burn', target:'adjacentEnemy', turns:1, maxTargets:1,
      conditions:{firstTickOnTarget:true}, limit:1, limitScope:'perTargetPerExpedition'}],
  },
  {
    id:'clear_spring', name:'澄泉引', symbol:'💧', category:'support',
    desc:'治疗生命低于 40% 的目标时，额外净化 1 个负面状态；每名角色每回合至多触发一次。',
    effects:[{kind:'cleanse', trigger:'healResolved', target:'healedTarget', count:1,
      conditions:{targetHpPctAtMost:0.40}, limit:1, limitScope:'perTargetPerRound'}],
  },
  {
    id:'thorned_aegis', name:'棘甲铭文', symbol:'🛡', category:'defense',
    desc:'护盾被击破时，对攻击者造成被击破护盾量 35% 的反击伤害。',
    effects:[{kind:'reflectDamage', trigger:'shieldBreak', target:'attacker', basis:'brokenShield', value:0.35,
      limit:1, limitScope:'perTargetPerRound'}],
  },
  {
    id:'conductive_tide', name:'导电潮汐', symbol:'⚡', category:'fusion',
    desc:'电磁洪流额外弹射 1 次，但由它产生的炼成过载延长 1 回合。',
    effects:[
      {kind:'fusionPropertyDelta', target:'water+thunder', property:'chain', value:1},
      {kind:'fusionPropertyDelta', target:'water+thunder', property:'overloadTurns', value:1},
    ],
  },
  {
    id:'flaw_hunter', name:'破绽追猎', symbol:'🎯', category:'offense',
    desc:'对带有负面状态的敌人造成伤害 +15%。',
    effects:[{kind:'damageMultiplier', trigger:'damageCalculate', target:'debuffedEnemies', value:1.15}],
  },
  {
    id:'emergency_crystal', name:'应激晶壳', symbol:'◇', category:'defense',
    desc:'单次受到超过最大生命 25% 的伤害后，获得最大生命 10% 的护盾；每名角色每回合一次。',
    effects:[{kind:'grantShield', trigger:'damageTaken', target:'damagedAlly', maxHpPct:0.10,
      conditions:{damageMaxHpPctAtLeast:0.25}, limit:1, limitScope:'perTargetPerRound'}],
  },
  {
    id:'echo_caliper', name:'回响刻度', symbol:'⌛', category:'cooldown',
    desc:'正式角色普攻命中后，自身剩余冷却最长的非大招技能冷却 -1；每回合一次。',
    effects:[{kind:'reduceCooldown', trigger:'basicAttackHit', target:'selfLongestCooldown', amount:1,
      conditions:{actorType:'hero',excludeUlt:true}, limit:1, limitScope:'perActorPerRound'}],
  },
  {
    id:'counterflow_cell', name:'逆流蓄电池', symbol:'✦', category:'element',
    desc:'正式角色打出元素克制伤害后获得 8 能量；每名角色每回合一次。',
    effects:[{kind:'gainResource', trigger:'advantageDamage', target:'source', resource:'energy', amount:8,
      conditions:{actorType:'hero'}, limit:1, limitScope:'perActorPerRound'}],
  },
];

// 第二波结束后的固定三选一。action.type 是营地逻辑的唯一分支键。
const CAMP_OPTIONS = [
  {
    id:'recover', name:'灵泉休整', symbol:'✚', category:'recover',
    desc:'全队回复 25% 最大生命。',
    action:{type:'recover', target:'expeditionAllies', maxHpPct:0.25, revive:false},
  },
  {
    id:'charge', name:'聚能冥想', symbol:'⚡', category:'charge',
    desc:'指定一名存活角色获得 40 能量。',
    action:{type:'charge', target:'selectedLivingHero', resource:'energy', amount:40, cap:100, requiresSelection:true},
  },
  {
    id:'swap', name:'替补换阵', symbol:'⇄', category:'swap',
    desc:'选择一名场上角色与一名替补交换，双方保留当前生命、能量与冷却。',
    action:{type:'swap', outgoing:'selectedActiveHero', incoming:'selectedReserveHero', requiresSelection:true,
      statePolicy:{preserveHp:true,preserveEnergy:true,preserveCooldowns:true,clearTurnFlags:true,clampVitals:true}},
  },
];

const EXPEDITION_CHOICE_RULES = {
  formula:{afterWave:1,draw:3,pick:1,pool:'TEMPORARY_FORMULAS'},
  camp:{afterWave:2,draw:3,pick:1,pool:'CAMP_OPTIONS'},
};

// ── 跨局成长数据（Slice C）──
// 节奏按一局约 5 分钟设计：7 次完整远征可将图谱从 Lv.1 提升到 Lv.10，
// 同时恰好积累首次进化所需精华；第 4 次胜利可完成第一次技能强化。
const PROGRESSION_RULES = {
  saveKey:'spirit-codex-progression-v1',
  version:1,
  codex:{minLevel:1,maxLevel:30,baseCost:60,costStep:20,statGrowthPerLevel:0.02},
  mastery:{minLevel:1,maxLevel:5,xpThresholds:[0,3,8,15,24],rank2StatBonus:0.03,rank3BasicEnergyBonus:5,rank4CooldownReduction:1,rank5StartingEnergy:15},
  skill:{minLevel:0,maxLevel:3,baseCost:100,costStep:75,powerGrowthPerLevel:0.10,cooldownReductionAtLevel:2},
  evolution:{unlockCodexLevel:10,unlockCost:100,switchCost:10},
  rewards:[
    {clearedWaves:0,ink:0,elementDust:0,essence:0,masteryXp:0},
    {clearedWaves:1,ink:45,elementDust:8,essence:4,masteryXp:1},
    {clearedWaves:2,ink:100,elementDust:17,essence:9,masteryXp:2},
    {clearedWaves:3,ink:180,elementDust:25,essence:15,masteryXp:3},
  ],
};

// 第一批四个核心定位的真实分支。patch 会在战斗单位创建时合并进指定技能；
// evolutionControl 等扩展字段由统一技能结算管线读取，不存在“只改文案”的分支。
const EVOLUTION_BRANCHES = {
  H1:[
    {id:'h1_wildfire',name:'焚野',symbol:'🔥',role:'群攻灼烧',skillIndex:1,
      desc:'【烈焰穿刺】改为攻击全体敌人并施加灼烧。',
      patch:{type:'aoe',mult:1.10,desc:'火线横扫全体敌人，并附加 3 回合灼烧。'}},
    {id:'h1_windhunt',name:'风狩',symbol:'🌪',role:'连击斩杀',skillIndex:1,
      desc:'【烈焰穿刺】改为两段追猎箭，每段 85% 攻击。',
      patch:{type:'attack',mult:0.85,hits:2,desc:'两段高速追猎箭命中同一目标，并附加灼烧。'}},
  ],
  H2:[
    {id:'h2_bulwark',name:'熔炉壁垒',symbol:'🛡',role:'护盾援护',skillIndex:1,
      desc:'【熔岩护盾】护盾提高至 25%，并令全队防御 +15% 持续 2 回合。',
      patch:{shieldPct:0.25,buff:{type:'def',val:0.15,turns:2},desc:'全队获得 25% 最大生命护盾，并提高防御。'}},
    {id:'h2_vanguard',name:'爆燃先锋',symbol:'💥',role:'群体破防',skillIndex:2,
      desc:'【爆燃冲锋】改为冲击全体敌人，并对全体施加破防。',
      patch:{type:'aoe',mult:1.00,desc:'爆燃冲击全体敌人，并施加 2 回合破防。'}},
  ],
  W1:[
    {id:'w1_spring',name:'深澜圣泉',symbol:'✚',role:'治疗净化',skillIndex:1,
      desc:'【治愈之泉】治疗提高至 24%，并净化全队负面状态。',
      patch:{healPct:0.24,cleanse:true,desc:'治疗全队 24% 生命，并净化全部负面状态。'}},
    {id:'w1_frost',name:'寒潮织者',symbol:'❄',role:'护盾控制',skillIndex:2,
      desc:'【冰霜护盾】展开寒潮，使全体敌人减速，并额外尝试冻结一名敌人。',
      patch:{evolutionControl:'frostwave',desc:'为全队施加冰盾；寒潮使全体敌人减速，并尝试冻结一名敌人。'}},
  ],
  A1:[
    {id:'a1_eagles',name:'鹰群契约',symbol:'🦅',role:'召唤强化',skillIndex:1,
      desc:'【风鹰召唤】一次召唤两只强化风鹰，攻击 +25%、持续 +1 回合。',
      patch:{summonCount:2,summonAtkMultiplier:1.25,summonDurationDelta:1,desc:'召唤两只强化风鹰助战。'}},
    {id:'a1_hunt',name:'风羽猎杀',symbol:'🎯',role:'双段收割',skillIndex:2,
      desc:'【暴风眼】改为两段风刃席卷，每段 70% 攻击。',
      patch:{hits:2,mult:0.70,desc:'两段风刃席卷全体敌人，并施加减速。'}},
  ],
};

// ── 远征规则与自动策略（Slice D）──
const EXPEDITION_DIFFICULTIES = [
  {id:'story',name:'剧情',symbol:'📖',desc:'敌人更温和，适合熟悉构筑。永久奖励 ×0.8，契约奖励按 25% 计。',enemy:{hp:0.82,atk:0.85,def:0.90,spd:0.96},rewardMultiplier:0.80,contractRewardScale:0.25,masteryMultiplier:2/3},
  {id:'standard',name:'标准',symbol:'⚔',desc:'按设计基准进行三波远征。永久奖励 ×1.0。',enemy:{hp:1,atk:1,def:1,spd:1},rewardMultiplier:1,masteryMultiplier:1},
  {id:'challenge',name:'挑战',symbol:'☠',desc:'敌人生命、攻击、防御与速度全面提高。永久奖励 ×1.35。',enemy:{hp:1.25,atk:1.20,def:1.10,spd:1.08},rewardMultiplier:1.35,masteryMultiplier:4/3},
];

const EXPEDITION_CONTRACTS = [
  {id:'ironhide',name:'铁壁敌阵',symbol:'⬡',desc:'敌人最大生命 +25%。',rewardBonus:0.15,effects:[{kind:'enemyStatMultiplier',stat:'hp',value:1.25}]},
  {id:'enemy_haste',name:'猎杀时钟',symbol:'⌛',desc:'敌人攻击 +10%、速度 +18%。',rewardBonus:0.20,effects:[{kind:'enemyStatMultiplier',stat:'atk',value:1.10},{kind:'enemyStatMultiplier',stat:'spd',value:1.18}]},
  {id:'scarce_healing',name:'枯竭灵泉',symbol:'✚',desc:'我方受到的治疗量 -30%。',rewardBonus:0.08,effects:[{kind:'allyHealingMultiplier',value:0.70}]},
  {id:'fragile_shields',name:'破碎晶壳',symbol:'◇',desc:'我方获得的护盾量 -30%。',rewardBonus:0.08,effects:[{kind:'allyShieldMultiplier',value:0.70}]},
  {id:'burning_ground',name:'余烬地脉',symbol:'🔥',desc:'每波开始时，正式角色获得 2 回合灼烧。',rewardBonus:0.18,effects:[{kind:'waveStartStatus',status:'burn',turns:2}]},
  {id:'sealed_arts',name:'封术刻印',symbol:'⛓',desc:'非普攻、非大招技能的基础冷却 +1。',rewardBonus:0.12,effects:[{kind:'skillCooldownDelta',value:1}]},
];

const AUTO_STRATEGIES = [
  {id:'assault',name:'速攻',symbol:'⚔',desc:'提高伤害技能与大招优先级，不主动融合。',damageWeight:1.25,supportWeight:0.78,fusionPolicy:'ultimate'},
  {id:'steady',name:'稳健',symbol:'🛡',desc:'更早治疗与护盾；Boss 关键回合会暂停并推荐融合。',damageWeight:0.95,supportWeight:1.25,fusionPolicy:'pauseCritical'},
  {id:'alchemy',name:'炼成',symbol:'⚗',desc:'能量与队友条件满足时，自动施放评分最高的元素融合。',damageWeight:1,supportWeight:1,fusionPolicy:'auto'},
];

const EXPEDITION_RULES = {maxContracts:3,defaultDifficulty:'standard',defaultSeedMode:'random',defaultAutoStrategy:'steady'};

// ── Image2 美术资产（相对 playable/spirit-codex.html）──
const ART = {
  backgrounds:{
    title:'assets/backgrounds/bg-title-codex-hall.png',
    town:'assets/backgrounds/bg-town-alchemy-haven.png',
    roster:'assets/backgrounds/bg-roster-archive.png',
    formation:'assets/backgrounds/bg-formation-war-table.png',
    battle:[
      'assets/backgrounds/bg-battle-wave-01-shadow-ruins.png',
      'assets/backgrounds/bg-battle-wave-02-elemental-foundry.png',
      'assets/backgrounds/bg-battle-wave-03-chaos-sanctum.png',
    ],
  },
  // UI 装饰同样走安全加载；若后续替换或文件缺失，会保留炼金符号/文字回退。
  ui:{
    emblem:'assets/ui/ui-sixfold-emblem.png',
    victoryCrest:'assets/ui/ui-victory-crest.png',
    defeatCrest:'assets/ui/ui-defeat-crest.png',
    panelGrain:'assets/ui/ui-panel-grain.png',
    mapSeal:'assets/ui/town-map-seal.png',
    rosterSeal:'assets/ui/town-roster-seal.png',
    recruitSeal:'assets/ui/town-recruit-seal.png',
    forgeSeal:'assets/ui/town-forge-seal.png',
    apothecarySeal:'assets/ui/town-apothecary-seal.png',
    evolutionSeal:'assets/ui/town-evolution-seal.png',
  },
};

// ── 状态定义 ──
const STATUS = {
  burn:   {emoji:'🔥', name:'灼烧', kind:'debuff', turns:3},
  corrupt:{emoji:'💀', name:'腐蚀', kind:'debuff', turns:3},
  frostbite:{emoji:'❄', name:'冻伤', kind:'debuff', turns:2},
  freeze: {emoji:'❄', name:'冰冻', kind:'debuff', turns:1},
  stun:   {emoji:'⚡', name:'麻痹', kind:'debuff', turns:1},
  slow:   {emoji:'🐌', name:'减速', kind:'debuff', turns:2},
  blind:  {emoji:'🌫', name:'致盲', kind:'debuff', turns:2},
  curse:  {emoji:'🔻', name:'诅咒', kind:'debuff', turns:2},
  defBreak:{emoji:'🛡', name:'破防', kind:'debuff', turns:2},
  haste:  {emoji:'💨', name:'加速', kind:'buff', turns:2},
  regen:  {emoji:'✚', name:'再生', kind:'buff', turns:3},
  invis:  {emoji:'👁', name:'隐匿', kind:'buff', turns:2},
  nextCrit:{emoji:'🎯', name:'必暴', kind:'buff', turns:1},
  overload:{emoji:'⚗', name:'炼成过载', kind:'debuff', turns:1},
};

// ── 角色技能 schema ──
// {name, type:'attack'|'aoe'|'heal'|'shield'|'buff'|'cleanse'|'summon', mult, target,
//  dot, dotTurns, status, statusChance, statusTurns, hits, chain,
//  healPct, shieldPct, buff:{type,val,turns}, summon, ult, lifesteal,
//  cooldown（使用后需等待的完整回合数；大招仍由能量限制，记为 0）,
//  desc, fx(美术特效提示词)}
const SUMMONS = {
  wind_eagle:{name:'风鹰', element:'wind', pos:'back', art:'assets/summons/summon-wind-eagle.png', hp:420, atk:74, def:28, spd:112, skills:[{name:'风爪',type:'attack',mult:1.0,cooldown:0}]},
  skeleton:  {name:'骷髅战士', element:'dark', pos:'front', art:'assets/summons/summon-skeleton-warrior.png', hp:640, atk:62, def:42, spd:58, skills:[{name:'骨爪',type:'attack',mult:1.0,cooldown:0}]},
};

// ── 12 位正式角色（game-art-design.md）──
const CHARACTERS = [
  { id:'H1', name:'艾拉·炎棘', element:'fire', element2:'wind', rarity:'SSR', role:'狙击', pos:'back', art:'assets/characters/char-h1-fire-ranger.png',
    intro:'火元素大师，手持燃烧长弓，性格冷静。',
    hp:760, atk:150, def:42, spd:96, crt:35, ctd:165, res:30, em:60, int:70,
    skills:[
      {name:'炎棘箭', type:'attack', mult:1.0, cooldown:0, desc:'火焰箭矢命中，小型爆燃。', fx:'单支火焰箭矢命中瞬间，橙红火焰包裹箭身，火花四溅。'},
      {name:'烈焰穿刺', type:'attack', mult:1.5, dot:'burn', dotTurns:3, cooldown:2, desc:'三道火柱点燃，附加灼烧。', fx:'三道火柱沿直线依次点燃，路径燃烧留痕。'},
      {name:'焚天箭雨', type:'aoe', mult:0.9, hits:3, dot:'burn', dotTurns:2, cooldown:3, desc:'数十支火焰箭雨覆盖全场敌人并灼烧。', fx:'数十支火焰箭雨从天而降，地面燃烧范围扩散。'},
      {name:'炎棘陨落', type:'aoe', mult:2.0, dot:'burn', dotTurns:3, cooldown:0, ult:true, desc:'全屏火焰流星雨陨落，巨额伤害+灼烧。', fx:'全屏火焰流星雨陨落，多道巨型火球撞击地面。'},
    ],
    passive:{name:'低血狂暴', type:'lowhp', val:0.3, threshold:0.3, desc:'生命低于 30% 时攻击力 +30%。'} },

  { id:'H2', name:'洛恩·炉火', element:'fire', element2:'water', rarity:'SR', role:'护卫', pos:'front', art:'assets/characters/char-h2-fire-guardian.png',
    intro:'炼金术士，用火焰大剑，性格豪爽。',
    hp:1340, atk:96, def:82, spd:55, crt:15, ctd:140, res:50, em:40, int:45,
    skills:[
      {name:'炼火斩', type:'attack', mult:1.1, cooldown:0, desc:'火焰剑斩向前推进。', fx:'单次火焰剑斩，剑身缠绕火焰向前推进。'},
      {name:'熔岩护盾', type:'shield', shieldPct:0.20, cooldown:2, desc:'周身升起熔岩护盾，全队获得 20% 最大生命护盾。', fx:'周身升起熔岩护盾，橙红岩浆流动，龟裂纹路发光。'},
      {name:'爆燃冲锋', type:'attack', mult:1.4, status:'defBreak', statusChance:1, statusTurns:2, cooldown:3, desc:'火焰冲锋，降低目标防御。', fx:'火焰冲锋路径留下燃烧轨迹，火线贯穿战场。'},
      {name:'炉火之怒', type:'aoe', mult:1.6, dot:'burn', dotTurns:2, cooldown:0, ult:true, desc:'大范围火焰爆炸，全体灼烧。', fx:'大范围火焰爆炸扩散，环形冲击波，熔岩喷涌。'},
    ],
    passive:{name:'炽炎反击', type:'counter', val:0.3, desc:'受到攻击时，反弹 30% 攻击力的伤害。'} },

  { id:'W1', name:'汐·深澜', element:'water', element2:'light', rarity:'SSR', role:'治疗', pos:'back', art:'assets/characters/char-w1-water-healer.png',
    intro:'水元素使，能操控水流和冰霜，性格温柔。',
    hp:840, atk:76, def:52, spd:80, crt:15, ctd:140, res:65, em:70, int:75,
    skills:[
      {name:'涌泉', type:'attack', mult:1.0, cooldown:0, desc:'单道水流冲击。', fx:'单道水流冲击向前，深蓝色水柱推进。'},
      {name:'治愈之泉', type:'heal', healPct:0.20, cooldown:2, desc:'蓝色水柱治愈全队 20% 生命。', fx:'蓝色治疗水柱从地面升起，治愈光点向上飘散。'},
      {name:'冰霜护盾', type:'shield', shieldPct:0.20, cooldown:3, desc:'为全队施加 20% 最大生命冰晶护盾，并几率冰冻一敌。', fx:'冰晶护盾环绕目标升起，六角冰晶旋转。'},
      {name:'深澜之颂', type:'heal', healPct:0.32, cleanse:true, cooldown:0, ult:true, desc:'全队治疗 32% 并净化负面状态。', fx:'全队治疗水波扩散，治愈光雨飘落。'},
    ],
    passive:{name:'快速恢复', type:'selfRegen', val:0.03, desc:'每回合结束回复自身 3% 生命。'} },

  { id:'W2', name:'亚瑟·潮汐', element:'water', element2:'thunder', rarity:'SR', role:'控制', pos:'front', art:'assets/characters/char-w2-tide-warden.png',
    intro:'前航海士，用三叉戟，性格沉稳。',
    hp:1280, atk:98, def:76, spd:60, crt:18, ctd:145, res:55, em:45, int:50,
    skills:[
      {name:'三叉刺', type:'attack', mult:1.2, cooldown:0, desc:'深蓝三叉戟水柱刺出。', fx:'单次水刺攻击，深蓝三叉戟水柱刺出。'},
      {name:'潮汐锁链', type:'attack', mult:1.3, status:'slow', statusChance:1, statusTurns:2, cooldown:2, desc:'水链缠绕，减速目标。', fx:'多道水链缠绕目标，水流链条螺旋收紧。'},
      {name:'深渊漩涡', type:'aoe', mult:1.2, status:'slow', statusChance:0.8, statusTurns:2, cooldown:3, desc:'漩涡吞噬全体敌人并减速。', fx:'地面水流漩涡形成，龙卷水柱旋转上升。'},
      {name:'海神降临', type:'aoe', mult:1.5, status:'slow', statusChance:0.9, statusTurns:2, cooldown:0, ult:true, desc:'大范围水流爆发，全体减速。', fx:'大范围水流爆发冲天，多道水柱同时涌起。'},
    ],
    passive:{name:'坚韧', type:'resUp', val:0.25, desc:'韧性 +25%，更不易被控制。'} },

  { id:'A1', name:'琳·风羽', element:'wind', element2:'fire', rarity:'SSR', role:'召唤', pos:'back', art:'assets/characters/char-a1-wind-ranger.png',
    intro:'风元素游侠，能召唤风鹰，性格活泼。',
    hp:780, atk:140, def:44, spd:100, crt:30, ctd:160, res:32, em:62, int:68,
    skills:[
      {name:'风羽刃', type:'attack', mult:1.2, status:'blind', statusChance:0.2, statusTurns:2, cooldown:0, desc:'风刃切割，几率致盲。', fx:'单道风刃向前切割，绿色气流拖尾。'},
      {name:'风鹰召唤', type:'summon', summon:'wind_eagle', cooldown:2, desc:'召唤风鹰助战（高速度攻击）。', fx:'风鹰从虚空中俯冲而下，气流漩涡卷起。'},
      {name:'暴风眼', type:'aoe', mult:1.1, status:'slow', statusChance:0.7, statusTurns:2, cooldown:3, desc:'龙卷风席卷全体并减速。', fx:'龙卷风中心形成，绿色风柱旋转上升。'},
      {name:'风羽风暴', type:'aoe', mult:1.8, cooldown:0, ult:true, desc:'全屏风刃风暴席卷全场。', fx:'全屏风刃风暴席卷，多道风刃同时飞出。'},
    ],
    passive:{name:'鹰眼', type:'crtUp', val:15, desc:'暴击率 +15%。'} },

  { id:'A2', name:'赛巴斯', element:'wind', element2:'light', rarity:'SR', role:'辅助', pos:'back', art:'assets/characters/char-a2-wind-alchemist.png',
    intro:'老炼金师，用风魔法强化队友，性格稳重。',
    hp:880, atk:74, def:54, spd:78, crt:12, ctd:135, res:60, em:66, int:72,
    skills:[
      {name:'风灵弹', type:'attack', mult:1.0, cooldown:0, desc:'小型绿色风弹射出。', fx:'小型绿色风弹射出，气流螺旋环绕。'},
      {name:'风之祝福', type:'buff', buff:{type:'atk', val:0.2, turns:2}, cooldown:2, desc:'增益风圈，全队攻击 +20%。', fx:'增益风圈环绕目标升起，光点向上飘散。'},
      {name:'顺风领域', type:'buff', buff:{type:'spd', val:0.4, turns:2}, cooldown:3, desc:'范围加速风场，全队速度 +40%。', fx:'范围加速风场扩散，气流加速线。'},
      {name:'风神庇佑', type:'shield', shieldPct:0.35, buff:{type:'spd', val:0.3, turns:2}, cooldown:0, ult:true, desc:'全队获得 35% 最大生命风盾 + 加速。', fx:'全队风盾加持升起，气流旋转。'},
    ],
    passive:{name:'启程', type:'teamHaste', val:0.2, turns:1, desc:'战斗开始时全队速度 +20%（首回合）。'} },

  { id:'T1', name:'扎克·雷鸣', element:'thunder', element2:'dark', rarity:'SSR', role:'爆发', pos:'back', art:'assets/characters/char-t1-thunder-warrior.png',
    intro:'雷元素战神，近战雷电，性格暴烈。',
    hp:820, atk:152, def:46, spd:88, crt:33, ctd:170, res:30, em:64, int:66,
    skills:[
      {name:'雷鸣斩', type:'attack', mult:1.3, cooldown:0, desc:'雷电剑斩，电弧缠绕。', fx:'单次雷电剑斩，紫色电弧缠绕剑身。'},
      {name:'雷霆一击', type:'attack', mult:2.0, cooldown:2, desc:'单体高伤雷击从天而降。', fx:'单体高伤雷击从天而降，地面电弧扩散。'},
      {name:'电磁脉冲', type:'aoe', mult:1.0, status:'stun', statusChance:0.3, statusTurns:1, cooldown:3, desc:'范围电磁爆炸，几率麻痹。', fx:'范围电磁爆炸扩散，电弧跳跃。'},
      {name:'万雷天牢', type:'aoe', mult:1.8, status:'stun', statusChance:0.5, statusTurns:1, cooldown:0, ult:true, desc:'全屏雷击，几率麻痹。', fx:'全屏雷击降临，雷电网格形成。'},
    ],
    passive:{name:'蓄能', type:'firstAct', val:0.3, desc:'本场首次行动攻击 +30%。'} },

  { id:'T2', name:'奈娜·闪电', element:'thunder', element2:'water', rarity:'SR', role:'控制', pos:'back', art:'assets/characters/char-t2-thunder-mage.png',
    intro:'年轻的雷系法师，性格冷静内敛。',
    hp:800, atk:94, def:48, spd:92, crt:22, ctd:150, res:50, em:60, int:64,
    skills:[
      {name:'闪电弹', type:'attack', mult:1.1, cooldown:0, desc:'单发紫色雷电球射出。', fx:'单发紫色雷电球射出，电弧跳跃。'},
      {name:'静电场', type:'aoe', mult:0.8, status:'slow', statusChance:0.8, statusTurns:2, cooldown:2, desc:'范围电场减速全体。', fx:'范围减速电场扩散，电弧跳跃。'},
      {name:'连锁闪电', type:'attack', mult:1.2, chain:2, cooldown:3, desc:'雷电击中后链式跳跃至另外 2 个敌人。', fx:'链式雷电在多个目标间跳跃，电光连接。'},
      {name:'电磁风暴', type:'aoe', mult:1.4, status:'stun', statusChance:0.4, statusTurns:1, cooldown:0, ult:true, desc:'全屏电磁爆发，几率麻痹。', fx:'全屏电磁爆发，电弧密布。'},
    ],
    passive:{name:'感电', type:'shock', val:0.15, desc:'攻击有 15% 几率使目标麻痹。'} },

  { id:'D1', name:'薇洛·暗舞', element:'dark', element2:'wind', rarity:'SSR', role:'刺客', pos:'back', art:'assets/characters/char-d1-shadow-assassin.png',
    intro:'暗元素杀手，速度极快，性格神秘。',
    hp:760, atk:150, def:40, spd:106, crt:38, ctd:175, res:28, em:60, int:67,
    skills:[
      {name:'暗影刺', type:'attack', mult:1.4, status:'curse', statusChance:1, statusTurns:2, cooldown:0, desc:'暗影匕首刺击并诅咒。', fx:'暗属性匕首刺击，紫黑刀光拖尾。'},
      {name:'影遁', type:'buff', buff:{type:'spd', val:0.5, turns:2}, selfOnly:true, cooldown:2, desc:'隐入暗影，自身速度大幅提升。', fx:'角色隐身进入暗影，紫色烟气消散。'},
      {name:'暗蚀', type:'attack', mult:1.2, dot:'corrupt', dotTurns:3, status:'defBreak', statusChance:1, statusTurns:2, cooldown:3, desc:'暗影腐蚀，持续伤害并破防。', fx:'暗影持续腐蚀目标，暗影触手蔓延。'},
      {name:'暗影之舞', type:'attack', mult:0.65, hits:4, status:'curse', statusChance:0.8, statusTurns:2, cooldown:0, ult:true, desc:'多段暗属性斩击连击并诅咒。', fx:'多段暗属性斩击连续，刀光连击。'},
    ],
    passive:{name:'嗜血', type:'lifesteal', val:0.25, desc:'造成伤害的 25% 转化为自身生命。'} },

  { id:'D2', name:'卡尔·冥府', element:'dark', element2:'fire', rarity:'SR', role:'召唤', pos:'front', art:'assets/characters/char-d2-necromancer.png',
    intro:'亡灵术士，能召唤骷髅战士，性格阴沉。',
    hp:1140, atk:90, def:70, spd:58, crt:16, ctd:145, res:48, em:58, int:62,
    skills:[
      {name:'魂火', type:'attack', mult:1.1, dot:'burn', dotTurns:2, cooldown:0, desc:'灵魂火焰攻击并灼烧。', fx:'灵魂火焰攻击，紫色魂火球飘出。'},
      {name:'亡灵召唤', type:'summon', summon:'skeleton', cooldown:2, desc:'从地面召唤骷髅战士承伤。', fx:'紫色魔法阵升起，骷髅战士从阵中爬出。'},
      {name:'暗影壁垒', type:'shield', shieldPct:0.20, cooldown:3, desc:'为全队升起 20% 最大生命暗属性护盾。', fx:'暗属性护盾升起，骷髅符文浮现。'},
      {name:'冥府之门', type:'aoe', mult:1.0, summon:'skeleton', summonCount:2, cooldown:0, ult:true, desc:'开启冥府之门，召唤 2 具骷髅并波及全场。', fx:'巨型暗紫传送门打开，亡灵战士涌出。'},
    ],
    passive:{name:'亡者庇护', type:'guardian', val:0.15, desc:'有队友倒下时，自身获得 15% 最大生命的护盾。'} },

  { id:'L1', name:'艾琳·圣光', element:'light', element2:'water', rarity:'SSR', role:'治疗', pos:'back', art:'assets/characters/char-l1-light-priestess.png',
    intro:'光元素大祭司，能治疗和复活，性格圣洁。',
    hp:860, atk:74, def:54, spd:82, crt:14, ctd:140, res:70, em:72, int:78,
    skills:[
      {name:'圣光箭', type:'attack', mult:1.0, cooldown:0, desc:'光属性箭矢射出。', fx:'光属性箭矢射出，金白光芒拖尾。'},
      {name:'治愈之光', type:'heal', healPct:0.26, single:true, cooldown:2, desc:'为单体回复 26% 生命。', fx:'治疗光柱从天空降下，光点向上飘散。'},
      {name:'净化之光', type:'cleanse', healPct:0.08, cooldown:3, desc:'净化全队负面并微弱治疗。', fx:'净化之光扩散，黑暗粒子被驱散。'},
      {name:'神圣洗礼', type:'heal', healPct:0.36, revive:true, cleanse:true, cooldown:0, ult:true, desc:'全队治疗 36% + 净化 + 复活濒死队友。', fx:'全队神圣洗礼光柱降下，复活光环扩散。'},
    ],
    passive:{name:'圣愈', type:'selfRegen', val:0.03, desc:'每回合结束回复自身 3% 生命。'} },

  { id:'L2', name:'雷欧·裁决', element:'light', element2:'thunder', rarity:'SR', role:'输出', pos:'front', art:'assets/characters/char-l2-light-paladin.png',
    intro:'圣殿骑士，用圣光剑，性格正直。',
    hp:1180, atk:122, def:72, spd:70, crt:25, ctd:155, res:52, em:50, int:55,
    skills:[
      {name:'圣光斩', type:'attack', mult:1.3, cooldown:0, desc:'单次光属性剑斩。', fx:'单次光属性剑斩，金白剑光拖尾。'},
      {name:'光明制裁', type:'attack', mult:2.0, cooldown:2, desc:'高伤害单体圣光斩。', fx:'高伤害单体圣光斩，金白巨型剑光劈下。'},
      {name:'神圣之光', type:'aoe', mult:1.1, status:'blind', statusChance:0.6, statusTurns:2, cooldown:3, desc:'范围光伤害并致盲。', fx:'范围光伤害扩散，光粒飞散，净化黑暗。'},
      {name:'神圣裁决', type:'aoe', mult:1.6, status:'blind', statusChance:0.7, statusTurns:2, cooldown:0, ult:true, desc:'全屏神圣审判，致盲全场。', fx:'全屏神圣审判之光降临，光芒笼罩全场。'},
    ],
    passive:{name:'制裁', type:'sanction', val:0.2, desc:'对带有负面状态的敌人伤害 +20%。'} },
];

// ── 敌人波次（3 波，含 Boss）──
// enemy.intent: {archetype, targetRule, pattern, ...行为专属参数}
//   pattern 以技能下标描述基础轮转；game.js 可按冷却与阶段回退至普通攻击。
// skill.intent: {type, label, target, telegraph}
//   type 用于意图图标/颜色，target 与 telegraph 用于战前提示，不替代技能本身的结算字段。
const ENEMIES = [
  [ {name:'暗影狼',element:'dark',art:'assets/enemies/enemy-shadow-wolf.png',hp:540,atk:86,def:34,spd:68,res:24,em:20,int:10,
     intent:{archetype:'packHunter',targetRule:'front',pattern:[0],packBonus:{allyArchetype:'packHunter',damagePerAlly:0.15,maxStacks:2}},
     skills:[{name:'撕咬',type:'attack',mult:1.1,cooldown:0,intent:{type:'attack',label:'狼群撕咬',target:'front',telegraph:'锁定前排；每名存活狼同伴使伤害提高 15%'}}]},
    {name:'暗影狼',element:'dark',art:'assets/enemies/enemy-shadow-wolf.png',hp:540,atk:86,def:34,spd:64,res:24,em:20,int:10,
     intent:{archetype:'packHunter',targetRule:'front',pattern:[0],packBonus:{allyArchetype:'packHunter',damagePerAlly:0.15,maxStacks:2}},
     skills:[{name:'撕咬',type:'attack',mult:1.1,cooldown:0,intent:{type:'attack',label:'狼群撕咬',target:'front',telegraph:'锁定前排；每名存活狼同伴使伤害提高 15%'}}]},
    {name:'暗影蝠',element:'dark',art:'assets/enemies/enemy-shadow-bat.png',hp:420,atk:96,def:26,spd:84,res:22,em:20,int:10,
     intent:{archetype:'backlineRaider',targetRule:'back',pattern:[0,1,0]},
     skills:[{name:'暗影袭',type:'attack',mult:1.2,cooldown:0,intent:{type:'attack',label:'后排突袭',target:'back',telegraph:'越过前排，袭击后排目标'}},
             {name:'噬魂',type:'attack',mult:1.0,status:'curse',statusChance:1,statusTurns:2,cooldown:2,intent:{type:'debuff',label:'噬魂诅咒',target:'back',telegraph:'诅咒后排目标 2 回合'}}]} ],
  [ {name:'炎魔兵',element:'fire',art:'assets/enemies/enemy-flame-demon-soldier.png',hp:720,atk:108,def:46,spd:60,res:30,em:30,int:15,
     intent:{archetype:'burner',targetRule:'front',pattern:[0,1,0]},
     skills:[{name:'火焰斩',type:'attack',mult:1.2,cooldown:0,intent:{type:'attack',label:'火焰斩',target:'front',telegraph:'攻击前排单体'}},
             {name:'炽炎',type:'attack',mult:1.1,dot:'burn',dotTurns:2,cooldown:2,intent:{type:'debuff',label:'炽炎灼烧',target:'front',telegraph:'攻击前排并施加 2 回合灼烧'}}]},
    {name:'冰霜守卫',element:'water',art:'assets/enemies/enemy-frost-guardian.png',hp:820,atk:84,def:64,spd:50,res:40,em:30,int:15,
     intent:{archetype:'guardian',targetRule:'front',pattern:[0,2,1],guardPriorityHpPct:0.70},
     skills:[{name:'冰锤',type:'attack',mult:1.1,cooldown:0,intent:{type:'attack',label:'冰锤',target:'front',telegraph:'攻击前排单体'}},
             {name:'霜冻',type:'attack',mult:1.0,status:'slow',statusChance:1,statusTurns:2,cooldown:2,intent:{type:'debuff',label:'霜冻压制',target:'front',telegraph:'攻击前排并减速 2 回合'}},
             {name:'寒霜壁垒',type:'shield',shieldPct:0.20,guard:{redirectPct:0.50,turns:1},cooldown:3,intent:{type:'defend',label:'寒霜护卫',target:'allAllies',telegraph:'全体获得 20% 最大生命护盾；替同伴承受 50% 伤害 1 回合'}}]},
    {name:'风暴使者',element:'wind',art:'assets/enemies/enemy-storm-herald.png',hp:640,atk:120,def:38,spd:86,res:30,em:30,int:15,
     intent:{archetype:'hasteSupport',targetRule:'back',pattern:[2,0,1],speedBias:0.20},
     skills:[{name:'风刃',type:'attack',mult:1.3,cooldown:0,intent:{type:'attack',label:'高速风刃',target:'back',telegraph:'高速攻击后排目标'}},
             {name:'疾风',type:'attack',mult:1.1,status:'blind',statusChance:0.3,statusTurns:2,cooldown:2,intent:{type:'debuff',label:'疾风障目',target:'back',telegraph:'攻击后排，30% 几率致盲 2 回合'}},
             {name:'风暴号令',type:'buff',buff:{type:'spd',val:0.25,turns:2},team:true,cooldown:3,intent:{type:'buff',label:'风暴号令',target:'allAllies',telegraph:'全体敌人速度提高 25%，持续 2 回合'}}]} ],
  [ {name:'混沌元素',element:'dark',art:'assets/enemies/enemy-chaos-elemental.png',hp:1700,atk:142,def:68,spd:74,res:44,em:50,int:30,boss:true,
     intent:{archetype:'phaseBoss',targetRule:'front',pattern:[1,0,2,0],coreExposure:{interruptBonus:0.35,releaseBonus:0.20},
       phases:[
         {id:'凝聚',minHpPct:0.70,pattern:[1,0,2,0],telegraph:'开场预告风暴；打断或承伤后抓住核心暴露窗口'},
         {id:'裂变',minHpPct:0.35,pattern:[0,1,2],spdBonus:0.15,telegraph:'生命低于 70%，速度提高并开始蓄积混沌风暴'},
         {id:'崩解',minHpPct:0,pattern:[1,2,0,1],atkBonus:0.20,telegraph:'生命低于 35%，攻击提高并频繁蓄力'}
       ],
       charge:{skillIndex:1,turns:1,interruptible:true}},
     skills:[{name:'暗影冲击',type:'attack',mult:1.3,cooldown:0,intent:{type:'attack',label:'暗影冲击',target:'front',telegraph:'攻击前排单体'}},
             {name:'混沌风暴',type:'aoe',mult:1.7,status:'stun',statusChance:0.35,statusTurns:1,chargeTurns:1,interruptible:true,cooldown:3,intent:{type:'charge',label:'混沌风暴',target:'allEnemies',telegraph:'蓄力 1 回合后攻击全体；可用控制技能打断'}},
             {name:'腐蚀吐息',type:'attack',mult:1.1,dot:'corrupt',dotTurns:3,status:'curse',statusChance:1,statusTurns:2,cooldown:2,intent:{type:'debuff',label:'腐蚀吐息',target:'back',telegraph:'攻击后排，附加 3 回合腐蚀与 2 回合诅咒'}}]} ],
];

// ── 元素融合表（game-design-doc 3.5.2）──
// 双元素 15 种
const FUSION2 = {
  'fire+water':   {name:'蒸汽', emoji:'💨', desc:'爆炸性高温伤害 + 灼烧 + 减速', apply:(a)=>{ aoeEnemies(a,1.6); applyDotAll('burn',2,a); applyStatusAllEnemies('slow',2,1,a); }},
  'fire+wind':    {name:'烈焰风暴', emoji:'🔥', desc:'火借风势，范围燃烧地形（灼烧3回合）', apply:(a)=>{ aoeEnemies(a,1.5); applyDotAll('burn',3,a); }},
  'fire+thunder': {name:'雷火炼狱', emoji:'🌩', desc:'雷电交加，极高伤害 + 麻痹 + 灼烧', apply:(a)=>{ aoeEnemies(a,1.8); applyDotAll('burn',2,a); applyStatusAllEnemies('stun',1,0.3,a); }},
  'fire+dark':    {name:'暗火', emoji:'🩸', desc:'火焰带吸血，伤害的20%转化为自身生命', apply:(a)=>{ const d=aoeEnemies(a,1.2); healUnit(a,Math.floor(d*0.2)); }},
  'fire+light':   {name:'神圣之焰', emoji:'✨', desc:'净化负面 + 对暗系敌人额外伤害', apply:(a)=>{ cleanseTeam(99); aoeEnemies(a,1.4,(t)=>t.element==='dark'?1.5:1); }},
  'water+wind':   {name:'冰霜风暴', emoji:'❄', desc:'冻伤 + 减速，对水属性双倍伤害', apply:(a)=>{ aoeEnemies(a,1.2,(t)=>t.element==='water'?2:1); applyDotAll('frostbite',2,a); applyStatusAllEnemies('slow',2,1,a); }},
  'water+thunder':{name:'电磁洪流', emoji:'🌊', desc:'伤害连锁传导至相邻敌人', apply:(a)=>{ const d=aoeEnemies(a,1.3); // 导电潮汐灵方会再增加 1 次弹射
      const extra=state.enemies.filter(e=>e.alive),bounces=hasFormula('conductive_tide')?3:2; for(let i=0;i<Math.min(bounces,extra.length);i++){ dealRaw(a,extra[i],Math.floor(d*0.5)); } }},
  'water+dark':   {name:'冥水', emoji:'🌀', desc:'腐蚀水流，减速并削弱敌人攻击', apply:(a)=>{ aoeEnemies(a,1.2); applyStatusAllEnemies('slow',2,1,a); applyStatusAllEnemies('curse',2,1,a); }},
  'water+light':  {name:'治疗雨', emoji:'🌧', desc:'全队持续回复并驱散一个负面', apply:(a)=>{ healTeam(a,0.25); cleanseTeam(1); }},
  'wind+thunder': {name:'风暴雷霆', emoji:'🌪', desc:'大范围高伤 + 几率麻痹 + 全队暴击伤害 +30%', apply:(a)=>{ aoeEnemies(a,1.5); applyStatusAllEnemies('stun',1,0.2,a); buffTeam({type:'ctd',val:0.3,turns:2}); }},
  'wind+dark':    {name:'暗影之息', emoji:'🍃', desc:'风刃带毒，破防 + 增伤', apply:(a)=>{ aoeEnemies(a,1.3); applyStatusAllEnemies('defBreak',2,1,a); }},
  'wind+light':   {name:'天空祝福', emoji:'🌤', desc:'全队加速 + 25% 最大生命护盾 + 韧性', apply:(a)=>{ buffTeam({type:'spd',val:0.4,turns:2}); shieldTeam(a,0.25); buffTeam({type:'res',val:0.2,turns:2}); }},
  'thunder+dark': {name:'暗雷', emoji:'🌑', desc:'无视护盾，10%即死（Boss免疫）+ 吸血', apply:(a)=>{ const d=aoeEnemies(a,1.4,null,true); healUnit(a,Math.floor(d*0.15));
      state.enemies.forEach(e=>{ if(e.alive&&!e.boss&&random()<0.1){ applyDamageToUnit(e,e.curHp,a,{ignoreShield:true,noCounter:true}); spawnFloat(e,'即死','#e0493b'); } }); }},
  'thunder+light':{name:'神圣闪电', emoji:'⚡', desc:'净化敌人增益 + 雷系队友下次增伤', apply:(a)=>{ aoeEnemies(a,1.3); state.enemies.forEach(e=>e.buffs=[]);
      state.allies.forEach(al=>{ if(al.alive&&al.element==='thunder') addBuff(al,{type:'nextDamage',val:0.5,turns:2}); }); }},
  'dark+light':   {name:'混沌', emoji:'🔮', desc:'随机 50% 治疗 / 50% 伤害', apply:(a)=>{ if(random()<0.5){ healTeam(a,0.22); pushLog('🔮 混沌赐福：全队治疗'); } else { aoeEnemies(a,1.5); pushLog('🔮 混沌吞噬：全队伤害'); } }},
};
// 三元素 4 种
const FUSION3 = {
  'fire+water+wind':   {name:'龙卷风灾', emoji:'🌪', desc:'超大范围伤害 + 灼烧+冰冻+减速', apply:(a)=>{ aoeEnemies(a,2.2); applyDotAll('burn',2,a); applyStatusAllEnemies('freeze',1,1,a); applyStatusAllEnemies('slow',2,1,a); }},
  'dark+fire+thunder': {name:'毁灭降临', emoji:'💥', desc:'单体极高伤害，50%即死(Boss免疫)，自身损血10%', apply:(a)=>{ const t=state.enemies.filter(e=>e.alive).sort((x,y)=>y.curHp-x.curHp)[0];
      if(t){ let dmg=Math.floor(effAtk(a)*3.0*getAdvantage(a.element,t.element)); if(!t.boss&&random()<0.5){applyDamageToUnit(t,t.curHp,a,{ignoreShield:true,noCounter:true});spawnFloat(t,'即死','#e0493b');} else dealRaw(a,t,dmg); }
      const self=Math.floor(a.maxHp*0.1); a.curHp=Math.max(1,a.curHp-self); spawnFloat(a,'-'+self,'#e0493b'); }},
  'light+thunder+water':{name:'生命洪流', emoji:'🌟', desc:'全队满血复活 + 40% 最大生命护盾 + 清除负面', apply:(a)=>{ reviveTeam();
      healTeam(a,1.0); cleanseTeam(99); shieldTeam(a,0.40); }},
  'dark+light+wind':  {name:'虚空行者', emoji:'👁', desc:'全队隐匿2回合 + 下次必暴', apply:(a)=>{ state.allies.forEach(al=>{ if(al.alive){ addStatus(al,'invis',2); addStatus(al,'nextCrit',2); } }); pushLog('👁 虚空行者：全队隐匿'); }},
};

/* ═══════════════════════════════════════════════════════════════
   工具函数 & 状态管理
   ═══════════════════════════════════════════════════════════════ */
