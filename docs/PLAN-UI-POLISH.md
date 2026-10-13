# 计划：界面美化专项（PLAN-UI-POLISH）

> 上游：PLAN-M3B（W7-1 巡野图 MapScene 已交付）。本文档是「UI 美化专项」的执行规划，2026-10-12 经用户拍板后落盘。
> 用户拍板：①重心 = **UI 美化专项**（关卡量产 W7-2~4 顺延）；②范围 = **全部场景统一打磨**（不留死角）；③方向 = **延续现有明亮像素风**，精修细节与动效（低风险）。

## 1. 激活机制清单

提问闸门（重心/范围/方向 3 问已拍板）｜todo 每步更新｜收尾独立审查｜知识盘点（Explore×1：6 场景 UI 债审计 + agent-browser 基线截图）｜两轮打磨。

## 2. 目标与非目标

- **目标**：设计系统升级（token 单一事实源收敛）+ 6 场景统一打磨 + 动效手感 pass + 前后对比视觉基线。
- **非目标**：不改玩法数值与内核契约（`src/core/**`、EventBus、存档字段语义）；不新增依赖；不引入栅格图片/占位 URL；不做关卡量产（W7-2~4 顺延）。

## 3. 现状审计（只读，2026-10-12）

统计口径：**硬编码字号 57 处**；**硬编码 hex 60+ 处**；**私有色常量集 3 套**（BattleScene / ShopScene / DrawScene）；**重复造轮子 16 处**（未复用 kit）；**命中区隐患 4 处**。

### P0（必改：一致性 / 命中 / 维护）

| # | 位置 | 问题 | 处置 |
|---|---|---|---|
| 1 | `BattleScene.ts:51-59` | 私有常量集 `C_GOLD/C_CREAM/C_DARK/WOOD/WOOD_LIGHT/PAPER/OUTLINE/GOLD_INT/CREAM_INT` 与 KIT 语义重叠 | 全部改引 `KIT` |
| 2 | `BattleScene.ts:256-331`、`364-482` | 手写 HUD 顶栏 / 暂停面板 / 种子卡 / 工具卡 | 复用 `sceneHeader`/`pixelPanel`/`pixelButton`（新 hud.ts/overlay.ts） |
| 3 | `cards.ts:116-117`、`195-196` | 命中 zone 被 `add` 进卡片容器（历史命中失效根因） | 改场景级 zone |
| 4 | `CodexScene.ts:103-104`、`329-330` | 对 Container 直接 `setInteractive` | 改场景级 zone |
| 5 | `CodexScene.ts:308-309` | 弹层 dim/panel 未 `setDepth`，层级靠创建顺序 | 显式层级（zIndex token） |
| 6 | 全仓 57 处 | 硬编码字号；`BattleScene.ts:270/275/283` 是 `{...typography.heading, fontSize:'26px'}` 覆盖式写法 | 收敛到 `typography` |

### P1（建议）

| # | 位置 | 问题 | 处置 |
|---|---|---|---|
| 7 | `MenuScene.ts:214-243` / `154-175` / `203` / `258-263` | 手搓钱包条 / 主 CTA / 次级卡命中 / 角落工具钮 | → `walletBar` / `pixelButton` |
| 8 | `ShopScene.ts:10-13`、`DrawScene.ts:24-30` | 私有色表 `CHANNEL_STROKE` / `RARITY_TINT` | → tokens 语义色 |
| 9 | `CodexScene.ts:83-92`、`310-320`、`226-232`、`258-264`、`279-285` | tab chip / 弹层 / 世界·地形·表格卡片手写底板 | → `pixelButton`/`pixelPanel`/`cardFrame` |
| 10 | `ShopScene.ts:72-80`、`DrawScene.ts:120-129`、`DeckPicker.ts:98-103` | 卡片底板手写 | → `cardFrame` |
| 11 | `DeckPicker.ts:126-134` | "出战"按钮手写 | → `pixelButton` |
| 12 | 全仓 | `fontFamily` 字面量 vs `FONT` 常量混用；`Phaser.Display.Color.HexStringToColor` vs `hexToInt` | 统一 `FONT` / `hexToInt` |

### P2（可选）

| # | 位置 | 问题 |
|---|---|---|
| 13 | `ShopScene.ts:24/32/44-47/72/149` | `parts` 只写不读的死代码 |
| 14 | `DrawScene.ts:142` | `if (this.lastPrizes.length > 0)` 恒真死条件 |
| 15 | `MapScene.ts:99`、`MenuScene.ts:183/190` | 散落语义色（金/绿）→ tokens |
| 16 | `BattleScene.ts:503-519` | 手写波次进度条 → 抽公共 `progressBar` |
| 17 | `CodexScene.ts:196-211` | 滚动遮罩外无命中拦截 → 加拦截，收敛穿透 |

## 4. 设计系统升级（token-first）

**`src/ui/tokens.ts`**（保持向后兼容，仅扩展）：
- `typography` 扩为 `display 48 / title 34 / heading 24 / subheading 20 / body 16 / caption 13`。
- 新增 `semantic`：`success / warning / danger / info / gold / accent`（供 kit/cards/hud 引用）。
- 新增 `zIndex`：`bg 0 / ambient 1 / panel 2 / content 3 / hud 10 / overlay 30 / dialog 31`。
- 统一导出 `FONT`（供全仓引用，消除字面量）。

**`src/ui/tokens.json`**：补语义色角色（`semantic`），保持 `palette`/`worldPalette` 结构不变。

**`src/ui/components/kit.ts`**：面板/按钮加**变体与状态**（hover / 按下 / 禁用 / accent）；新增 `chip` 标签、`progressBar`、`tooltip`；`sceneHeader`/`walletBar` 精修；`drawPixelBackdrop`/`KIT` 内硬编码色收敛。

**`src/ui/components/cards.ts`**：清理硬编码 hex（`'#FFFFFF'`/`'#8A8578'`/`'#A9805A'` 等）改引语义 token；命中区改场景级 zone。

## 5. 逐场景打磨清单

| 场景 | 要点 |
|---|---|
| `MenuScene` | 统一字阶与留白；主 CTA/次级卡/钱包/工具钮套用新 kit；氛围动效对齐；品牌区/立绘锚点精修 |
| `MapScene` | 节点三态视觉升级（星标/锁定/量产占位）、段牌与路径精修；散落色收敛 |
| `BattleScene` | HUD/种子条/暂停/结算改调 `hud.ts`/`overlay.ts`；消除私有色常量；补波次进度条 |
| `ShopScene` | 商品卡/钱包/购买反馈统一；清 `parts` 死代码；私有色表迁移 |
| `DrawScene` | 抽奖机视觉与翻牌动效精修；空态/返回统一；私有色表迁移 |
| `CodexScene` | 网格卡片/筛选标签/详情面板统一；滚动穿透收敛；弹层层级显式化 |

## 6. 动效与手感 pass

- 统一转场（`sceneEnter` 240ms）/ 按压（`pressable` 0.97 回弹）/ 呼吸（`breathe`）节奏与强度。
- 接入 **"减弱动态"开关**：存档 `settings.motion`（**schema v4→v5 增量 + migrate**，本轮唯一存档变更）。
- 预算：仅动 位置/缩放/alpha；活跃 Tween ≤300、活粒子 ≤2000；氛围粒子按场景分档（Menu 全量 / 子页弱化 / 内容重页压暗）。

## 7. 验收标准

- **视觉**：6 场景 × 2 视口（1920×1080 / 1280×800）前后对比截图留存 `docs/_review/ui-polish/`。
- **一致性**：grep 校验无新增硬编码字号/hex 残留（白名单：像素矩阵与 palette）。
- **功能**：`tsc --noEmit` 绿、`vitest run` 绿；触摸 + 键鼠双输入；热区 ≥48px。
- **性能**：PC 与平板视口 ≥60fps；粒子/Tween/纹理预算达标。
- **纪律**：每会话收尾 = 提交 + push + 独立审查。

## 8. 留痕裁决表

| # | 裁决 | 理由 | 错了损失什么 |
|---|---|---|---|
| UIP-D1 | 存档 schema v4→v5 增量 `settings.motion`（本轮唯一存档变更） | "减弱动态"需持久化；沿用 `migrate()` 只增不删 | 需补迁移用例 |
| UIP-D2 | 不改玩法数值与内核契约，纯 UI 层改动 | 用户口径"低风险" | 无 |
| UIP-D3 | 不引入新依赖 / 栅格图片，美术增强走像素矩阵 + 图形绘制 | 本仓"资产即数据"纪律（GDD §10） | 表现力受限 |
| UIP-D4 | kit 函数签名向后兼容（仅加可选参数），渐进替换场景 | 避免 6 场景一次性大改引发回归 | 改造周期略长 |
| UIP-D5 | 关卡量产 W7-2~4 顺延 | 用户拍板重心 = UI 美化 | 内容进度推后 |
| UIP-D6 | 战斗 HUD 抽 `hud.ts`/`overlay.ts` 独立模块 | `BattleScene` 已 ~1100 行且内嵌 HUD/暂停/结算 | 抽取期需逐块截图核对 |

## 9. 会话排期

| 会话 | 任务 | 验收 |
|---|---|---|
| **S1（本会话）** | UI 债审计 + 基线截图 + 本规划落盘 + 设计系统升级（tokens/kit/cards） | 三件套绿；kit 变体可用；无回归 |
| S2 | Battle HUD 统一（`hud.ts`/`overlay.ts`）+ 波次进度条 | 战斗视觉与交互核对通过 |
| S3 | Menu/Map/Shop/Draw/Codex 逐场景打磨 | 逐场景前后对比通过 |
| S4 | 动效 pass + "减弱动态"开关（save v5） | 开关生效；预算达标 |
| S5 | 终验（前后对比/性能/平板/独立审查/提交 push） | CI 绿 + Pages 200 |

## 10. 挂账

| 事项 | 归属 |
|---|---|
| PLAN-M3B W7-2~4 关卡量产（26 关 + 星级判定 + sim-sweep） | 本专项结束后 |
| 图鉴滚动穿透根治 | 本轮 S3 收敛（若未彻底则回挂 M6） |
| M6 动效全量 pass 与本轮的关系 | 本轮为 M6 前置，M6 只做终态微调 |
| DEV-PLAN 残留数字修订（M4/M6 关数） | M4 启动前 |

## 11. 执行进度与验收（2026-10-12 更新）

状态：**S1–S5 已完成**（本会话一次跑完）。

| 会话 | 状态 | 交付 |
|---|---|---|
| S1 | ✅ | UI 债审计（P0×6 / P1×6 / P2×5）+ 6 场景 × 2 视口改造前基线（`docs/_review/ui-polish/before-*.png`）+ 本规划落盘 + 设计系统升级 |
| S2 | ✅ | 新增 `ui/components/hud.ts` + `ui/components/overlay.ts`；BattleScene 的 HUD/种子条/暂停/结算全部改调共享件；私有色常量 → KIT 别名；新增 HUD 波次进度条 + 结算弹层（星级/奖励） |
| S3 | ✅ | Menu/Map/Shop/Draw/Codex 逐场景打磨（字阶统一、色板收敛、`ShopScene.parts` 死代码清除、`DrawScene` 恒真死条件清除、Codex 命中区场景级 + 显式层级、卡片拖拽阈值收敛滚动穿透） |
| S4 | ✅ | 动效 pass：`MOTION_ENABLED` 改 live binding + `setMotionEnabled`；新增 `ui/settings.ts`；主界面「设置」弹层；常驻循环动效与氛围粒子全部门控；存档 schema v4→v5（`settings.motion`）+ 迁移用例 |
| S5 | ✅ | 前后对比截图（`after-*.png`）；性能实测；独立审查（code-explorer）→ 2×P1 已修 |

### 验收结果

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | ✅ 0 错误 |
| `vitest run` | ✅ 87 测试全绿（含新增 v4→v5 迁移用例） |
| 帧率（战斗，1920×1080） | ✅ 157~161 fps（≥60 达标） |
| 活跃 Tween（战斗静置） | ✅ 0 |
| 纹理数 | 72 |
| 平板视口 1280×800 | ✅ 6 场景无溢出（`after-*-1280x800.png`） |
| 「减弱动态」端到端 | ✅ 开关切换 `settings.motion` true→false，氛围粒子即时消失（`check4-motion-off.png`） |
| 独立审查 | ✅ 2×P1 已修复；P2 挂账 |

### 审查修复记录

- **P1-1**：`CodexScene.openOverlay` 的 `closeHit` 仅在 ✕ 路径销毁 → 改为统一 `close()`（✕ 与点遮罩共用），并让敌人详情也可点遮罩关闭。
- **P1-2**：`MOTION_ENABLED` 门控遗漏（Menu 的 Logo/立绘/CTA 循环、Codex 立绘待机）已补齐；切换开关改为 `killAll + scene.restart` 即时生效。

### 追加挂账（本轮 P2，不阻塞）

| 事项 | 归属 |
|---|---|
| BattleScene 战斗 FX 的散落 hex（`#FF8A3D`/`#9BE564`/`0xff5555` 等）→ 可映射 `KIT.warningCss` 等语义色 | M6 打磨 pass |
| 组件内部字号字面量（`overlay 54px`、`kit 14/19px`、`cards 18px`、`Menu 104px Logo`、`Battle 52/30px FX`）→ 登记进 typography 或复用档位 | M6 |
| `cards.ts` 命中 zone 仍为容器子件（依赖容器随内容销毁，未构成回归） | 记录备查 |
