# v10：真实战场动作与功能测试场

日期：2026-09-06。

后续更新：角色技能已由 [v11 的48个独立技能动作](SKILL_PERFORMANCE_V11.md) 接替通用动作分类；本文件记录 v10 合击实战接入与历史验收。

## 这次改变

- 普通攻击、战术技能、角色大招、元素融合、敌方和召唤物攻击接入动作时间轴。复用十二角色四姿态素材，其他单位用局部网格变形表现出手与受击。
- 规则仍只结算一次；视觉保存前后快照。血条、死亡和飘字等攻击到达再变化，不再先扣血随后空等。
- 双方左右相向错列，按画布高度分配人物和姓名血条空间；操作按钮不压住怪物。
- 正式合击直接画在 `battle-canvas`，不会弹出另一套训练守卫或替身场景。实际施法者、武器出口、留场召唤物、独立攻击及真实受击对象共用坐标，六主题环境同步变化。
- 图鉴免费演练仍保留；新测试场运行正式规则，使用临时队伍和道具，退出恢复正式数据。

## 动作与边界

普通动作约 0.9–1.3 秒：预备、挥击/施法、攻击到达、受击、收势。完整合击 8.4 秒，4.7 秒开始命中，多目标错开 110 毫秒。凤凰留场振翼降火羽，青龙留场吐息，圣垒发射光枪并结盾，生命树向队友输送复苏水流，双刃释放斩波，魂阵派出独立攻势。沿用原画和动态网格，不是完整图鉴撞向怪物，也不是真正三维模型。

跳过只加速视觉，不能重复伤害/消费/推进回合。退出、重开、训练切配方和重置靶子取消旧时间轴。减少动态模式保留结算结果并减少运动。没有新增图片，也没有改正式合击数值或库存规则。

## 测试步骤

1. 刷新游戏，从标题或城镇点 **战斗测试场**。
2. 点任一 **六种合击 · 一键真实施放**：自动准备角色、60 / 40 能量、临时道具和真实前置，再执行正式合击。
3. 观察同一张战场：双人出手→汇聚→召唤物朝向合法目标→独立攻击命中→对应血量/护盾变化。生命树应治疗和复活队友。
4. 六种各测一次，分别完整播放或点 **跳过演出**。准备时临时道具 3 件，施放后 2 件；跳过不再消费。
5. 切换十二角色并点普通攻击/战术/大招；用 **回满生命 / 能量 / 冷却**、**重置靶子** 反复测试；点 **敌方行动一次** 看怪物出手与我方受击。
6. 点 **开启自动连战** 看双方动作和波次推进；训练无奖励。手机可收起测试面板扩大战场，展开后可滚动到所有控件。
7. 演出中退出再进入，正式资源、阵容、成长与存档应不变，旧演出不能回来。
8. 正常出征确认普通动作一致；正式满足合击前置并手动施放，表现应与训练一致，正式道具正常消费。

详细隔离与操作见 [BATTLE_LAB.md](BATTLE_LAB.md)。动作模块 `spirit-codex-battle-motion.js` 只维护视觉；`spirit-codex-live-combo.js` 适配现有美术渲染器到真实画布；训练模块通过正式写入、重置和奖励入口的保护保证不改存档。

## 验证

本轮独立浏览器用例 **136/136** 通过：规则/战前准备覆盖 desktop、tablet、mobile、compact 的 84 项；动作、免费演练、网格/器官出口、环境、真实战场、取消清理及49资源覆盖 desktop/compact 的 52 项。新增用例直接截获实际 Canvas 裁切、变换和血条绘制，不仅检查调试状态。

纯 Node 测试 **15/15** 通过：普通动作8项（命中、盾破、死亡、治疗/召唤、姿态尺寸及镜像锚点、敌召局部网格、减少动态、取消和随机不变）；测试场7项（状态隔离、正式引用/RNG/UID恢复、令牌、禁止正式战斗进入、写入保护、异步加载退出/重开）。

`file://` 桌面1366×768与紧凑360×640六套合击的聚能、成型、出招、命中共48张阶段图，均无脚本错误或页面横向溢出；另复拍最终人物尺寸修正后的凤凰/青龙与普通动作。没有触碰用户浏览器的正式存档。

复测命令：

```sh
node --test tests/playable/spirit-codex-battle-motion.test.cjs tests/playable/battle-lab.unit.cjs
npx playwright test tests/playable/spirit-codex-combos.spec.js tests/playable/spirit-codex-preparation.spec.js --workers=1
npx playwright test tests/playable/spirit-codex-combo-actions.spec.js tests/playable/spirit-codex-combo-motion.spec.js tests/playable/spirit-codex-combo-choreography.spec.js tests/playable/spirit-codex-combo-environment.spec.js tests/playable/spirit-codex-live-battle.spec.js --project=desktop --project=compact --workers=1
node tests/playable/live-battle-visual-qa.cjs
```
