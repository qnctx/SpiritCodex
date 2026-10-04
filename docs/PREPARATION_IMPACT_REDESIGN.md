# 准备界面与完整命中预览重设计

日期：2026-09-05。按照“先生成设计图，再实施”的顺序完成。生成方式：内置 imagegen 原生图像工具（用户称 Image 2），没有调用外部模型服务。下方原始提示词保存实际调用内容。

## 保存资产与接入

| 文件 | 用途 |
| --- | --- |
| `playable/assets/references/ref-preparation-v2.png` | 准备页视觉参考：四页导航、清楚的中文无衬线字体、哑光背景与分层信息。参考图示例人物和规则没有抄入游戏。 |
| `playable/assets/references/ref-combo-impact-storyboard.png` | 蓄力→命中→结果分镜参考；实际游戏由独立角色、目标、弹道、冲击与血条驱动，不以分镜幻灯片代替动态。 |
| `playable/assets/combos/combo-impact-atlas-v2.png` | 实际运行图片：1536×1024、3列2行，黑底发光图集，用 screen / additive 叠加。不是透明PNG。 |

图集顺序：炎羽、雷海、圣垒 / 星泉、蚀月、冥风。各格512×512。第一版生成未获得可用透明背景，因此用同一工具进行单一背景修改，得到适合加色合成的黑底版本；保留所有原图，不用脚本改绘图片。

## 实施约束

- 准备仍使用原有阵容、配置和库存：编队、合击图鉴、远征设置、补给工坊四页互斥显示，切页不修改存档。
- 字体改为清楚的系统中文无衬线，正文和交互文案至少14px；配方条件可展开，不把六套长规则、契约和补给全部堆在编队页。
- 演练使用明确标注的独立示例数值，不要求上阵、不消耗库存、能量、次数，不使用战斗随机流。
- 实战命中演出读取同次执行的真实前后快照；数值仍在确认施放时原子结算，不由动画重新结算。
- 标准演出约3.2秒：蓄力→施放→命中→结果。免费演练停在结果，支持重播、关闭和Esc。减少动态保留静态前后对比。

## 原始提示词

### preparation-layout-v2

参考输入：C:/Users/HUAWEI/AppData/Local/Temp/codex-clipboard-da10c573-55c1-4c16-82f1-7d8cac37d9b3.png

```text
Use case: ui-mockup
Asset type: production-ready Chinese fantasy RPG preparation screen redesign reference, 1536x1024 landscape.
Input image: reference only showing the existing Spirit Codex game and its readability problems, NOT an edit target to preserve.
Primary request: redesign this cluttered tiny-text screen into an elegant, calm, highly readable playable game interface. Keep restrained indigo-black alchemical fantasy identity and antique brass accents, but REMOVE busy ornamental backgrounds behind text, glowing text, excessive gold outlines, and tiny Latin kickers. Use modern clean Chinese sans-serif typography similar to Microsoft YaHei UI or Noto Sans SC. Body visually 16px equivalent, section titles 24px, normal spacing, high contrast ivory text, cool gray secondary text, broad breathing room.
Composition: a real shippable desktop screen with top title "远征准备", a compact back button "返回城镇", four clear horizontal navigation tabs exactly "编队" "合击图鉴" "远征设置" "补给工坊". Only "编队" is active; no advanced settings or inventory crafting grid is open. Main center area a clean team board, four generous hero portrait cards in 2 front/2 back slots with distinct fantasy heroes and large names, and two quieter reserve slots. Left main section title "主战阵容", small concise line "先选槽位，再选择角色". Right slim summary panel titled "本次远征" containing only 3 short summary lines: "标准难度", "稳健策略", "未启用契约", and a secondary button "调整远征". Below team board show a compact four-option formation switch with labels "坚壁" "疾风" "炼成" "召灵" and ONLY selected formation explanation. Bottom has a clean strip "可用合击" with two compact pair suggestions, not all 6 detailed recipes. Prominent bottom-right orange-gold button "开始远征". No long paragraphs. No fake stats charts. All Chinese text crisp and readable. Match the project's fantasy character art spirit but prioritize readable UI. No watermark, no device frame.
```

### impact-storyboard-v2

参考输入：无（新生成）

```text
Use case: ui-mockup
Asset type: 3-panel cinematic storyboard and functional game preview design reference, 1536x1024 landscape.
Primary request: design a COMPLETE phoenix elemental combo preview for an existing Chinese dark alchemical fantasy RPG, with visibly meaningful target impact instead of decorative pictures. Divide the image into three equally wide left-to-right panels labeled in large modern clean Chinese sans-serif exactly "蓄力" "命中" "结果". Each panel shows the same training arena from the same camera, two heroes at left (fire female archer and green wind female archer), and an armored magical training sentinel clearly at right. Dark calm indigo stone arena, restrained brass geometry, no busy text background.
Left panel: the two heroes gather orange fire and green wind into a small phoenix, clear direction toward the right-hand sentinel.
Middle panel: phoenix projectile physically strikes the sentinel's torso, a localized fiery wing-shaped explosion with green streaks centered on the contact point, sentinel recoils backward, a few floating damage marks, not a full-screen poster hiding the target. Ground dust and a shockwave anchor the hit. No blood/gore.
Right panel: target still visible with lowered training HP bar, lingering embers fade, a clear simple result box labeled "演示命中" and "不消耗道具". A bottom playback control row shows buttons "重播" and "关闭". Large readable Chinese, no calligraphy, no glittery text. A single top-level title "合击演练". Health bar values and damage are illustrative and explicitly a demonstration, not actual player combat. Ensure all three panels have strong spatial continuity and directional action. Main lesson is CAST -> CONTACT -> RECOIL/HP RESPONSE, implemented later as real layers, not a slideshow. No watermark.
```

### impact-atlas-v2

参考输入：无（新生成）

```text
Use case: stylized-concept
Asset type: production game VFX sprite atlas with SIX impact bursts, one per combo type. 1536x1024 landscape, strict 3 columns x 2 rows equal tiles. All effects centered inside each tile with large empty gutters, no effect crosses its tile edge.
Primary request: polished painted magical CONTACT IMPACT sprites for an indigo/brass alchemical fantasy RPG, usable as six separate cropped regions in CSS/Canvas without further image editing. Effects only, no characters, no scene, NO text, NO labels, NO borders, NO UI. Truly transparent background with real alpha, not a checkerboard.
Tile order left to right then next row:
top-left orange fire + emerald wind phoenix-feather burst with a bright compact impact core and trailing feather shards;
top-middle cyan water + blue-violet lightning splash impact, sharp electrified droplets around a compact core;
top-right amber molten fire + pale gold holy shield-contact flare, hexagonal shards and a circular protective pulse;
bottom-left mint water + ivory starlight healing bloom, delicate lotus petals and restorative sparks around a compact center;
bottom-middle violet shadow + electric lavender cross-slash impact, two curved luminous blades crossing at a bright core;
bottom-right ghost-teal and smoky violet spectral army impact, soul fragments and lance-shaped streaks radiating outward.
Consistent painterly premium VFX quality, each contact burst circular-ish within its square-ish tile, luminous but controlled bloom, fine readable edges, high contrast, generous transparent space all around. The six silhouettes must be visibly different. No background color, no typography, no watermark. Exact evenly spaced 3x2 grid.
```

### impact-atlas-v2 / 背景单项修改

参考输入：第一版六格命中图集 `exec-6e09feb6-4318-488c-aff2-0ee2a9bb7412.png`。

```text
Use case: precise-object-edit. Edit target: supplied six-cell VFX impact sprite atlas. Preserve all six impact effect subjects, their exact positions and 3-column 2-row equal grid, shapes, hues, detail and composition. Change ONLY the background: remove the entire colored ambient gradient background and replace it with absolute pure black RGB 0,0,0, including gutters and all negative space between sparks. Each impact should be an isolated bright emission sprite on black, for additive/screen compositing in a game. Remove diffuse colored rectangular haze and any non-black backdrop; keep the luminous actual petals, lightning, shards, skulls and localized glow attached to each burst. Keep generous solid black margins within each tile. No text, no borders, no new objects. Output 1536x1024.
```

最终原图：`C:/Users/HUAWEI/.codex/generated_images/01a06cd1-2d57-74c2-a3d3-c4b7652e73de/exec-5cba633a-e458-4294-9de7-e7d4571c3503.png`。

## 测试入口

操作步骤与本次验证结果统一维护在 [角色合击大招](COMBO_ULTIMATES.md#试玩验收)。
