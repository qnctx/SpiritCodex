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
Burn / Ult 固定伤害 = max(1, 技能配置伤害)
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

## 文档维护规则

每开始一个新切片前：

- 写清楚目标行为。
- 写清楚验收标准。

每完成一个切片后：

- 更新完成状态。
- 记录已知问题。
- 记录下一步要测什么。

这样可以避免 MVP 越做越散。
