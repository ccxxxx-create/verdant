# PLAN-INVENTORY-GACHA · 设置/兑换码 · 抽卡品质动画 · 背包系统

> 定位：元层系统补齐。延续现有明亮像素风（PAPER 纸底 + OUTLINE 深描边 + 实色偏移投影），
> **不改玩法内核契约**（不新增 sim 命令、不改 EventBus 事件），关卡量产（W7-2~4）顺延。
> 本轮**不做任何 git 提交或推送**（由用户自行处理）。

---

## 1. 需求与口径（用户已拍板）

| 项 | 结论 |
|---|---|
| 设置入口 | 移到**右上顶栏齿轮**（标准商业手游形态），右下角不再放设置 |
| 兑换码 | 设置面板内入口；`6666` 发放大量金币/钻石等资源；**可重复兑换**（调试用） |
| 抽卡动画 | 按**3 档品质**（普通 / 稀有 / 传说）给出**不同揭示动画**，达到商业完成度 |
| 背包 | **框架 + 3~4 个真实可用道具**，可查看、可使用 |
| 道具使用点 | **出战前携带 1 个，开局自动生效**（只改战斗初始状态） |
| 道具获取 | **接入抽奖奖池与商店** |
| 推送 | **不做**（用户自行处理） |

---

## 2. 落点复核结论（code-explorer 审计）

| # | 结论 | 影响 |
|---|---|---|
| 1 | `BattleConfig` @ `src/core/battle/types.ts:6-13`（**普通 interface，非 zod**，新增可选字段不破测） | 可安全加 `carriedItem?` |
| 2 | `mowers` 写入点**唯一**：`src/core/battle/sim.ts:500-517`（`state.mowers[row] = false`），初始化 `sim.ts:79` | 荆棘护盾判定挂载点唯一、风险低 |
| 3 | `PixelSprite = readonly string[]`（`palette.ts:68`），16×16 字符串矩阵；`pixelIcons` 现有 **29** 个图标 | 新增道具图标写法明确 |
| 4 | `ensurePixelTextures` @ `BattleScene.ts:84-96` **遍历 `pixelIcons`**，非 `world_` 前缀一律烘焙为 `icon_<name>` | **新图标自动烘焙**，无需改函数 |
| 5 | `ShopScene`：`drawUnits` @44-120、`buy` @122-145；网格 `cols=5 / cw=300 / ch=250 / gap=30 / y0=250` | 道具售卖区另起方法插在其后 |
| 6 | `tests/economy.test.ts:43-47` 硬断言 **`GACHA_POOL` 权重和 === 100** | 改奖池权重**必须同步**该测试 |
| 7 | `SaveV5` 被测试**按名直接 import**（`save.test.ts:3/50/65/79/94`、`review-fixes.test.ts:4`） | 改名会断测 → 需同步更新 import |
| 8 | 键盘监听**全仓库从不 `off`**，无 `shutdown()/destroy()` 覆写；依赖 Phaser 场景级 keyboard plugin 自动回收 | 照抄 `input.keyboard?.on(...)` 即可 |
| 9 | `registry` 一次性消费纪律：`get` 后紧跟 `remove`（`BattleScene.ts:149-151` / `225-226`、`DrawScene.ts:51-52`） | `carriedItem` 同纪律 |
| 10 | `kit.ts` **无 rarity 色键**；`UnitArchetype` **无 rarity 字段**且为 `strictObject` | 品质色需**全新引入**，不得给 unit 加字段 |
| 11 | `walletBar` / `sceneHeader` / `drawAmbient` 三页同构：`drawAmbient(this)` / `sceneHeader(this, t, {subtitle})` / `walletBar(this, 60, 128, width-120, …)` | InventoryScene 直接同参调用 |

---

## 3. 道具表（`src/data/items.ts`）

```ts
export type ItemRarity = 'common' | 'rare' | 'legendary';
export type ItemEffect =
  | { t: 'bonusLightdew'; amount: number }
  | { t: 'bonusPlantFood'; amount: number }
  | { t: 'mowerWard'; durationS: number }
  | { t: 'clearBonus'; coinMult: number; bonusSeeds: number };

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  rarity: ItemRarity;
  icon: string;                      // pixelIcons 键名
  effect: ItemEffect;
  shop?: { channel: 'coins' | 'diamonds'; price: number };
}
```

| id | 名称 | 品质 | 效果 | 生效层 | 商店 |
|---|---|---|---|---|---|
| `lightdew_jar` | 晨露罐 | 普通 | 开局光露 **+150** | `createBattle` 初始状态 | 金币 400 |
| `energy_core` | 能量晶核 | 稀有 | 开局能量豆 **+2** | `createBattle` 初始状态 | 钻石 3 |
| `thorn_ward` | 荆棘护盾 | 稀有 | 开局 **30s** 内每行割草机被突破时**免消耗一次** | `createBattle` 初始状态 + 1 处只读判定 | 钻石 4 |
| `lucky_clover` | 幸运四叶草 | 传说 | 本局通关**金币 ×1.5** 且额外 **+1 种子券** | 结算层（`rewards.ts`） | 钻石 8 |

**风险与回退**：`thorn_ward` 是唯一触碰战斗内核的道具——做法是给 `BattleState` 增加由 `createBattle` 写入、在 `sim.ts:500-517` 分支前读取的**限时字段**，不新增 sim 命令、不新增/修改事件。若审查判定不可接受，回退为纯初始状态项（如「开局 +2 种子券」），其余三个道具不受影响。

---

## 4. 抽卡品质分级动画配方（`src/ui/components/gachaFx.ts`）

品质归属为**领域层单一事实源**：`src/core/gacha.ts` 导出 `prizeTier(kind): 'common'|'rare'|'legendary'`
（coins/seeds/plantFood → common，diamonds → rare，unit/item → 按 item 品质或 legendary）。

| 档 | 归属 | 揭示配方 | 时长 |
|---|---|---|---|
| **普通** | 金币 / 种子 / 能量豆 | `scaleX 0→1` + 轻微 pop，**无光效** | 200ms |
| **稀有** | 钻石 / 稀有道具 | 翻入 + 紫色光晕呼吸 + 斜向**扫光带**掠过 + 6~8 粒微光 | 320ms |
| **传说** | 角色 / 传说道具 | 开奖前短暂**蓄势压暗** → 金色**放射光条**（≤14）+ 全屏**闪白** + **粒子爆发**（≤28）+ 卡片 `0→1.18→1` 大幅回弹 + **NEW** 徽记 | 480ms |

- **十连**：逐张级联（间隔 110ms），结束后高亮本次最高品质；右上角常驻**跳过**按钮（点击 `killTweensOf` 后置终态 + 播放最高品质短版光效）。
- **抽奖机待机**：中央纸底圆台 + 金色宝珠（呼吸光晕）+ 环绕微光点。
- **性能硬上限**：单次传说爆发 粒子 ≤28 / 光条 ≤14 / 活跃 Tween 增量 ≤60（预算：活跃 Tween ≤300、粒子 ≤2000）。
- **动效门控**：全部 `if (MOTION_ENABLED)`；减弱动态时退化为「直接显示 + 一次短淡入」，**不得残留 `repeat:-1`**。
- **保底提示**：结果区下方细进度条 + 「距必出未拥有角色还差 N 抽」。

---

## 5. 存档 schema v5 → v6（`src/core/schema/save.ts`）

- 新增：`inventory: Record<string, number>`（道具持有）、`stats.redeemCount: number`（兑换次数）。
- **不做「已兑换记录」数组**（6666 可重复，数组会无界增长）；只记计数，为日后切换一次性兑换留接口。
- `CURRENT_SCHEMA_VERSION = 6`；迁移链加 `5: toV6`；`shapeCurrent()` 增 `inventory`（过滤非负整数、忽略非法项）与 `stats.redeemCount`（`nonNeg`）兜底；`defaultSave()` 补 `inventory: {}` / `redeemCount: 0`。
- 同步 `src/core/save.ts`（`SaveV5` → `SaveV6` 导入与 `parse`）、`tests/save.test.ts`、`tests/review-fixes.test.ts`。
- **新增 v5→v6 迁移用例**与 inventory 默认值断言。

---

## 6. 出战携带数据流

```
DeckPicker（单选携带道具，扣减持有数 + writeSave）
   → registry.set('carriedItem', { id, effect })
   → BattleScene.create()（get 后立即 remove，一次性消费）
   → resetState() → createBattle(config) 应用初始状态
   → 胜利结算 → rewards.ts 增益（clearBonus）
```

- `conveyor` 模板关卡不经选卡（`DeckPicker.ts:23-27` 直接开战）→ **本局不携带**，需在详情页注明。
- `BattleConfig.carriedItem?` 为**可选**字段（审计确认不破测）。
- `BattleScene` HUD 需显示携带道具与护盾剩余（复用 `hud.ts` 组件）。

---

## 7. 目录改动清单

```
docs/PLAN-INVENTORY-GACHA.md            [NEW]  本文件
src/game.config.ts                      [MOD]  注册 InventoryScene
src/data/items.ts                       [NEW]  道具表 + 效果联合 + 查询辅助
src/data/redeem.ts                      [NEW]  兑换码表（首批 '6666'）
src/data/economy.ts                     [MOD]  ITEM_ACQUISITION 道具定价
src/data/pixels/icons.ts                [MOD]  +4 道具图标矩阵
src/core/schema/save.ts                 [MOD]  SaveV6 / toV6 / shapeCurrent / defaultSave
src/core/save.ts                        [MOD]  SaveV6
src/core/gacha.ts                       [MOD]  +'item' 奖项 / prizeTier() / 权重重配
src/core/rewards.ts                     [MOD]  clearBonus 通关增益
src/core/battle/types.ts                [MOD]  BattleConfig.carriedItem? + 护盾限时字段
src/core/battle/sim.ts                  [MOD]  createBattle 初始状态 + 护盾判定
src/scenes/MenuScene.ts                 [MOD]  右上齿轮 / 设置面板重构 / 次级卡扩 4 张
src/scenes/DrawScene.ts                 [MOD]  接入 gachaFx + item 奖项 + 跳过 + 保底
src/scenes/ShopScene.ts                 [MOD]  道具售卖区
src/scenes/BattleScene.ts               [MOD]  消费 carriedItem + HUD 显示
src/scenes/InventoryScene.ts            [NEW]  背包场景
src/ui/redeem.ts                        [NEW]  兑换码面板
src/ui/DeckPicker.ts                    [MOD]  携带道具单选行
src/ui/settings.ts                      [MOD]  按需补落盘辅助
src/ui/components/kit.ts                [MOD]  rarity 语义色
src/ui/components/gachaFx.ts            [NEW]  品质动效库
tests/save.test.ts                      [MOD]  v6 迁移用例
tests/review-fixes.test.ts              [MOD]  SaveV6
tests/economy.test.ts                   [MOD]  奖池权重和 + item 分支
```

---

## 8. 验收标准

| 项 | 标准 |
|---|---|
| `tsc --noEmit` | 0 错误 |
| `vitest run` | 全绿（含新增 v5→v6 迁移、奖池权重、道具效果用例） |
| `npm run build` | 成功 |
| 帧率 | 战斗与抽卡场景 ≥60fps（实测） |
| 平板视口 1280×800 | 6+1 场景无溢出 |
| 截图 | 前后对比：Menu / Shop / Draw / Battle / Inventory / DeckPicker |
| 独立审查 | P0/P1 全部修复闭环 |
| 「减弱动态」 | 新动效全部受门控，关闭后无残留循环 tween |

---

## 9. 会话级排期

| 会话 | 交付（均有可玩可见增量） |
|---|---|
| S1 | 落点复核 + 基线截图 + 本规划 + **存档 v6** |
| S2 | **数据层**：道具表 / 兑换表 / 4 个道具图标 / 奖池与 prizeTier / 定价 |
| S3 | **设置齿轮 + 多分区设置面板 + 兑换码面板** |
| S4 | **背包场景 + 携带道具 + 开局生效 + 通关增益** |
| S5 | **抽卡品质分级动画 + 抽奖机氛围 + 十连跳过 + 保底** |
| S6 | 前后对比截图 + 性能/平板/tsc/vitest + 独立审查收尾 |

---

## 10. 执行进度与验收

状态：**S1–S6 全部完成**（本轮一次跑完）。

| 会话 | 状态 | 交付 |
|---|---|---|
| S1 | ✅ | 落点复核（14 项，见 §2）+ 4 场景改造前基线（`docs/_review/ui-polish/before2-*.png`）+ 本规划落盘 |
| S2 | ✅ | 存档 v6（`inventory` + `stats.redeemCount` + `toV6` + 清洗 + 迁移用例） |
| S3 | ✅ | `data/items.ts`（4 道具）、`data/redeem.ts`、4 道具图标 + 背包图标、`gacha.ts`（item 奖项 + `prizeTier` + 权重重配）、`economy.ts`（`ITEM_ACQUISITION`）、KIT 品质色 |
| S4 | ✅ | 主界面右上齿轮、多分区设置面板、`ui/redeem.ts` 兑换码面板（屏幕键盘 + 物理键盘 + 发放飘字 + 防重入） |
| S5 | ✅ | `InventoryScene`（页签 + 槽位 + 详情 + 空态）、主界面次级卡扩 4 张、`DeckPicker` 携带道具行、`createBattle` 初始状态、`rewards` 通关增益、`ShopScene` 页签 + 道具售卖、战斗 HUD 携带道具与护盾倒计时 |
| S6 | ✅ | `gachaFx.ts` 三档品质动效 + 抽奖机待机 + 十连级联/跳过、`DrawScene` 重做；前后对比截图、帧率实测、独立审查（0×P0/P1，5×P2 已修） |

### 验收结果

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | ✅ 0 错误 |
| `vitest run` | ✅ **127 测试全绿**（1 skipped = 扫荡，需 `SIM_SWEEP=1`）；新增 `tests/items.test.ts` 16 条 |
| `npm run build` | ✅ 成功（796ms） |
| 帧率（抽奖，1920×1080，揭示中） | ✅ 163 fps / 活跃 Tween 14 |
| 帧率（战斗，1920×1080） | ✅ 163 fps / 活跃 Tween 0 / 纹理 79 |
| 平板视口 1280×800 | ✅ Menu / Inventory / Shop / Draw / Battle 无溢出 |
| 兑换码端到端 | ✅ `6666` 发放 金币 50000 / 钻石 3000 / 种子券 50 / 能量豆 30 + 4 种道具；`stats.redeemCount` 累加；钱包条实时刷新 |
| 无效码 | ✅ 红描边 + 抖动 + 「兑换码无效」提示 |
| 携带道具端到端 | ✅ 选卡面板携带 → 开局生效（护盾 HUD 倒计时 28s）→ 扣减持有 → 结算增益 |
| 抽卡品质分级 | ✅ 十连逐张级联 + 稀有/传说光晕与 NEW 徽记 + 跳过按钮 |
| 独立审查 | ✅ **0×P0 / 0×P1**；5×P2 全部已修（见下） |

### 审查修复记录（P2）

- `redeem.ts` 输入框 `40px` 字面量 → 新增 `typography.input` 档（token 单一事实源）。
- `gachaFx.finalize()` 未 kill 容器子件（扫光带）的在途 tween → 递归 kill 子件。
- `BattleScene` 携带道具「缺键保留上局值」的死分支 → 改为缺键即不携带。
- `redeemOpen` 模块级标志在场景销毁时可能卡住 → 加 `SHUTDOWN` 兜底复位。
- 持有数扣减归零未删键 / 商店道具购买写档失败未回滚 → 均补齐。

### 留痕裁决表

| 事项 | 裁决 | 理由 |
|---|---|---|
| 兑换码记录方式 | 只记 `stats.redeemCount` 计数，不存已用数组 | 用户口径为可重复兑换，数组会无界增长 |
| 道具品质字段 | 新增 `ItemRarity`，不给 `UnitArchetype` 加字段 | `UnitArchetype` 为 `strictObject`，加字段会破坏既有 schema 测试 |
| 道具定价位置 | 落在 `data/economy.ts` 的 `ITEM_ACQUISITION`（非 `items.ts` 内嵌 `shop` 字段） | 与既有 `UNIT_ACQUISITION` 同惯例，避免定价双源 |
| 护盾实现 | `createBattle` 写入限时字段 + `sim.ts` 唯一割草机消耗点只读判定 | 满足「不新增 sim 命令」约束，挂载点唯一 |
| 护盾粒度 | 每行**各一次**（`mowerWardUsed` 逐行布尔） | 无逐行追踪会退化为「30s 内无敌」，与道具描述不符 |
| 抽卡保底展示 | 不展示"距必出还差 N 抽"进度条，改为展示累计抽数 + 「十连必出未拥有」说明 | `rollTen` 是**单次十连内保底**，无跨抽计数；做进度条会误导 |
| 键盘监听清理 | 场景级 `keydown-ESC` 沿用 Phaser 自动回收；**弹层级**键盘监听（兑换码）显式 `off` | 弹层可在场景存活期反复开关，不能依赖场景回收 |
| 商店页签状态 | 走 `registry('shopTab')` 跨 `scene.restart()` 保留 | 与 `DrawScene` 的 `drawKeepResult` 同纪律 |
| 本次不推送 | 不做任何 git 提交/推送 | 用户明确要求自行处理 |

### 顺手修复的既存缺陷

- **战斗种子卡图标溢出**：`mkToolCard` 与 `drawFoodCard` 用 `setScale(3)` 作用于 64px 的 `icon_` 纹理（=192px），在 112px 宽的卡片上严重溢出（旧基线截图同样存在）。已改为 `setDisplaySize(76, 76)`。

### 后续挂账

| 事项 | 归属 |
|---|---|
| 道具仅 4 件，`ITEMS` 扩容需同步 `ITEM_ACQUISITION`（已有测试守护一一对应） | 内容扩充时 |
| 局内主动使用道具（HUD 道具槽 + sim 命令） | 后续版本 |
| 抽卡「保底进度」若要做，需先在 `core/gacha` 引入跨抽计数 | 后续版本 |
