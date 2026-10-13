# 计划：M3 战斗内核重构（M3A）+ 草原内容量产（PLAN-M3）

> 承接：codex 2026-10-11 启动 M3A 后中断，ZCode 接续。规划蓝本 = `docs/_review/research-notes.md`（PvZ1 反编译一手数值 + 借鉴决策表，W0 落盘）+ 工作区已产出的内核六模块。
> 上游：M2 已完结（E1-E10 全绿、线上部署，见 PLAN-M2）。DEV-PLAN §5 M3 目标：草原 32 关 + 13 单位 + 10 敌人 + Boss + 三星挑战 + 无头模拟 50 局/关胜率方差 ≤35%。

## 1. 激活机制清单

提问闸门（接替时 3 问：范围/渲染壳策略/选卡面板，已拍板）｜todo 每步更新｜收尾独立审查｜知识盘点（W0 已做：反编译仓库一手来源）｜两轮打磨

## 2. 用户拍板记录（2026-10-11）

1. **范围 = M3A 收尾**：恢复可玩 + 内核测试 + 模拟器 + PLAN 落盘 + 提交；32 关量产留下一会话。
2. **渲染壳 = 旧表现逐块移植**：M2 验收版的表现逻辑套到内核 API 上，不加戏。
3. **选卡面板 = 本次一并做**（W6 简化版）：内核 DECK_CAP=8 与 M2"卡组=全部拥有"矛盾，采纳调研决策表"局前选卡 owned ≤8 默认全选"。

## 3. W 分步与现状

> codex 中断时 W 分步只在 research-notes 决策表留有残影（W0/W4/W5/W6 被点名）；接替时按下表重排，已完成项以工作区实际产出为准。

| # | 步骤 | 状态 | 独立验收 |
|---|---|---|---|
| W0 | PvZ1 反编译调研（research-notes.md） | ✅ codex | 一手来源表 + 数值锚点表 + 借鉴决策表 |
| W1 | 无头战斗内核六模块（core/battle/：types/layout/traits/power/director/sim） | ✅ codex | 零 Phaser 依赖、确定性 RNG、事件输出 |
| W2 | balance.ts M3A 重锚（啃食 100dps/清场加速/大波灌场/Boss 召唤/盾量） | ✅ codex | 数值全部可溯源 research-notes |
| W3 | BattleScene 重写为渲染壳（step + drainEvents → 图像同步与 FX） | ✅ 接续 | tsc 0 错；浏览器实玩种植/波次/倍速/暂停/推车/结算 |
| W3b | scenes/battleGeometry.ts 改为内核 layout.ts 的 re-export（消除双源） | ✅ 接续 | battleGeometry.test 继续绿 |
| W4 | tests/sim.test.ts：内核单测 + 6 关无头托管模拟（SIM_DT_MS=50） | ✅ 接续 | 确定性断言；模拟终态合法；vitest 全绿 |
| W5 | 大波灌场/清场加速/植物食物/传送带（内核行为） | ✅ codex（内核侧） | 渲染壳表现由 W3 覆盖 |
| W6 | 局前选卡面板（owned ≤8 默认全选；传送带关跳过） | ✅ 接续 | MenuScene 选关→选卡→进战斗；卡组生效；浏览器实测通过 |
| W7 | M3 内容量产：草原 32 关 + Boss 关 + 模拟 50 局/关方差 ≤35% | ⬜ 下一会话 | DEV-PLAN §5 M3 验收；含 GDD"不连续 3 波同敌"跨波约束与 M3-D4 laneDedupe 裁决 |

## 4. 渲染壳架构（W3 定稿）

- 内核唯一事实源：`createBattle(config)` 建 `BattleState`；场景每帧 `step(state, dt*speed)` → `drainEvents(state)` 逐事件出 FX → 渲染层是内核状态的**投影**（单位/敌人/弹体/掉落图像每帧同步内核坐标，diff 增删）。
- 命令路径：点击格子 → `cmdPlant/cmdDig`；点露珠 → `cmdCollectDrop`；能量豆按钮 → `usePlantFoodOnUnit/usePlantFoodAtCell`。场景不再持任何逻辑数值（光露/波次/冷却/血量全在内核）。
- 事件→FX 映射保留 M2 打击感件套：squash/debris/floatText/bannerText/flashBanner/震屏；推车拦截、终波震屏、种植尘土、冷却遮罩全部保留。
- 传送带关：种子条区域改画传送带手牌（内核 `state.conveyor.hand` diff 同步），卡免费免冷却（内核 cmdPlant 已处理）。
- 结算写档沿用 M2 `levelClearReward`；win/lose 事件驱动。

## 5. 留痕裁决表

| # | 裁决 | 理由 | 错了损失什么 |
|---|---|---|---|
| M3-D1 | 选卡默认=owned 截前 8，选卡面板可改；F5 直进战斗走同一兜底 | 内核 DECK_CAP=8 已写死；PvZ1 种子槽口径 | 玩家不能用 >8 卡组（PvZ 同款上限，非损失） |
| M3-D2 | 传送带关跳过选卡（手牌全来自传送带） | conveyor 模板 startingLight=0 且 cmdPlant 走 hand 路径 | 无 |
| M3-D3 | sunCollect/plantFoodCollect 事件补 did 字段（内核增量改动） | 渲染层收集动画需定位图像实例；x/y 匹配在掉落重叠时脆弱 | 模拟测试不受影响（纯增量字段） |
| M3-D4 | 旧版"teach 前 3 波每行至多 1 只" laneDedupe 未入内核 | codex 内核改用全随机行 + 前 3 波保底全池出现；回归 PvZ 口径 | 新手首波同 row 2 只概率回升（模拟 W4 终校，超标则回补） |
| M3-D5 | 接续修复内核两处确定性/单位问题：betweenWavesMs 的 Math.random 改 state.rng；波内首怪延迟 0.5→500ms（旧版秒制残留） | 确定性是内核立身之本；ms 时基下 0.5ms≈立即出怪 | 模拟不可复现；首怪贴脸 |
| M3-D6 | 独立审查 P1×4 全修（banner hold 秒→ms、恒真断言重写、大招伤害改走 damageEnemy 统一入口、濒死敌人立即结算），P2×6 修（事件穷尽 case、registry level 一次性消费、死代码+无用导入清理）；"不连续 3 波同敌"跨波约束与 sim↔power 循环导入拆分（damage.ts）留 W7 | 全部为修法唯一的 bug/卫生项，不属实质分岔；复审确认无回归 | 无 |

## 6. 风险与对策

| 假如已失败，原因是 | 对策 | 切换判据 |
|---|---|---|
| 渲染壳与内核坐标/时基不同步（倍速漂移） | 一切坐标读内核实例；dt 只在 step 入口缩放 | 浏览器 2× 倍速目视弹体贴敌人 |
| 模拟托管策略太弱 → 全败方差无意义 | W4 先断言"终态合法+确定性"，胜率只输出不设闸；量产时再调 AI | — |
| 6 关数值被 M3A 重锚改坏（1-1 不再可通） | W4 模拟跑胜率；1-1 教学关必须可赢，否则回读 research 数值重校 | 1-1 托管 20 局胜率 = 0 |
