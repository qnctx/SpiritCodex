# 面向目标与战场环境联动 v9（网页版 v4.8）

日期：2026-09-05。修正“凤凰正对镜头”和“合击只改变一小块区域”的问题。此次仅修改 HTML5 游戏，不同步 Unity；表现仍为 Canvas 2.5D 原画网格、局部关节变形、透视与实时环境，不是真正三维模型。

## 实际变化

- 凤凰增加右侧身悬停战斗原画，喙和胸口朝向敌方，不再把正面图鉴构图当作战斗朝向。左右敌人可镜像，近翼/远翼错相振动，尾羽滞后，头颈有有限俯仰。
- 龙、凤凰依据合法攻击目标转向；树的治疗流朝友方受益者。圣垒、暗月、魂门使用有限侧向投影，保持建筑或法器直立。目标朝向、真实器官锚点与实际纹理三角共用同一变换。
- 手机目标位于下方时，不把整幅召唤图旋转90度，改用头颈俯仰、出招侧与弯曲轨迹。朝向设置死区且锁定同一合法目标，避免微小布局变化造成反复翻转。
- 六种合击均改变整片天空、天气粒子与地面反光，而非给UI套色。环境绘制在人物和文字之下，不遮挡HP、中文或按钮。
- 实战合击使用当前波次的战场背景；演练与实战演出共用环境采样、绘制和时间轴，底层真实战场Canvas也同步使用同一采样。完整演出返回后保留900ms、起始强度0.12的温和环境尾韵；跳过、减少动态、退出、重开和进入下一波立即清除。
- 不修改合击前置、库存、能量、伤害、治疗、召唤或回合规则。完整8.4秒，视觉首命中4.7秒，后续目标110ms错峰；只结算、扣费与续战一次。免费演练不写存档、不推进游戏随机流。

| 合击 | 环境变化 | 独立发招方式 |
| --- | --- | --- |
| 炎羽天陨 | 赤金火云、飞灰、流动暖色地面反光 | 侧身凤凰振翼引火，目标上方降落火羽 |
| 雷海龙裁 | 蓝色风暴云、斜雨、潮湿涟漪 | 留场青龙张口喷射水雷吐息 |
| 熔日圣垒 | 日光束、金尘、地面金色反射 | 核心光矛攻击敌方，友方护盾另走支路 |
| 星泉复苏 | 翠色薄雾、花瓣、水纹 | 莲心生命流进入治疗/复苏目标 |
| 蚀月雷刃 | 紫色暗幕、月晕、星尘 | 局部双刃发力，刃波交叉斩击 |
| 冥风军势 | 青绿魂雾、流动魂尘、地面雾光 | 魂门军阵发射魂矛，召唤支援分路 |

## 美术素材及来源

新增项目文件：`playable/assets/combos/phoenix-combat-facing-v9.png`，1254×1254、RGB、1×1单格。
SHA256：`f9de66b3b665b047bc187f5e47ff604c5ff0a6110191a9ef8a40c7793183a21a`。

通过**内置 imagegen**生成（非CLI/API）。参考为项目已有 `playable/assets/combos/reference-phoenix-v7.png` 的上排中间凤凰。首次侧身生成保留了姿态但得到绘制的棋盘格，不是真实透明；随后只让工具把背景替换为纯黑，保留侧身角色。最终黑底源图原样复制入项目，运行时沿用亮度净底、边缘羽化和原画网格，不将黑方块绘制到战场，不用程序重写PNG。渲染用512像素缓存控制开销，不改变源文件。

旧六主体源图均保留，凤凰早期聚能仍读原图第0格，其成型/出招读新增单格侧身图；其余五主体继续原图第1格。v8独立攻击材质和原有48人物动作继续使用。必需玩法图片增加为49张；历史素材、视频与Unity改动未删除或覆盖。

首次生成提示词：

```text
Use case: identity-preserve. Asset type: one single full-body fantasy RPG summon combat sprite, square 1024x1024. Input image is the character identity and visual style reference; use the orange-gold and emerald-green PHOENIX in the upper middle only, not the other effect panels. Make a new combat-facing pose of this same exquisitely detailed fire phoenix: strict RIGHT-FACING side / three-quarter side view, head and pointed beak looking toward an enemy OFFSCREEN RIGHT, only one dominant visible eye; chest and torso turned to the right, never looking toward the viewer. The bird is HOVERING UPRIGHT IN PLACE, not diving and not flying horizontally. Two wings lifted in asymmetric side-view perspective, clearly separate near and far wings with overlap and real feather layering, same fine blazing gold/orange/emerald feathers; talons drawn up below torso, long streaming tail trailing DOWN AND LEFT. The near wing rises toward the upper-left, the far wing behind it, do not use a front-facing symmetrical V-wing heraldic pose. Keep the whole phoenix fully visible with 10% clean safe margin, body center around 55% width 48% height, head around 74% width 36% height; wings and tail spread enough for later internal rig deformation. Preserve original anatomical identity, flame filaments and green accent feathers, rich premium painterly game rendering and volumetric self-light. Scene/backdrop: genuinely transparent background with original alpha, no ground, no card, no environment, no circles, no runes, no text, no labels, no watermark, no frame. ONE phoenix only, ONE sprite only, NOT a sprite sheet, not a panel layout. Do not add emitted projectiles; those are animated separately in the game.
```

最终定向修正提示词：

```text
Use case: precise-object-edit. Input image is the edit target. Change ONLY its pale checkerboard backdrop to perfectly uniform PURE BLACK (#000000), including all gaps between feathers, wings and tail. This is a sprite material for additive/screen rendering, so a real black matte is required: NO checkerboard, NO gray squares, NO white background, NO environment. Preserve the entire single right-facing hovering phoenix EXACTLY: same pose, exact framing, size, wing shape, beak direction, orange/gold/emerald feathers, all fine flame wisps, no added objects. Keep full feather detail and clean thin luminous edges against black. Do not turn it toward the camera. One square sprite.
```

## 开发接口

- `ComboChoreography.sample(geometry,motion,time,{artVariant,facingState})` 生成朝向、局部动作与攻击路线。会话局部facingState只记录视觉锁定，不修改游戏状态。caster含facingTargetUid/facingX/aimPitch/yaw与完整rigOptions。
- `ComboArtRig.getMesh/getAnchor/draw` 共享最终朝向变换；出口不能只在未翻转矩形上估算。龙吐息第一段控制点按真实朝向构建。
- `ComboEnvironment.sample/draw` 提供六主题可复现环境，不使用游戏随机数或独立定时器；`beginBattle/syncBattle/releaseBattle/battleFrame` 是带令牌的短生命周期桥。
- `.combo-environment-canvas` 在场景图之后、人物之前；实际 `#battle-canvas` 中同一环境在场景之后、角色/HUD之前。实战与演出传递同一时钟锚点，取消不留后台动画。
- 减少动态时环境强度为零、不绘制环境，也不建立实战尾韵。

## 手动测试步骤

1. 用Ctrl+F5刷新 `playable/spirit-codex.html`，进入“城镇 → 编队并出征 → 合击图鉴 → 炎羽天陨 → 预览绝招·免费 → 完整演出”。
2. 在约1.5–3秒看凤凰：应为侧身、朝右侧怪物，近远翼错相、尾羽摇动；不能再看到正面对镜头的对称双翼。随后振翼引出火羽，凤凰本体留场，火羽落在怪物身上。
3. 看整个场景：火云与飞灰逐渐出现，地面暖色反射流动，命中后再淡出。依次预览其余五招，确认环境与上表相符；治疗不能瞄敌人。
4. 缩窄到360px，检查召唤物仍直立，先展示出招再跟随攻击到目标，手动滚动、重播、查看结果、减少动态和关闭都能使用，中文/血条不能被特效挡住。
5. 实战：把艾拉和琳加入主战（再配两名其他角色），进入战斗后切手动。由琳召出存活风鹰，或先给敌人施加灼烧；轮到艾拉或琳本人时，两人均须存活且无冰冻/麻痹，当前行动成员至少60能量、另一人至少40能量，灰烬触媒至少1件。确认本局尚未用过炎羽天陨、全局合击未满2次、融合锁为0且仍有存活敌人，打开战斗合击并施放。首次新局通常已满足次数与融合锁要求；按钮旁会列出缺失条件。
   能量可通过普攻、技能和受击逐步积攒；不要提前使用会耗尽能量的普通大招。只想立即看美术效果时，先用免费的合击演练，不需要准备战斗条件。
6. 实战应显示当前关卡背景和同样的凤凰朝向、天气/地面变化，展示真实敌人与伤害；自然播完有短暂环境尾韵，跳过或退出不得残留。进入下一波后旧主题清除。道具只减1件，行动者60/协力者40能量只扣一次，每局次数只加1；自动战斗不会自动消耗合击道具。

## 验证记录

当前版 **172个独立浏览器定向案例通过**：原画/人物动作/49资源/器官出招72项＋环境16项＋规则/战前准备84项，覆盖桌面、平板、手机及360px紧凑屏。最后镜头锁定目标修改后另复验20项，均通过但不重复累计。5个纯VM朝向专项单project执行5/5通过，单独记录，不计入浏览器案例。不是全部历史游戏案例全量重跑，也不复用v8通过数。

规则首轮82/84，两个用例业务断言未失败但浏览器context关闭超过30秒；按原断言、原超时、单worker精确复验，mobile第335行用例5.0秒、compact第357行用例3.8秒分别通过。没有放宽业务断言或超时阈值。

环境专项测量真实Canvas绘制前后的天空、地面像素及四列覆盖，六主题与不同时间确实产生不同画面；实际绘制顺序是当前波背景→环境→角色/HUD。演练与实战同一模型及共同RAF时间原点、自然完成900ms尾韵后的逐像素恢复、快速换波清理、旧令牌隔离、跳过/重播/退出/减少动态和存档/RNG零副作用均通过。素材专项继续核对六张旧源图SHA、真实网格三角、非整体仿射动作、净底边界与中文HUD，无放宽质量保护。

纯函数检查已完成：9,072个姿态覆盖新/旧凤凰及其余五招、10/12网格、正反朝向、极限俯仰/侧向投影/发力，无局部网格反折，最小三角面积比0.29539。5个独立朝向专项检查通过，出口与实际drawImage仿射绘制在继承Canvas变换、镜像及俯仰下误差小于1e-7。另5046个环境时间样本检查连续性、减少动态零绘制、Canvas状态恢复与900ms尾韵。纯函数检查不等同浏览器画面或帧率测量。

最终file协议视觉检查已完成：桌面1366×768与360×640分别预览全部六招的11个时点；主代理复看六招发招、环境和手机命中画面。另两视口实际施放凤凰，核对命中、结果、返回战场尾韵与清除画面，无页面错误或横向溢出；真实伤害快照10000→9590/9590/9569且道具减1。浏览器、QA与录像均用独立临时上下文串行运行，未操作玩家现有存档或个人浏览器。

复现入口：

```text
node tests/playable/server.js
npx playwright test tests/playable/spirit-codex-combo-actions.spec.js tests/playable/spirit-codex-combo-motion.spec.js tests/playable/spirit-codex-combo-choreography.spec.js --workers=2
npx playwright test tests/playable/spirit-codex-combo-environment.spec.js --workers=2
npx playwright test tests/playable/spirit-codex-combos.spec.js tests/playable/spirit-codex-preparation.spec.js --workers=2
npx playwright test tests/playable/spirit-codex-combo-facing.spec.js --project=desktop --workers=1
node tests/playable/combo-motion-visual-qa.cjs --file
node tests/playable/ultimate-video-capture.cjs
node tests/playable/ultimate-video-playback-check.cjs
```

## 当前六段实录

已录制并复看六段v9游戏实时演出，另浏览器实际解码播放 **6/6通过**，零媒体或页面错误。每段8.4秒、1280×720、25fps编码、无声，总9,800,669字节（约9.80MB）。均核对六阶段和尾帧；25fps是导出编码规格，不表示所有设备实测恒定25fps，也不是外部AI视频替换游戏。游戏仍使用实时演出，`recipe.video`已改指v9；v8及更早视频保留。

| 合击 | v9实录 |
| --- | --- |
| 炎羽天陨 | [侧身振翼与火云环境](../playable/assets/combos/videos/ultimate-phoenix-v9.webm) |
| 雷海龙裁 | [目标朝向与雷雨吐息](../playable/assets/combos/videos/ultimate-leviathan-v9.webm) |
| 熔日圣垒 | [太阳光矛与金色光场](../playable/assets/combos/videos/ultimate-bastion-v9.webm) |
| 星泉复苏 | [治疗目标与花瓣泉雾](../playable/assets/combos/videos/ultimate-spring-v9.webm) |
| 蚀月雷刃 | [双刃出招与暗月星尘](../playable/assets/combos/videos/ultimate-eclipse-v9.webm) |
| 冥风军势 | [魂门齐射与魂雾环境](../playable/assets/combos/videos/ultimate-legion-v9.webm) |

本地静帧目录为系统临时目录下的`spirit-codex-facing-v9-qa`与`spirit-codex-ultimate-video-v9-qa`。测试服务器和独立浏览器已停止；正式视频、新素材及旧版本素材保留。
