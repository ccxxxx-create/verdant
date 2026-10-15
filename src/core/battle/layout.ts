/**
 * 战斗布局唯一事实源（M3A：从 scenes/battleGeometry.ts 迁入内核，零引擎依赖）。
 *  Kernels need cell math; the scene re-exports these via scenes/battleGeometry.ts.
 * 布局：顶部信息条(0-108) 鈫?水平种子条(108-256) 鈫?6脳9 草坪(272-1040) 鈫?左侧推犁 gutter。
 */

export const ROWS = 6;
export const COLS = 9;

/** 顶部信息条（露珠计数/波次/倍速）。 */
export const HUD_H = 108;
/** 种子条：108鈥?56（PvZ 式水平顶栏）。 */
export const SEED_BAR_Y = HUD_H;
export const SEED_BAR_H = 148;
/** 草坪：x 170鈥?850，y 272鈥?040。 */
export const GRID_X0 = 170;
export const GRID_Y0 = SEED_BAR_Y + SEED_BAR_H + 16;
export const GRID_BOTTOM = 1040;
/** 右侧波次进度条留白。 */
export const WAVE_MARGIN = 90;
/** 左侧推犁 / gutter。 */
export const GATE_X = 118;

export const COL_W = (1920 - GRID_X0 - WAVE_MARGIN) / COLS;
export const ROW_H = (GRID_BOTTOM - GRID_Y0) / ROWS;

/** 敌人粒子踩脚点距行底的内边距（像素），与字体无关，仅几何。 */
export const ENEMY_FOOT_PAD = 6;
/** 露珠（掉落阳光）可点击收集半径。 */
export const SUN_PICK_R = 46;

export interface Cell {
  col: number;
  row: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const LAWN_RECT: Rect = {
  x: GRID_X0,
  y: GRID_Y0,
  w: COLS * COL_W,
  h: GRID_BOTTOM - GRID_Y0,
};

export const SEED_BAR_RECT: Rect = {
  x: 0,
  y: SEED_BAR_Y,
  w: 1920,
  h: SEED_BAR_H,
};

export const HUD_RECT: Rect = {
  x: 0,
  y: 0,
  w: 1920,
  h: HUD_H,
};

/** 单元格中心（种植锚点=点击点，反馈#3：视觉与判定同源）。 */
export function cellX(col: number): number {
  return GRID_X0 + col * COL_W + COL_W / 2;
}

export function cellY(row: number): number {
  return GRID_Y0 + row * ROW_H + ROW_H / 2;
}

export function laneTop(row: number): number {
  return GRID_Y0 + row * ROW_H;
}

export function laneBottom(row: number): number {
  return GRID_Y0 + (row + 1) * ROW_H;
}

/** 指针坐标 鈫?单元格；越界/UI 区域返回 undefined。 */
export function pointerToCell(x: number, y: number): Cell | undefined {
  if (x < GRID_X0 || y < GRID_Y0) return undefined;
  const col = Math.floor((x - GRID_X0) / COL_W);
  const row = Math.floor((y - GRID_Y0) / ROW_H);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return undefined;
  return { col, row };
}

/** 敌人图像 y（贴行底，防漂移）。 */
export function enemyFeetY(row: number, spriteHeight: number): number {
  return laneBottom(row) - ENEMY_FOOT_PAD - spriteHeight / 2;
}

/** 天空露珠下落的停留区间（草坪内随机停点）。 */
export const SUN_REST_X0 = GRID_X0 + 70;
export const SUN_REST_X1 = GRID_X0 + COLS * COL_W - 70;
export const SUN_REST_Y0 = GRID_Y0 + 90;
export const SUN_REST_Y1 = GRID_BOTTOM - 80;

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** 单元格矩形（幽灵预览/格子高亮/铲除命中共用）。 */
export function cellRect(col: number, row: number): Rect {
  return { x: GRID_X0 + col * COL_W, y: GRID_Y0 + row * ROW_H, w: COL_W, h: ROW_H };
}

// 鈥斺€?战斗内核几何锚点（M3A，参考 PvZ1 原版反编译口径自定）鈥斺€?

/** 敌人出生 x（屏幕右缘外）。 */
export const SPAWN_X = 1960;
/** 敌人啃食时停在植物右缘外的像素偏移（PvZ 嘴部几何；必须 > 枪口偏移）。 */
export const BITE_OFFSET = 64;
/** 锁定啃食目标的最大提前量（贴脸才锁定；窗口外不可见，防"锁定即瞬移"）。 */
export const BITE_LOCK_SLACK = 24;
/** 锁定窗口左界（负值=已越过嘴位；越过即让位给推犁线）。 */
export const BITE_LOCK_MIN = -10;
/** 直射弹体与敌人的命中容差（线性扫描两侧，治愈"射穿啃食者"）。 */
export const HIT_R = 40;
/** 推犁触发线（敌人越过即触发/破线）= 推车立绘中心 GATE_X（用户反馈：与推车视觉位置差 20px 有偏移）。 */
export const MOWER_LINE = GATE_X;
/** 弹体飞行速度 px/s。 */
export const PROJ_SPEED = 620;
/** homing（蒲公英追踪种子）速度系数（= PROJ_SPEED × 该值）。 */
export const HOMING_SPEED_FACTOR = 0.8;
/** homing 最长追逐 ms（超时空中消散，防永飞）。 */
export const HOMING_TIMEOUT_MS = 2600;
/** 三连发类弹幕的发射间隔 ms。 */
export const MULTI_SHOT_STAGGER_MS = 80;
/** 露珠落地时长 ms。 */
export const SUN_FALL_MS = 4200;
/** 植物产物露珠短落地 ms。 */
export const PLANT_SUN_FALL_MS = 420;
/** 露珠静置寿命 s。 */
export const SUN_LIFE_S = 14;
/** 世界能量大招强化时长 ms（GDD 搂13.1）。 */
export const POWER_DURATION_MS = 8000;
/** 大招拖空白：击退格数。 */
export const POWER_KNOCKBACK_CELLS = 1;
/** 大招拖空白：击退半径（格）。 */
export const POWER_KNOCKBACK_RADIUS = 1.5;
/** 大招拖空白：火焰伤害。 */
export const POWER_KNOCKBACK_DAMAGE = 100;
/** 局内能量掉落持有上限（PvZ2 口径：基础 3，古埃及升级 4，内购 5）。 */
export const PLANT_FOOD_CAP = 3;

