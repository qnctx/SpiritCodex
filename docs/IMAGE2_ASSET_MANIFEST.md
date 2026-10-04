# Image 2 美术资产清单

> 生成日期：2026-09-04
> 统一方向：秘仪炼金·灵素绘卷（暗靛黑、旧黄铜、象牙白、六元素局部发光）
> 风格锚点：`playable/assets/references/ref-ui-style-anchor.png`

## v4.8 目标朝向与环境联动 v9（当前，2026-09-05）

新增 `playable/assets/combos/phoenix-combat-facing-v9.png`，SHA256 为 `f9de66b3b665b047bc187f5e47ff604c5ff0a6110191a9ef8a40c7793183a21a`。内置imagegen先生成侧身凤凰，初稿出现烘焙棋盘格，再定向修正为纯黑底；最终源PNG原样保留，运行时matte净底并接入真实网格。旧六主体原图、v8攻击材质及人物动作保留，必需图片由48变49。

六主题环境由共享Canvas模块绘制天空、天气及地面，在演练和真实战场同步，不给UI染色；完整实战返回保留900ms温和尾韵，跳过/退出/换波清除。仍为2.5D而非真3D，未同步Unity。完整提示词、来源和免费试玩见 [目标朝向与环境联动](COMBO_FACING_ENVIRONMENT_V9.md)。本轮172浏览器专项及5纯函数专项通过，六段v9实录播放6/6通过，具体过程见该文档验证记录。

## v4.7 留场召唤与独立攻击材质（历史，2026-09-05）

六张精细主体原图保留，新增内置imagegen生成的 `playable/assets/combos/attack-material-atlas-v8.png`（1536×1024，3列2行，RGBA）。六格只含火羽、水雷吐息、太阳光矛、花瓣水流、月牙刃波、魂矛，不含凤凰、龙或建筑主体。已接入预览与真实战斗预载，必需图片由47变48。

运行时裁单格，软遮罩与screen合成消除矩形雾边；小弹头沿实际路径运动，吐息另以28段曲线网格持续形变。召唤物第1格留场张颌/振翼/挥刃，仅独立攻击飞向目标。源文件不离线改写，属于2.5D而非真实3D。最终提示词、SHA256与试玩见 [留场召唤与独立出招](COMBO_CHOREOGRAPHY_V8.md)。原始生成输出保留于 `C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-bcb69e72-25fd-46bb-ad65-6c46ea4cfb5c.png`。

## v4.6 精细原画动态（历史，2026-09-05）

直接使用用户提供的四张精细六阶段图，无修改复制为 `reference-{phoenix,leviathan,bastion,spring}-v7.png`；另重新启用同系 `ultimate-{eclipse,legion}-sequence-v3.png`。全部1536×1024、3列2行，必需图片由41变47。原图按单格进入实时三角网格，图内各部分独立运动，未作为整幅背景板显示。没有新图像生成提示词，也未离线改写源PNG。

凤凰/军势RGB与蚀月原画的方形暗底在运行时净底，RGBA透明边缘保留，暗月内圆恢复原图暗纹。详细原件路径、字节数、SHA256、绑定方式和验收见 [COMBO_PAINTED_RIG_V7.md](COMBO_PAINTED_RIG_V7.md)。人物48幅动作与v5战场图继续使用；旧素材未删除，未同步Unity。

## v4.4 统一战场与实时材质（历史，2026-09-05）

imagegen内置工具新生成并接入 `arena-concordance-v5.png`（1672×941，空战场底图）与 `vfx-brush-atlas-v5.png`（1774×887，4列2行8种微粒纹理）。两张约2.53MB；全六种合击移除巨型技能序列平面、局部命中位图和目标头像卡，改用实时Canvas材质与完整人物。旧6张sequence/1张impact不再预载；必需清单从46改为41，旧文件保留未删除。

源PNG均RGB无alpha：人物在游戏运行时用SVG窄色键合成保留黑甲，灰度小笔刷在运行时转alpha以免黑块；不读取或改写图像像素文件，支持file协议。新增底图是环境，不是技能主体；笔刷仅作为微小局部粒子。完整提示词、原始生成路径、当前v5实录和验收见 [COMBO_STAGE_V5.md](COMBO_STAGE_V5.md)。未同步Unity。

## v4.3 六套人物动作追加（历史，2026-09-05）

新增 `playable/assets/combos/cast-{phoenix,leviathan,bastion,spring,eclipse,legion}-actions-v4.png`，每图1774×887、4列2行，12名原有角色各4种实际出招姿态，共48幅。六张约11.27MB，必需玩法图片由40增加至46；原角色立绘、技能序列及命中图集不替换。逐角色/逐姿态的武器与掌心坐标配置于 `COMBO_CASTING_MEMBERS`，合击预览与真实施放共同加载。

图像工具初轮透明请求得到烘焙棋盘，未入库；改为RGB暗底（无alpha），三套再做格内安全范围修订，星泉修复多余手臂。舞台颜色采用各张实际空白角落RGB中位数，CSS边缘柔化，人物正常合成；不使用加色抹掉深色盔甲。完整提示词、参考角色、最终原始文件与游戏测试见 [COMBO_ACTIONS_V4.md](COMBO_ACTIONS_V4.md)。新版实录采用 `ultimate-{id}-v4.webm`；旧v3录像保留为历史。未同步Unity。

## v4.2 六套绝招序列追加（历史，2026-09-05）

先使用内置图像生成工具分别制作六套六阶段序列，再接入8.4秒实时游戏演出；不是仅放大原海报。各图1536×1024、3列2行、共36幅阶段画面，黑底加色合成（非透明）。水龙、圣垒、星泉、军势的初稿环境背景另用同一工具调整为黑底。六张图约14.38 MB；必需玩法图片从34张增至40张，参考图不计入该清单。

| 文件（`playable/assets/combos/`） | 主题与阶段 |
| --- | --- |
| `ultimate-phoenix-sequence-v3.png` | 凤凰聚能、展翼、俯冲、翼焰爆发、羽焰涡、余羽 |
| `ultimate-leviathan-sequence-v3.png` | 水核、雷水巨龙、突进、电水命中、龙浪环、潮光 |
| `ultimate-bastion-sequence-v3.png` | 熔日核心、圣垒、盾击、金盾碎光、保护领域、残辉 |
| `ultimate-spring-sequence-v3.png` | 星莲种、莲与生命树、生命上升、复苏花开、藤叶领域、星泉 |
| `ultimate-eclipse-sequence-v3.png` | 暗月核、蚀月双刃、交叉斩、裂月、月刃领域、余弧 |
| `ultimate-legion-sequence-v3.png` | 魂核、巨型魂门、魂军突进、魂枪命中、军势强化、魂影 |

六段 `assets/combos/videos/ultimate-{id}-v3.webm` 是实际游戏录屏（1280×720、25fps、8.4秒、无音轨），不是视频生成模型输出，也不参与真实战斗结算。原始完整提示词、来源文件、图片和视频链接见 [COMBO_EPIC_V3.md](COMBO_EPIC_V3.md)。本次未同步Unity。下方保留旧版本资产记录。

## v4.0–v4.1 契约合击追加（历史，2026-09-05）

v4.1追加：准备页参考 `assets/references/ref-preparation-v2.png`、命中分镜 `assets/references/ref-combo-impact-storyboard.png`、实际六主题命中图集 `assets/combos/combo-impact-atlas-v2.png`。均先生成后实施；图集1536×1024、3列2行、黑底加色合成（非透明）。原始提示词和使用约束见 [重设计记录](PREPARATION_IMPACT_REDESIGN.md)。该版本必需玩法图片为34张；新增参考图不计入运行必需清单。

六张独立 1536 × 1024 PNG 由本次内置图像生成工具生成，原图直接接入网页版编队配方及施放演出，未覆盖旧角色或场景资产。它们是位图插画，差异化动态由游戏 CSS / JavaScript 实现，不是生成视频。本次新增未同步 Unity。

| 文件（`playable/assets/combos/`） | 大招主题 |
| --- | --- |
| `combo-phoenix.png` | 火与风凝成焰羽凤凰 |
| `combo-leviathan.png` | 水龙与雷暴交织 |
| `combo-bastion.png` | 熔火与圣光守护壁垒 |
| `combo-spring.png` | 水晶莲与治愈星泉 |
| `combo-eclipse.png` | 日蚀下的暗雷双刃 |
| `combo-legion.png` | 冥风魂门与骷髅军阵 |

完整提示词与文件来源见 [COMBO_ART_PROMPTS.md](COMBO_ART_PROMPTS.md)，配方规则与验收见 [COMBO_ULTIMATES.md](COMBO_ULTIMATES.md)。下方为原有资产记录。

## 生成方式

- 场景、角色、敌人、召唤物、队友、徽记和纹理由 OpenAI Image 2 分别生成，均为 **generation mode**。
- 每个后续资产都把标题星象厅作为风格参考，提示词共同要求：`dark Chinese-inspired alchemical fantasy RPG, antique brass astrolabe geometry, indigo-black lacquer, painterly premium game art, no text, no letters, no watermark`。
- 独立立绘/徽记在提示词中额外要求：`single centered full-body/cutout, entire silhouette visible, generous margin, uniform #00FF00 or #FF00FF chroma background`；最终使用柔边、去溢色色键流程输出 RGBA PNG。
- 曾用 **image-edit mode** 尝试把败北徽记改为全透明背景；该结果出现棋盘格烘焙，因此未进入游戏。最终 `ui-defeat-crest.png` 使用原始 generation 输出，并作为暗色卡片背景而不是透明小图。

## 场景背景（generation）

| 最终路径 | 提示词主体 |
|---|---|
| `playable/assets/backgrounds/bg-title-codex-hall.png` | 无文字标题界面：黑曜炼金观测厅、中央黄铜星盘、六元素徽记、电影式留白 |
| `playable/assets/backgrounds/bg-town-alchemy-haven.png` | 炼金城镇中庭：石阶、工坊灯火、星盘建筑、可承载菜单的暗部留白 |
| `playable/assets/backgrounds/bg-roster-archive.png` | 角色档案馆：高耸书架、黄铜索引环、紫蓝环境光、卡片阅读区 |
| `playable/assets/backgrounds/bg-formation-war-table.png` | 布阵战桌：俯视六槽星盘、黄铜战术线、深靛作战厅 |
| `playable/assets/backgrounds/bg-battle-wave-01-shadow-ruins.png` | 第一波暗影遗迹：月光、断裂星盘、雾、前后排战斗净空 |
| `playable/assets/backgrounds/bg-battle-wave-02-elemental-foundry.png` | 第二波元素熔炉：熔岩炉心、冰晶机械、风雷管线、战斗净空 |
| `playable/assets/backgrounds/bg-battle-wave-03-chaos-sanctum.png` | 第三波混沌圣所：破碎日蚀星盘、六元素裂隙、Boss 战净空 |

Unity 镜像位于 `LingsuMVP/Assets/Resources/Art/Generated/Backgrounds/`，文件名使用下划线。

## 正式角色（generation）

共同提示词结构：`single full-body [角色身份/武器/姿态], element-specific materials and glow, crisp battle silhouette, painterly dark alchemical fantasy, matching style anchor, chroma background, no text`。

| 最终路径 | 角色提示词主体 |
|---|---|
| `playable/assets/characters/char-h1-fire-ranger.png` | 艾拉·炎棘：冷静火焰弓手、燃烧长弓、红黑轻甲 |
| `playable/assets/characters/char-h2-fire-guardian.png` | 洛恩·炉火：炼金护卫、火焰大剑、熔炉重甲 |
| `playable/assets/characters/char-w1-water-healer.png` | 汐·深澜：水与冰治疗师、水晶法杖、潮汐礼服 |
| `playable/assets/characters/char-w2-tide-warden.png` | 亚瑟·潮汐：三叉戟潮汐守卫、深海重甲 |
| `playable/assets/characters/char-a1-wind-ranger.png` | 琳·风羽：风系游侠、轻弓、羽饰与风纹 |
| `playable/assets/characters/char-a2-wind-alchemist.png` | 赛巴斯：年长风炼金师、黄铜法器、层叠长袍 |
| `playable/assets/characters/char-t1-thunder-warrior.png` | 扎克·雷鸣：雷电战士、巨刃、紫电重甲 |
| `playable/assets/characters/char-t2-thunder-mage.png` | 奈娜·闪电：年轻雷法师、电弧法杖、冷静姿态 |
| `playable/assets/characters/char-d1-shadow-assassin.png` | 薇洛·暗舞：高速暗影刺客、双匕首、紫黑烟影 |
| `playable/assets/characters/char-d2-necromancer.png` | 卡尔·冥府：亡灵术士、魂灯法杖、暗色仪式袍 |
| `playable/assets/characters/char-l1-light-priestess.png` | 艾琳·圣光：光系大祭司、日轮法杖、象牙金礼服 |
| `playable/assets/characters/char-l2-light-paladin.png` | 雷欧·裁决：圣殿骑士、光剑与盾、金白重甲 |

Unity 镜像位于 `LingsuMVP/Assets/Resources/Art/Generated/Characters/`。

## 敌人、召唤物与 Unity 队友（generation）

| 最终路径 | 提示词主体 |
|---|---|
| `playable/assets/enemies/enemy-shadow-wolf.png` | 暗影狼：黑曜毛皮、紫色魂焰、黄铜项圈 |
| `playable/assets/enemies/enemy-shadow-bat.png` | 暗影蝠：破损翼膜、紫色眼光、炼金束环 |
| `playable/assets/enemies/enemy-flame-demon-soldier.png` | 炎魔兵：熔岩盔甲、火焰军刀、炉心胸甲 |
| `playable/assets/enemies/enemy-frost-guardian.png` | 冰霜守卫：冰晶重甲、巨锤、雪花炉心 |
| `playable/assets/enemies/enemy-storm-herald.png` | 风暴使者：面具祭司、风雷星环法杖、青黑长袍 |
| `playable/assets/enemies/enemy-chaos-elemental.png` | 混沌元素：六元素核心、黑曜装甲、破裂黄铜炉心 |
| `playable/assets/summons/summon-wind-eagle.png` | 风鹰：玉色羽毛、黄铜护饰、展翼战斗姿态 |
| `playable/assets/summons/summon-skeleton-warrior.png` | 骷髅战士：黑曜札甲、圆盾短剑、紫色魂火 |
| `playable/assets/allies/ally-wood-mage.png` | 木系法师：苔玉长袍、种子法杖、藤叶黄铜纹 |
| `playable/assets/allies/ally-iron-guard.png` | 铁卫：玄铁重甲、塔盾、重锤 |
| `playable/assets/allies/ally-alchemy-apprentice.png` | 炼金学徒：炭黑旅行装、酒红围巾、药瓶与转化手甲 |

Unity 另保留 `monster_01/02/03`、`boss_ember` 和三名队友的兼容文件名，供现有运行时代码直接加载。

## UI 资产（generation）

| 最终路径 | 提示词主体 |
|---|---|
| `playable/assets/ui/ui-sixfold-emblem.png` | 六元素对称黄铜星盘主徽记 |
| `playable/assets/ui/ui-victory-crest.png` | 月桂、复原六元素印、红色缎带的胜利徽记 |
| `playable/assets/ui/ui-defeat-crest.png` | 破裂黑曜星盘、熄灭炉心、残旗的败北画面 |
| `playable/assets/ui/ui-panel-grain.png` | 可平铺低对比靛黑漆/手工纸/星盘刻线面板纹理 |
| `playable/assets/ui/town-map-seal.png` | 剑、圆规和打开图谱组成的远征入口徽记 |
| `playable/assets/ui/town-roster-seal.png` | 兜帽角色侧影与档案圆章 |
| `playable/assets/ui/town-recruit-seal.png` | 三张无字星象卡牌与红色宝石 |
| `playable/assets/ui/town-forge-seal.png` | 锤、短刃与发光坩埚 |
| `playable/assets/ui/town-apothecary-seal.png` | 琥珀药瓶、研钵与黄铜月环 |
| `playable/assets/ui/town-evolution-seal.png` | 紫晶高塔与三重星盘轨道 |

## 验收要点

1. 角色/敌人/召唤物在黑底和浅底均无明显色键边缘，透明区域不拦截 UI 点击。
2. 桌面 1366×768 与移动 390×844 下，背景允许裁切，但按钮、中文、血条和目标命中区不得被图像遮挡。
3. Web 图片加载失败时回退元素符号；Unity 资源缺失时由 `ArtCatalog` 返回既有占位图，不阻断流程。
4. Web 不在首页解码全部大图；角色图由浏览器按界面加载，战斗图按当前波次惰性缓存。
