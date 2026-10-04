# 留场召唤与独立出招 v8（网页版 v4.7）

日期：2026-09-05。本轮修正召唤物的动作逻辑：凤凰、青龙等精细原画主体留在召唤区域完成蓄力、发招和收势，只有火雨、吐息、光矛、花瓣流、刃波或魂矛前往目标，不再把整张召唤物原画当作弹头撞向敌人。

仅修改 HTML5 演出与验证入口，未同步 Unity。这里的“召唤物”指合击演出主体，不新增一名参与回合的战斗单位，不改变配方、库存、能量、伤害、治疗或召唤机制。

## 六套独立动作

| 合击 | 留场主体与发招动作 | 实际前往目标的效果 |
| --- | --- | --- |
| 炎羽天陨 | 凤凰胸部稳定，双翼先下压再抬起；翼尖能量引向目标上空，形成火云 | 从上空落下的燃烧羽焰与连续火雨，不是凤凰本体俯冲 |
| 雷海龙裁 | 青龙保留 S 形躯干，头颈先后仰蓄力再前探，下颌相对张开 | 从真实嘴部位置喷出的水雷吐息；锥形体积、螺旋水流与雷纹沿同一路径推进 |
| 熔日圣垒 | 圣垒核心留场，盾冠与局部板块蓄能 | 向敌方发射太阳光矛；友方护盾独立走受益目标通路 |
| 星泉复苏 | 生命树留在莲座上，枝冠摇曳、莲瓣展开 | 花瓣与生命流进入需要治疗或复苏的队友，不向敌人发送伤害弹 |
| 蚀月雷刃 | 暗月稳定，左右原画弯刃分别蓄势、相向挥击 | 两道独立弧形刃波交叉切向合法单体目标，不把月球推过去 |
| 冥风军势 | 魂门两扇打开，门柱、拱顶和军阵继续分区运动 | 军阵发射分列魂矛；新增或强化召唤物的效果单独进入受益者 |

后续火雨、光矛或魂矛分段属于同一次已结算合击的视觉表现，不追加隐藏伤害或额外扣费。实际战斗显示本次真实前后快照；免费演练使用明确标注的演示数值。

## 原图与实现边界

- 沿用 v7 的四张用户原件及原有蚀月、军势原画，**六张主体源 PNG 未重写或重新生成**。本轮另新增一张独立攻击材质图集，必需图片由47变为 **48 张**。六主体文件来源和 SHA256 沿用 [v7 原图与来源](COMBO_PAINTED_RIG_V7.md#原图与来源)。历史图片与视频保留。
- 召唤主体持续使用原图第 1 格（3×2 图集的上排中格，索引从 0 开始）。网格中的翼、颈、颌、盾冠、莲瓣、双刃和门扇真实相对运动；不在释放时切换为整图飞行弹头。第0格只用于早期聚能；第2–5格在当前演出停用，命中与收尾使用独立攻击材质和粒子，避免整只龙、整座城垒重复出现在敌人身上。
- 保留运行时净底缓存、暗月原纹保护、逐三角原画采样、人物 48 姿态和中文 HUD 裁剪。没有逐帧重新生成原图，也不把整张图集铺在舞台上。
- 这是 **Canvas 2.5D 表现，不是真实 3D 模型或三维骨骼**：使用原画网格变形、前后层次、局部明暗、透视吐息和粒子模拟体积。它不能提供任意角度观看的三维角色。

### 新增攻击材质图集

`playable/assets/combos/attack-material-atlas-v8.png` 为本轮通过内置 imagegen 工具生成的3列×2行攻击材质图集，不包含重画后的凤凰、青龙等主体。六格依次为火羽、水雷吐息、太阳光矛、花瓣水流、月牙刃波、魂矛。

运行时裁取对应单格，沿各自攻击路径分段变形，并叠加独立粒子和局部受光。这些图像是召唤物发出的攻击材料，不把原画角色重新当作飞行贴图。六主体仍直接使用用户选定或项目已有的原件。

图像生成使用内置 imagegen（非CLI/API）；已将最终输出复制到项目，原始生成文件仍保留。1536×1024，RGBA，SHA256：`c605d040b6dbaad72dc443117a79f3cf4c1b08866402826a91e68d0015ca0db0`。生成图带少量彩色雾边，运行时单格使用圆形软遮罩与screen合成，不修改PNG像素。火羽等小弹头随真实弹道旋转、缩放；吐息额外分成28段沿曲线变形，波动不同步，嘴部出口保持对齐。

最终提示词：

```text
Use case: stylized-concept. Asset type: one production game VFX texture atlas, 1536x1024 landscape, exactly 3 equal columns and 2 equal rows, each cell square. Generate six isolated emitted ATTACK MATERIALS for a high-detail dark fantasy RPG, NOT summon creatures, NOT icons, NOT UI. Pure black uniform background for luminous runtime compositing, no text, no labels, no borders or grid lines, no creatures, no dragons, no birds, no castles, no trees. Every effect fully contained in its cell with at least 12% black safe padding. The six effects in reading order: top-left a blazing gold-orange fire-feather meteor, intense white-hot pointed tip facing RIGHT at 80% width and 50% height, streaming turbulent flame tails toward LEFT, richly layered incandescent wisps and green-gold tiny sparks, not a solid brown feather. Top-middle a dense cyan-blue turbulent WATER-LIGHTNING breath plume flowing LEFT to RIGHT, tiny narrow nozzle at 15% width, expanding frothy refractive conical stream ending near 85% width, bright violet branching lightning interwoven, translucent mist and volumetric highlights, absolutely no dragon head. Top-right a radiant solar-gold lance projectile, sharp pointed tip RIGHT, luminous faceted golden spear energy with trailing ember light to left, no castle. Bottom-left an elegant jade-aqua healing petal stream, white luminous lotus petals carried in curling crystalline water flowing LEFT to RIGHT, no whole flower or tree. Bottom-middle one luminous violet crescent slash of razor energy opening LEFT and curved cutting edge facing RIGHT, fine electric tendrils and broken tiny purple shards. Bottom-right a spectral emerald soul-spear projectile facing RIGHT with narrow luminous lance head and smoky teal spirit trail to LEFT, no soldier or gate. Premium painterly VFX with physically shaded fluid/fire volume and crisp fine filaments, brilliant saturated emission, black negative space, consistent scale, no motion-blur smears covering the whole cell. This is a texture sheet to be animated along actual weapon-to-target trajectories in a game, not a storyboard or composed battle image.
```

## 共享动作与真实发射位置

`playable/spirit-codex-combo-choreography.js` 是留场主体、攻击轨迹和镜头取景的共享动作描述。`ComboChoreography.sample(geometry, motion, time)` 返回主体盒子、动作进度、真实器官锚点和各目标的攻击路径；`point(attack, progress)` 为同一条路径求位置。

`ComboArtRig.getAnchor(options, u, v)` 不是静态屏幕坐标，也不是只对原图矩形做缩放。它使用与 `getMesh()`、`draw()` 相同的顶点和交替对角线，在实际三角形内做重心插值，得到嘴部、翼尖、核心、刃缘或门区的当前位置。输出位于舞台的目标坐标系；外层 Canvas 变换由调用方统一处理。

原图绑定保持 `phase: 'manifest'`；新增 `action: 0..1` 控制待机、蓄势、发力和余势。舞台可以连续驱动它，不需要移动整个主体来伪装攻击。人物武器/掌心 → 融合与召唤区域 → 原画真实器官 → 独立攻击 → 合法目标共用几何数据；火雨另有“翼尖 → 上空火云 → 地面目标”两段明确来源。治疗、护盾和召唤强化仍按受益目标分路。

## 时序、镜头与结算不变

- 完整演出仍为 **8.4 秒**：聚能、成型、释放、命中、余波、结果。视觉首命中仍是 **4.7 秒**，后续目标仍错开 **110ms**。主体留场并不会延迟或新增一次伤害计算。
- 真实扣费及数值在确认施放时只结算一次；动画消费只读快照。自然结束或主动跳过均只续战一次，退出或重开会取消旧回调。
- 默认尊重系统“减少动态”，使用约 **1.8 秒**静态结果；玩家仍可在免费演练主动选择“完整演出”。选择仅保存在本页内存，不写存档或系统设置。
- 手机先展示双人聚能与召唤物发力，发招开始时保留嘴部/翼尖在画面内，再跟随真实吐息或火雨等效果进入目标，最后展示 HP、护盾及状态。不会在刚张口或振翼时立刻切走。免费演练手动滚动停止跟随，重播恢复；底部控制和中文保持可用。

## 免费试玩步骤

1. 用 `Ctrl + F5` 刷新 `playable/spirit-codex.html`，进入 **城镇 → 编队 → 合击图鉴 → 预览绝招 · 免费 → 完整演出**。无需开战，无需配齐角色，也无需准备合击道具。
2. 先看 **炎羽天陨**：凤凰留在召唤区域振翼，能量从翼尖升到目标上方，火雨再落下。不能出现整只凤凰撞向守卫。等待 4.7 秒后的演示 HP 变化与第 7 秒余波。
3. 再看 **雷海龙裁**：留意青龙颈部蓄势、张口和从嘴里连续伸出的水雷吐息；龙体不随吐息一起飞走。
4. 对照上表预览其余四招，确认光矛、花瓣流、双刃波和魂矛各有不同出招方式。星泉展示治疗/复苏，圣垒同时区分敌方打击和友方护盾。
5. 在手机观察出招器官到命中的镜头；试手动滚动、重播、查看结果、减少动态、关闭或 Esc。原画细节、中文、HP/盾量和按钮不得被黑底、特效或页脚遮挡。
6. 回到补给工坊确认库存没变，再检查阵容和角色能量。免费演练不消耗道具、能量或每局次数，不写玩家存档，也不推进游戏随机流。真实战斗验收沿用 [合击配方与消费步骤](COMBO_ULTIMATES.md#再检查真实战斗)。

## 验证与录像

### 已完成的纯函数辅助检查

- 19,800 组主题、网格密度、时间、组装程度和 `action` 组合，三角网格无反折或退化。
- 18,672 个实际网格三角质心及顶点锚点一致，最大坐标误差约 `1.71e-13`。
- 缺省动作与 `action: 0` 严格兼容；UV 越界参数按边缘夹取；禁用 `Math.random` 后仍可执行。
- 此类纯 Node 检查不等同浏览器画面、帧率或完整游戏回归，不计入最终浏览器案例数。

### 浏览器验收与实录

最终冻结版 **156项不同定向案例全部通过**：原画/动作/48资源60项（2.7分钟）＋新增出招专项12项（38.7秒）＋规则/布阵84项（1.8分钟）。覆盖四视口，不重复累计专项复测，不表示重跑整个项目全部历史案例。新增专项按实际Canvas纹理三角独立投影器官UV，再核对真实攻击轨迹，不只读取调试坐标。旧成型相对动作检查发现月刃摆动被发力抑制过多，已恢复独立错相摆刃；原画羽丝的暗纹来源增加512原生缓存复核，零不明暗点和边界黑方限制不放宽。莲心出口保持稳定，莲瓣/树冠承担出招动作，内部运动验收采样对应可见局部，不强迫稳定莲心摇动。

本地 `file://` 完整验收：桌面1366×768与360×640分别预览全部六招的11个时点（含3.35秒出手、3.9/4.4秒飞行、5.3秒命中），均无页面错误、无页面横向溢出。主代理逐组复看发招/命中静帧；手机先展示召唤物出手，再随独立攻击转向目标。两视口另实际施放凤凰，敌方生命从10000变为9590/9590/9569，道具消耗一件，测试使用独立上下文未触碰玩家存档。六段v8实录另完成播放6/6验证：8.4秒、1280×720、正常解码和时间推进，零媒体/页面错误；录制核验六阶段和尾帧。不沿用v7通过数，不把纯函数或视频验证并入上述156项。

浏览器验证、静帧和录像串行执行，使用独立临时上下文，不操作玩家个人存档。复现入口：

```text
node tests/playable/server.js
npx playwright test tests/playable/spirit-codex-combo-choreography.spec.js --workers=2
npx playwright test tests/playable/spirit-codex-combo-actions.spec.js tests/playable/spirit-codex-combo-motion.spec.js --workers=2
npx playwright test tests/playable/spirit-codex-combos.spec.js tests/playable/spirit-codex-preparation.spec.js --workers=2
node tests/playable/ultimate-video-capture.cjs
node tests/playable/ultimate-video-playback-check.cjs
```

录像脚本已输出六段 `playable/assets/combos/videos/ultimate-{id}-v8.webm`，共9,386,625字节（约9.39MB）。8.4秒、1280×720、25fps编码、无声的真实游戏录屏，不是外部AI视频，也不代替实时游戏演出，不表示任何设备都能以25fps运行。临时录制前缀为 `spirit-codex-ultimate-v8-record-`，录像静帧目录为系统临时目录中的 `spirit-codex-ultimate-video-v8-qa`。

全部导出、实际看图与播放检查完成后，已将游戏的 `recipe.video` 更新至v8。未覆盖历史v7视频。

| 合击 | 当前实录 |
| --- | --- |
| 炎羽天陨 | [凤凰振翼 → 天降火雨](../playable/assets/combos/videos/ultimate-phoenix-v8.webm) |
| 雷海龙裁 | [青龙张口 → 水雷吐息](../playable/assets/combos/videos/ultimate-leviathan-v8.webm) |
| 熔日圣垒 | [核心光矛与友方护盾](../playable/assets/combos/videos/ultimate-bastion-v8.webm) |
| 星泉复苏 | [莲心分流治疗与复苏](../playable/assets/combos/videos/ultimate-spring-v8.webm) |
| 蚀月雷刃 | [双刃挥击与交叉刃波](../playable/assets/combos/videos/ultimate-eclipse-v8.webm) |
| 冥风军势 | [魂门齐射与友方入场](../playable/assets/combos/videos/ultimate-legion-v8.webm) |
