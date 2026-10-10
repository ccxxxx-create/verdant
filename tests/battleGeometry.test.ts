import { describe, expect, it } from 'vitest';
import {
  COLS,
  HUD_RECT,
  LAWN_RECT,
  ROWS,
  SEED_BAR_RECT,
  cellRect,
  cellX,
  cellY,
  enemyFeetY,
  laneBottom,
  laneTop,
  pointerToCell,
  rectsOverlap,
} from '../src/scenes/battleGeometry.ts';

describe('battle layout geometry (user feedback #3 click mismatch & #5 UI overlap)', () => {
  it('HUD and seed bar never overlap the lawn', () => {
    expect(rectsOverlap(HUD_RECT, LAWN_RECT)).toBe(false);
    expect(rectsOverlap(SEED_BAR_RECT, LAWN_RECT)).toBe(false);
    expect(HUD_RECT.y + HUD_RECT.h).toBe(SEED_BAR_RECT.y);
    expect(SEED_BAR_RECT.y + SEED_BAR_RECT.h).toBeLessThan(LAWN_RECT.y);
  });

  it('clicking the exact cell center maps back to that cell (round trip)', () => {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        expect(pointerToCell(cellX(col), cellY(row))).toEqual({ col, row });
      }
    }
  });

  it('pointer outside lawn returns undefined (HUD/seed bar clicks are not plant actions)', () => {
    expect(pointerToCell(80, 60)).toBeUndefined(); // HUD
    expect(pointerToCell(300, 180)).toBeUndefined(); // seed bar
    expect(pointerToCell(-5, 500)).toBeUndefined();
    expect(pointerToCell(5000, 500)).toBeUndefined();
  });

  it('cell edges are exclusive but interior maps correctly', () => {
    const c = pointerToCell(GRID_EDGE_X, GRID_EDGE_Y);
    expect(c).toEqual({ col: 0, row: 0 });
    // 右下角内侧仍映射到最后一格（用户反馈#5：最后一列必须可种植）
    expect(pointerToCell(LAWN_RECT.x + LAWN_RECT.w - 1, LAWN_RECT.y + LAWN_RECT.h - 1)).toEqual({ col: COLS - 1, row: ROWS - 1 });
  });

  it('enemy sprite feet stay inside its lane', () => {
    for (let row = 0; row < ROWS; row++) {
      const y = enemyFeetY(row, 120);
      expect(y + 60).toBeGreaterThanOrEqual(laneTop(row));
      expect(y + 60).toBeLessThanOrEqual(laneBottom(row));
    }
  });

  it('cellRect covers the full lane cell', () => {
    const r = cellRect(2, 3);
    expect(r.x).toBe(LAWN_RECT.x + 2 * r.w);
    expect(r.y).toBe(laneTop(3));
    expect(r.y + r.h).toBe(laneBottom(3));
  });
});

const GRID_EDGE_X = LAWN_RECT.x;
const GRID_EDGE_Y = LAWN_RECT.y;
