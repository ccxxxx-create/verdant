# 计划：M3B 草原 32 关量产 + 巡野图（PLAN-M3B）

> 上游：PLAN-M3（M3A 战斗内核，已完成，提交 020ea33）。本文档是 W7 的执行规划，2026-10-11 经用户拍板后落盘。
> 用户拍板记录：①本次只写规划不动工；②关卡入口=**巡野图 MapScene**（DEV-PLAN 原规划形态，非分段面板）；③模拟验收=**试玩驱动调参**（不设胜率自动闸，用户亲手玩后反馈数值）；④M3A 成果即时 push 部署（已执行，force-with-lease 覆盖远程 api 快照线，见 §7）。

## 1. 激活机制清单

提问闸门（范围/入口形态/验收口径/push 4 问已拍板）｜todo 每步更新｜收尾独立审查｜知识盘点（Explore×2：GDD 结构 + 代码扩展点）｜两轮打磨

## 2. 32 关总表（唯一关卡事实源）

id 命名 `meadow-<段>-<段内序>`（与既有 meadow-4-1 一致）。依据 GDD §8.3 四段分布 + 现状 6 关顺延。池规则：新敌亮相关必含新敌，其余取已亮相池 3~5 种调制；unlockUnits 全 `[]`（M2 经济口径：4 赠送已发完，9 单位走商店/抽奖）；起步光露恒 50（chal① 例外 150）。

### 段 1（1-1~1-10）亮相敌 1-6：march_ant → web_spider

| 关 | 模板 | waves | pool | starCondition | 状态 |
|---|---|---|---|---|---|
| 1-1 | teach | 10 | [march_ant] | none | 已有 |
| 1-2 | normal | 12 | [march_ant, grey_tide_swarm] | none | 已有 |
| 1-3 | normal | 12 | [march_ant, grey_tide_swarm, gnaw_back_rat] | none | 已有 |
| 1-4 | normal | 14 | [march_ant, iron_beak_sparrow, gnaw_back_rat] | none | 已有 |
| 1-5 | normal | 14 | [march_ant, grey_tide_swarm, iron_beak_sparrow, vine_boa] | none | 已有 |
| 1-6 | normal | 16 | [march_ant, grey_tide_swarm, gnaw_back_rat, vine_boa, web_spider] | none | 新（织网蛛亮相） |
| 1-7 | normal | 16 | 六敌混池 | none | 新 |
| 1-8 | normal | 16 | 六敌混池 | none | 新 |
| 1-9 | normal | 18 | 六敌混池 | none | 新 |
| 1-10 | normal | 18 | 六敌混池 | none | 新（段终） |

### 段 2（2-1~2-10）亮相敌 7-8：shell_raiser（铁门盾）、vine_gnawer

| 关 | 模板 | waves | pool | starCondition | 备注 |
|---|---|---|---|---|---|
| 2-1 | normal | 20 | +shell_raiser 亮相 | none | |
| 2-2 | normal | 20 | 七敌混池 | none | |
| 2-3 | normal | 20 | 七敌混池 | none | |
| 2-4 | normal | 20 | +vine_gnawer 亮相 | none | |
| 2-5 | chal | 20 | 七敌混池 | **no_producer** | 起步 150 补经济 |
| 2-6 | normal | 20 | 八敌混池 | none | |
| 2-7 | normal | 20 | 八敌混池 | none | |
| 2-8 | chal | 20 | 八敌混池 | **field_le12** | |
| 2-9 | normal | 20 | 八敌混池 | none | |
| 2-10 | normal | 20 | 八敌混池 | none | 段终 |

### 段 3（3-1~3-10）亮相敌 9-10：lightdew_moth（偷露珠）、stone_hide_beast；末三关 flag→survive→boss

| 关 | 模板 | waves | pool | starCondition | 备注 |
|---|---|---|---|---|---|
| 3-1 | normal | 20 | +lightdew_moth 亮相 | none | |
| 3-2 | normal | 20 | 九敌混池 | none | |
| 3-3 | normal | 20 | 九敌混池 | none | |
| 3-4 | normal | 20 | +stone_hide_beast 亮相 | none | |
| 3-5 | normal | 20 | 十敌混池 | none | |
| 3-6 | normal | 20 | 十敌混池 | none | |
| 3-7 | normal | 20 | 十敌混池 | none | |
| 3-8 | flag | 24 | 十敌混池 | none | 大旗波关 |
| 3-9 | survive | 30 | 十敌混池 | none | GDD 写 ∞ 波，冒险关需终态，30 波收口 |
| 3-10 | boss | 10 | 普通池护卫 + stone_hide_giant | none | 末波 Boss+护卫（planWave 已支持） |

> 段 3 收为 10 关的原因（M3B-D2）：GDD §8.3 段表 10+10+12+2=34 与冻结值 32 矛盾，且第 3 段内部 8+1+1+1=11≠12；按权威级取 32（用户第 13 轮拍板 + DEV-PLAN M3 验收 + §1 冻结），段 3 = normal×7 + 末三关，总量 10+10+10+2=32 自洽。

### 段 4（4-1~4-2）conveyor×2（GDD §13.2 末段）

| 关 | 模板 | waves | conveyor | 备注 |
|---|---|---|---|---|
| 4-1 | conveyor | 20 | interval 5000/handLimit 5/池 8 单位 | 已有 |
| 4-2 | conveyor | 20 | interval 4000/handLimit 6/池 8 单位+十敌混池 | 新（末关收紧） |

## 3. MapScene 巡野图（关卡入口）

- 新场景 `MapScene` 注册 game.config（Boot 后可选）。视觉：草原四段长卷（横向或纵向分段），明亮像素风延续（meadow 色板 + 现有 icon 纹理）。
- 32 节点 = 32 关，三态：锁定（灰）/解锁（亮）/通关（星级角标）。节点坐标静态表 `src/data/map/meadow.ts`（TS 常量，含段标题装饰位）。
- 点击节点 → 选卡面板 → Battle（conveyor 关跳选卡）。跨段解锁链：1-10→2-1→2-10→3-1→3-10→4-1→4-2（判定仍用 clearedLevels 前驱 id）。
- 选卡面板从 MenuScene 抽成共享模块 `src/ui/DeckPicker.ts`（Menu/Map 复用；场景级 zone 纪律照旧）。
- MenuScene「冒险」按钮与巡野图入口卡改跳 MapScene；32 关 JSON 改 `import.meta.glob` 批量导入（MenuScene 27 条 import 清除）。

## 4. 星级判定实装（当前 winLevel 固定 3 星）

内核增量：`BattleStats` 加 `plantedByRole: Record<string, number>` 与 `plantedElement: Record<string, number>`（cmdPlant 成功时累加）。渲染壳按 starCondition 判星：

| 条件 | 判定数据来源 |
|---|---|
| no_producer | plantedByRole.producer === 0 |
| deck_le6 | 本局 deck.length ≤ 6 |
| field_le12 | stats.peakUnits ≤ 12 |
| no_fire / no_electric | plantedElement.fire / electric === 0 |
| under_90s | stats.elapsedMs ≤ 90000 |
| no_mower_break | stats.mowersUsed === 0 |
| no_shovel | stats.dug === 0 |

达成=3 星、未达成=1 星（levelClearReward 已按星分档，无需改）。`none` 维持 3 星。

## 5. 模拟与调参口径（试玩驱动）

- 托管 AI 适度增强：能量豆收即用、producer 被啃后补种（只服务于"可通关性验证"，不追求强度）。
- `scripts/sim-sweep.mjs`：32 关 × 20 seeds 输出报告（胜率/平均用时/推车数）。唯一硬闸=**无全败关**（0/20 → 标记排查：AI 弱 or 数值过紧）。
- 难度调参主循环 = **用户试玩反馈** → 调 pool/waves/起步光露（PLAN R2 的"方差≤35%"不做自动闸；用户 2026-10-11 拍板）。
- 扫荡耗时估算：1600 局 ≈ 60-90s（现 6 关实测 414ms/17 测试推算），node 脚本不进 CI。

## 6. 留痕裁决表

| # | 裁决 | 理由 | 错了损失什么 |
|---|---|---|---|
| M3B-D1 | 巡野图 MapScene 替代"分段网格面板"方案，进 W7 而非 M4 | 用户拍板（入口形态问） | W7 工期 +1~2 会话 |
| M3B-D2 | GDD §8.3 双重算术矛盾（段和 10+10+12+2=34≠32；段 3 内部 11≠12）按冻结值 32 收口：段 3=10 关（normal×7+末三关），总量 10+10+10+2=32 | 32 是用户第 13 轮拍板 + DEV-PLAN M3 验收 + §1 首发冻结，权威级最高；段表为 v1.1 编辑残留 | 多 2 关的内容空间（放进 BACKLOG 供难度扩展） |
| M3B-D2a | 巡野图节点数=32；跨段解锁链 1-10→2-1→2-10→3-1→3-10→4-1→4-2 | 段 3 收 10 关后的 id 序列 | 无 |
| M3B-D3 | survive 关 30 波收口 | GDD ∞ 波无终态，冒险关需 win 判定（内核 wave≥waves） | 与 GDD §8.1 原文偏离，GDD 修订注记 |
| M3B-D4 | unlockUnits 全空（段 1 的 1-1/1-2/1-3 既有赠送保留） | M2 经济口径（4 赠送+商店+抽奖）优先于 GDD §8.5"解锁即获得"旧口径 | GDD §8.5 需修订（列入 §8） |
| M3B-D5 | 模拟不设胜率自动闸，试玩驱动 | 用户拍板 | 数值问题上线后才暴露（有扫荡报告兜底） |
| M3B-D6 | 远程 api 快照线（13 提交）force-with-lease 覆盖 | 树比对验证：快照线无本地缺的实质内容（全部差异=本地新增）；本地线经完整测试/审查 | 无（快照内容已全部包含于本地线） |
| M3B-D7 | W7 内部顺序改 MapScene 巡野图先行（原 S1 关卡在前），细化为 W7-1~W7-4 会话任务单（2026-10-12 用户拍板） | 量产期间每会话收尾都有可玩可见增量；老关先行验证入口/选卡/战斗全链路 | 首个新关可见时间推后一个会话（无实质影响） |
| M3B-D8 | M4-M6 路线细化不在本轮（用户拍板只细化 W7）；DEV-PLAN 残留数字修订挂账 | 单里程碑聚焦，避免规划文档过度前置失效 | 无 |

## 7. 已执行：push 与部署（2026-10-11）

- 远程 origin main 原为 codex 的 API 快照平行历史（13×"chore: api push"，最后 a1dcdf5 2026-10-10 18:40:01，与本地 f0c9a09 18:39:56 同工作双推）。
- 凭据链问题四连排查：GCM 无头不可用 → gh 凭据对 gh-proxy host 拒答 → gh-proxy 剥 Basic 认证（"No anonymous write access"）→ github.com 直连瞬时 reset 后恢复。
- 终态：`GIT_ASKPASS`（gh auth token 现取不落盘）+ insteadOf 反向重写 + 显式 URL + `--force-with-lease=main:a1dcdf5`；CI 触发（run 38149461425）。

## 8. GDD 同步修订（随本规划一并提交）

1. §4.0「10+8+8=26 关」「107 关冻结值」→ 32 关/世界、131 总关（与 §1/§8.3 对齐，v1.1 遗留）。
2. §8.3 双重算术矛盾收口注记：段 3=10 关（normal×7+末三关），总量 10+10+10+2=32（M3B-D2）。
3. §8.1 T-SURVIVE ∞ → 冒险模式 30 波收口（M3B-D3）；生存玩法真 ∞ 形态留 BACKLOG。
4. §8.5"解锁即获得"→ 标注 M2 经济口径取代（M3B-D4）。
5. §8.3"关卡节点分布随巡野图落定"→ 更新为"已落定（PLAN-M3B §2 总表 + MapScene）"。

## 9. 执行排期（W7 会话任务单，2026-10-12 重排：MapScene 先行）

> 原始 S1-S7 步骤已细化为 4 个会话任务单（M3B-D7）。每会话收尾纪律：提交 + push（凭据链见记忆 game-push-credential-chain）+ 独立审查（代码会话）。

### 会话 W7-1：巡野图入口（原 S2 前置）

| 任务 | 内容 |
|---|---|
| 节点表 | `src/data/map/meadow.ts`：32 节点坐标静态表，三态（解锁/通关/锁定）；27 个未量产节点=锁定态"量产中"占位 |
| MapScene | 新建场景（直接复用 kit：drawPixelBackdrop/pixelPanel/pixelButton/sceneHeader/sceneEnter）+ game.config 注册 |
| DeckPicker 抽取 | MenuScene `openDeckPicker`（:340）抽成 `src/ui/DeckPicker.ts` 共享模块，Menu/Map 复用，逻辑不变 |
| 关卡批量导入 | 关卡 JSON 改 `import.meta.glob` 批量导入（新关落盘自动进表）；MenuScene 原 `openLevelPicker` 退役删除，「冒险」入口与巡野图入口卡改跳 MapScene |
| 验收 | 浏览器实测 5 老关节点→选卡→进战斗全通；27 占位节点锁定态正确；tsc/vitest 绿 |

### 会话 W7-2：段 1+段 2 关卡（11 关）+ 星级判定（原 S1 前半 + S3）

| 任务 | 内容 |
|---|---|
| 新关 JSON | 1-6~1-10、2-1~2-10（含 2-5 `no_producer` 起步 150、2-8 `field_le12`），按 §2 总表 |
| levels.test | 扩展：新关 parse、解锁链、池亮相顺序断言 |
| 星级判定 | 内核 `BattleStats` 增量 `plantedByRole/plantedElement`（cmdPlant 累加）→ 渲染壳 winLevel 按 starCondition 判星（达成 3 星/未达成 1 星/none 维持 3） |
| sim.test | 补 starCondition 真假两态断言 |
| 验收 | 三件套绿；浏览器实测 2-5/2-8 三星判定两态 |

### 会话 W7-3：段 3+段 4 关卡（12 关）+ 托管 AI 与扫荡（原 S1 后半 + S4）

| 任务 | 内容 |
|---|---|
| 新关 JSON | 3-1~3-10（3-8 flag / 3-9 survive 30 波 / 3-10 boss 石皮巨兽+护卫）、4-2 conveyor（收紧发牌） |
| 托管 AI | 增强（能量豆收即用、producer 被啃补种） |
| sim-sweep | `scripts/sim-sweep.mjs`：32 关 × 20 seeds 报告（胜率/用时/推车）；唯一硬闸=无全败关 |
| 验收 | 扫荡报告产出；32 关节点全部解锁可进；三件套绿 |

### 会话 W7-4：终验 + 试玩调参 + 审查（原 S5+S6+S7）

| 任务 | 内容 |
|---|---|
| 抽关实测 | 浏览器实测 1-10 / 2-5 / 3-8 / 3-10 / 4-2 |
| 试玩循环 | 交付用户试玩 → 反馈调参（循环、可能多轮；调 pool/waves/起步光露） |
| 收尾 | 独立审查 → P0 清零 → 提交 push → CI 绿 + Pages 200 |
| 验收 | 用户确认难度曲线 |

## 9b. 挂账（本轮不做，记录归属）

| 事项 | 归属 |
|---|---|
| DEV-PLAN 残留数字修订（M4"深海 26 关"→32、M6"107 关全通"→131） | M4 启动前 |
| M4-M6 会话级拆分路线 | M4 启动时规划 |
| ShopScene `parts` 数组等误导性死代码清理 | W7-4 审查时顺手 |
| 图鉴滚动穿透根治（卡 hit 场景级随滚动重建；当前 depth=10 过渡方案） | M6 动效 pass |
| 动效全量 pass（MOTION_ENABLED 接设置场景"减弱动态"） | M6 |
| BACKLOG 机制候选（单位融合/波次进化/昼夜双场/地形法术/混合关） | 各自触发条件见 BACKLOG.md |

## 10. 明确不做（BACKLOG/后续）

分段网格选关面板（被巡野图取代）｜高处草丛地形（LevelDef 无字段）｜laneDedupe 与"不连续 3 波同敌"跨波约束（随模拟终校）｜sim↔power 循环导入拆分 damage.ts｜真 ∞ 生存模式｜雪人逃跑/Boss 多形态等（research-notes 已排除）。
