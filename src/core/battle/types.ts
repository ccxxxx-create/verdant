import type { EnemyArchetype, UnitArchetype } from '../schema/unit.ts';
import type { LevelDef } from '../schema/level.ts';
import type { Rng } from '../rng.ts';

/** 内核战斗配置：关卡 + 原型表 + 牌组 + 种子。 */
export interface BattleConfig {
  level: LevelDef;
  units: ReadonlyMap<string, UnitArchetype>;
  enemies: ReadonlyMap<string, EnemyArchetype>;
  /** 牌组（局前选卡结果；缺省时内核用全 owned 前 8）。 */
  deck: readonly string[];
  seed?: number;
}

export type AttackKind = 'single' | 'multi' | 'aoe' | 'melee' | 'lobbed' | 'trigger';

export interface UnitInst {
  uid: number;
  def: UnitArchetype;
  row: number;
  col: number;
  /** 像素坐标（种植锚点=格心，渲染与判定同源）。 */
  x: number;
  y: number;
  hp: number;
  /** 上次行动时间（内核统一时钟 ms）。 */
  lastShot: number;
  /** 三连发等排队弹。 */
  pendingShots: { at: number; damage: number; element: string }[];
  /** 大招强化截止（0=未激活）。 */
  powerUntil: number;
  /** 被蛛网定身截止。 */
  stunUntil: number;
  /** control 行为已命中的敌人集合（避免每帧重复触发）。 */
  controlled: Set<number>;
}

export interface EnemyInst {
  eid: number;
  def: EnemyArchetype;
  row: number;
  hp: number;
  maxHp: number;
  /** 逻辑 x（px，右为来向）。 */
  x: number;
  /** 图像 y（飞行单位漂移用）。 */
  yOffset: number;
  slowUntil: number;
  burnUntil: number;
  stunUntil: number;
  flashUntil: number;
  biteTarget?: UnitInst;
  /** 铁门正面格挡盾量（>0 时吸收直射）。 */
  shield: number;
  /** Boss 召唤物（统计召唤上限用）。 */
  summoned?: boolean;
  /** gnaw_pause：已停下啃过的单位 id。 */
  gnawed?: Set<number>;
  /** 潜行/显形（mist_lamp reveal 字段，M4 潜行敌接入前为展示位）。 */
  revealed: boolean;
}

export interface ProjInst {
  pid: number;
  row: number;
  /** 发射起点（lobbed 弧线插值用）。 */
  sx: number;
  sy: number;
  x: number;
  y: number;
  damage: number;
  element: string;
  kind: 'straight' | 'lobbed';
  /** lobbed 落点。 */
  tx: number;
  ty: number;
  tRow: number;
  /** 飞行累计 ms。 */
  age: number;
  duration: number;
}

export interface DropInst {
  did: number;
  kind: 'light' | 'plantFood';
  x: number;
  y: number;
  restY: number;
  life: number;
  falling: boolean;
  age: number;
  /** 下落时长 ms（天空露珠慢、植物产物快）。 */
  fallMs: number;
}

export type BattleEvent =
  | { t: 'plant'; unit: UnitInst }
  | { t: 'dig'; unit: UnitInst }
  | { t: 'enemySpawn'; enemy: EnemyInst }
  | { t: 'enemyDeath'; enemy: EnemyInst; x: number; y: number }
  | { t: 'unitDeath'; unit: UnitInst; x: number; y: number }
  | { t: 'hit'; x: number; y: number; damage: number; element: string; target: 'enemy' | 'unit'; /** 受击实例 id（渲染定位用）。 */ tid?: number }
  | { t: 'shoot'; x: number; y: number; element: string }
  | { t: 'blast'; x: number; y: number }
  | { t: 'sunSpawn'; drop: DropInst }
  | { t: 'sunCollect'; did: number; x: number; y: number; amount: number }
  | { t: 'plantFoodSpawn'; drop: DropInst }
  | { t: 'plantFoodCollect'; did: number; x: number; y: number }
  | { t: 'powerStart'; unit: UnitInst }
  | { t: 'powerEnd'; unit: UnitInst }
  | { t: 'knockback'; x: number; y: number }
  | { t: 'stun'; x: number; y: number }
  | { t: 'web'; x: number; y: number }
  | { t: 'shieldBreak'; x: number; y: number }
  | { t: 'mower'; row: number }
  | { t: 'waveStart'; wave: number; final: boolean }
  | { t: 'waveWarning' }
  | { t: 'win' }
  | { t: 'lose' }
  | { t: 'banner'; text: string; hold: number }
  | { t: 'flash'; text: string; hold: number };

export interface BattleStats {
  kills: number;
  peakUnits: number;
  dug: number;
  mowersUsed: number;
  elapsedMs: number;
}

export interface BattleState {
  config: BattleConfig;
  rng: Rng;
  /** 统一时钟 ms（倍速下 dt/now 同步缩放，见 step）。 */
  now: number;
  lightdew: number;
  plantFood: number;
  units: UnitInst[];
  enemies: EnemyInst[];
  projectiles: ProjInst[];
  drops: DropInst[];
  mowers: boolean[];
  wave: number;
  waveTimer: number;
  /** 本波已进行 ms（清场加速的最短经过时间判定）。 */
  waveAge: number;
  waveHpStart: number;
  inWave: boolean;
  spawnQueue: { id: string; row: number }[];
  spawnTimer: number;
  skySunTimer: number;
  conveyor: { hand: string[]; timer: number; exhausted: string[] } | null;
  bossSummonTimer: number;
  /** 卡牌冷却（unitId → 起止 ms）。 */
  cooldowns: Record<string, { start: number; end: number }>;
  /** 已发过大波警示的波次（去重）。 */
  warnedWaves: Set<number>;
  status: 'playing' | 'won' | 'lost';
  stats: BattleStats;
  seq: number;
  events: BattleEvent[];
}

export interface BattleCommands {
  plant(state: BattleState, unitId: string, row: number, col: number): boolean;
  dig(state: BattleState, row: number, col: number): boolean;
  collectDrop(state: BattleState, dropId: number): boolean;
  usePlantFoodOnUnit(state: BattleState, unitId: number): boolean;
  usePlantFoodAtCell(state: BattleState, row: number, col: number): boolean;
}
