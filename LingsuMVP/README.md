# LingsuMVP · 最小可行测试

> 灵素图谱的最小可运行单元，用于验证核心循环是否走得通。

## 🎯 定位

本目录是 **SpiritCodex 的一个子项目**，采用「小步验证」策略：

```
SpiritCodex（主项目，统一规划）
├── LingsuMVP/          ← 本目录：最小闭环测试
│   ├── 战斗 → 掉落 → 进化 → 通关
│   └── 验证核心玩法循环是否成立
└── 其他子模块/          ← 后续逐步拆分测试
    ├── 角色系统
    ├── 元素融合
    ├── PVP 模块
    └── ...
```

## 📦 当前实现（v0.1）

仅包含 **6 个脚本**，跑通最基础的游戏循环：

| 文件 | 职责 |
|------|------|
| `BattleManager.cs` | 战斗流程管理 |
| `GameManager.cs` | 游戏状态管理 |
| `Hero.cs` | 角色属性与技能 |
| `Monster.cs` | 怪物AI与属性 |
| `DropSystem.cs` | 掉落逻辑 |
| `EvolutionUI.cs` | 进化界面 |
| `GameScene.unity` | Unity场景 |

## 🔄 核心循环（已验证）

```
战斗 (BattleManager)
  → 击杀怪物 (Monster)
    → 触发掉落 (DropSystem)
      → 获得材料
        → 进化角色 (EvolutionUI)
          → 阵容变强
            → 挑战更高难度关卡
              → 循环
```

## ⚠️ 缺失内容（未完成）

- Unity 项目配置文件（`Packages/manifest.json` 等）
- UI 界面（主菜单、背包、关卡选择）
- 数值平衡与配置表
- 存档与持久化
- Android APK 打包

## 📐 设计原则

1. **MVP 优先**：先跑通核心循环，不做复杂设计
2. **快速验证**：每个子模块独立测试后再合并
3. **原子化拆分**：一个目录测一个明确的小目标
4. **数据驱动**：数值和配置与代码分离

## 🔗 关联

- 主设计文档：`game-design-doc.md`
- 美术设计文档：`game-art-design.md`
- 仓库：https://github.com/qnctx/SpiritCodex