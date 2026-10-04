/* 限定角色合击：数据在战斗引擎前加载，效果在 combos.js 中解析。 */
const COMBO_RULES = Object.freeze({actorEnergy:60,partnerEnergy:40,maxCasts:2,lockRounds:2,inventoryCap:99,starterCount:2});
const COMBO_STAGE_ART = Object.freeze({arena:'assets/combos/arena-concordance-v5.png',texture:'assets/combos/vfx-brush-atlas-v5.png',attack:'assets/combos/attack-material-atlas-v8.png'});
// Preserve the user's selected detailed artwork byte-for-byte. These are rig
// textures, not full-sheet UI planes; each cell is animated internally at runtime.
const COMBO_RIG_ART = Object.freeze(Object.fromEntries(['phoenix','leviathan','bastion','spring','eclipse','legion'].map(id=>[id,Object.freeze({
  src:['eclipse','legion'].includes(id)?`assets/combos/ultimate-${id}-sequence-v3.png`:`assets/combos/reference-${id}-v7.png`,
  columns:3,rows:2,matte:['phoenix','eclipse','legion'].includes(id)?'luminance':'alpha',
  combat:id==='phoenix'?Object.freeze({src:'assets/combos/phoenix-combat-facing-v9.png',columns:1,rows:1,matte:'luminance',variant:'phoenix-side'}):null,
  darkCores:id==='eclipse'?[[.49,.48,.12],[.495,.54,.245],[.48,.5,.185],null,[.55,.6,.17],null]:null,
})])));
const COMBO_ITEMS = Object.freeze({
  ember:{id:'ember',name:'灰烬触媒',symbol:'✺',color:'#ff9d5c',description:'用于炎羽天陨、熔日圣垒',cost:{ink:20,elementDust:3}},
  tide:{id:'tide',name:'潮汐棱晶',symbol:'◇',color:'#80e4ff',description:'用于雷海龙裁、星泉复苏',cost:{ink:20,elementDust:3}},
  soul:{id:'soul',name:'魂契封印',symbol:'☾',color:'#c5a0ff',description:'用于蚀月雷刃、冥风军势',cost:{ink:20,elementDust:3}},
});
const COMBO_RECIPES = [
  {id:'phoenix',name:'炎羽天陨',memberIds:['H1','A1'],itemId:'ember',theme:'phoenix',motion:'phoenix',symbol:'✺',color:'#ff9d5c',
    condition:'敌方有人灼烧，或己方有存活风鹰',
    setup:'艾拉先用烈焰穿刺点燃，或由琳召唤风鹰；随后保留两人的能量。',
    effect:'双人各造成 165% 攻击力的全体伤害，并施加 3 回合灼烧。',
    image:'assets/combos/combo-phoenix.png',art:'assets/combos/combo-phoenix.png'},
  {id:'leviathan',name:'雷海龙裁',memberIds:['W2','T1'],itemId:'tide',theme:'tide',motion:'tide',symbol:'ϟ',color:'#83d5ff',
    condition:'敌方至少一人处于减速',
    setup:'亚瑟先用潮汐锁链制造减速，再让亚瑟或扎克接续合击。',
    effect:'双人各造成 125% 攻击力的全体伤害，并有 70% 概率麻痹 1 回合；受抵抗与首领免控影响。',
    image:'assets/combos/combo-leviathan.png',art:'assets/combos/combo-leviathan.png'},
  {id:'bastion',name:'熔日圣垒',memberIds:['H2','L2'],itemId:'ember',theme:'bastion',motion:'bastion',symbol:'▱',color:'#ffd98c',
    condition:'洛恩或雷欧当前拥有护盾',
    setup:'洛恩的熔岩护盾可以启动连携；保留盾量，准备攻守合一的反击。',
    effect:'双人各造成 85% 攻击力的全体伤害；正式队员获得 30% 最大生命护盾，并净化所有负面。',
    image:'assets/combos/combo-bastion.png',art:'assets/combos/combo-bastion.png'},
  {id:'spring',name:'星泉复苏',memberIds:['W1','L1'],itemId:'tide',theme:'spring',motion:'spring',symbol:'✧',color:'#9af1d1',
    condition:'任意正式主战生命不高于 50%，或已有正式主战倒下',
    setup:'汐与艾琳都必须存活；将能量保留到队伍承压时，接住濒危回合。',
    effect:'存活正式队员回复 45% 最大生命；倒下的正式队员以 40% 生命复活，并净化全队负面。',
    image:'assets/combos/combo-spring.png',art:'assets/combos/combo-spring.png'},
  {id:'eclipse',name:'蚀月雷刃',memberIds:['D1','T2'],itemId:'soul',theme:'eclipse',motion:'eclipse',symbol:'☾',color:'#d4adff',
    condition:'敌方至少一人有负面状态或正在蓄力',
    setup:'用奈娜的静电场铺设负面，或等待高危蓄力；优先斩击正在蓄力的敌人。',
    effect:'双人各造成 300% 攻击力的单体伤害并无视护盾，随后尝试施加 2 回合破防；优先蓄力目标，其次生命比例最低者。',
    image:'assets/combos/combo-eclipse.png',art:'assets/combos/combo-eclipse.png'},
  {id:'legion',name:'冥风军势',memberIds:['D2','A2'],itemId:'soul',theme:'legion',motion:'legion',symbol:'♜',color:'#a8e5c0',
    condition:'己方至少有一个存活召唤物',
    setup:'卡尔先召唤骷髅战士，再与赛巴斯建立军势；召唤物存活越久，收益越高。',
    effect:'双人各造成 110% 攻击力的全体伤害；空位补充 1 个骷髅，所有存活召唤物攻击 +35% 持续 3 回合、寿命 +2 回合。',
    image:'assets/combos/combo-legion.png',art:'assets/combos/combo-legion.png'},
];
// Each generated sheet contains six distinct ultimate stages in a 3 × 2 grid.
COMBO_RECIPES.forEach(recipe=>{
  recipe.sequence=Object.freeze({src:`assets/combos/ultimate-${recipe.id}-sequence-v3.png`,columns:3,rows:2});
  recipe.rig=COMBO_RIG_ART[recipe.id];
  recipe.video=`assets/combos/videos/ultimate-${recipe.id}-v9.webm`;
});

// Art-directed, per-pose weapon/palm sockets, normalized inside each square cell.
// Rows follow character IDs, not the order of the current battle's leader/partner.
const COMBO_CASTING_MEMBERS={
  phoenix:[
    {id:'H1',action:'举弓、拉弦、放箭、收弓',anchors:[[.755,.195],[.765,.368],[.805,.392],[.592,.604]]},
    {id:'A1',action:'弓步、引风、放箭、回收',anchors:[[.750,.414],[.716,.267],[.783,.290],[.587,.533]]},
  ],
  leviathan:[
    {id:'W2',action:'回提三叉戟、瞄准、突刺、回防',anchors:[[.370,.325],[.762,.370],[.904,.430],[.375,.367]]},
    {id:'T1',action:'沉肩、举剑、下劈、收刃',anchors:[[.230,.410],[.793,.463],[.923,.756],[.790,.778]]},
  ],
  bastion:[
    {id:'H2',action:'横剑守势、举刃蓄火、展掌释焰、回防',anchors:[[.900,.638],[.842,.144],[.796,.368],[.788,.187]]},
    {id:'L2',action:'持剑、举掌聚光、推掌结盾、收势',anchors:[[.789,.274],[.669,.130],[.785,.186],[.698,.321]]},
  ],
  spring:[
    {id:'W1',action:'持杖、引泉、展掌祝福、收杖',anchors:[[.225,.462],[.673,.295],[.791,.377],[.642,.510]]},
    {id:'L1',action:'祈祷、聚光、舒臂赐福、回收',anchors:[[.300,.078],[.646,.130],[.823,.107],[.229,.136]]},
  ],
  eclipse:[
    {id:'D1',action:'低伏、交叉双刃、突进斩、回旋警戒',anchors:[[.915,.742],[.443,.392],[.940,.374],[.828,.485]]},
    {id:'T2',action:'横杖、抬杖聚雷、前刺释放、收杖',anchors:[[.122,.400],[.714,.085],[.931,.233],[.310,.067]]},
  ],
  legion:[
    {id:'D2',action:'持杖、抬掌唤魂、展臂开门、收掌',anchors:[[.699,.169],[.779,.291],[.791,.262],[.326,.156]]},
    {id:'A2',action:'立杖、聚风、推掌号令、归位',anchors:[[.271,.105],[.195,.100],[.812,.240],[.330,.105]]},
  ],
};
COMBO_RECIPES.forEach(recipe=>{
  if(COMBO_CASTING_MEMBERS[recipe.id])recipe.casting=Object.freeze({
    src:`assets/combos/cast-${recipe.id}-actions-v4.png`,columns:4,rows:2,
    // Median of each final sheet's empty cell corners, sampled without altering its pixels.
    background:{phoenix:'#05101b',leviathan:'#050e19',bastion:'#060f1b',spring:'#050e18',eclipse:'#060f1b',legion:'#020f1c'}[recipe.id],
    members:COMBO_CASTING_MEMBERS[recipe.id],
  });
});
