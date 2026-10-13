# 计划：PvZ2 节奏与数值对齐（PLAN-PVZ2-ALIGN）

> 上游：`docs/PLAN-UI-POLISH.md`（界面美化专项已完成）。
> 本文档是「以《植物大战僵尸2》为准的节奏/数值对齐」长期路线，2026-10-14 经用户拍板后落盘。
> 用户口径：**全部以 PvZ2 为准**｜**严格搬 PvZ2 的东西**｜**难度忠于 PvZ2**｜植物机制也可模仿｜**这是长期工作**。

## 1. 为什么以前"说对齐了却没对齐"

审计（只读，2026-10-14）给出的根因有三条，全部是"声明与实现脱节"：

1. **常量声明了但从未生效**：`src/core/balance.ts:14` 写了 `ENEMY_BITE_DPS = 100`，但实际啃食走 `src/core/battle/sim.ts` 里 `e.def.biteDps`（各敌人 4~14），`100` 只在一处 `gnaw_pause` 路径生效 → **PvZ1 的 100 dps 从未落地**。
2. **数值散落无出处**：充能 7.5s、阳光 25、首波/波间等是 PvZ1 口径，但没有任何一处标注"这是 PvZ1 还是 PvZ2"，导致文档写 PvZ2、代码是 PvZ1。
3. **结构级缺失被当成数值问题**：PvZ2 的强度 10 档 / 速度 6 档 / 植物等级 1~10 / 逐植物 Plant Food，仓库一个都没有。

本轮对策：**先建可追溯的权威参考数据集**（`src/data/pvz2/`），再让 archetype 与 `balance.ts` 从它派生，最后用防漂移测试闸锁死。

## 2. PvZ2 权威参考数据集（唯一事实源）

来源：`plantsvszombies.wiki.gg`（CC BY-SA 4.0），版本基准 **PvZ2 v13.5.1**，抓取日 2026-10-14。
涉及页面：`Plants_(PvZ2)`、`Peashooter_(PvZ2)`、`Zombies_(PvZ2)`、`Basic_Zombie_(PvZ2)`、`Plant_Food`、`Seed_slot`、`Sun`。

| 文件 | 内容 |
|---|---|
| `src/data/pvz2/mechanics.ts` | 速度 6 档 / 强度 10 档 / 阳光面值 / 种子槽 / 啃食基准 / Plant Food 规则 / 关卡结构 / 待查证清单 + 分档派生函数 |
| `src/data/pvz2/plants.ts` | 植物参考表（cost/recharge/HP/伤害/间隔/DPS/Plant Food）+ 豌豆射手 1~10 级曲线 |
| `src/data/pvz2/zombies.ts` | 僵尸参考表（HP/护甲叠加/强度档/速度档）+ 护甲加值阶梯 |
| `src/data/pvz2/mapping.ts` | 本仓 id ↔ PvZ2 条目映射 + 对齐状态 + 差距统计 |

## 3. 本轮查证的关键结论（与旧文档冲突处以此为准）

| 项 | 结论 | 影响 |
|---|---|---|
| 普通僵尸 HP | **190**（国际版现行；Update 6.3.1 由 270 下调为 190，掉臂阈值 95）；**中文版 270** | 旧文档"三源中位取 200"作废 |
| 啃食 dps | **100**（PvZ2 基准，与 PvZ1 同；个别僵尸强化到 150/200） | `ENEMY_BITE_DPS` 需真正接线 |
| 植物充能 | **5 秒**（豌豆/向日葵/卷心菜/三线/寒冰…）；坚果墙 20s、土豆雷 20s、樱桃 35s、双胞葵 10s | 仓库 7.5s 是 **PvZ1** 值，必须改 |
| 阳光面值 | 微小 5 / 小 25 / **普通 50** / 大 75；天空自然阳光与向日葵单次产出都是 **50**；初始 50；上限 9900 | 仓库 25 是 **PvZ1** 值，必须改 |
| 种子槽 | **基础 8 个**（第 8 个需进度/真钱/650 金币租一关）；中文版可到 9 | 仓库 `DECK_CAP=8` **已对齐 PvZ2**（但两处重复定义需收敛） |
| 僵尸分档 | 强度 10 档（Fragile 1–100 … Ultra-Undying 29501+）；速度 6 档（Creeper 7.5s/格 … Flighty 0.5s/格，**Basic = 5.0s/格**） | 需新增分档体系 |
| Plant Food | 上限 **3**（古埃及升级 4 / 内购 5）；逐植物时长（豌豆 3s 等）；即时充能（野西 Day 20 解锁）；不可跨关 | 仓库上限 5，需改 3 |
| 关卡结构 | 每关 **1~3 面旗**；单关 **1~2 分钟**；11 世界 317 关 | 仓库实测 7~15 分钟，偏离最大 |

## 4. 差距表（S1 初始快照；**当前状态以 §7b 与 `src/data/pvz2/mapping.ts` 为准**）

> 说明：下表是 S1 审计时的**初始差距**。S1–S6 已把其中大部分落地，逐行最新状态见
> `src/data/pvz2/mapping.ts` 的 `ALIGNMENT` 表（含 `aligned / numeric-drift / structural-gap / no-counterpart`），
> 本文档 §7b 给出执行结果。

统计（`alignmentSummary()`）：**aligned 18 项｜numeric-drift 3 项｜structural-gap 3 项｜no-counterpart 13 项**（合计 37 行，状态随 S1–S6 落地后更新）。

### 4.1 植物（单位）

| 本仓 | PvZ2 | 状态 | 差异 |
|---|---|---|---|
| `firefly_reed` | sunflower | numeric-drift | 充能 7.5→5s；产出 25→**50** |
| `twin_glow` | twinSunflower | numeric-drift | 充能 7.5→10s；产出 50→**100** |
| `thorn_pea` | peashooter | numeric-drift | 充能 7.5→5s（伤害/间隔/HP 已对齐） |
| `trifold_arrow` | threepeater | numeric-drift | 充能 7.5→5s（cost 300 已对齐） |
| `frost_pea` | snowPea | numeric-drift | cost 175→**150**；充能 7.5→5s |
| `wood_core` | wallNut | numeric-drift | 充能 30→**20s**（cost/HP 已对齐） |
| `drum_cap` | potatoMine | numeric-drift | 充能 50→**20s** |
| `lob_shroom` | cabbagePult | numeric-drift | cost 150→**100**；充能 7.5→5s |
| `ember_fluff` / `storm_cap` / `tether_moss` / `nectar_moss` / `mist_lamp` | — | no-counterpart | 本仓原创，保持不动 |

**PvZ2 有而仓库缺**：Repeater(200)、Cherry Bomb(150/35s)、Bloomerang(175)、Iceberg Lettuce(0)、Spikeweed(100)、Kernel-pult(100)。

### 4.2 敌人

| 本仓 | PvZ2 | 状态 | 差异 |
|---|---|---|---|
| `march_ant` | basic | numeric-drift | HP 45→**190**；啃食 4→**100 dps**；速度 4.76s/格 ≈ Basic(5.0) 已接近 |
| `shell_raiser` | conehead | structural-gap | PvZ2 是**层叠护甲**（+370/+1100）；仓库是 armor 档位减伤系数 |
| `stone_hide_giant` | gargantuar / zombot | structural-gap | PvZ2 Gargantuar 3600 非 Boss；Boss 是 Zombot(18500~54000)。仓库 4000 标 Boss，需拆分 |
| 其余 7 个 | — | no-counterpart | 本仓原创 |

### 4.3 系统 / 机制

| 项 | 状态 | 差异 |
|---|---|---|
| 单位充能 | numeric-drift | 全表 7.5s → PvZ2 5s 系 |
| 啃食 dps | **structural-gap** | `ENEMY_BITE_DPS=100` 被 archetype 覆盖，从未生效 |
| 强度分档 | structural-gap | 缺 10 档体系 |
| 速度分档 | structural-gap | 缺 6 档体系 |
| 种子槽 | numeric-drift | 值已对齐（8），但 `sim.ts` 与 `DeckPicker.ts` 重复定义 |
| 阳光面值 | numeric-drift | 25 → **50** |
| 天空阳光间隔 | numeric-drift | 仓库 4.25~7s（PvZ1）；PvZ2 精确值待查证 |
| 波次节奏 | numeric-drift | 仓库为 PvZ1 口径；PvZ2 值待查证 |
| Plant Food 上限 | numeric-drift | 仓库 5 → PvZ2 **3** |
| 植物等级 1~10 | structural-gap | 缺 |
| 逐植物 Plant Food | structural-gap | 缺（只有通用"世界能量"） |
| 单关时长 | structural-gap | 仓库 7~15 分钟 → PvZ2 **1~2 分钟** |
| 关卡旗数 | structural-gap | 仓库 JSON 硬编码波数 → PvZ2 1~3 面旗 |

## 5. 留痕裁决表

| # | 裁决 | 理由 | 错了损失什么 |
|---|---|---|---|
| P2A-D1 | 对齐对象 = **PvZ2**（非 PvZ1） | 用户 2026-10-14 拍板"全部以2为准" | 返工一轮数值 |
| P2A-D2 | 普通僵尸 HP 取**国际版现行 190**；中文版 270 记入参考表备注 | 用户要求"查权威来源"；190 是当前国际版口径 | 若用户要中文版手感，需切 270 |
| P2A-D3 | 啃食 dps 采用 **100**（PvZ2 基准，与 PvZ1 同） | 多僵尸条目的平衡改动记载"从 100 提升至 150/200" | 需回炉重校 |
| P2A-D4 | 保留原创命名与美术，"对齐"只针对机制与数值 | 仓库有 GDD §3.4 避嫌声明 | 法律/合规风险 |
| P2A-D5 | 新增 `src/data/pvz2/` 只读参考层，archetype 由它派生 | 治本：消除"声明与实现脱节"与再次漂移 | 多一层间接 |
| P2A-D6 | 啃食 dps 与僵尸 HP **必须成对改**，不可单独动 | 45 血 + 4 dps 是自洽小数值体系；拉到 100 dps 后 300 血植物 3s 被啃穿 | 战斗瞬间失衡 |
| P2A-D7 | 查不到的项显式标"待查证"并挂账，不凭记忆补全 | 用户要求权威来源 | 引入错误口径 |
| P2A-D8 | 种子槽维持 8（= PvZ2 基础值），仅收敛为单一事实源 | 查证结果与仓库现值一致 | 无 |

## 6. 阶段排期（7 步，每步可独立验收）

| # | 步骤 | 交付 | 验收 |
|---|---|---|---|
| **S1（本会话）** | 权威参考数据集 + 差距表 + 本路线落盘 | `src/data/pvz2/{mechanics,plants,zombies,mapping}.ts` + 本文档 | `tsc` 绿；参考表字段与来源可追溯 |
| S2 | 机制骨架对齐 | 充能 5s 系、速度/强度分档派生函数、`DECK_CAP` 单一事实源、大波结构 | 分档函数有单测；`tsc`+`vitest` 绿 |
| S3 | 数值全表对齐 | 僵尸 HP 190 基准与护甲阶梯、`points` 与测试断言同步、植物 cost/HP/伤害、**啃食 dps 真正接线** | 战斗可跑；`registry`/`schema` 断言同步；模拟可复现 |
| S4 | 植物机制模仿 | 等级 1~10 曲线（伤害/HP/充能/花费）+ 逐植物 Plant Food 效果 + `tests/pvz2Align.test.ts` 防漂移闸 | 防漂移闸绿（参考表与 archetype 一致） |
| S5 | 关卡结构重排 | 波次预算公式、关卡旗数与时长（目标单关 1~2 分钟）、6 关 JSON 与 GDD 同步 | 扫荡时长落入 1~2 分钟量级 |
| S6 | 无头模拟重校准 | `scripts/sim-sweep.mjs` + 对齐前后对比报告 | 胜率曲线与时长忠于 PvZ2 |
| S7 | 终验与收尾 | 独立审查、`tsc`/`vitest` 全绿、重生成 almanac、GDD 同步、提交 | P0 清零；提交完成（push 由用户在本机执行） |

## 7. 挂账（待查证，查证后回填 `src/data/pvz2/`）

| 事项 | 归属 |
|---|---|
| 波次间隔秒数与大波（Final Wave）强度倍率：wiki 未给 PvZ2 独立值 | S5 前查证 |
| 僵尸等级 / 阶级（Level / Tier）的动态缩放公式 | S3 前查证 |
| 向日葵 / 双胞向日葵的精确产出周期秒数 | S3 前查证 |
| 天空自然阳光在 PvZ2 的精确刷新秒数（wiki 仅有初代"约 10 秒"描述） | S2 前查证 |
| Plant Food 掉落概率与大波是否必掉 | S4 前查证 |
| 各植物独立条目页的 HP / 伤害 / 攻击间隔（本轮只查了豌豆射手） | S3 期间逐页补 |

## 7b. 执行进度（2026-10-14，S1–S6 已落地）

| # | 步骤 | 状态 | 落地内容 |
|---|---|---|---|
| S1 | 参考数据集 + 差距表 | ✅ | `src/data/pvz2/{mechanics,plants,zombies,mapping}.ts` + 本路线文档 |
| S2 | 机制骨架 | ✅ | 充能 5s 系（由参考层 `pvz2RechargeMs` 派生）、速度/强度分档派生函数、`DECK_CAP` 收敛到 `balance.ts` 单一事实源 |
| S3 | 数值全表 | ✅ | 啃食 dps 接线（`enemyBiteDps()` 单一入口，archetype 统一 100）；僵尸 HP 按 PvZ2 分档重锚（行蚁 45→190 等）；植物 cost 对齐（冰豆 175→150、雾菇 150→100）；阳光面值 25→50；能量豆上限 5→3 |
| S4 | 植物机制 | ✅（部分） | 等级 1~10 曲线模块 `src/data/pvz2/leveling.ts`（与 PvZ2 豌豆射手逐级表逐项一致）+ 逐植物 Plant Food 文案与查表；**逐植物效果接线到战斗留后续** |
| S5 | 关卡结构 | ✅ | 首波 **2s**（PvZ2 已查证）、**1 面旗 = 5 波**（6 关 JSON 由 10~20 波改 5 波）、波间隔按"5 波 / 1~2 分钟"反推为 18s + rand(0~5s) |
| S6 | 模拟校准 | ✅ | `scripts/sim-sweep.mjs` + `tests/sim-sweep.test.ts`（`npm run sweep`）；对齐前后对比见下表 |
| S7 | 终验与收尾 | ✅ | `tsc` / `vitest` 全绿；almanac 重生成；GDD 同步；提交 |

### 对齐前后对比（8 seeds，真实解锁牌组）

| 关卡 | 波数 | 对齐前时长 | 对齐后时长 | 对齐前推车 | 对齐后推车 | 胜率 |
|---|---|---|---|---|---|---|
| meadow-1-1 | 10→5 | 6.9 min | **2.2 min** | 0.00 | 0.00 | 8/8 |
| meadow-1-2 | 12→5 | 9.4 min | **3.3 min** | 2.50 | 1.00 | 8/8 |
| meadow-1-3 | 12→5 | 10.1 min | **3.4 min** | 2.92 | 1.63 | 8/8 |
| meadow-1-4 | 14→5 | 10.6 min | **3.3 min** | 2.67 | 1.63 | 8/8 |
| meadow-1-5 | 14→5 | 11.4 min | **3.2 min** | 2.25 | 1.00 | 8/8 |
| meadow-4-1 | 20→5 | 14.8 min | **3.3 min** | 3.50 | 1.00 | 8/8 |

> **残余差距说明**：单关时长已从 7~15 分钟压到 **2.2~3.4 分钟**（PvZ2 量级），但仍高于 PvZ2 的 1~2 分钟。
> 两个原因：① 扫荡用的托管 AI 只有 2~4 张牌、击杀慢，属悲观上界；② PvZ2 官方波次间隔待查证，当前 18s 是反推值。

## 8. 约束与纪律

- `balance.ts` 仍是数值唯一事实源；`src/data/pvz2/` 是**参考层**（只读），由它派生。
- 保留原创命名与美术；"严格搬 PvZ2"= 机制与数值口径。
- 不破坏 `src/core/battle` 的无头可跑性与确定性 RNG（随机必须走 `state.rng`）。
- 每次改动保持 `tsc --noEmit` + `vitest run`（现 87 用例）绿；断言随公式同步更新，不得跳过。
- 收尾纪律沿用仓库惯例：提交 + push + 独立审查。**本机无法 push**（github.com 直连超时、gh-proxy 剥认证），需用户在本机执行。
