# 合击战场展示重构 v5（网页版 v4.4）

> 本文保留 v5 战场方向、生成资产及该轮验证记录。当前版本在这套场景之上接入用户指定的精细原画与局部网格动画，最新实现、实录和测试见 [v7 精细原画动态](COMBO_PAINTED_RIG_V7.md)。

日期：2026-09-05。范围：HTML5 可玩版本 `playable/` 的六种专属合击演练与真实施放。未同步 Unity，未修改前置条件、伤害、治疗、能量、库存或限次。

## 美术问题与新方向

用户指出 v4 的巨型圣垒插画像一块背景板，和人物、卡片目标叠在一起，看起来不是同一场战斗。本轮不是缩小这块图：从演出中彻底移除六套整幅技能序列、局部命中图集、头像卡框、标题海报缩略图以及六阶段横向流程标签。

新方向是“同一片夜色石台上的战斗”：远景、低亮地面、完整人物、脚下状态和实时材质效果处在同一舞台里。原配方海报仅保留于图鉴；原技能序列和旧录像保留为历史资产，不预载、不作为特效平面显示。

- 人物保持原有48种出招姿态，使用正常混合。按每套动作表实际背景RGB做运行时SVG窄范围色键，剔除暗底而保留黑甲，不用screen/lighten洗掉深色人物。源PNG没有改写，仍是RGB；没有虚构alpha通道。滤镜不读取像素，兼容直接打开本地HTML。
- 目标由裁切半身卡片改为 `object-fit:contain` 的无框完整立绘；姓名、HP、盾与结算反馈置于脚下，中文至少14px。法效Canvas对姓名/血条/反馈区域实际裁剪，光效不能盖字。
- 顶部只保留招式名、当前阶段和细进度条；控制区保持完整/减少动态、查看结果、重播与关闭。
- 元素效果由独立的 `spirit-codex-combo-stage-vfx.js` 每帧绘制，有填充渐变、前后层次、折射、羽片/花瓣、受击与持续余波；不以一幅完成插画缩放平移冒充技能动画。
- 生成的小纹理只用于少量微小火花/水滴/灵魂细节，不整张展示、不作主体。黑底灰度通过运行时滤镜转为透明度，避免小黑块。程序化材质本身不依赖纹理才能运行。
- 保留人物武器/手掌→融合点→合法目标的共享几何坐标。攻击与盾指向躯干；治疗/召唤明确定位到目标脚下。释放后融合点固定，不随人物收势拖动。
- 手机是可滚动舞台：先展示双人出招，释放后移向目标，手动滚动停止跟随；右侧施法者向内镜像，锚点共同变换。减少动态静态显示结果；预览不影响存档、道具、能量、次数或随机流。

## 六种新材质表现

| 合击 | 蓄能与释放 | 到达目标后 |
| --- | --- | --- |
| 炎羽天陨 | 成束火羽逐片展开，沿出射轨迹汇成焰翼冲锋 | 羽焰散开、焦灼余烬持续升起 |
| 雷海龙裁 | 有厚度的水带旋流，雷光顺潮向前推进 | 水浪与电光冲击，脚下涟漪持续波动 |
| 熔日圣垒 | 聚光形成曲面护盾，表面有斜向反光与纹饰 | 友方身前护盾展开；敌方脚下独立熔火裂隙 |
| 星泉复苏 | 聚合的生命流与轻盈莲瓣，非攻击弹道 | 脚下莲阵、上升生命流、复苏与治疗反馈 |
| 蚀月雷刃 | 双人合力形成有厚度的交错光刃 | 斜向切击实际单体敌人，残刃与碎光收束 |
| 冥风军势 | 地面倾斜魂阵，灵魂轮廓涌出并冲锋 | 敌方魂影打击；友方独立召唤入场与强化 |

完整时长仍为8.4秒：0–1.4聚能、1.4–3.2凝聚、3.2–4.7释放、4.7–6.2命中、6.2–7.6余波、7.6–8.4收束。减少动态约1.8秒。实际数值仍在确认释放时结算一次，4.7秒到达后才播放可见血条变化；自然结束或跳过只续战一次。

## 新资产、来源与提示词

使用 imagegen 技能的内置图像生成工具。两张最终文件已经复制到项目，原始生成文件保留。不是AI视频模型输出。

| 文件 | 实际规格 | 用途 | 原始文件 |
| --- | --- | --- | --- |
| [arena-concordance-v5.png](../playable/assets/combos/arena-concordance-v5.png) | 1672×941 RGB PNG，1,698,146字节 | 真正的统一空战场底图 | `C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-a7d99879-5818-4dd8-8edc-cb46faafd156.png` |
| [vfx-brush-atlas-v5.png](../playable/assets/combos/vfx-brush-atlas-v5.png) | 1774×887 RGB PNG，836,595字节；4列2行 | 8种微粒笔刷，运行时灰度转alpha | `C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-084d90ce-c623-4f46-8c66-7b3c964b92b2.png` |

本轮必需图片由46张调整为41张（移除6张旧技能序列与1张旧命中图集，加2张新场地/笔刷）。并非删除旧文件：历史素材、原角色立绘与所有用户文件保留。人物色键和笔刷alpha均是游戏运行时材质合成，不是对PNG的离线改写。

### 统一战场原始提示词

```text
Use case: stylized-concept. Asset type: production GAME BACKGROUND plate for a side-view 2.5D fantasy RPG ultimate battle stage, not a UI mockup. Primary request: an empty, beautifully art-directed ancient ritual terrace at night, a continuous believable place with low atmospheric depth and room for moving characters/VFX. Premium hand-painted fantasy game environment, restrained painterly brush texture. Wide landscape 16:9 1920x1080. Horizon at 38 percent canvas height, wide level worn dark slate stone floor across lower 55 percent, perspective floor seams gently recede. Far background only: very distant broken slender pillars at the extreme left/right edges, muted moonlit fog and a few warm bronze inlays in the floor. Center 80 percent has clean NEGATIVE SPACE and dark desaturated midnight blue #07121f, floor subtle and readable; no huge central portal, no castle, no shrine, no statue, no trees. Left and right combat lanes equally usable. Lighting: very soft cold blue backlight from upper-left, almost-black corners, restrained faint reflection on floor, no spotlight hotspot or bright central subject. Atmosphere feels cinematic and coherent with painted anime fantasy heroes, NOT photoreal stone photo or flat vector. No characters, no creatures, no weapons, no skill effects, no colored magic circle, no UI, no frame or border, no icons, no text or numbers, no watermark.
```

### 小型粒子纹理原始提示词

```text
Use case: stylized-concept. Asset type: production realtime game VFX SMALL PARTICLE TEXTURE ATLAS, not finished skill art. EXACT 4 equal columns x 2 equal rows on a 2:1 wide canvas, ideally2048x1024, 8 equal square cells. Pure uniform BLACK #000000 backdrop, intended additive compositing, no transparency simulation, no checkerboard, no environment. Each of the8 cells contains ONE small isolated white/neutral-gray luminous painterly texture completely contained with generous 18% black margin on all four sides, feather edges to pure black. Top row left to right: (0) tapered curved feather-shaped flame wisp pointing right with wispy soft smoke edge; (1) short thick crescent brush slash with bright tapered tip pointing right, no complete ring; (2) irregular water mist splash droplet with fine spray flecks locally inside cell; (3) soft low-contrast billowing smoke puff/cloud with translucent-looking gradient. Bottom row left to right: (4) diamond crystalline shard with softly glowing white edge and dark body; (5) narrow delicate leaf/petal shape with central vein; (6) four-point short sparkle with soft glow, elegant not lens flare; (7) oval ghostly soul wisp with tapered flowing tail, no face or skull. ALL WHITE/GRAY, not colored. Texture values varied 5%-80%gray with tiny white highlights, keep visible brush detail not overexposed blobs. No whole phoenix, no dragon, no giant shield, no tower, no trees, no portal, no whole skill composition, no characters, no long lightning, no arrows, no labels, no borders, no dividers, no watermark. This sheet will be sampled as dozens of small rotated particle sprites, never shown whole.
```

## 试玩步骤

1. `Ctrl + F5` 强制刷新 [游戏](../playable/spirit-codex.html)，进入城镇→编队→合击图鉴→熔日圣垒→“预览绝招 · 免费”，选择“完整演出”。
2. 应看到同一片场地和完整人物，没有巨型城堡、六段流程栏和目标半身卡框。洛恩黑甲和脚部应完整，不透出地板；雷欧推掌后聚成小型曲面光盾。
3. 到命中阶段，观察敌人脚下熔火裂隙与队友身前金盾是两条不同反馈；特效不能盖住姓名/HP/盾值，4.7秒前血条不应提前变化。
4. 依次预览其余五组，核对火羽、雷潮、莲瓣生命流、交错斩、魂阵的差别；第7秒仍有余波，不再出现大幅图片底板或小黑色方块。
5. 试手机宽度、手动滑动、重播、查看结果、减少动态和关闭/Esc；少动态时进度为100%、实时Canvas为空，仍可阅读结果。回到补给工坊核对库存未变。
6. 真实施放按 [合击前置与操作](COMBO_ULTIMATES.md#再检查真实战斗) 操作，测试正反主导、自然播完与提前跳过；确认只扣1枚催化物，显示实际受益/受伤对象，恰好续战一次。

## 可复现验证

在单独终端运行 `node tests/playable/server.js`。所有浏览器测试/录制均用独立非持久上下文，不读取或改写用户自己的浏览器存档。

- 规则与准备：`npx playwright test tests/playable/spirit-codex-combos.spec.js tests/playable/spirit-codex-preparation.spec.js --workers=2`
- 新舞台与动作：`npx playwright test tests/playable/spirit-codex-combo-actions.spec.js tests/playable/spirit-codex-combo-motion.spec.js --workers=2`
- 图片加载：运行原 `spirit-codex.spec.js` 的资产加载用例，当前41张必需图。
- 可复现静帧：`node tests/playable/combo-motion-visual-qa.cjs`（支持 `--file`、`--only=bastion`）。输出系统临时目录 `spirit-codex-stage-v5-qa`。
- 实时录制：`node tests/playable/ultimate-video-capture.cjs`，输出六段 `playable/assets/combos/videos/ultimate-{id}-v5.webm`；抽帧目录为系统临时目录 `spirit-codex-ultimate-video-v5-qa`。
- 视频只读播放：`node tests/playable/ultimate-video-playback-check.cjs`。旧v3/v4录像保留为历史，不代表当前舞台。

## 本轮结果

- 本轮四视口 **140个不同定向案例全部通过**：84项规则/准备（1.7分钟）＋最终56项动作/材质/生命周期/素材（2.3分钟）。首轮视觉53/56，发现手机融合盾被名牌裁出洞及360px裁帧测试整数舍入；修复布局、改用CSS亚像素宽高测量且不放宽容差后，完整56/56重跑通过。不把早期重复运行累加，也未声称重跑历史296项全量。
- 实际拦截新渲染器调用与Canvas绘制，确认没有旧sequence/impact贴图，禁止整幅大图转移到Canvas内冒充新方案；目标无框且contain。6组×6时点材质均有差异运动，第7秒/7.25秒仍有余波，黑色matte块像素为0；可见中文/血条区域Canvas没有覆盖污染。
- 48动作帧、角色ID、武器锚点、实测起终点、手机镜像/滚动/resize、攻击与友方支持分路继续通过。4690ms血条不变，4730ms首目标开始变化而后续110ms错峰目标尚未变，5300ms逐个核对结果；真实复活及召唤对象展示正确。
- 减少动态1.8秒、进度100%、Canvas零绘制，8.4秒自然结束/提前跳过/重复回调/取消与免费零消费零随机流保护均通过。41张必需图解码通过。
- 主代理实际查看六组桌面与手机关键帧；手机圣垒汇聚移至名牌下方留白区后另看最终截图，无大盾被横向挖洞。直接file协议复核桌面/360屏圣垒全程及真实凤凰施放，0页面错误、无横向溢出；角色黑甲和脚部保留，原始图片未改写。
- 六段最终v5实录录制完成，1280×720、25fps、8.40秒、无音轨，共6,727,954字节（约6.73MB），原始运行全部六阶段完成且预览前后状态一致。另做浏览器播放 **6/6通过**、0媒体错误，与140项游戏测试分开计数。

### 当前游戏实录（不是AI视频模型输出）

| 合击 | v5实录 |
| --- | --- |
| 炎羽天陨 | [观看实录](../playable/assets/combos/videos/ultimate-phoenix-v5.webm) |
| 雷海龙裁 | [观看实录](../playable/assets/combos/videos/ultimate-leviathan-v5.webm) |
| 熔日圣垒 | [观看实录](../playable/assets/combos/videos/ultimate-bastion-v5.webm) |
| 星泉复苏 | [观看实录](../playable/assets/combos/videos/ultimate-spring-v5.webm) |
| 蚀月雷刃 | [观看实录](../playable/assets/combos/videos/ultimate-eclipse-v5.webm) |
| 冥风军势 | [观看实录](../playable/assets/combos/videos/ultimate-legion-v5.webm) |
