/**
 * 战斗场景唯一几何事实源（PvZ 式布局：顶部信息条 → 水平种子条 → 6×9 草坪 → 左侧篱门）。
 * 布局纪律：任何 UI 矩形不得与 LAWN_RECT 重叠（用户第 12 轮反馈#5：槽位遮挡草坪）。
 * 本模块为纯函数/常量，供 BattleScene 与测试共用（点击错位回归防线，反馈#3）。
 */

export const ROWS = 6;
export const COLS = 9;

/** 顶部信息条（光露计数/波次/倍速）：0–108。 */
export const HUD_H = 108;
/** 种子卡条：108–256（PvZ 式水平顶条）。 */
export const SEED_BAR_Y = HUD_H;
export const SEED_BAR_H = 148;
/** 草坪：x 170–1850，y 272–1040。 */
export const GRID_X0 = 170;
export const GRID_Y0 = SEED_BAR_Y + SEED_BAR_H + 16;
export const GRID_BOTTOM = 1040;
/** 右侧波次进度带留白。 */
export const WAVE_MARGIN = 90;
/** 左侧篱门/ gutter。 */
export const GATE_X = 118;

export const COL_W = (1920 - GRID_X0 - WAVE_MARGIN) / COLS;
export const ROW_H = (GRID_BOTTOM - GRID_Y0) / ROWS;

/** 敌人精灵落脚点距行底的内边距（像素）与字号无关，仅几何。 */
export const ENEMY_FOOT_PAD = 6;
/** 光露（掉落阳光）可点击收集半径。 */
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

/** 单元格中心（种植落点=点击点，反馈#3：视觉与判定同源）。 */
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

/** 指针坐标 → 单元格；越界/UI 区域返回 undefined。 */
export function pointerToCell(x: number, y: number): Cell | undefined {
  if (x < GRID_X0 || y < GRID_Y0) return undefined;
  const col = Math.floor((x - GRID_X0) / COL_W);
  const row = Math.floor((y - GRID_Y0) / ROW_H);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return undefined;
  return { col, row };
}

/** 敌人图像 y（精灵底部贴行底，防漂浮）。 */
export function enemyFeetY(row: number, spriteHeight: number): number {
  return laneBottom(row) - ENEMY_FOOT_PAD - spriteHeight / 2;
}

/** 天空阳光下落的目标区间（草坪内随机停留点）。 */
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
