# LingsuMVP

`LingsuMVP` 是 SpiritCodex 当前的 Unity/Tuanjie 原型工程。

它现在的目标不是发布正式游戏，而是用一个个小闭环验证核心玩法。长期目标仍然是移动端策略养成手游；Windows `.exe` 只是本地测试用的临时构建。

## 当前原型状态

当前已经验证的最小循环：

```text
进入战斗
  -> Hero 和小怪自动战斗
  -> 小怪死亡后掉落材料
  -> 敌人清空后出现 Victory
  -> Hero 死亡后出现 Defeat
```

这说明第一个最小 MVP 已经跑通，但它还不是一个完整战斗 Demo。

## 重要场景说明

现在只使用这个场景：

```text
Assets/Scenes/GameSceneClean.unity
```

不要打开旧的 `GameScene.unity` 或 `.bak` 备份文件。旧场景已经损坏，曾经导致编辑器崩溃。

干净场景主要依赖运行时自动搭建：

```text
Assets/Scripts/MVPBootstrapper.cs
```

## 当前脚本职责

| 文件 | 作用 |
| --- | --- |
| `BattleManager.cs` | 管理自动战斗、攻击计时、胜负判断 |
| `Hero.cs` | Hero 血量、攻击、防御、受伤、重置 |
| `Monster.cs` | 小怪/Boss 血量、攻击、防御、死亡 |
| `DropSystem.cs` | 材料掉落和材料数量 UI |
| `EvolutionUI.cs` | 临时进化测试逻辑 |
| `GameManager.cs` | 游戏状态、Victory/Defeat 面板、重开流程 |
| `MVPBootstrapper.cs` | 运行时创建相机、UI、Hero、小怪和管理器 |

## 当前限制

这些问题在当前阶段是预期内的：

- 没有可见攻击动作。
- 没有弹道、斩击、命中特效、伤害数字。
- 还没有真正的技能系统。
- 还没有移动端战斗 UI。
- 还没有队伍和站位系统。
- 还没有城镇、角色界面、进化界面。
- 进化目前只是为了验证“掉落材料 -> 属性增强”的临时逻辑，后续应移出战斗地图。
- Victory/Defeat 按钮还需要补完整 UI 输入处理，才能稳定点击。

## 编辑器测试流程

1. 打开 Tuanjie Hub。
2. 打开 `LingsuMVP` 项目。
3. 打开 `Assets/Scenes/GameSceneClean.unity`。
4. 点击 `Play`。
5. 检查：
   - Hero 和小怪能显示。
   - 战斗中血量会变化。
   - 敌人清空后出现 Victory。
   - Hero 死亡后出现 Defeat。
   - Console 没有红色报错。

## Build 策略

不要每改一点就 Build。

只有在这些情况才 Build：

- 一个完整小切片已经做完。
- 编辑器 Play Mode 已经验证通过。
- 需要确认 Windows 独立运行版是否正常。

当前阶段主要在编辑器 Play Mode 里测试。

## 下一阶段目标

下一阶段是：

```text
v0.2 战斗表现原型
```

目标：

```text
让当前自动战斗看起来像一场真正的战斗。
```

计划功能：

- Hero 和小怪头顶血条。
- 可见的普通攻击反馈。
- 简单弹道或攻击闪光。
- 目标受击闪烁。
- 飘字伤害数字。
- 死亡淡出或缩小。
- Victory/Defeat 按钮可点击重开。
- 暂时隐藏战斗中的 Evolve 按钮。

详细拆分见：

```text
docs/mvp-development-plan.md
```
