# 合击绝招演出 v3（网页版 v4.2）

本页保留 v3 技能序列、分镜与历史录像。当前人物出招、武器/掌心发射点及新版实录见 [v4动作修正](COMBO_ACTIONS_V4.md)；本页旧录像不代表当前人物动作。

日期：2026-09-05。本次只修改 HTML5 游戏，不同步 Unity，不改六种合击的数值、前置、能量、库存与限次。

## 交付与分镜

完整演出从约 3.2 秒延长至 **8.4 秒**，每套先生成独立六阶段图片，再由游戏实现实体位移、缩放、帧间过渡、弹道、粒子、目标命中、血条/护盾变化与持续余波。不是把一张海报停留更久，也不是只播视频替代战斗结算。

| 时间 | 阶段 | 视觉与信息 |
| --- | --- | --- |
| 0–1.4 s | 聚能 | 双人光环汇聚，元素核形成 |
| 1.4–3.2 s | 显现 | 凤凰、水龙、圣垒、生命树、蚀月或魂门成为大幅主体 |
| 3.2–4.7 s | 释放 | 按配方分别俯冲、突进、护垒推进、生命上升、交叉斩或军阵冲锋 |
| 4.7–6.2 s | 命中 | 目标局部冲击与真实 HP/护盾变化，治疗及复苏以友方为目标 |
| 6.2–7.6 s | 余波 | 六套主题场持续运动；第 7 秒仍有可见特效 |
| 7.6–8.4 s | 结果 | 特效逐渐收束，保留伤害、盾、治疗或召唤结果 |

预览自然结束后停留，可「重播」「查看结果」「关闭」或按 Esc；完整/减少动态按钮可随时切换，选择仅保留在本页内存，不写玩家存档。默认尊重系统减少动态偏好，减少动态约 1.8 秒且静止，可主动选择「完整演出」。手机镜头依次跟随施法者、巨型实体、受击目标；手动滑动即停止跟随，重播恢复。中文和血量不靠缩小字号挤空间，底部操作与目标状态不得相互遮挡。

实战只在演出自然完成或主动跳过后继续；移除了旧的最多等待 5 秒限制。结算快照在施放确认时生成，演出不重新抽取随机数或修改结果。完成回调防重入，离开/重开战斗取消旧演出，不让旧回调推进新战斗。图片/渲染器故障有降级反馈和恢复路径，不会卡住回合。

## 六套图片与实录视频

图片均为 1536×1024 PNG、3 列×2 行，每帧 512×512，黑底加色合成，**不是透明 PNG**。六张序列共 36 幅阶段画面；既有六张配方海报和局部命中图集保留。

视频来自上述游戏的真实运行录制，不是 AI 视频模型生成。视频为 WebM / VP8、1280×720、25 fps、8.40 秒、无音轨；用于观看与验收，实际战斗仍播放可交互的实时效果。录制使用独立非持久浏览器上下文，不读取或覆盖玩家存档。

| 配方 | 新序列图 | 对应游戏实录 |
| --- | --- | --- |
| 炎羽天陨 | [六阶段图片](../playable/assets/combos/ultimate-phoenix-sequence-v3.png) | [观看视频](../playable/assets/combos/videos/ultimate-phoenix-v3.webm) |
| 雷海龙裁 | [六阶段图片](../playable/assets/combos/ultimate-leviathan-sequence-v3.png) | [观看视频](../playable/assets/combos/videos/ultimate-leviathan-v3.webm) |
| 熔日圣垒 | [六阶段图片](../playable/assets/combos/ultimate-bastion-sequence-v3.png) | [观看视频](../playable/assets/combos/videos/ultimate-bastion-v3.webm) |
| 星泉复苏 | [六阶段图片](../playable/assets/combos/ultimate-spring-sequence-v3.png) | [观看视频](../playable/assets/combos/videos/ultimate-spring-v3.webm) |
| 蚀月雷刃 | [六阶段图片](../playable/assets/combos/ultimate-eclipse-sequence-v3.png) | [观看视频](../playable/assets/combos/videos/ultimate-eclipse-v3.webm) |
| 冥风军势 | [六阶段图片](../playable/assets/combos/ultimate-legion-sequence-v3.png) | [观看视频](../playable/assets/combos/videos/ultimate-legion-v3.webm) |

## 直接试玩步骤

1. 在游戏页按 Ctrl+F5，进入城镇 → 编队 → **合击图鉴**，点击任一「预览绝招 · 免费」。
2. 若系统减少动态已开启，点击「完整演出」。等待约 8.4 秒，观察大幅实体、突进、4.7 秒后命中、7 秒余波及最终数值。
3. 依次测试六套：炎羽看凤凰俯冲；雷海看水龙与电光；圣垒看冲击及队友金盾；星泉看莲树、回血与倒下队友复苏；蚀月看双刃交叉；冥风看魂门军阵与骷髅入场。
4. 中途点「查看结果」，再「重播」，最后关闭/Esc。回到补给工坊确认库存不变；免费预览不消耗能量和每局次数。手机可手动滑动，确认镜头停止自动跟随、按钮仍可点击。
5. 真实施放步骤沿用 [合击规则与实战验收](COMBO_ULTIMATES.md#再检查真实战斗)。先用炎羽完整播完，再在另一局主动跳过：每次仅扣一枚灰烬触媒，60/40 能量各扣一次，只续战一次；演出中不会提前在第 5 秒开下一回合。

## 验证与复现

- 80 个独立四视口定向案例全部通过，并额外检查 1280×720 录像布局；不代表重新执行历史全量数值回归。初轮 72/80，修正余波体积、阶段主体断言与虚拟时钟派发后补齐失败项，并复测相关布局。
- 覆盖六阶段/图集真实裁切与差异运动、第 7 秒持续余波、完整与减少动态、中文/HP/状态可达、预览零存档/库存/能量/UID/随机源变化、取消/重播/Esc/inert恢复。
- 真实施放自然结束、提前跳过、临界跳过、重复回调、渲染器缺失/抛错、退出或重开后的迟到回调均验收，恢复恰好一次。必需图片清单现为 40 张。
- 截图复现：先运行 `node tests/playable/server.js`，再运行 `node tests/playable/combo-motion-visual-qa.cjs`。截图输出到系统临时目录 `spirit-codex-ultimate-v3-qa`；加 `--preparation-only` 仅检查四准备页。
- 当前版本实际完成桌面1366×768、紧凑屏360×640的六套七时点截图及真实三目标炎羽命中/结果；无页面脚本错误或横向溢出。目视复核巨型主体、命中、余波、盾/治疗/复苏/召唤和手机结果，HP与底部操作可读。实际炎羽校验为三敌10000生命降至9590/9590/9569，触媒只减1。
- 另外执行 `node tests/playable/combo-motion-visual-qa.cjs --file --only=phoenix`，直接本地HTML（file://）的桌面/360屏四准备页、凤凰全程和真实施放均通过，无脚本错误/横向溢出，与HTTP结果一致，不改玩家浏览器状态。
- 录像复现：服务开启后运行 `node tests/playable/ultimate-video-capture.cjs`；可用 `--only=phoenix` 录单套，`--check-tools` 检查本机已有录制依赖。实际墙钟录制，不用测试时钟加速后伪装实录。
- 最终六个WebM浏览器播放验收 **6/6通过**：每个loadedmetadata为8.4秒/1280×720，play成功，3次时间更新、实际解码帧，HTTP200，媒体/页面错误均0；总计9,869,735字节。复现：`node tests/playable/ultimate-video-playback-check.cjs`。该检查独立于80项游戏定向，不混加计数。
- 录像采用纯图片解码预热和导出范围外的全屏标记定位，最终版本已去除早期录制误带入的预热片段。按0.4/2.3/5.3/7.0/8.1秒解码复核聚能/显现/命中/余波/结果；凤凰与蚀月还检查首尾，交付视频无起止标记。
- 720p圣垒比其他演练多一行盾条，额外回收反馈空白并给目标组保留底部内边距，不缩小中文；相应验收检查HP、盾值与状态距离舞台底边至少4px。仅影响桌面圣垒免费预览，不改其他五套、手机及实战。
- 最后该边距修正后，desktop完整演练单案复测通过（4.8秒），含1280×720圣垒5个可见HP/盾/状态框至少4px底距、文字至少14px及零副作用；它是前述80项之一的重跑，不累加。复现：`npx playwright test tests/playable/spirit-codex-combo-motion.spec.js:374 --project=desktop --workers=1`。
- 圣垒对应视频最终单独重录为1,693,431字节，命中/余波/结果、首尾和中文底距均目视通过，并用 `node tests/playable/ultimate-video-playback-check.cjs --only=bastion` 再次确认正常播放；其余五段未变。

当前80项定向用例的复现命令（motion 9 + preparation 2 + combos 5 + baseline 4，乘四视口；720p检查包含于desktop用例）：

```text
npx playwright test tests/playable/spirit-codex-combo-motion.spec.js tests/playable/spirit-codex-preparation.spec.js tests/playable/spirit-codex-combos.spec.js:72 tests/playable/spirit-codex-combos.spec.js:119 tests/playable/spirit-codex-combos.spec.js:357 tests/playable/spirit-codex-combos.spec.js:382 tests/playable/spirit-codex-combos.spec.js:405 tests/playable/spirit-codex.spec.js:105 tests/playable/spirit-codex.spec.js:631 tests/playable/spirit-codex.spec.js:658 tests/playable/spirit-codex.spec.js:1758 --workers=2
```

## 生成来源与原始提示词

全部图片先由本次内置图像生成工具生成，然后复制进项目。来源目录：
`C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/`。

四张初稿背景环境光偏亮，随后使用同一内置工具仅编辑黑色背景；不通过代码重画或抠改生成图。凤凰和蚀月直接采用初稿。原始生成文件保留；下方记录准确提示词和最终接入文件。

### 炎羽天陨 · phoenix

- 初次来源：`exec-4c4988e8-0fde-4f91-833e-426dadf14037.png`
- 最终来源：`exec-4c4988e8-0fde-4f91-833e-426dadf14037.png`
- 项目文件：`playable/assets/combos/ultimate-phoenix-sequence-v3.png`

原始生成提示词：

```text
Use case: stylized-concept
Asset type: PRODUCTION GAME ULTIMATE VFX sequence sprite sheet, 1536x1024, exact 3 columns x 2 rows, each cell 512x512.
Primary request: six distinct chronological keyframe sprites for ONE spectacular fantasy RPG ultimate: an enormous legendary PHOENIX made of blazing amber-orange fire and emerald wind, expressive bird head, long blade-like feathers, spectacular fully recognizable winged creature. These six stages will be animated into a long, premium ultimate cutscene, not shown as a contact sheet.
Cell order, left to right then next row:
1. a compact fire-and-emerald feather seed surrounded by an incomplete delicate alchemical summoning sigil
2. the complete majestic phoenix in a frontal three-quarter view, enormous wings fully spread, flaming tail curling down, strong bird silhouette, thrilling ultimate manifestation
3. the SAME phoenix diving toward the right with wings swept backwards, long green wind trails and flame-feather ribbons, distinct directional attack pose
4. the phoenix striking in a huge recognizable wing-shaped fiery detonation, luminous golden core with orange and emerald feather shards, strong impact
5. layered feather shockwaves and a vast spiralling fire vortex, remnants of the bird silhouette disintegrating into embers
6. elegant floating flame-feather fragments and fading emerald-gold motes, aftermath silhouette with clearly different negative space
Style: polished high-end painterly game VFX illustration, richly detailed luminous material, dramatic volumetric shaping inside the magical subject, unmistakable large silhouettes, sharp bright edge detail and controlled glow. Maintain consistent subject design and palette across all six stages. Clearly DIFFERENT poses/forms per tile, not six identical images.
Background: absolute pure BLACK RGB 0,0,0 throughout all empty space and gutters, for additive/screen compositing. No colored ambient haze filling rectangular tiles. Local glow attached to the subject is allowed. No environment, no ground, no horizon, no UI.
Composition constraints: STRICT evenly spaced 3x2 grid, centered subject in each square tile with generous 10% black margins on ALL sides; no subjects cross tile edges; tile boundaries stay black. Treat each tile as an independent isolated sprite, no shared whole-image background. No borders, NO numbers, NO labels, NO lettering, NO watermarks, no human player characters. Only the magical ultimate effect described above.
```

### 雷海龙裁 · leviathan

- 初次来源：`exec-0cd2028f-0a9f-499e-8e82-2a3eadba434a.png`
- 最终来源：`exec-c6f57e82-8f85-44e7-847a-e79296037d69.png`
- 项目文件：`playable/assets/combos/ultimate-leviathan-sequence-v3.png`

原始生成提示词：

```text
Use case: stylized-concept
Asset type: PRODUCTION GAME ULTIMATE VFX sequence sprite sheet, 1536x1024, exact 3 columns x 2 rows, each cell 512x512.
Primary request: six distinct chronological keyframe sprites for ONE spectacular fantasy RPG ultimate: a colossal serpentine WATER DRAGON made of sapphire and turquoise water with violet-blue lightning horns, crystalline dragon jaws, impressive curling body and flowing fins. These six stages will be animated into a long, premium ultimate cutscene, not shown as a contact sheet.
Cell order, left to right then next row:
1. a pressurized glowing water pearl wrapped by electric arcs and a fragmented tidal summoning seal
2. the full gigantic water dragon coiled in a towering S shape, head roaring, translucent liquid scales, lightning horns and long mane, unmistakably powerful creature
3. the SAME dragon lunging rapidly to the right with open jaws and body stretched behind, electrified water ribbons in its wake
4. dragon jaws and a sharp lightning bolt crashing into a dense electrified tsunami splash, dramatic water-crystal impact, no ground or scene
5. expanding layered tidal crests and branching thunder bolts, watery dragon silhouette dissolving into ripples
6. drifting water droplets and electric-blue sparks, lingering thin currents
Style: polished high-end painterly game VFX illustration, richly detailed luminous material, dramatic volumetric shaping inside the magical subject, unmistakable large silhouettes, sharp bright edge detail and controlled glow. Maintain consistent subject design and palette across all six stages. Clearly DIFFERENT poses/forms per tile, not six identical images.
Background: absolute pure BLACK RGB 0,0,0 throughout all empty space and gutters, for additive/screen compositing. No colored ambient haze filling rectangular tiles. Local glow attached to the subject is allowed. No environment, no ground, no horizon, no UI.
Composition constraints: STRICT evenly spaced 3x2 grid, centered subject in each square tile with generous 10% black margins on ALL sides; no subjects cross tile edges; tile boundaries stay black. Treat each tile as an independent isolated sprite, no shared whole-image background. No borders, NO numbers, NO labels, NO lettering, NO watermarks, no human player characters. Only the magical ultimate effect described above.
```

### 熔日圣垒 · bastion

- 初次来源：`exec-9053cddd-66c6-4044-b740-064cfd8020cb.png`
- 最终来源：`exec-072b0a34-759d-4923-ae7a-83635b66ffb7.png`
- 项目文件：`playable/assets/combos/ultimate-bastion-sequence-v3.png`

原始生成提示词：

```text
Use case: stylized-concept
Asset type: PRODUCTION GAME ULTIMATE VFX sequence sprite sheet, 1536x1024, exact 3 columns x 2 rows, each cell 512x512.
Primary request: six distinct chronological keyframe sprites for ONE spectacular fantasy RPG ultimate: a colossal radiant HOLY SUN CITADEL AND SHIELD, molten gold and ivory light, architectural battlements and a central sun-disc, heavy protective metallic-magical presence. These six stages will be animated into a long, premium ultimate cutscene, not shown as a contact sheet.
Cell order, left to right then next row:
1. a small molten gold sun core above two floating curved shield fragments and an angular alchemical seal
2. a magnificent complete floating golden citadel-shield, three tall luminous bastions and a central giant sun disc, thick radiant plates, monumental silhouette
3. the SAME fortress shield projecting forward to the right in an armored holy ram attack, molten-gold lances and ribbon trails
4. an immense sun-hammer impact with angular golden shield shards and a white-gold cross-shaped flare, crisp weighty geometry
5. several protective hexagonal shield domes unfurling with amber sun rays and hovering battlement shards
6. slowly falling molten-gold flakes and a calm luminous protective crest, gentle ending
Style: polished high-end painterly game VFX illustration, richly detailed luminous material, dramatic volumetric shaping inside the magical subject, unmistakable large silhouettes, sharp bright edge detail and controlled glow. Maintain consistent subject design and palette across all six stages. Clearly DIFFERENT poses/forms per tile, not six identical images.
Background: absolute pure BLACK RGB 0,0,0 throughout all empty space and gutters, for additive/screen compositing. No colored ambient haze filling rectangular tiles. Local glow attached to the subject is allowed. No environment, no ground, no horizon, no UI.
Composition constraints: STRICT evenly spaced 3x2 grid, centered subject in each square tile with generous 10% black margins on ALL sides; no subjects cross tile edges; tile boundaries stay black. Treat each tile as an independent isolated sprite, no shared whole-image background. No borders, NO numbers, NO labels, NO lettering, NO watermarks, no human player characters. Only the magical ultimate effect described above.
```

### 星泉复苏 · spring

- 初次来源：`exec-91389733-e5c0-41e7-90d6-4b7d24ffbd0d.png`
- 最终来源：`exec-2c2c0c1e-8ff2-4050-be78-d3080b5a7d13.png`
- 项目文件：`playable/assets/combos/ultimate-spring-sequence-v3.png`

原始生成提示词：

```text
Use case: stylized-concept
Asset type: PRODUCTION GAME ULTIMATE VFX sequence sprite sheet, 1536x1024, exact 3 columns x 2 rows, each cell 512x512.
Primary request: six distinct chronological keyframe sprites for ONE spectacular fantasy RPG ultimate: a magnificent living STAR LOTUS AND LUMINOUS TREE formed from mint-turquoise water and ivory starlight, graceful organic restorative magic, serene but visually spectacular. These six stages will be animated into a long, premium ultimate cutscene, not shown as a contact sheet.
Cell order, left to right then next row:
1. a closed lotus bud holding a bright star seed, surrounded by tiny upward-flowing drops
2. a giant fully opened star lotus supporting a luminous branching tree, many luminous ivory petals and aqua branches, exquisite majestic restorative ultimate apparition
3. the SAME lotus-tree releasing an ascending helix of leaves, water ribbons and stars, upward and outward flowing wave of life
4. a brilliant full star-lotus bloom with radiant starlight waterfall and curling mint water petals, a healing supernova not a damaging explosion
5. many green-ivory restorative vine arcs and star constellations spreading outward, layered petal waves
6. gently falling ivory petals and softly glowing mint dew, lingering restorative stardust
Style: polished high-end painterly game VFX illustration, richly detailed luminous material, dramatic volumetric shaping inside the magical subject, unmistakable large silhouettes, sharp bright edge detail and controlled glow. Maintain consistent subject design and palette across all six stages. Clearly DIFFERENT poses/forms per tile, not six identical images.
Background: absolute pure BLACK RGB 0,0,0 throughout all empty space and gutters, for additive/screen compositing. No colored ambient haze filling rectangular tiles. Local glow attached to the subject is allowed. No environment, no ground, no horizon, no UI.
Composition constraints: STRICT evenly spaced 3x2 grid, centered subject in each square tile with generous 10% black margins on ALL sides; no subjects cross tile edges; tile boundaries stay black. Treat each tile as an independent isolated sprite, no shared whole-image background. No borders, NO numbers, NO labels, NO lettering, NO watermarks, no human player characters. Only the magical ultimate effect described above.
```

### 蚀月雷刃 · eclipse

- 初次来源：`exec-eca7f63c-c0b0-45bc-b981-bbe9581b19c7.png`
- 最终来源：`exec-eca7f63c-c0b0-45bc-b981-bbe9581b19c7.png`
- 项目文件：`playable/assets/combos/ultimate-eclipse-sequence-v3.png`

原始生成提示词：

```text
Use case: stylized-concept
Asset type: PRODUCTION GAME ULTIMATE VFX sequence sprite sheet, 1536x1024, exact 3 columns x 2 rows, each cell 512x512.
Primary request: six distinct chronological keyframe sprites for ONE spectacular fantasy RPG ultimate: a giant BLACK ECLIPSE MOON flanked by TWO CURVED SPECTRAL BLADES, dark-violet shadow and electric-lavender thunder, razor sharp dramatic assassin ultimate silhouette. These six stages will be animated into a long, premium ultimate cutscene, not shown as a contact sheet.
Cell order, left to right then next row:
1. a concentrated dark orb with a thin lavender crescent and two small blade tips emerging from sparks
2. a complete enormous eclipsed moon halo flanked by two giant curved spectral blades, symmetrical powerful ominous silhouette, bright crackling edges
3. the SAME two giant blades sweeping toward the right in opposing diagonals around the eclipse, motion trails clearly describe a crossing strike
4. an explosive double diagonal X slash of violet-lavender lightning splitting a dark moon core, crisp razor-sharp contact bloom
5. fractured eclipse rings and several staggered spectral blade echoes, spreading purple lightning web
6. fading crescent fragments and small lavender sparks, sharp sparse afterimage
Style: polished high-end painterly game VFX illustration, richly detailed luminous material, dramatic volumetric shaping inside the magical subject, unmistakable large silhouettes, sharp bright edge detail and controlled glow. Maintain consistent subject design and palette across all six stages. Clearly DIFFERENT poses/forms per tile, not six identical images.
Background: absolute pure BLACK RGB 0,0,0 throughout all empty space and gutters, for additive/screen compositing. No colored ambient haze filling rectangular tiles. Local glow attached to the subject is allowed. No environment, no ground, no horizon, no UI.
Composition constraints: STRICT evenly spaced 3x2 grid, centered subject in each square tile with generous 10% black margins on ALL sides; no subjects cross tile edges; tile boundaries stay black. Treat each tile as an independent isolated sprite, no shared whole-image background. No borders, NO numbers, NO labels, NO lettering, NO watermarks, no human player characters. Only the magical ultimate effect described above.
```

### 冥风军势 · legion

- 初次来源：`exec-8741cbe0-66b8-4bfe-8c03-c3e3b257003e.png`
- 最终来源：`exec-7162b32e-b879-419e-951f-079d85194ae2.png`
- 项目文件：`playable/assets/combos/ultimate-legion-sequence-v3.png`

原始生成提示词：

```text
Use case: stylized-concept
Asset type: PRODUCTION GAME ULTIMATE VFX sequence sprite sheet, 1536x1024, exact 3 columns x 2 rows, each cell 512x512.
Primary request: six distinct chronological keyframe sprites for ONE spectacular fantasy RPG ultimate: a monumental SPECTRAL WAR GATE with a charging ARMY OF ARMORED GHOST WARRIORS and spears, ghost-teal wind and smoky violet souls, non-gory high-fantasy summoned army ultimate. These six stages will be animated into a long, premium ultimate cutscene, not shown as a contact sheet.
Cell order, left to right then next row:
1. a compact ghost-teal summoning gate rune wrapped in violet wisps and three spectral spear tips
2. a complete grand spectral war gate opened wide, large armored ghost commander silhouette behind a row of warriors, impressive ethereal banner and spear silhouettes
3. the SAME spectral warriors charging toward the right out of the gate, many clearly articulated armored silhouettes, bright teal wind trails
4. a heavy collective spear-charge impact, ghost-teal lance points and swirling soul fragments exploding outward, visible armored shapes in the flare
5. an organized line of reinforced spectral warriors raising spears beneath violet-teal soul banners, waves of strengthening energy
6. receding spectral banners and floating teal soul lights, warriors becoming mist
Style: polished high-end painterly game VFX illustration, richly detailed luminous material, dramatic volumetric shaping inside the magical subject, unmistakable large silhouettes, sharp bright edge detail and controlled glow. Maintain consistent subject design and palette across all six stages. Clearly DIFFERENT poses/forms per tile, not six identical images.
Background: absolute pure BLACK RGB 0,0,0 throughout all empty space and gutters, for additive/screen compositing. No colored ambient haze filling rectangular tiles. Local glow attached to the subject is allowed. No environment, no ground, no horizon, no UI.
Composition constraints: STRICT evenly spaced 3x2 grid, centered subject in each square tile with generous 10% black margins on ALL sides; no subjects cross tile edges; tile boundaries stay black. Treat each tile as an independent isolated sprite, no shared whole-image background. No borders, NO numbers, NO labels, NO lettering, NO watermarks, no human player characters. Only the magical ultimate effect described above.
```

### 四张黑底修订共用提示词

用于 leviathan、bastion、spring、legion 的初稿；只调整背景，不改六格结构与主体。

```text
Use case: precise-object-edit. Supplied image is the EDIT TARGET: a 3-column, 2-row game ultimate sequence sprite atlas. Preserve the EXACT six magical subjects, exact composition, positions, poses, original six chronological stages, brilliant colors and all fine details. Change ONLY THE BACKGROUND: remove the entire colored rectangular ambient backdrop/gradient and replace all negative space and gutters with ABSOLUTE PURE BLACK RGB(0,0,0). The glowing magical subjects remain luminous, each isolated on black, for additive/screen game compositing. Remove broad rectangular colored haze not attached to the subject. Keep localized light, wisps, petals, water, flame and sparks that are actually part of the subjects. There must be no colored background or shared sheet-wide gradient at all, just black between the six subjects. No new objects, no text, no labels, no borders. Maintain exact 1536x1024 3x2 layout and preserve every original subject; do not recolor, shrink or redesign.
```
