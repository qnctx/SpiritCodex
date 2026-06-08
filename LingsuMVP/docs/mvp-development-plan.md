# LingsuMVP 开发计划

这个文档用来记录当前 MVP 的实际开发路线。这里不写泛泛的大规划，只写可以拆开实现、可以单独测试的小切片。

## 产品方向

SpiritCodex 的长期方向是移动端策略角色养成游戏。

当前 `LingsuMVP` 只是原型沙盒，用来验证核心系统，不是正式产品工程。

当前优先级：

```text
先验证玩法，再做精修。
```

## 当前基线：v0.1

状态：已经可以在编辑器和 Windows 测试构建中运行。

已验证：

- 运行时自动搭建场景可用。
- Hero 和小怪可以显示。
- 自动战斗扣血循环可用。
- 小怪死亡后可以增加材料数量。
- Victory 状态可以出现。
- Defeat 状态可以出现。
- 导入的 Hero 和 Monster 图片可以显示。

已知缺口：

- 攻击过程不可见。
- 血量变化不够直观。
- Victory/Defeat 按钮还不能稳定点击。
- 进化目前临时放在战斗里，只是为了验证材料循环。
- 还没有移动端 UI 结构。
- 还没有技能系统。
- 还没有队伍站位系统。

## 设计决定：血条位置

v0.2 先做角色头顶血条。

原因：

- 当前战场有多个单位。
- 玩家需要知道哪个小怪正在被攻击。
- 对小型战斗原型来说，头顶血条最直观。

后续扩展：

- 有 Boss 战后，再加屏幕顶部 Boss 大血条。
- 有队伍系统后，再加队伍状态 UI。

## 设计决定：攻击反馈

v0.2 不需要新增美术资源。

先用代码做临时反馈：

- Hero 攻击时轻微前冲。
- 小怪攻击时轻微前冲。
- 简单弹道或斩击闪光。
- 被命中目标闪白或闪红。
- 命中位置出现伤害数字。
- 死亡单位淡出或缩小。

后续正式方案：

- 序列帧动画。
- Spine 或 Live2D 风格动画。
- 每个元素对应粒子特效。
- 正式技能 VFX 资源。

## 设计决定：进化

长期设计里，进化不应该是战斗地图里的按钮。

更合理的流程：

```text
战斗
  -> 结算奖励
  -> 回城 / 角色界面
  -> 升级或进化
  -> 进入下一场战斗
```

v0.2 处理方式：

- 隐藏或移除战斗界面的 `Evolve` 按钮。
- 暂时保留 `EvolutionUI.cs` 作为系统逻辑。
- 暂时不做完整城镇和进化界面。

## v0.2 战斗表现原型

状态：已完成。

目标：

```text
让当前自动战斗变得可读、可测、像一场真正的战斗。
```

### 任务 1：修复 UI 点击

状态：已验证，使用临时 IMGUI 点击处理。

问题：

- Victory/Defeat 面板可以出现，但按钮不能稳定点击。

可能原因：

- 之前为了绕开输入报错，运行时移除了 EventSystem。
- UI 按钮需要可用的 EventSystem 才能点击。

实现目标：

- 运行时创建稳定的 EventSystem。
- 暂时不使用会触发旧输入报错的 UGUI 输入模块。
- 曾使用 `GameManager.OnGUI()` 提供 Victory/Defeat 重开按钮，后续已改为结果面板内按钮。
- 隐藏原结果面板内的 UGUI 按钮，避免和临时按钮重叠。
- 确保 `Play Again` 和 `Restart` 可以点击。

验收标准：

1. 进入 Play Mode。
2. 触发 Victory。
3. 点击 `Play Again`。
4. 战斗可以重开。
5. 触发 Defeat。
6. 点击 `Restart`。
7. 战斗可以重开。
8. Console 没有红色报错。

### 任务 2：隐藏战斗进化按钮

状态：已验证。

问题：

- 战斗地图进化不是长期设计目标。

实现目标：

- 隐藏战斗中的 `Evolve` 按钮。
- 暂时保留材料数量显示。
- 除非影响测试，否则不改进化逻辑。

验收标准：

1. 进入 Play Mode。
2. 战斗区域看不到 `Evolve` 按钮。
3. 小怪死亡后材料数量仍然更新。
4. Victory/Defeat 仍然正常。

### 任务 3：头顶血条

状态：已验证。

实现目标：

- Hero 头顶显示血条。
- 每个小怪头顶显示血条。
- 血条跟随单位位置。
- 单位受伤后血条立即更新。

验收标准：

1. 进入 Play Mode。
2. Hero 头顶有血条。
3. 每个小怪头顶有血条。
4. 单位受伤时，对应血条减少。
5. 小怪死亡后，对应血条消失。

### 任务 4：普通攻击反馈

状态：已验证。

实现目标：

- Hero 普攻有可见反馈。
- 小怪攻击 Hero 有可见反馈。
- 目标被命中时短暂闪烁。
- 命中时出现伤害数字。

验收标准：

1. 进入 Play Mode。
2. Hero 攻击当前小怪。
3. 可以看到弹道、斩击或闪光。
4. 小怪被命中时闪烁。
5. 出现伤害数字。
6. 小怪攻击 Hero 时也有可见反馈。

### 任务 5：死亡反馈

状态：已验证。

实现目标：

- 小怪死亡时淡出、缩小或闪烁后消失。
- Hero 死亡时有明确反馈，再出现 Defeat 面板。

验收标准：

1. 击杀一个小怪。
2. 小怪不是无反馈瞬间消失。
3. 清空敌人。
4. Victory 可以正常出现。
5. 强制 Hero 死亡。
6. Defeat 可以正常出现。

## v0.3 移动端战斗 UI 原型

状态：已完成。

目标：

```text
开始把战斗界面往手机交互方向推进。
```

计划功能：

- 竖屏友好的 Canvas 布局。
- 底部技能按钮区域。（已实现占位）
- `Skill 1` 临时点击热区：火焰箭，造成 2 倍 Hero ATK 伤害，4 秒冷却。（已实现，待验证）
- `Skill 2` 临时点击热区：燃烧标记，造成低伤害，并附加 3 次燃烧 DOT，5 秒冷却。（已验证）
- 技能冷却显示。
- 点击选择目标，并用黄色标记显示当前目标。（已实现，待验证）
- 能量条和 `Ult`：战斗中积攒能量，满能量后释放一次群体伤害。（已验证）
- 临时技能按钮图标。
- 底部技能按钮布局优化：按钮稍微加宽，`Skill 1` 简写为 `S1`，能量条和按钮视觉层对齐。（已验证）
- 视觉清晰度修复：关闭角色图片压缩，新增自动导入规则，加入临时战斗地台，优化 IMGUI 按钮样式。（已验证）

### 任务 1：点击选择目标

状态：已验证。

实现目标：

- 点击场上小怪可以切换当前目标。
- 黄色标记跟随当前目标。
- Hero 普攻优先攻击当前目标。
- `Skill 1` 和 `Skill 2` 优先作用于当前目标。

验收标准：

1. 进入 Play Mode。
2. 点击不同小怪。
3. 黄色目标标记切换到被点击的小怪。
4. Hero 普攻攻击被选中的小怪。
5. 技能攻击被选中的小怪。

### 任务 2：Skill 1 火焰箭

状态：已验证。

实现目标：

- 点击 `Skill 1` 后，对当前目标造成 2 倍 Hero ATK 伤害。
- 技能进入 4 秒冷却。
- 冷却期间按钮显示倒计时。

验收标准：

1. 进入 Play Mode。
2. 选择一个小怪。
3. 点击 `Skill 1`。
4. 目标受到明显高于普攻的伤害。
5. 按钮显示 4 秒倒计时。
6. 冷却结束后可以再次使用。

### 任务 3：Skill 2 燃烧

状态：已验证。

首次测试问题：

- 点击 `Burn` 后，看起来只在第一个 Monster 身上造成了一次 5 点伤害。
- 原因判断：燃烧第一跳等待太久，自动普攻可能在 DOT 跳出前已经击杀目标。

修正目标：

- 命中后给目标挂上橙色燃烧标记。
- 燃烧第一跳更快出现。
- 燃烧 DOT 使用固定伤害，暂时不受防御影响，方便 MVP 验证。
- 燃烧伤害数字使用橙色，和普攻黄色数字区分。

验证结果：

- `Burn` 会对当前选中的同一个目标连续造成 3 次 `-5` 燃烧伤害。

验收标准：

1. 进入 Play Mode。
2. 点击一个存活小怪作为目标。
3. 点击 `Burn`。
4. 目标先出现一次命中伤害。
5. 目标头顶出现橙色燃烧标记。
6. 随后出现 3 次橙色燃烧伤害数字。
7. `Burn` 按钮进入 5 秒倒计时。
8. Console 没有红色报错。

### 任务 4：能量条和 Ult

状态：已验证。

实现目标：

- 底部技能区上方显示 `Energy` 能量条。
- Hero 普攻、`Skill 1`、`Burn` 都会增加能量。
- 左侧按钮从 `Basic` 改成 `Ult`。
- 能量未满时，`Ult` 按钮显示当前百分比。
- 能量达到 `100/100` 后，`Ult` 按钮可点击。
- 点击 `Ult` 后，对所有存活敌人造成一次群体伤害，并清空能量。

验证结果：

- 能量达到满值后，点击 `Ult` 会对多个存活小怪造成红色 `-18` 群体伤害。

验收标准：

1. 进入 Play Mode。
2. 底部技能区上方能看到 `Energy 0/100`。
3. Hero 普攻后，能量会上涨。
4. 点击 `Skill 1` 或 `Burn` 后，能量也会上涨。
5. 能量未满时，左侧 `Ult` 按钮不能释放，只显示百分比。
6. 能量满后，左侧按钮显示 `Ult`。
7. 点击 `Ult` 后，所有存活小怪都出现一次红色伤害数字。
8. 释放后能量回到 `0/100`。
9. 点击 `Restart` 或 `Play Again` 后，能量也重置为 `0/100`。
10. Console 没有红色报错。

### 任务 5：底部技能按钮布局优化

状态：已验证。

实现目标：

- 底部按钮整体更贴近屏幕底部，减少遮挡角色。
- 技能按钮真实点击区域和视觉占位对齐。
- `Skill 1` 文案改为 `S1`，避免按钮文字挤压。
- `Skill 2` 视觉占位直接显示 `Burn`，和实际按钮一致。
- 能量条宽度和三枚按钮整体宽度更接近。

验收标准：

1. 进入 Play Mode。
2. 底部按钮和能量条没有明显重叠。
3. `S1`、`Burn`、`Ult/百分比` 文案都能看清。
4. 点击每个按钮时，实际响应区域和看到的按钮位置一致。
5. Console 没有红色报错。

验证结果：

- 底部按钮、能量条、点击区域在当前 MVP 测试中可用。

### 任务 6：视觉清晰度修复

状态：已验证。

问题：

- Game 视图在非 1x 缩放时会产生插值，看起来发糊。
- 角色 PNG 在 Standalone 平台曾开启压缩，细节会被压坏。
- 当前战斗没有背景和地台，角色像漂浮在纯黑底上。
- IMGUI 默认按钮皮肤偏工程占位，不适合继续验证手机战斗 UI。

实现目标：

- `Hero.png` 和 `Monster.png` 的 Standalone 纹理压缩关闭。
- 新增 `ArtSpriteImportSettings`，后续放进 `Assets/Resources/Art/` 的图片自动按 Sprite、无 mipmap、无压缩导入。
- 运行时对 Hero/Monster 纹理应用更稳定的滤镜设置。
- 给战斗区域增加程序生成的临时竞技场背景、地台和脚底阴影。
- 临时技能按钮和能量条改成更干净的纯色样式。
- Victory/Defeat 面板和重开按钮上移，避免压住 Hero。

验收标准：

1. Unity/Tuanjie 重新编译脚本后，没有 Console 红色报错。
2. `Hero.png` 和 `Monster.png` 重新导入后，Inspector 里压缩不是压缩格式。
3. 进入 Play Mode 后，角色后方能看到临时竞技场背景，不再是硬色块拼接。
4. 底部技能按钮不再是默认灰色按钮质感。
5. Victory/Defeat 出现时，结果面板和重开按钮不压住 Hero。
6. 把 Game 视图 `Scale` 调到接近 `1x` 后，角色边缘比之前更清楚。

验证结果：

- 角色图片无压缩设置生效。
- 临时竞技场背景、脚底阴影、技能按钮样式可用于继续 MVP 测试。

v0.3 阶段继续保持小切片开发：每次只新增或修正一个可单独测试的战斗交互。

## v0.4 数据驱动战斗原型

状态：开发中。

目标：

```text
把写死在代码里的战斗数值变成可复用数据。
```

计划功能：

- 角色属性数据。
- 怪物属性数据。
- 技能数据。
- 元素字段。
- 职业定位字段。
- 根据美术文档里的角色规划，做小型测试阵容。

### 任务 1：怪物和技能数值数据化

状态：已验证。

实现目标：

- 新增可配置的数据结构，保存 Hero、Monster、Skill 的核心数值。
- 当前先覆盖已经在 MVP 中用到的字段：
  - Hero：HP、ATK、DEF、普攻间隔。
  - Monster：HP、ATK、DEF、站位。
  - Skill：伤害、冷却、能量、DOT 参数。
- `MVPBootstrapper` 和 `SkillController` 不再到处写死数值。
- 行为保持和 v0.3 已验证版本一致。

实现记录：

- 新增 `Assets/Resources/Data/combat_config.json` 作为当前 MVP 的战斗数值配置。
- 新增 `CombatConfig.cs`，启动时通过 `Resources.Load<TextAsset>` 读取 JSON。
- Hero、小怪、战斗节奏、S1、Burn、Ult 的核心数值已从配置读取。
- Boss 的 HP、ATK、DEF、位置、显示高度也从配置读取。
- Hero 和 Monster 的 Restart 重置逻辑改为回到初始化配置值，不再写死默认数值。

验收标准：

1. 进入 Play Mode，没有 Console 红色报错。
2. Hero、小怪、S1、Burn、Ult 行为和 v0.3 一致。
3. 修改数据里的某个数值后，重新 Play 能看到对应变化。
4. Restart / Play Again 仍然正常。

### 任务 2：Boss 数值数据化

状态：已实现，待验证。

问题：

- 之前 Boss 在 `Monster.Initialize(boss=true)` 中写死为 `150 HP / 15 ATK / 8 DEF`。
- 这会导致改 JSON 不能影响 Boss，和 v0.4 数据驱动目标冲突。

实现目标：

- `combat_config.json` 新增 `boss` 节点。
- Boss 的 HP、ATK、DEF、站位、显示高度从 JSON 读取。
- 清空普通怪后，如果没有 Boss prefab，也能运行时创建一个 Boss。
- Victory 改为击杀 Boss 后触发，而不是清完普通怪直接触发。
- Boss MVP 默认数值调整为 `90 HP / 10 ATK / 4 DEF`，方便先验证完整 Boss 战闭环。
- Defeat/Victory 后，延迟弹道和 Burn DOT 不再继续结算伤害。

验收标准：

1. 进入 Play Mode。
2. 击杀 3 个普通 Monster 后，会出现一个 Boss。
3. 击杀 Boss 后才出现 Victory。
4. 修改 JSON 里的 `boss.hp` 后，Boss 耐久会变化。
5. Restart / Play Again 后 Boss 状态正常重置。
6. Defeat/Victory 后，不再继续出现新的 Boss 受伤日志。
7. Console 没有红色报错。

验证结果：

- 清空普通怪后 Boss 正常出现。
- 击杀 Boss 后才出现 Victory。
- Boss 默认 `90 HP / 10 ATK / 4 DEF` 可以完成当前 MVP 闭环。
- Defeat/Victory 后没有继续结算新的 Boss 伤害。

### 任务 3：伤害显示和实际扣血一致

状态：已实现，待验证。

问题：

- 之前 Hero 攻击力是 `10`，Monster 防御是 `2`。
- 实际扣血公式是 `max(1, 攻击值 - 防御值)`，所以每次普攻实际只扣 `8`。
- 但画面上仍显示 `-10`，导致看起来像 60 HP 的怪物应该 6 次死亡。

实现目标：

- `Hero.TakeDamage` 和 `Monster.TakeDamage` 返回实际扣血值。
- 普攻、`S1`、`Burn`、`Ult` 的伤害数字显示实际扣血。
- 保持当前战斗公式不变。

当前伤害公式：

```text
普通受击实际伤害 = max(1, 攻击值 - 防御值)
Burn 固定伤害 = max(1, 技能配置伤害)
Ult 群体伤害 = 技能配置基础伤害 + 当前 Hero 攻击力，不吃怪物防御
```

验收标准：

1. `combat_config.json` 中 Monster 防御为 `2`，Hero 攻击为 `10`。
2. 进入 Play Mode。
3. Hero 普攻 Monster 时，伤害数字应显示 `-8`。
4. 把 Monster 防御改成 `0` 后重新 Play，普攻伤害数字应显示 `-10`。
5. Console 没有红色报错。

### 任务 4：战斗结果结算摘要

状态：已验证。

实现目标：

- DropSystem 记录本局普通怪击杀数、Boss 击杀数、本局材料收入。
- Victory/Defeat 面板显示本局摘要。
- Restart / Play Again 后清空本局统计。

验收标准：

1. 进入 Play Mode。
2. 正常打到 Victory。
3. 结果面板显示普通怪击杀数、Boss 击杀数、材料收入。
4. 点击 Play Again 后，Materials 和本局统计重置。
5. 触发 Defeat 时，也能看到本局已经获得的击杀和材料。
6. Console 没有红色报错。

验证结果：

- Victory 显示本局 `Kills: 3 + Boss 1` 和 `Materials: +8`。
- Defeat 显示本局已经完成的击杀和材料收入。

### 任务 5：掉落数值数据化

状态：已验证。

实现目标：

- `combat_config.json` 新增 `drops` 节点。
- 普通怪掉落材料数和 Boss 掉落材料数从 JSON 读取。
- 默认保持普通怪 `1`，Boss `5`，不改变现有验证结果。

验收标准：

1. 进入 Play Mode。
2. 击杀普通怪后，Materials 增加 `monsterDropAmount`。
3. 击杀 Boss 后，Materials 增加 `bossDropAmount`。
4. 修改 JSON 中的掉落数值后，重新 Play 能看到结算 Materials 变化。
5. Console 没有红色报错。

验证结果：

- 普通怪和 Boss 掉落会累加到 Materials。
- Boss 默认掉落 5，完整战斗 Materials 可以到 8。
- Restart / Play Again 后 Materials 会重置为 0。

### 任务 6：自动拾取材料表现

状态：已验证。

设计决定：

- 材料暂时自动发放，不做手动拾取。
- 击杀单位后，材料数量立即入账。
- 画面上生成一个材料图标，从死亡位置飞向左上角 `Materials` 计数，用来确认本次掉落来自哪里。

验收标准：

1. 进入 Play Mode。
2. 击杀一个普通 Monster 后，死亡位置出现材料图标并飞向左上角。
3. `Materials` 增加 `monsterDropAmount`。
4. 击杀 Boss 后，出现更明显的材料图标并飞向左上角。
5. `Materials` 增加 `bossDropAmount`。
6. Victory 结算中的 Materials 数量仍然正确。
7. Restart / Play Again 后 Materials 和本局统计重置。
8. Console 没有红色报错。

验证结果：

- 击杀后材料会自动发放。
- 结果面板显示 Materials 收益。
- Restart 后 Materials 重置正常。

### 任务 7：Boss 死亡瞬间的胜负优先级

状态：已验证。

问题：

- Boss 进入死亡动画后，之前已经发出的攻击仍可能命中 Hero。
- 如果 Hero 在 Boss 死亡动画期间归零，当前结果可能先进入 Defeat。

规则：

- Boss 已经进入死亡流程时，本场战斗应等待 Boss 死亡流程完成。
- Boss 死亡流程完成后正常发放 Boss 掉落并进入 Victory。
- 这类延迟命中不再把结果改成 Defeat。

验收标准：

1. 进入 Play Mode。
2. 打到 Boss 阶段。
3. 在 Hero 低血量时击杀 Boss。
4. 如果 Boss 死亡动画期间 Hero 又收到延迟伤害，不应出现 Defeat。
5. Boss 掉落和 Victory 仍然正常。

验证结果：

- 使用临时测试配置验证 Boss 死亡结算。
- Boss 死亡后正常发放 Boss 掉落。
- 最终结果进入 Victory，未被延迟事件改成 Defeat。
- 测试后已恢复默认战斗配置。

## v0.5 关卡流程原型

状态：开发中。

目标：

```text
把单场战斗沙盒推进成可以连续测试的关卡循环。
```

### 任务 1：Victory 后进入下一关

状态：已验证。

实现目标：

- 战斗顶部显示当前 `Stage`。
- Victory 后结果面板按钮从 `Play Again` 改为 `Next Stage`。
- 点击 `Next Stage` 后进入下一关。
- Defeat 后回到临时 Home，不再原地 Restart。
- 每进入下一关，普通怪和 Boss 的 HP/ATK 做轻量缩放。
- 当前仍然是 MVP 测试流程，下一关会重置本场 Materials 和统计。

当前缩放规则：

```text
敌人 HP = 基础 HP * (1 + (Stage - 1) * 0.25)
敌人 ATK = 基础 ATK * (1 + (Stage - 1) * 0.15)
```

验收标准：

1. 进入 Play Mode，顶部能看到 `Stage 1`。
2. 打赢后出现 Victory，按钮显示 `Next Stage`。
3. 点击 `Next Stage` 后进入 `Stage 2`。
4. Stage 2 的怪物/Boss 血量比 Stage 1 更高。
5. Stage 2 Defeat 后，点击 `Return Home` 回到临时 Home。
6. Console 没有红色报错。

验证结果：

- Stage 1 Victory 后按钮显示 `Next Stage`。
- 点击后正常进入 Stage 2。
- Stage 2 怪物血量按缩放规则提高。
- Stage 2 Defeat 后仍停留在 Stage 2；后续已从 `Restart` 改为 `Return Home`。
- BossHealthBar 在进入下一关和重开时不再重复堆积。

### 任务 2：背包材料和本场掉落分离

状态：已验证。

问题：

- 当前 `Materials` 和本关统计一起重置。
- 进入下一关后，顶部 Materials 会清零，不利于后续养成系统。

实现目标：

- Home 中的 `Materials` 表示背包累计材料。
- 战斗中的顶部显示 `Loot`，表示本场掉落。
- 结果面板里的 `Materials: +N` 表示本关获得。
- 首次进入 Play 时累计材料从 0 开始。
- Victory 后点击 `Next Stage`，本场 `Loot` 正式并入背包 Materials。
- Defeat 后点击 `Return Home`，本场 `Loot` 丢失，不进背包。
- 后续进化/养成系统继续使用累计材料。
- 掉落概率和掉落表暂时不在这个切片里深测，后续单独做材料爆率设计。

验收标准：

1. 进入战斗后，顶部显示 `Loot: 0`。
2. Stage 1 打赢时，本场 `Loot` 为 8，结果面板显示 `Materials: +8`。
3. 点击 `Next Stage` 进入 Stage 2 后，顶部显示 `Loot: 0`。
4. Stage 2 击杀普通怪后，顶部 `Loot` 增加。
5. Stage 2 Defeat 后点击 `Return Home`，Home 中 Materials 不包含本次失败 Loot。
6. 重新退出 Play 再进入 Play，背包 Materials 从 0 开始。
7. Console 没有红色报错。

验证结果：

- Defeat 时战斗顶部显示本场 `Loot`。
- 点击 `Return Home` 后，Home 显示背包累计 `Materials`，不包含失败战斗的 Loot。
- 从 Home 点击 `Enter Battle` 后重新进入当前 Stage，战斗顶部重置为 `Loot: 0`。
- 旧验证基于“顶部显示累计 Materials”的方案，已被“背包 Materials / 战斗 Loot”方案替换。

### 任务 3：失败后回城

状态：已验证。

问题：

- `Restart` 是早期为了快速测试 Defeat 的临时按钮。
- 正式流程里，失败后应先回城/回主界面，再选择是否继续挑战。

实现目标：

- Defeat 结果按钮改为 `Return Home`。
- 点击后进入临时 Home 状态。
- Home 显示当前 Stage 和累计 Materials。
- Home 上点击 `Enter Battle` 后重新挑战当前 Stage。
- 回城时会回滚本次失败战斗里未提交的材料收益。
- Defeat 面板显示 `Lost Materials: +N`，避免误解失败收益已经入账。
- Victory/Defeat 使用单一运行时结果面板，不再混用 UGUI 面板和外置按钮。

验收标准：

1. Stage 2 失败后，结果按钮显示 `Return Home`。
2. 点击后进入 Home 面板。
3. Home 显示 `Stage 2` 和累计 Materials。
4. 点击 `Enter Battle` 后重新挑战 Stage 2。
5. 重新挑战时 Hero、怪物、Boss、能量、本关统计都重置。
6. Defeat 面板中失败战斗收益显示为 `Lost Materials`。
7. 结果面板里的标题、摘要、按钮在同一个面板内，且不重叠。
8. Console 没有红色报错。

验证结果：

- Defeat 后可以点击 `Return Home`。
- Home 面板可以显示 Stage 和 Materials。
- 点击 `Enter Battle` 可以重新进入当前 Stage。
- Home 面板排版已调整，信息和按钮不再重叠。

## v0.6 城镇和灵素图谱流程原型

状态：开发中。

目标：

```text
把“单条 Stage 线”升级为“城镇 -> 功能建筑 -> 灵素图谱 -> 地图 -> 战斗 -> 养成”的正式玩法骨架。
```

### 设计决定：城镇是养成入口集合

城镇不是单纯的返回界面，而是长期养成系统的主入口。

城镇基础建筑：

- `灵素图谱`：进入地图、挑战、扫荡、翻页解锁。
- `商店`：买卖基础道具，例如药品、炼丹材料、低阶素材。
- `铁匠铺`：打造、强化、重铸装备。
- `进化塔`：角色进化入口，收集完材料后在这里进化。
- `炼药铺`：炼丹入口，炼制丹药并提升属性。
- `修炼场`：学习技能、升级技能、配置上阵技能。
- `角色阁`：查看角色属性、成长、职业定位、元素信息。
- `装备阁`：穿戴、卸下、替换装备。
- `背包`：查看材料、丹药、装备、消耗品。

核心分工：

```text
战斗产出材料
  -> 背包保存
  -> 商店买卖 / 炼药铺炼丹 / 铁匠铺打造 / 进化塔进化 / 修炼场升级技能
  -> 角色属性、装备强度、技能强度提升
  -> 再挑战更高图谱页
```

### 设计决定：商店

商店用途：

- 购买药品。
- 购买基础炼丹材料。
- 出售多余材料或低阶装备。
- 后续可以刷新商品。

MVP 暂定：

- 商店先只做入口和占位。
- 不在当前切片实现完整买卖价格、货币和库存。

### 设计决定：铁匠铺

铁匠铺用途：

- 打造装备。
- 消耗矿石、图谱材料、金币等资源。
- 后续扩展强化、升星、词条重铸。

MVP 暂定：

- 先只做入口和占位。
- 装备系统先不和战斗数值强绑定，避免同时打开太多变量。

### 设计决定：进化塔

进化塔用途：

- 角色进化只在进化塔发生。
- 进化消耗指定图谱材料。
- 进化后提升基础属性、解锁技能或改变形态。

规则：

- 战斗地图中不出现进化按钮。
- 收集材料后回城进入进化塔操作。
- 进化条件需要明确显示：所需材料、当前拥有数量、进化后变化。

MVP 暂定：

- 保留已有 `EvolutionUI` 逻辑，但不放在战斗里。
- 后续把它迁移到进化塔入口。

### 设计决定：炼药铺

炼药铺用途：

- 消耗草药、灵材等材料炼制丹药。
- 丹药用于提升属性，例如 HP、ATK、DEF 或元素抗性。
- 炼丹可能有配方、成功率、熟练度。

MVP 暂定：

- 先记录系统方向。
- 暂不实现炼丹公式和熟练度。

### 设计决定：修炼场

修炼场用途：

- 学习新技能。
- 升级已有技能。
- 配置战斗中携带的主动技能。
- 后续可以扩展技能分支、被动技能、元素专精。

和其他系统的关系：

- 进化塔可以解锁新的技能槽、技能上限或技能学习资格。
- 修炼场负责真正的学习、升级和装配。
- 灵素图谱和地图掉落技能书、技能残页、元素灵材。
- 商店可以出售低阶技能材料。

技能成长方向：

- 技能等级影响伤害倍率、冷却、能量获取、DOT 次数、范围等。
- 技能升级消耗技能书、同元素材料、金币。
- 高阶技能需要角色进化阶段或图谱页进度解锁。

MVP 暂定：

- 先只做入口和占位。
- 当前战斗里的 `S1 / Burn / Ult` 继续保持临时技能配置。
- 后续把 `SkillController` 的技能数据接到修炼场配置。

### 设计决定：角色和装备

角色阁用途：

- 查看角色属性。
- 查看元素、职业定位、技能信息。
- 查看当前成长进度。
- 查看当前队伍槽位和锁定条件。

装备阁用途：

- 查看装备槽位。
- 穿戴/卸下装备。
- 后续和铁匠铺打造系统连接。

MVP 暂定：

- 角色阁先显示 Hero 当前 HP / ATK / DEF、等级经验、装备加成和 3 个队伍槽位。
- Slot 1 为当前 Hero。
- Slot 2 / Slot 3 先按等级锁定，不参与战斗。

### 设计决定：战斗队伍规模

长期玩法采用“轻阵容自动战斗 + 手动技能释放 + 养成构筑”。

当前 MVP 仍然保持单 Hero 战斗，原因：

- 当前还在验证城镇、图谱、经验、装备、技能、商店、扫荡主循环。
- 过早加入多角色会让测试难以判断问题来源。
- 单 Hero 可以更快验证养成系统是否闭环。

长期阵容方向：

```text
3 人主战
前排 / 中排 / 后排
职业定位和元素组合影响战斗策略
```

推荐职业定位：

```text
Guardian：前排，抗伤，护盾，嘲讽
Warrior：前排/中排，稳定物理输出
Ranger：后排，单体爆发，持续输出
Mage：后排，群体伤害，元素异常
Assassin：中后排，爆发，收割
Alchemist：后排，治疗，增益，炼药相关
```

开发路线：

```text
当前：单 Hero
已完成：角色阁显示 3 个队伍槽
当前：Lv.3 后解锁第 2 个角色占位
之后：3 人主战真实参战
```

队伍槽解锁规则：

```text
Slot 1：默认解锁，当前 Hero
Slot 2：Hero Lv.3 解锁
Slot 3：Hero Lv.6 解锁
Support Slot：Page 2 后再考虑
```

### 设计决定：城镇系统分层

为了避免系统互相抢职责，城镇建筑按“资源 -> 加工 -> 成长”分层。

资源来源：

- 灵素图谱：主要材料、技能残页、装备素材、炼丹材料。
- 扫荡：已通关地图的稳定材料来源。
- 商店：基础消耗品、低阶材料、补缺口资源。

加工建筑：

- 炼药铺：把草药/灵材加工成丹药。
- 铁匠铺：把矿石/装备素材加工成装备。
- 修炼场：把技能书/残页/元素材料加工成技能等级。

成长入口：

- 进化塔：角色阶段成长。
- 角色阁：查看角色本体成长。
- 装备阁：穿戴装备，形成装备成长。
- 修炼场：技能成长。

背包职责：

- 只负责持有和查看物品。
- 不直接承担进化、炼丹、打造、技能升级逻辑。

推荐优先级：

```text
先做城镇入口结构
  -> 再做灵素图谱地图节点
  -> 再做背包材料分类
  -> 再接进化塔/修炼场的第一个真实养成动作
  -> 最后做商店、炼药、铁匠铺的复杂经济
```

### 设计决定：等级和经验系统

总体设计文档里已经有等级提升方向：

- 角色通过副本获得经验。
- 等级提升增加基础属性。
- 等级有上限，需要突破材料提高上限。
- 等级可以作为技能学习、进化阶段、装备穿戴、图谱页挑战的门槛。

MVP 取舍：

- 需要做等级系统，但不要立刻做完整数值曲线。
- 第一版只做 Hero 等级、经验、升级加属性。
- 战斗胜利后获得经验。
- 失败不获得经验，或者只获得极少经验；MVP 先按失败不获得处理，避免刷失败收益。
- 等级上限、突破、经验药水后续再接。

第一版规则：

```text
Hero Lv.1
EXP 0/100
Victory +50 EXP
升级：HP +10，ATK +2，DEF +1
```

当前实现规则：

```text
地图推荐等级：Map 1 = Lv.1，Map 2 = Lv.2，Map 3 = Lv.3
普通怪：10 EXP
Boss：50 EXP
首次通关奖励：40 EXP
扫荡：不给 EXP，只给 Materials
失败：不给 EXP

等级差衰减：
角色等级 <= 推荐等级 + 2：100% EXP
高 3 级：50% EXP
高 4 级：25% EXP
高 5 级或以上：0 EXP

升级需求：
Lv.1 -> Lv.2：100 EXP
Lv.2 -> Lv.3：150 EXP
Lv.3 -> Lv.4：220 EXP
Lv.4 -> Lv.5：320 EXP

每升 1 级：
HP +10
ATK +2
DEF +1
```

实现记录：

- Victory 结果面板显示本场 `EXP +N`。
- 如果本场经验足够升级，Victory 结果面板显示 `Level Up!`。
- 点击 `Return Codex` 后，经验正式入账并应用升级属性。
- `角色阁` 显示 Hero 当前等级和经验进度。
- 当前等级和经验只在本次 Play 会话内生效，暂未做存档。

长期扩展：

- Lv.5 解锁修炼场技能升级。
- Lv.10 解锁进化塔第一次进化。
- Lv.15 解锁装备强化。
- Lv.20 解锁下一类图谱页或精英地图。
- 等级上限通过突破石和进化材料提升。

### 开发批次建议

可以一次开发多个功能，但必须按“同一测试路径”合并，不要把互相无关的系统混在一起。

适合合并开发的一批：

- 城镇主界面 9 个入口。
- 灵素图谱入口。
- 图谱 Page 1 的 3 个地图节点。
- 未解锁地图置灰。
- 点击占位建筑显示提示。

原因：

- 都是 Home/UI 导航。
- 不改战斗公式。
- 你一次 Play 就能测完整入口路径。

适合第二批开发的一批：

- 地图通关解锁。
- Victory 后回图谱页。
- Map 1 -> Map 2 -> Map 3 顺序推进。
- Page 1 通关后显示 Page 2 解锁。

原因：

- 都属于图谱进度。
- 需要和战斗胜利结果联动。

适合第三批开发的一批：

- 背包材料分类。
- 地图掉落表。
- 已通关地图扫荡。
- 扫荡次数。

原因：

- 都属于资源经济。
- 需要一起验证“材料从哪里来、进哪里去、能不能刷漏洞”。

不建议和上面混在一批的系统：

- 等级经验。
- 技能升级。
- 装备打造。
- 炼丹。
- 进化。

原因：

- 它们都会改角色属性。
- 一旦和地图解锁/掉落同时做，测试时很难判断是哪个系统导致战斗难度变化。

### 设计决定：灵素图谱

长期入口流程：

```text
城镇
  -> 灵素图谱入口
  -> 图谱页
  -> 地图节点
  -> 战斗
  -> 结算 / 回城
```

图谱规则：

- 灵素图谱按“页”组织。
- 每一页有多个地图节点。
- 每个地图可以有不同掉落内容、掉落权重、推荐战力、敌人配置。
- 未通关地图必须按顺序挑战并解锁。
- 已通关地图可以重复挑战。
- 一页全部通关后，图谱翻到下一页，解锁下一页地图。

掉落规则方向：

- 现在的“每只小怪固定掉 1，Boss 固定掉 5”只是 MVP 验证用。
- 正式设计应改为地图掉落表。
- 同一页内不同地图可以掉不同材料，或者同材料不同爆率。
- Boss 可以有固定首通奖励、概率掉落、保底材料。
- 掉落概率不在当前 UI 切片里继续深测，后续单独做“地图掉落表和扫荡收益”切片。

扫荡规则方向：

- 已通关地图可以快速刷图。
- 扫荡消耗刷图次数。
- 扫荡直接获得该地图掉落表中的材料。
- 未通关地图不能扫荡。
- 扫荡收益应该进背包 Materials，不进入战斗 Loot。

### 设计决定：前三阶材料体系

目标：

- 先把材料系统设计成能支撑前三个成长阶段。
- 第一阶段服务 MVP：小回血药、低阶装备、第一次技能升级、第一次进化准备。
- 第二阶段服务 Page 2 / Lv.10 左右：稀有装备、属性丹、第一次正式进化。
- 第三阶段服务 Page 3 / Lv.20 左右：史诗装备、高阶丹药、第二次进化或突破。
- 后续更多图谱页可以按同一结构继续扩展四阶、五阶材料。

材料分层：

```text
一阶：普通材料
用途：基础消耗、低阶装备、低阶丹药、低阶技能升级。
特点：可交易，可大量掉落，可扫荡获得。

二阶：稀有材料
用途：稀有装备、属性丹、第一次进化、技能中阶升级。
特点：部分可交易，主要靠地图和 Boss，商店只少量限购。

三阶：史诗材料
用途：史诗装备、高阶丹药、第二阶段进化、突破等级上限。
特点：多数不可交易，主要来自精英图、Boss 首通、周/月限制内容。
```

货币和通用资源：

```text
灵尘
- 定位：基础货币，低阶交易媒介。
- 来源：普通怪、Boss、扫荡、出售可交易材料。
- 用途：商店购买药品、低阶材料、基础打造/炼丹手续费。
- 交易：可交易，可买卖。
- 当前代码：materialCount。

灵玉
- 定位：珍贵货币，后续用于稀有商店和刷新。
- 来源：首通、成就、活动、少量付费或高级任务。
- 用途：稀有材料限购、商店刷新、特殊道具。
- 交易：不可直接出售，不由普通地图大量产出。
- MVP：先只设计，不进入代码。
```

炼丹材料：

```text
一阶普通：
赤草
- 用途：小回血药、低阶生命丹。
- 来源：图谱一 地图 1，低阶商店。
- 交易：可买，可卖。
- 当前代码：herbCount。

清露
- 用途：小回灵丹、低阶防御丹。
- 来源：图谱一 地图 2 或后续水系地图。
- 交易：可买，可卖。
- MVP：先设计，暂不实现。

二阶稀有：
朱果
- 用途：中回血药、攻击丹、进化辅助丹。
- 来源：图谱二 草木地图，Boss 概率掉落。
- 交易：商店限购，可卖但价格较低。

月华露
- 用途：中回灵丹、技能冷却类丹药。
- 来源：图谱二 夜/月主题地图。
- 交易：商店限购，可卖。

三阶史诗：
凤髓花
- 用途：高阶生命丹、二阶进化丹。
- 来源：图谱三 Boss、精英地图首通。
- 交易：不可卖，不可常规购买。

星髓露
- 用途：高阶灵力丹、突破丹。
- 来源：图谱三 稀有 Boss、活动/精英图。
- 交易：不可卖，特殊商店限购。
```

锻造和武器材料：

```text
一阶普通：
铁砂
- 用途：训练武器、普通护甲、基础强化。
- 来源：图谱一 地图 2，低阶商店。
- 交易：可买，可卖。
- 当前代码：oreCount。

兽皮
- 用途：皮甲、护手、鞋类装备。
- 来源：图谱一 地图 1/3 的小怪。
- 交易：可买，可卖。
- MVP：先设计，暂不实现。

二阶稀有：
赤铜
- 用途：稀有武器、稀有护甲、装备强化 +3 以后。
- 来源：图谱二 矿洞/火系地图，Boss 概率掉落。
- 交易：商店限购，可卖。

妖骨
- 用途：特殊武器、饰品、职业专属装备。
- 来源：图谱二 精英怪、Boss。
- 交易：不可在普通商店购买，可少量出售。

三阶史诗：
玄铁
- 用途：史诗武器、史诗护甲、装备突破。
- 来源：图谱三 Boss、精英地图首通、扫荡低概率。
- 交易：不可卖，不可常规购买。

龙鳞
- 用途：高阶护甲、守卫职业装备、进化装备材料。
- 来源：图谱三 Boss 或特殊地图。
- 交易：不可卖，特殊商店极少限购。
```

进化材料：

```text
一阶普通：
火灵屑 / 水灵屑 / 风灵屑 / 土灵屑
- 用途：第一次进化前置材料、低阶元素技能升级。
- 来源：图谱一 对应元素地图。
- 交易：可卖，不建议商店常驻购买。

二阶稀有：
火灵核 / 水灵核 / 风灵核 / 土灵核
- 用途：第一次正式进化、技能中阶升级。
- 来源：图谱二 Boss、首通奖励、精英怪概率。
- 交易：不可卖，商店只可用灵玉限购少量。

三阶史诗：
炎魄 / 玄水魄 / 疾风魄 / 厚土魄
- 用途：第二次进化、职业分支、形态突破。
- 来源：图谱三 Boss 首通、精英图保底。
- 交易：不可卖，不可普通购买。
```

技能材料：

```text
一阶普通：
技能残页
- 用途：技能 Lv.1 -> Lv.2。
- 来源：图谱一 Boss、商店少量购买。
- 交易：可买，可卖。

二阶稀有：
技能秘页
- 用途：技能 Lv.2 -> Lv.4，解锁第二段效果。
- 来源：图谱二 Boss、精英怪。
- 交易：商店限购，可卖但不推荐。

三阶史诗：
技能真卷
- 用途：技能高阶突破、奥义强化。
- 来源：图谱三 Boss 首通、稀有掉落。
- 交易：不可卖，特殊商店限购。
```

丹药设计：

```text
一阶丹药：
小回血药：赤草 + 灵尘
小回灵丹：清露 + 灵尘
低阶生命丹：赤草 + 清露 + 灵尘

二阶丹药：
中回血药：朱果 + 赤草 + 灵尘
攻击丹：朱果 + 火灵核 + 灵尘
防御丹：月华露 + 土灵核 + 灵尘

三阶丹药：
高阶生命丹：凤髓花 + 星髓露 + 灵玉
突破丹：星髓露 + 元素魄 + 灵玉
进化丹：凤髓花 + 元素魄 + 灵玉
```

装备打造设计：

```text
一阶普通装备：
训练长弓：铁砂 + 兽皮 + 灵尘
灰革甲：兽皮 + 铁砂 + 灵尘
低阶饰品：铁砂 + 火灵屑 + 灵尘

二阶稀有装备：
猎焰长弓：赤铜 + 妖骨 + 火灵核 + 灵尘
守护重甲：赤铜 + 妖骨 + 土灵核 + 灵尘
元素戒指：赤铜 + 对应灵核 + 技能秘页

三阶史诗装备：
炎魄战弓：玄铁 + 龙鳞 + 炎魄 + 灵玉
玄鳞重甲：玄铁 + 龙鳞 + 厚土魄 + 灵玉
星髓护符：玄铁 + 星髓露 + 技能真卷 + 灵玉
```

商店规则：

```text
普通商店：
- 常驻出售：小回血药、赤草、铁砂、技能残页。
- 常驻回收：赤草、铁砂、兽皮、技能残页。
- 不出售进化核心材料。

稀有商店：
- 条件：图谱二解锁后开放。
- 出售：朱果、月华露、赤铜、技能秘页。
- 规则：每日/每轮限购，价格较高，可用灵尘或灵玉。

珍宝商店：
- 条件：图谱三或进化塔解锁后开放。
- 出售：少量史诗材料碎片、技能真卷碎片、灵玉道具。
- 规则：大部分限购，不常驻完整史诗材料。
```

交易规则：

```text
可交易：
- 灵尘
- 赤草、清露、铁砂、兽皮
- 技能残页
- 少量二阶材料，如朱果、月华露、赤铜

限制交易：
- 技能秘页
- 妖骨
- 火灵核 / 水灵核 / 风灵核 / 土灵核
- 只能限购或活动兑换，不应无限买卖。

不可交易：
- 灵玉
- 史诗材料：凤髓花、星髓露、玄铁、龙鳞
- 元素魄：炎魄、玄水魄、疾风魄、厚土魄
- 进化关键材料和 Boss 首通材料
```

前三页地图产出建议：

```text
图谱一：普通材料页
地图 1 草木坡：赤草、兽皮、火灵屑，Boss 概率技能残页。
地图 2 铁砂岭：铁砂、清露、土灵屑，Boss 概率技能残页。
地图 3 余烬祭坛：赤草、铁砂、火灵屑，Boss 固定首通火灵屑 + 技能残页。

图谱二：稀有材料页
地图 1 朱果林：朱果、赤草、风灵核，Boss 概率技能秘页。
地图 2 赤铜矿：赤铜、铁砂、土灵核，Boss 概率妖骨。
地图 3 月华溪：月华露、朱果、水灵核，Boss 首通随机灵核。

图谱三：史诗材料页
地图 1 凤髓谷：凤髓花、朱果、炎魄碎片。
地图 2 玄铁渊：玄铁、赤铜、龙鳞碎片。
地图 3 星髓坛：星髓露、技能真卷碎片、元素魄碎片，Boss 首通完整元素魄。
```

实现优先级：

```text
当前可做：
1. 背包显示多材料：灵尘、赤草、铁砂。
2. 商店支持基础买卖：赤草、铁砂、小回血药。
3. 图谱一三张地图给不同基础材料。

下一批做：
1. 背包材料分类 UI。
2. 商店商品表和限购。
3. 炼药铺/铁匠铺读取材料表。
4. 更多图谱页材料产出接入。

再下一批做：
1. 炼药铺第一批丹药。
2. 铁匠铺第一批打造。
3. 进化塔第一次进化材料需求。
4. 稀有/史诗材料的不可交易规则。
```

当前代码临时映射：

```text
materialCount = 灵尘
herbCount = 赤草
oreCount = 铁砂

图谱一地图掉落已从代码硬编码移动到：
Assets/Resources/Data/map_drop_config.json

图谱一 地图 1：草木坡，通关赤草 +2，扫荡灵尘 +3
图谱一 地图 2：铁砂岭，通关铁砂 +2，扫荡灵尘 +4
图谱一 地图 3：余烬祭坛，通关赤草 +1、铁砂 +1，扫荡灵尘 +5
```

### 任务 11：地图掉落表数据化

状态：已实现，待验证。

实现目标：

- 不再把图谱一地图材料奖励直接写死在 `GameManager` 方法里。
- 新增地图掉落配置文件。
- 胜利结算、奖励预览、扫荡收益读取同一份地图掉落表。
- 配置丢失或解析失败时回退到内置默认值，避免 MVP 直接无法运行。

实现记录：

- 新增 `Assets/Scripts/MapDropConfig.cs`。
- 新增 `Assets/Resources/Data/map_drop_config.json`。
- `GameManager` 启动时加载 `MapDropConfigLoader.Load()`。
- `GetSweepReward`、`GetMapHerbReward`、`GetMapOreReward` 改为读取地图掉落表。

验收标准：

1. 通关地图 1 后仍然获得赤草 +2。
2. 通关地图 2 后仍然获得铁砂 +2。
3. 通关地图 3 后仍然获得赤草 +1、铁砂 +1。
4. 已通关地图扫荡仍然获得对应灵尘奖励。
5. Console 没有红色报错。

### 任务 12：材料表数据化

状态：已实现，待验证。

实现目标：

- 将材料名称、品质、分类、是否可交易、用途描述从设计文档落到配置表。
- 当前背包、商店说明、地图奖励提示先读取材料表中的名称和交易属性。
- 不重写当前数量存储结构，避免影响已经通过的战斗/掉落闭环。

实现记录：

- 新增 `Assets/Resources/Data/material_config.json`。
- `CombatConfig.cs` 中新增 `MaterialConfig`、`MaterialEntry`、`MaterialConfigLoader`。
- `GameManager` 启动时加载材料表。
- 背包中的 `灵尘 / 赤草 / 铁砂`、商店说明、地图材料提示开始读取材料名称。
- 商店说明开始显示赤草、铁砂是否可交易。

当前材料表包含：

```text
货币：灵尘、灵玉
炼丹：赤草、清露、朱果、月华露、凤髓花、星髓露
锻造：铁砂、兽皮、赤铜、妖骨、玄铁、龙鳞
技能：技能残页、技能秘页、技能真卷
进化：火灵屑、火灵核、炎魄
```

验收标准：

1. 城镇顶部仍显示 `灵尘 N`。
2. 背包仍显示 `灵尘 / 赤草 / 铁砂 / 小回血药 / 扫荡次数`。
3. 商店说明仍显示小回血药、赤草、铁砂价格。
4. 商店说明能看到赤草、铁砂为可交易。
5. 地图胜利和扫荡提示里的材料名仍正确。
6. Console 没有红色报错。

### 任务 13：商店和背包格子化

状态：已实现，待验证。

设计决定：

- 商店只负责购买商品。
- 出售材料放到背包内完成。
- 背包采用格子形式显示当前可操作物品。
- 商店按手游常见结构组织：类目标签、商品小格、选中详情、购买按钮、左右翻页。
- 城镇子界面使用屏幕安全区完整页面，不再露出主界面的建筑入口或缩在右侧小面板。
- 右上角 `X` 用于关闭当前子界面并回到城镇主界面。
- 当前 MVP 不做拖拽、排序和复杂筛选。

实现目标：

- 商店不再使用“上一个/下一个”切换买卖动作。
- 点击商店后，当前屏幕切换成商店完整页面。
- 商店顶部显示类目：消耗、炼丹、锻造、进化。
- 商店商品格子缩小，只显示图标和价格状态。
- 点击商品格子只负责选中商品，不直接购买。
- 选中商品后，在详情区显示名称、价格、说明。
- 底部 `购买` 按钮执行购买。
- 灵尘不足时，购买按钮显示 `灵尘不足`。
- 底部左右按钮用于后续商品分页。
- 背包也使用完整页面显示材料/消耗品格子，右侧显示选中物品详情。
- 背包选中材料后，可以 `卖 1` 或 `全卖`。
- 药水先作为消耗品展示，不开放出售。

当前商店商品：

```text
小回血药：3 灵尘
赤草：2 灵尘
铁砂：3 灵尘
```

当前背包格子：

```text
赤草：可出售，卖价 1 灵尘
铁砂：可出售，卖价 1 灵尘
小回血药：展示数量，暂不出售
```

验收标准：

1. 城镇点击商店，主界面建筑入口消失，切换成商店完整页面。
2. 商店顶部显示 `消耗 / 炼丹 / 锻造 / 进化` 类目。
3. 商品格子比旧版更小，格子内不塞长说明文字。
4. 点击小回血药格子，只切换选中详情，不立即购买。
5. 灵尘不足时，购买按钮显示 `灵尘不足` 且不可点击。
6. 点击 `购买` 后，灵尘减少 3，小回血药 +1。
7. 点击炼丹类目，选择赤草，点击 `购买` 后灵尘减少 2，赤草 +1。
8. 点击锻造类目，选择铁砂，点击 `购买` 后灵尘减少 3，铁砂 +1。
9. 点击进化类目时，当前可以显示暂无商品或购买按钮不可用。
10. 城镇点击背包，主界面建筑入口消失，切换成背包完整页面。
11. 选中赤草或铁砂后，点击 `卖 1` 会减少对应材料并增加灵尘。
12. 点击 `全卖` 会卖掉当前选中材料的全部数量。
13. 小回血药不应被出售。
14. 点击右上角 `X` 后返回城镇主界面。
15. Console 没有红色报错。

### 任务 14：测试进度本地存档

状态：已实现，待验证。

设计决定：

- 当前阶段使用 Unity `PlayerPrefs` 保存测试进度。
- 这是 MVP 测试存档，不是正式账号/服务器存档。
- 目标是减少反复 Play/Stop 后重新刷图、重新攒材料的时间浪费。
- 城镇主界面提供 `清存档` 小按钮，用于从零验证新手流程。

当前保存内容：

```text
灵尘
赤草
铁砂
小回血药
已通关地图
已解锁地图
当前选中地图
扫荡次数
主角等级
主角经验
S1 技能等级
已穿戴装备
```

触发保存：

```text
通关地图并返回图谱
扫荡地图
商店购买
背包出售
战斗中消耗药水
修炼场升级技能
装备阁穿戴/卸下装备
退出游戏/停止 Play
```

验收标准：

1. 打通地图 1 后停止 Play，再重新 Play，地图 1 仍为已通关，地图 2 仍为解锁。
2. 获得的灵尘、赤草、铁砂重新 Play 后仍保留。
3. 商店购买的小回血药重新 Play 后仍保留。
4. 技能等级和主角等级重新 Play 后仍保留。
5. 点击城镇主界面 `清存档` 后，重新回到初始进度。
6. Console 没有红色报错。

### 任务 1：城镇主界面入口布局

状态：已实现，待验证。

实现目标：

- Play 后先进入 Home，而不是直接开战。
- Home 改为临时城镇主界面。
- 城镇中显示核心建筑入口：
  - 灵素图谱
  - 商店
  - 铁匠铺
  - 进化塔
  - 炼药铺
  - 修炼场
  - 角色
  - 装备
  - 背包
- 只有灵素图谱入口先能进入下一层。
- 其他建筑显示占位提示，不进入完整功能。

验收标准：

1. 进入 Play Mode 后先看到城镇主界面。
2. 城镇界面能看到 9 个核心入口。
3. 点击灵素图谱后进入图谱页。
4. 点击商店/铁匠铺/进化塔/炼药铺/修炼场/角色/装备/背包时，出现占位提示。
5. Console 没有红色报错。

实现记录：

- Play 后默认进入城镇，不再直接开战。
- 城镇使用临时 IMGUI 面板显示 9 个入口。
- `灵素图谱` 可进入图谱页。
- 其他建筑先显示占位提示。
- 城镇和图谱页隐藏战斗单位与底部技能栏，避免和导航界面混在一起。
- `角色阁` 已提供临时属性查看面板，显示 Hero HP / ATK / DEF / 元素 / 定位。
- `背包` 已提供临时资源查看面板，显示累计 Materials 和当前 Battle Loot。

### 任务 2：灵素图谱第一页地图节点

状态：已实现，待验证。

实现目标：

- 从城镇点击灵素图谱后进入临时图谱页 UI。
- 图谱页先显示第 1 页和 3 个地图节点。
- 当前可挑战节点高亮，未解锁节点置灰。
- 点击可挑战地图后进入战斗。

验收标准：

1. 从城镇点击灵素图谱。
2. 图谱页显示 Page 1 和 3 个地图节点。
3. 只有当前可挑战地图能进入战斗。
4. 未解锁地图不能点击进入战斗。
5. Console 没有红色报错。

实现记录：

- 图谱页显示 `灵素图谱 Page 1`。
- 当前显示 3 个地图节点。
- 初始只有 `Map 1` 可挑战。
- 未解锁地图置灰，不能进入战斗。
- 点击可挑战地图后进入战斗，战斗顶部显示当前 `Page 1 - Map N`。

### 任务 3：地图通关解锁和翻页

状态：部分实现，待验证。

实现目标：

- 通关地图 1 后，解锁地图 2。
- 通关地图 2 后，解锁地图 3。
- 通关地图 3 后，解锁下一页。
- Victory 后不再直接 `Next Stage`，而是回到图谱页并显示新解锁状态。

验收标准：

1. 初始只解锁 Page 1 Map 1。
2. 打赢 Map 1 后回图谱页，Map 2 解锁。
3. 打赢 Map 2 后回图谱页，Map 3 解锁。
4. 打赢 Map 3 后显示 Page 2 已解锁。
5. Console 没有红色报错。

实现记录：

- Victory 后按钮改为 `Return Codex`，不再直接进入下一场线性 Stage。
- 点击 `Return Codex` 后，本场 Loot 并入背包 Materials，并回到图谱页。
- 通关 Map 1 后解锁 Map 2。
- 通关 Map 2 后解锁 Map 3。
- 图谱页显示 Page 2 锁定/解锁占位。
- Page 1 三张地图全部通关后，Page 2 显示为已解锁占位。
- 真正 Page 2 地图内容和翻页交互尚未实现，放到后续图谱批次。

### 任务 4：已通关地图扫荡入口

状态：已实现，待验证。

实现目标：

- 已通关地图显示 `Sweep`。
- 点击 `Sweep` 消耗一次刷图次数。
- 扫荡直接增加背包 Materials。
- 未通关地图不显示或禁用 `Sweep`。

验收标准：

1. 通关 Map 1 后，Map 1 出现 `Sweep`。
2. 点击 `Sweep` 后 Materials 增加。
3. 刷图次数减少。
4. 未通关 Map 2/Map 3 不能扫荡。
5. Console 没有红色报错。

实现记录：

- 图谱页顶部显示剩余扫荡次数 `Sweeps`。
- 已通关地图下方显示 `Sweep +N`。
- 未通关地图显示 `Sweep Locked`，不能点击。
- 点击 Sweep 后消耗 1 次扫荡次数。
- 扫荡奖励直接进入背包 Materials，不进入 Battle Loot。
- 当前临时收益为 Map 1 = 3，Map 2 = 4，Map 3 = 5。
- 正式地图掉落表、概率和保底机制后续单独实现。

### 任务 5：图谱地图信息展示

状态：已实现，待验证。

实现目标：

- 地图节点显示当前状态。
- 地图节点显示推荐等级。
- 地图节点显示预计 EXP。
- 图谱页显示距离 Page 2 解锁还差几张地图。

验收标准：

1. 图谱页每个 Map 节点能看到状态、推荐等级、预计 EXP。
2. 初始显示还需通关 3 张地图解锁 Page 2。
3. 通关 Map 1 后显示还需通关 2 张。
4. 通关 Map 1/2/3 后显示 Page 2 已解锁占位。
5. Console 没有红色报错。

实现记录：

- Map 节点显示 `Lv.N` 和 `EXP N`。
- 预计 EXP 会根据当前 Hero 等级、地图推荐等级、是否首通计算。
- Page 2 当前只是解锁状态占位，不可进入。

### 任务 6：商店小回血药

状态：已实现，待验证。

实现目标：

- 商店不再只是占位。
- 可以花 Materials 购买小回血药。
- 背包显示药水数量。
- 战斗中可以消耗药水回复 Hero HP。

当前规则：

```text
小回血药价格：3 Materials
回复量：30 HP
只有 Hero 受伤且拥有药水时可用
```

验收标准：

1. 城镇点击商店，能看到小回血药。
2. Materials 足够时点击购买，Materials 减少 3，Potion +1。
3. 城镇点击背包，能看到 Potion 数量。
4. 进入战斗后底部能看到 Potion 按钮。
5. Hero 受伤后点击 Potion，Hero 回复 HP，Potion 数量减少。
6. Potion 为 0 或 Hero 满血时不能使用。
7. Console 没有红色报错。

### 任务 7：修炼场 S1 升级

状态：已实现，待验证。

实现目标：

- 修炼场不再只是占位。
- 可以花 Materials 升级 S1。
- S1 等级影响战斗中的 S1 伤害倍率。

当前规则：

```text
S1 初始 Lv.1，伤害倍率 2x
S1 Lv.2，伤害倍率 3x，消耗 6 Materials
S1 Lv.3，伤害倍率 4x，消耗 12 Materials
当前 MVP 上限 Lv.3
```

验收标准：

1. 城镇点击修炼场，能看到 S1 等级、倍率、升级消耗。
2. Materials 足够时可以升级 S1。
3. 升级后 Materials 正确扣除。
4. 进入战斗后，S1 伤害倍率提高。
5. S1 达到 Lv.3 后显示已达当前上限。
6. Console 没有红色报错。

### 任务 8：装备阁穿戴原型

状态：已实现，待验证。

实现目标：

- 装备阁不再只是占位。
- 装备阁使用手游式六槽布局，不再使用 `上一个 / 下一个` 调试切换。
- 中间显示角色占位，左右各三个装备槽。
- 点击装备槽打开同部位装备库格子。
- 装备库弹窗打开时，底层装备槽不可点击，必须先选择装备、卸下或关闭弹窗。
- 可以按职业和等级限制穿戴装备。
- 点击可穿戴装备后直接替换当前槽位装备。
- 当前槽位已有装备时，可以在装备库中卸下当前装备。
- 穿戴后角色属性变化。
- 角色阁显示装备带来的属性加成。

当前装备：

```text
训练长弓
Lv.1 普通 武器 Ranger
ATK +3

粗布帽
Lv.1 普通 头部 全职业
HP +5 DEF +1

灰革甲
Lv.1 普通 护甲 全职业
HP +10 DEF +1

皮护手
Lv.1 普通 手部 Ranger
ATK +1

猎人短靴
Lv.1 普通 鞋子 全职业
DEF +1

余烬戒指
Lv.1 稀有 饰品 全职业
ATK +1

猎焰长弓
Lv.3 稀有 武器 Ranger
ATK +6

赤纹护手
Lv.3 稀有 手部 Ranger
ATK +3

守护重甲
Lv.3 稀有 护甲 Guardian
HP +25 DEF +4
当前 Ranger 不能穿
```

验收标准：

1. 城镇点击装备阁，能看到中间角色占位和 6 个装备槽。
2. 左侧显示 `头部 / 护甲 / 鞋子`，右侧显示 `武器 / 手部 / 饰品`。
3. 点击空槽位会弹出同部位装备库。
4. 点击可穿戴装备后，装备显示到对应槽位。
5. 已有装备的槽位可点击 `卸下当前`。
6. 等级不够时不能穿 `猎焰长弓 / 赤纹护手`。
7. 职业不符时不能穿 `守护重甲`。
8. 穿戴装备后，角色阁中的 HP / ATK / DEF 增加。
9. 卸下装备后，角色阁属性回落。
10. 退出 Play 再进入，已穿戴装备仍保留。
11. Console 没有红色报错。

### 任务 9：角色阁队伍槽占位

状态：已实现，待验证。

实现目标：

- 保持当前战斗仍为单 Hero。
- 角色阁开始显示未来 3 人队伍结构。
- Slot 1 显示当前 Hero。
- Slot 2 / Slot 3 根据 Hero 等级显示锁定或空槽。

验收标准：

1. 城镇点击角色阁。
2. 可以看到 Hero 属性、装备加成。
3. 可以看到队伍槽：
   - Slot 1：Hero / Ranger / Front
   - Slot 2：Locked - Hero Lv.3，达到 Lv.3 后显示 Unlocked - Empty / Mid
   - Slot 3：Locked - Hero Lv.6，达到 Lv.6 后显示 Unlocked - Empty / Back
4. 进入战斗后仍然只有当前 Hero 参战。
5. Console 没有红色报错。

### 任务 10：城镇建筑化 UI 原型

状态：已实现，待验证。

实现目标：

- 城镇不再只是 3x3 文字按钮。
- 每个入口显示临时建筑/功能图标。
- 保留当前所有入口和详情面板功能。
- 灵素图谱页增加临时书页背景和地图节点视觉。

当前取舍：

- 使用代码绘制临时图标和背景。
- 不使用最终美术资源。
- 不改变战斗、经验、材料、装备、药水、扫荡逻辑。

验收标准：

1. 城镇入口看起来像建筑/功能入口，而不是纯文字后台按钮。
2. 灵素图谱入口像一本书。
3. 商店、铁匠铺、进化塔、炼药铺、修炼场、角色阁、装备阁、背包都有不同图标轮廓。
4. 点击入口仍然能打开原来的功能面板。
5. 图谱页能看到书页背景和地图节点视觉。
6. Console 没有红色报错。

## Recent Rule Updates

- Battle retreat now requires a confirmation modal. Confirming retreat returns to the Codex and discards uncommitted run rewards.
- Victory EXP must be awarded before run stats are cleared. This prevents the result panel from showing EXP that is not actually saved to the character.
- Sweep attempts have a daily baseline of 3 attempts.
- Extra sweep attempts can be purchased with spirit dust. The same-day price is `5 * purchase number`, so the first purchase costs 5, the second costs 10, and the third costs 15.
- The daily sweep purchase count resets when the local date changes.
- Sweep now awards repeat-clear EXP for the selected map, but does not award first-clear bonus EXP.
- Replaced equipment returns to the equipment bag. Unequipped equipment can be dismantled after confirmation for spirit dust and iron sand. Equipped items cannot be dismantled until they are unequipped.
- Entering the Equipment page or opening an equipment bag should not auto-select the previously selected slot or item. The player must explicitly choose a slot/item before actions appear.
- Blacksmith is a multi-function building with top tabs. Current tabs are Crafting and Enhancement. Crafting is a placeholder; Enhancement is the active MVP loop.
- Blacksmith enhancement uses an equipment-page-like six-slot layout. Clicking a currently equipped slot selects it as the enhancement target; it does not open the equipment bag.
- Blacksmith enhancement can enhance currently equipped gear to +3. Enhancement level is stored on the equipment item, persists in PlayerPrefs, and resets when clearing the test save.
- Enhancement costs are +1: 5 spirit dust and 2 iron sand, +2: 10 spirit dust and 4 iron sand, +3: 15 spirit dust and 6 iron sand.
- Offensive slots (weapon, gloves, accessory) gain attack +2 per enhancement level. Defensive slots (helmet, armor, boots) gain HP +5 and defense +1 per enhancement level.
- Blacksmith enhancement buttons support 1x, up to 5x, and up to 10x enhancement. Current MVP still caps gear at +3, so batch enhancement stops at the cap and requires enough materials for the available steps.
- Equipment auto-equip chooses the best owned and wearable item per slot by score. The MVP score prioritizes actual combat stats first: attack, defense, HP, quality, and level requirement. Future set bonuses should be added as score modifiers instead of blindly prioritizing sets over stronger mixed gear.
- Blacksmith no longer shows the generic bottom selected-item notice in the full-screen panel. Enhancement batch buttons are centered in the selected equipment detail bar.
- Blacksmith Crafting is now an active MVP loop. The first craftable recipes are Ember Bow, Forgefire Gloves, and Alchemy Furnace Talisman.
- Crafting consumes spirit dust and iron sand, then adds the crafted equipment to the Equipment page's equipment library. Crafting does not auto-equip the item.
- Crafted equipment cannot be duplicated in the current MVP. If the item is already owned, the recipe shows an owned state instead of allowing another craft.
- Default owned equipment is limited to the starter six-slot set. Craftable and higher-tier equipment should be earned through crafting, drops, or later reward systems.
- Shop purchase flow supports quantity controls. The player selects a product, adjusts quantity with minus/plus/max buttons, then buys the selected quantity in one action.
- Alchemy Shop is now an active MVP building. The first recipe is Body Tempering Pill, capped at Lv.3.
- Body Tempering Pill costs red herb and spirit dust. Costs scale by target level: Lv.1 costs 2 red herb and 4 spirit dust, Lv.2 costs 4 red herb and 8 spirit dust, Lv.3 costs 6 red herb and 12 spirit dust.
- Each Body Tempering Pill level grants permanent hero HP +10. The bonus is applied to combat stats, shown in the Character page, saved in PlayerPrefs, and reset by the test clear-save action.
- Evolution Tower is now an active MVP building. Hero evolution is manual and happens in town, not automatically during battle.
- Evolution requirements are now multi-gate instead of material-only. Stage 1 requires hero Lv.5, Codex Page 1 map 3 cleared, Skill S1 Lv.2, Body Tempering Pill Lv.1, 60 spirit dust, 20 red herb, and 12 iron sand. It grants HP +20, attack +4, defense +2.
- Evolution Stage 2 requires hero Lv.10, Codex Page 1 map 3 cleared, Skill S1 Lv.3, Body Tempering Pill Lv.3, 120 spirit dust, 40 red herb, and 25 iron sand. It grants HP +30, attack +6, defense +3.
- Evolution Tower UI keeps the main panel focused on current stage, next stage, evolution gains, and a single action button. When requirements are missing, the action button reads "查看所需条件" and opens the detailed level, map progress, skill, pill, and material checklist in a modal instead of permanently occupying panel space.
- Evolution stage persists in PlayerPrefs, appears in the Character page, applies to combat stats, and resets with the test clear-save action.
- The legacy `EvolutionUI` auto-evolution behavior is disabled so materials are not consumed outside Evolution Tower.
- Evolution Tower UI layout test: open Town -> Evolution Tower at the current editor Game view size, confirm no requirement list extends outside the tower panel, click "查看所需条件", confirm the modal lists all missing gates, close it, then satisfy the requirements and confirm the button changes to "进化" and performs the evolution.
- Character page now uses a dedicated card layout instead of one long text block. The left card shows the main hero portrait placeholder, class/position, level/EXP, base stats, equipment, pill, and evolution bonuses. The right card shows three team-slot cards.
- Character page no longer shows the generic bottom notice bar, so the stat rows and team-slot cards do not overlap with page chrome.
- Character page stat bonuses are shown as compact two-column cells with short labels (`生/攻/防`) so HP, attack, defense, equipment, pill, and evolution bonuses stay readable at the current 16:9 editor scale.
- Character page now shows the second team slot as an open recruitment placeholder after Hero Lv.3: "可招募队友 / 职业待选择 / 中排 / 前往招募系统". It is not fixed to one character or class. This is display-only; battles still use the single hero until the later recruitment and multi-character combat slices.
- Character page team-slot test: open Town -> Character and confirm the page is split into a left hero stat card and right team-slot cards with no bottom notice overlap; confirm the four stat cells fit without clipping their values; at Hero Lv.1 or Lv.2 slot 2 should say it unlocks at Hero Lv.3; level the hero to Lv.3 through map clears or sweep EXP, reopen Character, and confirm slot 2 shows the recruitable placeholder while entering battle still spawns only the main hero.
- Town MVP test UI now supports two pages. Page 1 keeps the original nine core loop buildings. Page 2 is reserved for expansion/test systems and currently exposes 招贤阁 as the first real entry; other Page 2 slots are placeholders.
- 招贤阁 is currently an MVP placeholder panel with an adaptive compact test layout: top currency bar, recruitment-pool candidate cards, and a single action panel containing disabled 单次招募 / 十次招募 buttons plus recent-result/guarantee text. Candidate cards and the action area now size themselves from the available panel height, and narrow panels fall back to stacked one-line candidate cards. It does not use the generic bottom town notice bar. Actual recruit currency, pull logic, ten-pull guarantee, ownership saving, and role-slot binding are the next recruitment slice.
- Town pagination and 招贤阁 layout test: open Town, confirm Page 1 still has the original nine buildings, click `>` to reach 城镇 2/2, click 招贤阁 and confirm the placeholder panel opens with candidate cards and action buttons without any bottom overflow, overlap, or clipped text. Candidate names, rarity labels, and role text must render as full Chinese characters, not half-height clipped glyphs. Resize the editor Game view smaller and reopen 招贤阁; candidate cards should stay inside the pool area and the action panel should keep both buttons plus the recent-result/guarantee line visible. Close it, click `<` to return to 城镇 1/2, and confirm core Page 1 buildings still open normally.
- A separate paid test currency, 仙玉, now exists outside the tradable material/backpack system. New and cleared MVP saves start with 9999 仙玉 for testing purchases. 仙玉 and 招贤令 persist in PlayerPrefs and reset through the existing clear-save action.
- Shop now has an 招募 category. The first 招募 product is 招贤令, priced at 1 仙玉 each. Buying it consumes 仙玉 and increases the saved 招贤令 count; ordinary shop goods still use 灵尘. Shop quantity controls now support minus, plus, max, and direct numeric input; the input can be cleared before typing a new quantity, and purchase is disabled while the field is empty.
- Inventory now has category tabs: 全部, 炼丹, 炼器, 成品丹药, 招募, and 进化. 招贤令 appears in the 招募 category and in 全部. Current MVP keeps finished equipment in 装备阁 instead of duplicating it in 背包.
- Town Page 2's 任务榜 is now the task panel location. The task panel is no longer embedded in 灵素图谱, so the Codex page can stay focused on map challenge/sweep state. 任务榜 contains 主线任务 / 支线任务 tabs. Main tasks are claimable retroactively from completed Page 1 maps, so players who already cleared maps 1, 2, and 3 can claim the Page 1 main rewards without resetting. Side task MVP currently rewards completing any sweep once. Task reward claim states persist in PlayerPrefs and reset with clear-save.
- 灵素图谱 page has been simplified after moving tasks out: map nodes now sit inside one framed map area, each map card owns its sweep button, and notice / sweep-purchase / Page 2 placeholder controls are anchored above the return button instead of overlapping the map/task content.
- 仙玉 / 招贤令 / 商店 / 背包 / 任务榜 test: open Town and confirm the top resource line shows 仙玉 9999 on a new or cleared save. Open Shop -> 招募, clear the quantity input, type a quantity manually, buy 招贤令, and confirm 仙玉 decreases and 招贤令 increases. In the purchase-success modal, click 确定 and confirm the modal closes. Open 背包 -> 招募 and confirm 招贤令 is visible but not sellable. Reopen 招贤阁 and confirm the top bar shows the new 招贤令 count. Open Town Page 2 -> 任务榜, switch between 主线任务 and 支线任务, claim any completed Page 1 main-task rewards, confirm 招贤令 / 仙玉 / 灵尘 rewards are added only once, restart Play Mode, and confirm claimed states plus currency counts persist. In 灵素图谱, clicking a map card should enter battle, while clicking its bottom 扫荡 button should sweep without entering battle.
- 招贤阁 now has a real MVP recruitment loop. The current recruit pool is 青木术士（普通 / 法师 / 中排）, 铁甲卫（普通 / 守卫 / 前排）, and 炼药童子（稀有 / 辅助 / 后排）. 单次招募 consumes 1 招贤令. 十次招募 consumes 10 招贤令 and guarantees at least one 稀有 result. Newly drawn characters become owned; duplicate draws convert into fragments, with 普通 duplicates giving 5 fragments and 稀有 duplicates giving 10 fragments.
- Recruit ownership and fragment counts persist in PlayerPrefs and reset through the existing 清存档 action. The 招贤阁 panel now shows owned state and fragments on the candidate cards, shows the latest result in the action area, and opens a modal with the detailed pull result. When 招贤令 is insufficient, the action button remains clickable and opens a requirement modal instead of silently doing nothing.
- 角色阁 team slots now read recruit ownership. Slot 2 unlocks at Hero Lv.3 and shows the first owned recruit; Slot 3 unlocks at Hero Lv.6 and shows the second owned recruit when available. Current MVP combat still uses only the main hero; recruits are displayed as team members but do not spawn in battle yet.
- 招贤阁 recruitment test: open Town -> Page 2 -> 招贤阁 with 0 招贤令, click 单次招募 and 十次招募, and confirm each modal explains the required 招贤令 count. Go to Shop -> 招募, buy at least 10 招贤令, return to 招贤阁, run 单次招募 and confirm 招贤令 decreases by 1, a result modal appears, and the candidate card changes to 已拥有 or gains fragments. Run 十次招募 and confirm 招贤令 decreases by 10 and the result includes at least one 稀有. Reopen 角色阁 at Hero Lv.3+ and confirm Slot 2 shows the owned recruit; restart Play Mode and confirm 招贤令, owned recruits, and fragments persist. Click 清存档 and confirm recruits/fragments reset while 仙玉 returns to 9999.
- Town building cards no longer treat the first entry on each page as a selected/primary card. The green emphasis is now only a hover highlight, so 灵素图谱 and 招贤阁 should use the same idle background as other real building entries.
- 角色阁 now includes an 已招募名册 section under the team slots. It lists every owned recruit with rarity, role, position, and fragment count, while the team slots remain a compact view of the first two recruitable positions.
- Town/Character UI correction test: open 城镇第一页 and 城镇第二页 without hovering the first card and confirm the first card does not keep a permanent green selected background. Move the mouse over any building and confirm only the hovered card highlights. Open 角色阁 after recruiting multiple characters and confirm the right side shows both 队伍槽 and 已招募名册, with all owned recruits visible and no overlap at the current 16:9 editor Game view.
- 角色阁名册 is now interactive. Clicking an owned recruit selects it, then `上阵2` / `上阵3` assigns that recruit to the corresponding team slot if the slot level gate is unlocked. Team-slot assignment persists in PlayerPrefs and is reset by 清存档. This still controls display only; actual multi-character combat remains a later slice.
- Recruit fragments now have a visible star-up sink. Owned recruits start at 1星 and can upgrade to 10星. The current MVP fragment costs are: 2星 20, 3星 40, 4星 70, 5星 110, 6星 160, 7星 220, 8星 290, 9星 370, and 10星 460. Star level persists in a dedicated RecruitStar PlayerPrefs field and does not inherit the earlier temporary RecruitRank value, so old test saves should not accidentally show 2星. Star level is shown in both 队伍槽 and 已招募名册.
- Recruit roster interaction test: open 角色阁 after owning at least two recruits, click different rows in 已招募名册, confirm the selected row highlights, click `上阵2` and `上阵3`, and confirm 队伍槽 changes to the selected recruit without duplicating the same recruit in both slots. In 名册, select a recruit and confirm the bottom button says `升至X星 cost` when fragments are enough, or `升至X星 碎片current/cost` when fragments are not enough. Click the button only when it is enabled, then confirm fragments decrease by the displayed next-star cost and the recruit star level increases by 1. Restart Play Mode and confirm selected team slots plus star level persist.
- 角色阁 has been split into top tabs: 属性, 布阵, and 名册. 属性 only shows the main hero stat card. 布阵 shows team slots plus a recruit picker and owns `上阵2` / `上阵3`. 名册 shows all owned recruits and owns fragment star-up. This avoids the previous overlap where team slots, roster rows, and synthesis/formation buttons were all drawn in one right-side column.
- Character tab layout test: open 角色阁 and switch between 属性 / 布阵 / 名册. 属性 should show only the hero stat card with no roster controls. 布阵 should show team slots on the left and selectable owned recruits plus `上阵2` / `上阵3` on the right, with no text or button overlap. 名册 should show all owned recruits and a single synthesis button at the bottom; no formation buttons should appear there. Resize the 16:9 Game view smaller and confirm each tab remains usable.
- 角色阁布阵 has been upgraded from fixed team slots into a 3x3 formation grid. The main hero is fixed in the current MVP left-middle slot. 布阵 only shows the grid, owned recruit names, and a confirm action; recruit intro/skill details are intentionally limited to 名册. To place a recruit, select a non-hero grid cell on the left, select an owned recruit name on the right, then click `确认上阵`. Placing the same recruit in a new cell moves it instead of duplicating it. Old TeamRecruitSlot2/3 test saves migrate into the new grid, and if a save has owned recruits but no grid data the first two owned recruits are placed into default middle/back cells.
- 灵素图谱 battle visuals now read the 3x3 formation. The player side is arranged as a left 3x3 grid and the monster side as a right 3x3 grid, both using left-to-right columns and top-to-bottom rows. Recruited allies create lightweight visual placeholders with names on the player grid. The current slice is visual/formation sync only: actual damage, enemy targeting, ally HP, ally skills, and selected-character skill-bar switching still run through the main hero and are the next combat slice.
- Battle ally placeholders must read as visible characters, not small dots: each recruited ally uses a larger named silhouette keyed by recruit name, e.g. 铁甲卫 has a blue heavy-armor/shield look, 青木术士 has a green caster look, and 炼药童子 has a gold support look. Before entering battle, formation sync also backfills default recruit cells from owned recruits if the saved grid is empty.
- Recruited allies are now lightweight combatants instead of pure visuals. They auto-attack the current monster/boss target on their own interval using their star-scaled recruit attack. Clicking a deployed ally selects it, scales/highlights the ally visual, updates the skill bar's selected-character label, and switches the two skill buttons to that ally's MVP skills: 铁甲卫 uses 盾击 / 铁壁, 青木术士 uses 青木术 / 缠木, and 炼药童子 uses 回春弹 / 药雾. Ultimate and potion remain shared MVP buttons for now.
- 角色阁 -> 属性 now has a role selector. It can inspect the main hero and every owned recruit. Recruit detail shows rarity, role, position, star, fragments, HP/attack/defense, normal attack damage, skill one damage, and skill two damage. These recruit damage values match the current MVP battle formulas.
- Formation battle sync test: open 角色阁 -> 布阵 after owning at least two recruits, click a non-hero grid cell on the left, click a recruit name on the right, then click `确认上阵`. Repeat with another cell and recruit. Confirm 布阵 does not show intro/skill text; those details only appear under 名册. Restart Play Mode and confirm the grid persists. Enter 灵素图谱 battle and confirm the main hero plus placed recruits appear in a left 3x3 layout, while monsters appear in a right 3x3 layout. Move a recruit to another grid cell, re-enter battle, and confirm the left-side visual position changes. Confirm no 角色阁 tab text, grid label, action button, or bottom hint is clipped at the current 16:9 editor Game view.
- Ally combat test: deploy 铁甲卫 or another recruit, enter battle, and wait 1-2 seconds. Confirm additional damage numbers appear from the ally's position even when the main hero has not just attacked. Click 铁甲卫 and confirm it becomes visually highlighted/scaled, the skill bar label changes from 主角 to 铁甲卫, and the two skill buttons read 盾击 / 铁壁 instead of 技能一 / 灼烧. Click those skills and confirm damage numbers use the 铁甲卫 skill values from 角色阁 -> 属性. Click the main hero and confirm the buttons return to 技能一 / 灼烧.

## 文档维护规则

每开始一个新切片前：

- 写清楚目标行为。
- 写清楚验收标准。

每完成一个切片后：

- 更新完成状态。
- 记录已知问题。
- 记录下一步要测什么。

这样可以避免 MVP 越做越散。
