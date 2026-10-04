# 合击动作与发射位置 v4（网页版 v4.3）

本页保留人物动作表、48个姿态与锚点的历史设计。当前展示已取消巨型技能贴图/目标卡片，改为同场实时材质战斗，见 [v5舞台重构](COMBO_STAGE_V5.md)；本页v4录像不是当前画面。六套动作源图继续使用，新增运行时色键去底而非修改源文件。

日期：2026-09-05。只修改 `playable/` 网页版，不同步 Unity；保留六套合击的前置、消耗、数值、限次及 8.4 秒完整时长。

## 本次修正

此前两个人只是待机立绘整体漂移，光束起点取立绘中心，巨型实体与弹道又各用一套定位。现在新增 **6 张双人四姿态动作表，共 12 人、48 幅姿态**，替换合击期间的待机立绘，并将图像、人物出招与目标反馈接到同一套实际几何位置。

- 0–1.4 秒蓄势，1.4–3.2 秒聚能瞄准，3.2–5.0 秒身体前倾/踏步并释放，5 秒后收势。四幅是实际不同的手臂、肩、膝、武器姿态，加上实时位移和重心过渡；不是完整骨骼动画。
- 每个角色、每个姿态分别标定武器/手掌锚点；按角色 ID 匹配动作行，反向主导不交换身份。锚点经过图片缩放、人物位移、手机镜像和舞台滚动后重新测量，不使用固定屏幕坐标。
- 两个出招点先连向下游融合点，巨型实体与主弹道使用该融合点；释放后冻结融合位置，避免人物收势将飞行中的技能拖回。攻击落在敌人躯干，治疗落在队友脚下，护盾包住友方，召唤走独立入场路线。
- 4.7 秒首次抵达目标后才播放可见 HP/盾变化，后续目标按 110 ms 错开。真实规则仍在确认释放时结算一次，动画只读取该次前后快照，不重复扣费/伤害。
- 展翼/显现用的程序线条在释放前收掉，避免与飞行实体叠成越界线框。手机先保留两人的出招，3.45 秒后再追随技能；右侧角色向内镜像，武器锚点一起变换。手动滚动停止跟随，重播恢复。
- 展示目标优先保留真正复活的队员、实际受益队员、新召唤物，而非只取目标数组前 3 人。圣垒/军势可同时保留攻击与受益路线；星泉不播攻击爆炸。
- 免费演练仍零道具/能量/次数/存档/随机流副作用，减少动态、查看结果、重播、Esc、退出清理和实战只续战一次保持不变。

## 六套动作与路线

| 配方 | 人物动作 | 路线 |
| --- | --- | --- |
| 炎羽天陨 | 双弓举弓 → 拉弦 → 放箭 → 收弓 | 弓口 → 凤凰融合点 → 敌人躯干 |
| 雷海龙裁 | 三叉戟回提/瞄准/突刺/回防；雷剑沉肩/举剑/下劈/收刃 | 戟尖与雷剑刃 → 水龙融合点 → 敌人躯干 |
| 熔日圣垒 | 炉火横剑/举刃/展掌/回防；圣骑举掌/推掌结盾/收势 | 武器与手掌 → 圣垒 → 敌方熔火裂纹、友方独立金盾 |
| 星泉复苏 | 双祭司聚杖/举掌/舒臂祝福/收杖 | 法杖晶核或祝福手掌 → 生命树 → 受益队友脚下莲阵 |
| 蚀月雷刃 | 刺客低伏/交叉双刃/突进斩/回旋；雷法横杖/抬杖/前刺/收杖 | 刀刃与法杖紫晶 → 蚀月 → 单个实际敌方目标 |
| 冥风军势 | 死灵聚魂/展臂开门/收掌；风术师聚风/推掌号令/归位 | 法杖或号令手掌 → 魂门 → 敌方军势突击、召唤物脚下入场 |

## 图片资产和生成约束

使用内置图像生成工具，以现有两位角色原图为身份/服饰/武器参考。每张实际交付 **1774×887、4 列×2 行、RGB PNG（无 alpha）**，每格逻辑尺寸 443.5×443.5。运行时按实际图片尺寸等比分格，不假定提示词中请求的 2048×1024 已实现。六张共 11.27 MB，必需玩法图片从 40 张增加到 46 张。

第一轮凤凰/雷海/圣垒请求透明背景，但得到烘焙棋盘的 RGB，未接入游戏；随后用同一图像工具改为暗色哑光底。凤凰、雷海、圣垒再做单格安全范围修订，星泉修正第三格多余手臂。最终图保留不透明深蓝背景，舞台按各张图安全角落的实际 RGB 中位数匹配，边缘以 CSS 柔化；人物使用正常混合，避免加色使黑色盔甲透明。没有把背景处理冒称真正 alpha。原始图均保留，项目只复制最终稿。

| 配方 | 最终接入图 | 原始生成文件 |
| --- | --- | --- |
| 炎羽天陨 | [cast-phoenix-actions-v4.png](../playable/assets/combos/cast-phoenix-actions-v4.png) | `C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-21671b9a-432a-4a89-bc4b-ceaba206453f.png` |
| 雷海龙裁 | [cast-leviathan-actions-v4.png](../playable/assets/combos/cast-leviathan-actions-v4.png) | `C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-1321563a-f6db-4344-896f-58cbf17811c1.png` |
| 熔日圣垒 | [cast-bastion-actions-v4.png](../playable/assets/combos/cast-bastion-actions-v4.png) | `C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-9beb9d67-c751-4b7d-8962-ff0642ff8436.png` |
| 星泉复苏 | [cast-spring-actions-v4.png](../playable/assets/combos/cast-spring-actions-v4.png) | `C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-acbe9cd6-e3fd-4b5b-8429-82297ee908f3.png` |
| 蚀月雷刃 | [cast-eclipse-actions-v4.png](../playable/assets/combos/cast-eclipse-actions-v4.png) | `C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-2495b768-aa82-451a-bac5-e4c413712bb9.png` |
| 冥风军势 | [cast-legion-actions-v4.png](../playable/assets/combos/cast-legion-actions-v4.png) | `C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-40c05b71-e145-4464-ad20-a9e57cae0c06.png` |

巨型技能仍使用 [v3 六阶段序列](COMBO_EPIC_V3.md) 和原局部命中图集，本次主要新增人物动作表并改实时运动，不用视频替代真实战斗。v3 的录像属于历史版本。

## 当前游戏实录

本轮录像为浏览器运行新版游戏的实际录屏，非 AI 视频模型生成；输出 1280×720 / 25 fps / 8.4 秒 / WebM VP8，无音轨。录制前解码新动作表，保留画面“演练 / 演示数值”标记。六套共9,894,527字节（约9.89MB），原 `v3.webm` 保留为历史记录。视频完成与播放结果见文末验证记录。

| 配方 | 当前游戏实录 |
| --- | --- |
| 炎羽天陨 | [观看 v4 实录](../playable/assets/combos/videos/ultimate-phoenix-v4.webm) |
| 雷海龙裁 | [观看 v4 实录](../playable/assets/combos/videos/ultimate-leviathan-v4.webm) |
| 熔日圣垒 | [观看 v4 实录](../playable/assets/combos/videos/ultimate-bastion-v4.webm) |
| 星泉复苏 | [观看 v4 实录](../playable/assets/combos/videos/ultimate-spring-v4.webm) |
| 蚀月雷刃 | [观看 v4 实录](../playable/assets/combos/videos/ultimate-eclipse-v4.webm) |
| 冥风军势 | [观看 v4 实录](../playable/assets/combos/videos/ultimate-legion-v4.webm) |

## 你可以这样验收

1. 强制刷新游戏（Ctrl + F5），城镇 → 编队 → 合击图鉴 → 任意配方“预览绝招 · 免费”；若系统减少动态已开启，点“完整演出”。
2. 先看炎羽：第一秒举弓，第二秒拉弦，3.2 秒后松弦/身体前倾。光从各自弓口汇到凤凰，再向敌人飞；目标 HP 不应在抵达前下降。
3. 再看雷海的戟刺/剑劈、蚀月的双刃突进/杖刺；星泉应是舒臂祝福和队友脚下生命阵，不是朝队友发攻击弹。圣垒应区分敌方火裂与友方金盾，军勢应看到魂门和召唤入场。
4. 缩到手机宽度：双人先同屏出招，再跟随技能；右侧人物向中间，光仍贴着武器。试手动上下滑动、重播、提前查看结果、关闭/Esc，按钮应一直能操作。
5. 回到补给工坊确认免费预览未消费。实战按 [通用合击步骤](COMBO_ULTIMATES.md#再检查真实战斗) 满足指定主战、60/40 能量及铺垫后释放，正向/反向主导各试一次：画面人物身份与武器不换错、道具只扣 1 件、显示真实目标结果、自然结束或跳过仅恢复一次战斗。

## 可复现检查

先在单独终端运行 `node tests/playable/server.js`，以下脚本使用独立非持久浏览器上下文，不读取或改写用户实际浏览器存档。

- 规则与准备：`npx playwright test tests/playable/spirit-codex-combos.spec.js tests/playable/spirit-codex-preparation.spec.js --workers=2`
- 动作与几何：`npx playwright test tests/playable/spirit-codex-combo-actions.spec.js tests/playable/spirit-codex-combo-motion.spec.js --workers=2`
- 静帧复核：`node tests/playable/combo-motion-visual-qa.cjs`；可加 `--only=phoenix` 或 `--file`。输出系统临时目录 `spirit-codex-actions-v4-qa`，含 3.35 秒释放姿态。
- 实时录制：`node tests/playable/ultimate-video-capture.cjs`（可加 `--only=phoenix,spring`），输出项目 `playable/assets/combos/videos/ultimate-*-v4.webm`；抽帧目录为系统临时目录 `spirit-codex-ultimate-video-v4-qa`。只删除脚本本次唯一创建的临时原始录制目录，不删除历史素材。
- 视频只读验证：`node tests/playable/ultimate-video-playback-check.cjs`。

## 完整提示词与参考来源

以下逐条保留传入图像工具的实际提示词。生成工具未暴露可独立指定的模型参数，因此记录为内置图像生成，不虚构视频生成模型或透明通道。

### 炎羽天陨：动作表初稿

参考图（顺序为上行、下行）：

- `E:/myProject/SpiritCodex/playable/assets/characters/char-h1-fire-ranger.png`
- `E:/myProject/SpiritCodex/playable/assets/characters/char-a1-wind-ranger.png`

```text
Use case: stylized-concept.
Asset type: production-ready 2D game CHARACTER ACTION sprite sheet for Spirit Codex, to replace idle portraits during a cooperative ultimate.
Input images: Image 1 is the identity/costume/weapon reference for TOP ROW character; Image 2 is the identity/costume/weapon reference for BOTTOM ROW character. Preserve each identity, face, hair, outfit, weapon and original premium painted anime fantasy art style; CHANGE THEIR BODY POSES as specified.
Output composition: exactly 2048x1024 landscape PNG, STRICT uniform FOUR COLUMNS and TWO ROWS, eight equal square cells of 512x512, no drawn separators. One SINGLE full-body character per cell. Rows are the same character across four different actions. Transparent background with genuine alpha, NOT a baked checkerboard, black rectangle, environment or floor. Entire body, hair, feet, hands and complete weapon in every cell, 7% empty safety margin; identical camera, baseline near 91% cell height, consistent adult proportions and scale. Three-quarter side-on stance facing SCREEN RIGHT in ALL cells because combat travels to the right. Face still recognizably the reference. Four clearly DISTINCT joint poses, not a repeated portrait with effects.
Columns left to right: 0 ANTICIPATION / wind-up; 1 FOCUS / channel/aim; 2 RELEASE / committed forward action; 3 RECOVERY / return-to-guard. Hands actually grip weapons, knees/shoulders/elbows alter as action progresses. Sparse tiny element glow only exactly at weapon tip or channeling palm, keep silhouettes unoccluded. No large magic circle, no projectile crossing a cell, no targets, no UI, no text, no numbers, no watermark, no contact sheet decoration. No duplicate/ghost figures, no more than two arms or two legs, do not crop.
TOP ROW: the red long-ponytail fire female archer in black/red brass-trim armor from Image1. Col0 braces her feet and raises her flame bow, col1 pulls a real burning arrow to the cheek with elbow back and bow arm extended right, col2 forcefully releases to the right with bow-hand still forward, recoil in string arm and ponytail streaming left, col3 lowers bow diagonally right and settles back into guard. BOTTOM ROW: mint-haired white/teal feather-armored wind female archer from Image2. Col0 steps into a low archery stance, col1 draws her ivory feather bow fully toward screen right, col2 releases wind arrow with a visible change in shoulder/elbow and a small green flash at arrow rest, col3 eases bow downward with flowing cape. Bow/arrow emitting point in aiming/release frames is on the RIGHT of each character. Both archers remain visibly different people.
```

### 雷海龙裁：动作表初稿

参考图（顺序为上行、下行）：

- `E:/myProject/SpiritCodex/playable/assets/characters/char-w2-tide-warden.png`
- `E:/myProject/SpiritCodex/playable/assets/characters/char-t1-thunder-warrior.png`

```text
Use case: stylized-concept.
Asset type: production-ready 2D game CHARACTER ACTION sprite sheet for Spirit Codex, to replace idle portraits during a cooperative ultimate.
Input images: Image 1 is the identity/costume/weapon reference for TOP ROW character; Image 2 is the identity/costume/weapon reference for BOTTOM ROW character. Preserve each identity, face, hair, outfit, weapon and original premium painted anime fantasy art style; CHANGE THEIR BODY POSES as specified.
Output composition: exactly 2048x1024 landscape PNG, STRICT uniform FOUR COLUMNS and TWO ROWS, eight equal square cells of 512x512, no drawn separators. One SINGLE full-body character per cell. Rows are the same character across four different actions. Transparent background with genuine alpha, NOT a baked checkerboard, black rectangle, environment or floor. Entire body, hair, feet, hands and complete weapon in every cell, 7% empty safety margin; identical camera, baseline near 91% cell height, consistent adult proportions and scale. Three-quarter side-on stance facing SCREEN RIGHT in ALL cells because combat travels to the right. Face still recognizably the reference. Four clearly DISTINCT joint poses, not a repeated portrait with effects.
Columns left to right: 0 ANTICIPATION / wind-up; 1 FOCUS / channel/aim; 2 RELEASE / committed forward action; 3 RECOVERY / return-to-guard. Hands actually grip weapons, knees/shoulders/elbows alter as action progresses. Sparse tiny element glow only exactly at weapon tip or channeling palm, keep silhouettes unoccluded. No large magic circle, no projectile crossing a cell, no targets, no UI, no text, no numbers, no watermark, no contact sheet decoration. No duplicate/ghost figures, no more than two arms or two legs, do not crop.
TOP ROW: mature dark-haired bearded navy/brass armored tide warden from Image1, with his cyan TRIDENT. Col0 stands low and pulls trident back diagonally, col1 turns torso and aims trident forward-right, col2 lunges one stride and thrusts the trident straight to screen right, col3 draws trident back to upright guard. Keep weapon tip inside cell. BOTTOM ROW: spiky black/purple-haired muscular black/brass lightning knight from Image2 with huge dark greatsword with golden lightning seam. Col0 crouches and brings blade back, col1 raises blade high diagonally in a charged two-handed stance, col2 swings a strong down-forward diagonal slash to the right, knees and torso committed forward, col3 plants stance with sword lowered after the follow-through. Small cyan light at trident prongs, violet/gold light on sword edge only. Clear physical weapon actions.
```

### 熔日圣垒：动作表初稿

参考图（顺序为上行、下行）：

- `E:/myProject/SpiritCodex/playable/assets/characters/char-h2-fire-guardian.png`
- `E:/myProject/SpiritCodex/playable/assets/characters/char-l2-light-paladin.png`

```text
Use case: stylized-concept.
Asset type: production-ready 2D game CHARACTER ACTION sprite sheet for Spirit Codex, to replace idle portraits during a cooperative ultimate.
Input images: Image 1 is the identity/costume/weapon reference for TOP ROW character; Image 2 is the identity/costume/weapon reference for BOTTOM ROW character. Preserve each identity, face, hair, outfit, weapon and original premium painted anime fantasy art style; CHANGE THEIR BODY POSES as specified.
Output composition: exactly 2048x1024 landscape PNG, STRICT uniform FOUR COLUMNS and TWO ROWS, eight equal square cells of 512x512, no drawn separators. One SINGLE full-body character per cell. Rows are the same character across four different actions. Transparent background with genuine alpha, NOT a baked checkerboard, black rectangle, environment or floor. Entire body, hair, feet, hands and complete weapon in every cell, 7% empty safety margin; identical camera, baseline near 91% cell height, consistent adult proportions and scale. Three-quarter side-on stance facing SCREEN RIGHT in ALL cells because combat travels to the right. Face still recognizably the reference. Four clearly DISTINCT joint poses, not a repeated portrait with effects.
Columns left to right: 0 ANTICIPATION / wind-up; 1 FOCUS / channel/aim; 2 RELEASE / committed forward action; 3 RECOVERY / return-to-guard. Hands actually grip weapons, knees/shoulders/elbows alter as action progresses. Sparse tiny element glow only exactly at weapon tip or channeling palm, keep silhouettes unoccluded. No large magic circle, no projectile crossing a cell, no targets, no UI, no text, no numbers, no watermark, no contact sheet decoration. No duplicate/ghost figures, no more than two arms or two legs, do not crop.
TOP ROW: orange flaming short-haired/bearded furnace guardian in dark brass heavy armor with orange furnace chest and molten greatsword from Image1. Col0 braces legs and grips sword two-handed near hip, col1 raises sword diagonally right gathering furnace heat, col2 plants sword downward-forward and leans into an immovable guarding stance with one free gauntlet extended RIGHT, col3 recovers sword toward shoulder-high guard. BOTTOM ROW: silver short-haired white/gold paladin with sun emblem and luminous sword from Image2. Col0 settles feet and holds sword close, col1 raises open free palm right at shoulder level while guarding with sword, col2 steps forward firmly and pushes that open palm farther RIGHT to project a holy barrier (only tiny gold palm glow, do not draw barrier), col3 holds protective guard with arm relaxed. Preserve original equipment, do not add a physical shield. Actions must read planted defense and directed projection, not sword attacks toward ally.
```

### 星泉复苏：动作表初稿

参考图（顺序为上行、下行）：

- `E:/myProject/SpiritCodex/playable/assets/characters/char-w1-water-healer.png`
- `E:/myProject/SpiritCodex/playable/assets/characters/char-l1-light-priestess.png`

```text
Use case: stylized-concept.
Asset type: production-ready 2D game CHARACTER ACTION sprite sheet for Spirit Codex, to replace idle portraits during a cooperative ultimate.
Input images: Image 1 is the identity/costume/weapon reference for TOP ROW character; Image 2 is the identity/costume/weapon reference for BOTTOM ROW character. Preserve each identity, face, hair, outfit, weapon and original premium painted anime fantasy art style; CHANGE THEIR BODY POSES as specified.
Output composition: exactly 2048x1024 landscape PNG, STRICT uniform FOUR COLUMNS and TWO ROWS, eight equal square cells of 512x512, no drawn separators. One SINGLE full-body character per cell. Rows are the same character across four different actions. OPAQUE perfectly uniform deep navy #0b1118 background in all cells, matching the game's dark battle arena. NO checkerboard, NO transparency simulation, NO scenery, no gradient, no shadows outside silhouettes. Entire body, hair, feet, hands and complete weapon in every cell, 7% empty safety margin; identical camera, baseline near 91% cell height, consistent adult proportions and scale. Three-quarter side-on stance facing SCREEN RIGHT in ALL cells because combat travels to the right. Face still recognizably the reference. Four clearly DISTINCT joint poses, not a repeated portrait with effects.
Columns left to right: 0 ANTICIPATION / wind-up; 1 FOCUS / channel/aim; 2 RELEASE / committed forward action; 3 RECOVERY / return-to-guard. Hands actually grip weapons, knees/shoulders/elbows alter as action progresses. Sparse tiny element glow only exactly at weapon tip or channeling palm, keep silhouettes unoccluded. No large magic circle, no projectile crossing a cell, no targets, no UI, no text, no numbers, no watermark, no contact sheet decoration. No duplicate/ghost figures, no more than two arms or two legs, do not crop.
TOP ROW: long ice-blue-haired water priestess in blue/white robes and spiked gold halo with cyan crystal ring staff from Image1. Col0 lowers center of gravity and cups free hand inward, col1 raises staff crystal above shoulder-right with focused eyes and free hand lifted, col2 extends open palm forward RIGHT and opens shoulders to bless allies while staff angles forward, col3 softly lowers staff and closes supporting palm. BOTTOM ROW: long golden-haired white/gold holy priestess and star-ring golden crystal staff from Image2. Col0 bows head slightly holding staff close, col1 lifts staff and free palm in prayer, col2 opens arm/palm screen RIGHT in a pronounced blessing gesture with robe/sleeve extending, col3 returns upright to calm protective stance. Both are grounded, feet visible, gentle healer body language not attacking. Tiny cyan/gold light at the extended palm or staff crystal, no giant flowers/trees in sheet.
```

### 蚀月雷刃：动作表初稿

参考图（顺序为上行、下行）：

- `E:/myProject/SpiritCodex/playable/assets/characters/char-d1-shadow-assassin.png`
- `E:/myProject/SpiritCodex/playable/assets/characters/char-t2-thunder-mage.png`

```text
Use case: stylized-concept.
Asset type: production-ready 2D game CHARACTER ACTION sprite sheet for Spirit Codex, to replace idle portraits during a cooperative ultimate.
Input images: Image 1 is the identity/costume/weapon reference for TOP ROW character; Image 2 is the identity/costume/weapon reference for BOTTOM ROW character. Preserve each identity, face, hair, outfit, weapon and original premium painted anime fantasy art style; CHANGE THEIR BODY POSES as specified.
Output composition: exactly 2048x1024 landscape PNG, STRICT uniform FOUR COLUMNS and TWO ROWS, eight equal square cells of 512x512, no drawn separators. One SINGLE full-body character per cell. Rows are the same character across four different actions. OPAQUE perfectly uniform deep navy #0b1118 background in all cells, matching the game's dark battle arena. NO checkerboard, NO transparency simulation, NO scenery, no gradient, no shadows outside silhouettes. Entire body, hair, feet, hands and complete weapon in every cell, 7% empty safety margin; identical camera, baseline near 91% cell height, consistent adult proportions and scale. Three-quarter side-on stance facing SCREEN RIGHT in ALL cells because combat travels to the right. Face still recognizably the reference. Four clearly DISTINCT joint poses, not a repeated portrait with effects.
Columns left to right: 0 ANTICIPATION / wind-up; 1 FOCUS / channel/aim; 2 RELEASE / committed forward action; 3 RECOVERY / return-to-guard. Hands actually grip weapons, knees/shoulders/elbows alter as action progresses. Sparse tiny element glow only exactly at weapon tip or channeling palm, keep silhouettes unoccluded. No large magic circle, no projectile crossing a cell, no targets, no UI, no text, no numbers, no watermark, no contact sheet decoration. No duplicate/ghost figures, no more than two arms or two legs, do not crop.
TOP ROW: dark long-haired purple/black leather female assassin with two curved shadow daggers from Image1. Col0 drops into crouched coil with daggers drawn back, col1 crosses the two blades in front chest pointed right, col2 lunges forward-right and opens arms into a committed crossed dual-dagger slash (blades and hands fully within cell), col3 returns low guard with daggers apart and cloak flowing back. BOTTOM ROW: pale long silver-haired purple/black lightning mage with short white skirt, star hairpin and purple crystal-ring staff from Image2. Col0 braces holding staff by hip, col1 raises the purple orb to shoulder-right aiming, col2 plants forward foot and thrusts her staff head toward RIGHT to release lightning, col3 withdraws staff to upright guard. Preserve distinct long hair and all outfits; no giant moon, no standalone slashes, no targets, only small purple highlight at blade tips/orb.
```

### 冥风军势：动作表初稿

参考图（顺序为上行、下行）：

- `E:/myProject/SpiritCodex/playable/assets/characters/char-d2-necromancer.png`
- `E:/myProject/SpiritCodex/playable/assets/characters/char-a2-wind-alchemist.png`

```text
Use case: stylized-concept.
Asset type: production-ready 2D game CHARACTER ACTION sprite sheet for Spirit Codex, to replace idle portraits during a cooperative ultimate.
Input images: Image 1 is the identity/costume/weapon reference for TOP ROW character; Image 2 is the identity/costume/weapon reference for BOTTOM ROW character. Preserve each identity, face, hair, outfit, weapon and original premium painted anime fantasy art style; CHANGE THEIR BODY POSES as specified.
Output composition: exactly 2048x1024 landscape PNG, STRICT uniform FOUR COLUMNS and TWO ROWS, eight equal square cells of 512x512, no drawn separators. One SINGLE full-body character per cell. Rows are the same character across four different actions. OPAQUE perfectly uniform deep navy #0b1118 background in all cells, matching the game's dark battle arena. NO checkerboard, NO transparency simulation, NO scenery, no gradient, no shadows outside silhouettes. Entire body, hair, feet, hands and complete weapon in every cell, 7% empty safety margin; identical camera, baseline near 91% cell height, consistent adult proportions and scale. Three-quarter side-on stance facing SCREEN RIGHT in ALL cells because combat travels to the right. Face still recognizably the reference. Four clearly DISTINCT joint poses, not a repeated portrait with effects.
Columns left to right: 0 ANTICIPATION / wind-up; 1 FOCUS / channel/aim; 2 RELEASE / committed forward action; 3 RECOVERY / return-to-guard. Hands actually grip weapons, knees/shoulders/elbows alter as action progresses. Sparse tiny element glow only exactly at weapon tip or channeling palm, keep silhouettes unoccluded. No large magic circle, no projectile crossing a cell, no targets, no UI, no text, no numbers, no watermark, no contact sheet decoration. No duplicate/ghost figures, no more than two arms or two legs, do not crop.
TOP ROW: pale severe older-looking necromancer with long black hair and white streak, skeletal brass-trim black robe and purple orb staff from Image1. Col0 leans slightly over staff with free palm curled close to body, col1 lifts commanding free palm facing RIGHT while purple staff glows small, col2 firmly extends arm and spreads fingers forward-right to OPEN a soul gate (do not draw gate), col3 retracts to controlling stance with staff held steady. BOTTOM ROW: elderly white-haired/bearded wind alchemist in cream/teal/gold robes and green orb staff from Image2. Col0 braces staff and draws free hand in, col1 raises staff head diagonally right and coils free hand, col2 sweeps free arm outward RIGHT to send a sustained wind current while leaning forward slightly, col3 settles back with lowered palm. Preserve age, face and costume. Tiny violet/green glow only at outward palm/staff orb; no summoned minions, no gate in cells.
```

### 凤凰 / 雷海 / 圣垒：替换烘焙棋盘

```text
Use case: precise-object-edit. Input image is the edit target: an eight-frame 4-column by 2-row character action sheet. CHANGE ONLY the baked white/gray checkerboard background: replace every checkerboard/white/gray backdrop pixel with perfectly UNIFORM flat deep navy #0b1118. OPAQUE matte background is intentional. No transparency simulation, no checkerboard, no gradients, no scenery, no shadows outside character silhouette. Preserve all eight characters and exact existing poses, faces, identity, costumes, weapons, tiny elemental glow, scale, placement and grid coordinates. Preserve the exact wide 2:1 canvas and four equal square cells per row, two rows. Do not add/delete/rearrange frames. No letters or labels. All figure and weapon pixels remain, no redrawing the pose. The result will be composited normally against a matching deep navy game arena.
```

### 凤凰 / 雷海 / 圣垒：单格安全范围修订

```text
Use case: precise-object-edit. Edit target is this eight-pose character animation sprite sheet. Fix ONLY animation-cell safety and stray effects. Preserve the same two character identities, exact outfits and four corresponding poses per row, keep flat deep navy #0b1118 background. REPACK each full character AND its complete weapon inside its OWN strict equal square cell in a 4-column by 2-row grid on the same 2:1 canvas. Reduce each full character+weapon to 78% of its previous scale around its cell center, align feet to 86% of that row's height. Every pixel of every weapon/arrow, hair, cloak and toes must be at least 8% away from that cell's four edges; absolutely NO crossing between neighboring cells. Remove any flying projectile/arrow already leaving a weapon; keep bow and bowstring plus nocked arrow only where physically held, and a tiny pinpoint glow at release weapon/hand. No new magic effects, no text, no gridlines, no extra limbs. Maintain four distinct poses in same order. This is layout safety for exact runtime rectangular sprite cropping, not a new illustration. Keep exactly 4 columns × 2 rows; no portraits or background scenery.
```

### 星泉：第三格解剖修正

```text
Use case: precise-object-edit. Edit target is this 4-column 2-row eight-frame sprite sheet. Change ONLY the TOP ROW THIRD CELL blue-haired water healer RELEASE pose: it currently has an extra arm/hand. Give her exactly TWO ARMS and TWO HANDS. Her LEFT hand is lowered on the LEFT side of her body gripping her single cyan-ring staff shaft, staff crystal above-left of her head. Her RIGHT arm is extended toward screen RIGHT with one glowing open palm to cast a healing blessing. Remove the extra forward arm/hand holding the staff near the upper-right; reposition that one staff with her lowered left hand instead. Preserve the same face, ice-blue hair, blue-white gown, halo and grounded stance. Keep all seven other cells pixel-composition unchanged. Keep strict4x2 arrangement, exact wide2:1 canvas, uniform #0b1118 background, all limbs/weapon inside each cell with safe margin. No other edits, no text, no extra magic circles.
```

## 本轮验证记录

- 本轮四视口 **140 个独立定向案例全部通过**：合击规则与准备界面84项（5.5分钟）＋最终动作/几何/素材/生命周期56项（2.4分钟）。早期重复跑的案例不累加，本轮未重跑历史全游戏296项基线。
- 六张动作表48个cell的实际解码、逐帧差异像素、48处武器/掌心锚点附近非空像素、无拉伸、反向主导角色身份、手机镜像均通过。几何测试独立拦截真实Canvas绘制及变换，核对武器→融合→每个目标的轨迹端点，不只比较同一份debug数据。
- 4.69秒目标HUD仍为前值，命中后变化；攻击/治疗/盾/召唤按对象分路。验证了第四位倒下队友被真正展示、补召唤/既有召唤强化、跨断点resize与手动滚动对齐。
- 46张必需图片加载、免费预览零副作用、跳过/重播/减少动态/取消、实战只消费及续战一次的回归均通过。相关游戏与测试JavaScript语法检查通过；相关已跟踪文件diff空白检查通过，未改Unity和无关脏文件。
- 主代理及视觉代理实际查看六组桌面/手机动作与命中截图；暗底匹配后另检查凤凰。直接打开本地HTML（file协议）另完成桌面/360屏凤凰四姿态、全程及实际施放检查：无pageerror、无横向溢出，实际HP快照正确、消耗1枚。
- 六段最终v4录像真实完成全部六阶段，8.4秒/1280×720，预览前后存档/资源快照一致；另完成浏览器播放 **6/6通过**，0媒体错误。观看抽帧包含3.35秒释放姿态与结果；视频检查与140项游戏案例分开计数。
