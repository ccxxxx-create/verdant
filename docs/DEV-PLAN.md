# 《长夏》开发计划（DEV-PLAN）

> 对应 GDD：`docs/GDD.md`。本文档是架构落地规范 + M0-M6 里程碑路线图。
> 架构结论来源：三次独立采样收敛（详见 `docs/PLAN.md` §5 留痕裁决表 D8 与收敛结论）。
> 版本基准：2026-10-09 Context7 收录 Phaser 3.90.0、Vite 8.0.x；M0 建仓时以 npm registry 实际 stable 为准并锁定。

---

## 1. 架构总览

### 1.1 场景划分

| 场景 | 职责 | 说明 |
|---|---|---|
| `BootScene` | 程序化生成 SVG 资产并烘焙为 Phaser 纹理 | 启动一次，走完才进 Preload |
| `PreloadScene` | 载入 JSON 关卡数据 + Zod 校验 + 存档读取迁移 | 校验失败给可读报错（不黑屏） |
| `MenuScene` | 主菜单 | — |
| `MapScene` | 巡野图（四世界长卷+节点） | — |
| `GameScene` | 对局核心：网格/实体/各系统 | 实体只在此增删 |
| `HudScene` | 对局 UI 覆盖层（并行运行） | 只读 EventBus，不直接操作 GameScene 实体 |
| `ResultScene` | 结算（三星/奖励/解锁） | — |
| `CodexScene` | 图鉴 | 读 archetype 注册表 |
| `EditorScene` | 关卡编辑器 | **M4 起上线**；复用 GameScene 渲染层与同一 schema |

场景间只经 EventBus 与 registry 通信，互不直持引用。

### 1.2 实体模型：Container + 可插拔行为组件

拒绝类继承树与全量 ECS（单人+AI 协作下前者爆炸、后者样板成本高）。实体=容器+数据+组件数组：

```ts
// entities/Entity.ts
import Phaser from 'phaser';

export interface BehaviorContext {
  entity: Entity;
  grid: GridQuery;     // 查格/格状态查询接口
  bus: EventBus;       // 全局事件
  rng: RNG;            // 确定性随机（播种，可回放）
  time: number;        // 全局对局时间
}

export interface Behavior {
  readonly key: string;
  onAttach?(ctx: BehaviorContext): void;
  update?(dt: number, ctx: BehaviorContext): void;
  onDetach?(ctx: BehaviorContext): void;
}

export class Entity {
  readonly parts: Phaser.GameObjects.Container;   // 部件容器（SVG 部件层）
  readonly archetypeId: string;                   // 索引 data/archetypes
  readonly lane: number;
  readonly cell: { col: number; row: number };
  hp: number;
  statuses: StatusSet;                            // 燃烧/感电/减速/定身…
  private behaviors = new Map<string, Behavior>();
  constructor(readonly scene: Phaser.Scene, def: UnitArchetype, lane: number) { /* ... */ }
  addBehavior(b: Behavior) { /* attach */ }
  update(dt: number, ctx: BehaviorContext) { for (const b of this.behaviors.values()) b.update?.(dt, ctx); }
}
```

新增一个单位=只加一条 archetype 数据 + 组合既有 behavior 键，零新类。

### 1.3 数据组织（混合）

| 数据 | 载体 | 理由 |
|---|---|---|
| 单位/敌人原型（archetypes） | **TS 常量模块** `src/data/archetypes/**/*.ts` | 编译期查错、AI 重构安全、git diff 可读 |
| 波次脚本 | TS 常量（同目录 `waves/`） | 同上 |
| 关卡定义 | **JSON** `src/data/levels/*.json` | 内容侧自由、编辑器产出、用 `import.meta.glob` 构建期打包 |
| 存档 | JSON（localStorage，见 GDD §9.2） | — |
| Schema | **Zod** `src/core/schema/*.ts`，带 `version`+`migrate()` | 字段只增不删；加载即校验，可读报错 |

```ts
// core/schema/unit.ts（节选）
export const UnitArchetype = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),        // 例：firefly_reed
  world: z.enum(['meadow', 'reef', 'sky', 'frost']),
  role: z.enum(['producer', 'attacker', 'defender', 'support']),
  name: z.string(),                              // UI 名（中文）
  cost: z.number().int().positive(),
  cooldownMs: z.number().int().positive(),
  hp: z.number().int().positive(),
  behaviors: z.array(z.string()),                // behavior 键列表
  attack: z.object({                          // 可选
    damage: z.number(), intervalMs: z.number(),
    kind: z.enum(['single', 'multi', 'aoe', 'melee', 'lobbed', 'trigger']),
    range: z.number(), element: z.enum(['none','fire','water','ice','electric']).optional(),
  }).optional(),
  waterOnly: z.boolean().default(false),        // 深海限水格
  breakableSlots: z.boolean().default(false),   // 浮岛可种断格
}).strict();
```

### 1.4 动画管线：SVG → 纹理 → 部件容器 → 数据化 clip

1. **烘焙**：`BootScene` 用 `this.load.svg(key, url, { width, height })` 光栅化（Phaser 官方 API，见 §6 引证）为 2× 分辨率纹理；每个角色拆多个部件 SVG（身/头/武器/表情），同一键 `*_part_*`。
2. **组装**：实体=`Phaser.GameObjects.Container` 内按 anchor 挂部件 Sprite。
3. **动画**：clip 是**数据**，由统一 `PartAnimator` 驱动：
   ```ts
   type Clip = { name: string; steps: { t: number; part: string; prop: 'x'|'y'|'rot'|'scaleY'|'alpha'; to: number; ease?: string }[]; loop?: boolean };
   ```
   新单位只写 clip 不写代码；打击/死亡特效走 `this.add.particles()`（3.60+ API）+对象池。
4. **不上 Spine/DragonBones**：无法程序化产出素材，体积与授权成本不划算（三次采样 3/3 共识）。

### 1.5 通信与状态

- `EventBus`：全局 `Phaser.Events.EventEmitter` 单例，跨场景/跨系统解耦（`economy:changed`、`wave:flag`、`entity:spawned`…）。
- `GameStore`：存档/设置/进度（≈80 行 typed reactive），localStorage 持久化。
- `GameState`：局内单例（光露数、波次计数、暂停），只活在对局中。
- 实体间禁止直接引用；交互一律走事件或 `GridQuery` 查询。

### 1.6 目录骨架

```
src/
  main.ts                  game.config.ts
  core/        bus.ts store.ts save.ts rng.ts
               schema/{unit,enemy,level,save,version}.ts
  data/        archetypes/{units,enemies,waves}/…
               levels/*.json
  scenes/      BootScene PreloadScene MenuScene MapScene
               GameScene HudScene ResultScene CodexScene (EditorScene@M4)
  entities/    Entity.ts UnitEntity.ts EnemyEntity.ts
               ProjectileEntity.ts DropEntity.ts
  behaviors/   MoveBehavior AttackBehavior ProduceBehavior
               ControlBehavior AuraBehavior LobBehavior FlyBehavior
               StatusBehavior BurnBehavior ElectrifyBehavior
  systems/     GridSystem EconomySystem WaveDirectorSystem
               TargetingSystem TerrainSystem StatusSystem
               SaveSystem CodexRegistry
  fx/          ParticleFactory.ts ClipLibrary.ts
  render/      SvgFactory.ts PartFactory.ts
  ui/          tokens.ts components/ hud/ map/
  audio/       sfx.ts music.ts
tests/
  waveSim.test.ts   chains.test.ts
  archetypeSmoke.test.ts  save.test.ts
public/             favicon.svg og-image.png(M6)
.github/workflows/  deploy.yml
```

---

## 2. 数据 Schema 草案（节选）

```ts
// core/schema/level.ts
export const LevelDef = z.object({
  id: z.string(),                    // meadow-1-1
  world: z.enum(['meadow', 'reef', 'sky', 'frost']),
  template: z.enum(['teach', 'normal', 'flag', 'survive', 'boss', 'chal']),
  rows: z.literal(6), cols: z.literal(9),
  terrain: z.object({               // 每世界地形差异
    waterColumns: z.array(z.number()).default([]),   // 深海：水格列（每行同构）
    brokenCells: z.array(z.number()).default([]),   // 浮岛：断格索引
    iceColumns: z.array(z.number()).default([]),   // 冰原：冰面列
    wind: z.enum(['none', 'left', 'right']).default('none'),
  }),
  waves: z.number().int(),
  pool: z.array(z.string()),        // 亮相敌人 id（波次导演只允许从此池选）
  unlockUnits: z.array(z.string()).default([]),    // 首通奖励
  starCondition: z.enum(['none','no_producer','deck_le6','field_le12',
                         'no_fire','no_electric','under_90s','no_mower_break','no_shovel']).default('none'),
  startingLight: z.number().int().default(50),
});
export const SaveGame = z.object({ schemaVersion: z.number(), /* 见 GDD §9.2 */ });
```

`version.ts`：`migrate(save): save` 链式升级；旧字段只增不删；校验失败→重置为默认档并提示。

---

## 3. 性能预算（硬编码，违反即返工）

| 指标 | 上限 | 测量 |
|---|---|---|
| 同屏实体（单位+敌人+掉落物） | ≤ 80 | Phaser 计数 |
| 活粒子 | ≤ 2000 | `emitter.getAliveParticleCount()` 汇总 |
| 纹理内存（运行时） | ≤ 40MB | renderer 纹理统计 |
| 同时活跃 Tween | ≤ 300 | tween 管理器 |
| 帧率 | PC 与平板双端 ≥ 60fps | 每帧 EMA + 每 5s 落 `perf.log` |
| 加载到可交互 | ≤ 3s（WiFi） | 启动计时 |

**画质三档**（`settings.quality=auto` 时按设备探测+帧率EMA自动切换）：高档=全量；中档=粒子 -50%、死亡粒子简化；低档=粒子 -70%、非必要 tween 关闭。降档**不改变玩法数值**（只改表现）。

---

## 4. 测试策略（把 R2/R3 风险压成自动化）

| 层级 | 工具 | 内容 |
|---|---|---|
| 单元 | vitest + Phaser **HEADLESS** 模式 | 元素连锁 BFS（传导跳数/蒸汽转换/融冰）；波次导演公式；Zod 校验全部 archetypes |
| 冒烟 | HEADLESS 启动 | 遍历全部 archetype 各生成一帧，断言纹理键存在（防注册表漂移——采样1 风险对策） |
| 模拟 | Node 跑逻辑（不渲染） | 每关 50 局 AI 托管对局，统计胜率方差（判据见 PLAN R2：>35% 重调） |
| 端到端 | Playwright（M2 起） | 主路径：启动→选关→种植→结算；平板视口 1280×800 触控模拟 |
| 类型 | `tsc --noEmit` | CI 必过 |

---

## 5. 里程碑 M0-M6（每项可独立验收）

### M0 脚手架与可部署空壳（约 1 个工作会话）

- 产出：git 仓库 + GitHub public 仓库 + Vite/Phaser/TS 骨架；Boot→Menu 可跑；schema 草案；LICENSE（MIT，建仓时终定）；README。
- 验收：`npm run build` 通过；GitHub Actions 部署绿；**Pages URL 打开能看到主菜单**；registry 校验器进 CI。
- **部署纪律（M1-M6 通用）**：每个里程碑合并即自动部署 Pages，可玩产出对同学实时可见（PLAN R6 的外部反馈机制）；里程碑验收默认包含"Pages 上验证当期待办功能"。

### M1 核心手感垂直切片（约 2-3 个工作会话）

- 产出：草原第 1 关全流程（种植/产出/波次/弹道/啃食/失败）；刺豆+萤茅+2 敌人；角色 4 状态（待机/受击/攻击/死亡）外观。
- 验收：**R1 切换判据关口**——表 §7 风险 R1：连续 2 个工作会话外观不达验收即触发管线切换评估。四状态动画在平板视口目视通过。

### M2 对局闭环 + UI 系统 + 性能达标（约 3 个工作会话）

- 产出：HUD/编成/巡野图/结算/存档；网格系统+6×9；触控+键鼠双输入；性能预算仪表。
- 验收：PC 与平板（或浏览器平板视口代理）双端 ≥60fps；Playwright 主路径 E2E 绿；存档重进/迁移用例通过。

### M3 世界一内容量产（约 2-3 个工作会话）

- 产出：草原 26 关全量 + 13 单位 + 10 敌人全量 + Boss + 三星挑战关 + 掉落光露。
- 验收：无头模拟 50 局/关胜率方差 ≤35%（PLAN R2）；archetype 冒烟绿；全关卡可通关（脚本验证）。

### M4 深海世界 + 关卡编辑器（约 3 个工作会话）

- 产出：深海 26 关 + 12 单位 + 10 敌人 + 导电链 + 暖流井；编辑器（复用 schema，关卡 JSON 导出）。
- 验收：编辑器产出 1 关并在运行时加载通过；导电 BFS 单元测试绿；模拟方差达标。

### M5 浮岛 + 冰原（约 3-4 个工作会话）

- 产出：两世界内容全套（24 单位/敌人、断格、风向、冰面、寒潮、Boss）+ 生存关全套。
- 验收：同 M4 判据；四世界全部可通；跨世界携带单位规则生效。

### M6 打磨与首发发布（约 2-3 个工作会话）

- 产出：音频全量、动效打磨、图鉴、OG 图、README、性能终测、`docs/BACKLOG.md` 评审。
- 验收：视觉闸门终过（参照物锚定+硬指标+独立评审）；双端 60fps 复测；107 关全通脚本验证。

---

## 6. GitHub Pages CI 要点

- `vite.config.ts`：`base: '/<仓库名>/'`（Pages 子路径，官方文档方案）。
- `.github/workflows/deploy.yml`：push main → `npm ci` → `npm run build` → `actions/upload-pages-artifact`（`./dist`）→ `actions/deploy-pages`；权限 `pages: write` + `id-token: write`（Vite 官方 static-deploy 工作流）。
- Pages 设置：Settings → Pages → Source = **GitHub Actions**。

## 7. 官方引证（知识盘点，2026-10-09）

| 事实 | 来源 |
|---|---|
| `this.load.svg(key, url, {width,height})` 光栅化 SVG | Phaser 官方文档（Context7 `/phaserjs/phaser`，loading-assets） |
| 3.60+ 粒子 API：`this.add.particles(x,y,texture,config)` 返回 `ParticleEmitter`，无 Manager | Phaser 官方文档（Context7，particles） |
| `load.atlas` 支持 JSON/XML/Multi/Unity/Aseprite 图集 | Phaser 官方文档（loading-assets） |
| Vite Pages 部署：设 `base`、workflow 用 `actions/deploy-pages` | Vite 官方文档（Context7 `/vitejs/vite`，static-deploy-github-pages） |
| Phaser 3.90.0 / Vite 8.0.x 为收录最新版 | Context7 版本列表（2026-10-09 快照） |

> 实施中遇未核实概念：先 Context7/官方文档查证再动手（知识盘点纪律）。
