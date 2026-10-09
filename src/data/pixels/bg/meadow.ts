import type { PixelSprite } from '../palette.ts';

/**
 * 草原战斗场景像素背景（320×180 逻辑网格，运行时 ×6 放大到 1920×1080）。
 * 代码生成+确定性种子：天空带/太阳/树线/雾(抖动)/六车道草带/草屑散布/左侧栅栏。
 * 场景统一走像素体系（用户裁定：所有内容全像素）。
 */

const W = 320;
const H = 180;

const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));

function set(y: number, x: number, ch: string): void {
  if (y < 0 || y >= H || x < 0 || x >= W) return;
  const row = grid[y];
  if (row) row[x] = ch;
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 天空带色（上深下浅，地平线最亮） */
const SKY: [number, string][] = [
  [26, 'q'],
  [40, 'g'],
  [54, 'L'],
  [62, 'h'],
];

/** 树线高度函数（确定性；右侧密左侧疏） */
function treeLine(x: number): number {
  const t = (x * 2654435761) % 100;
  const base = x > 220 ? 26 : x > 120 ? 16 : 8;
  return base + Math.floor(t / 12);
}

export function meadowBattleBg(): PixelSprite {
  // 1. 天空
  let y = 0;
  for (const [rows, ch] of SKY) {
    for (let i = 0; i < rows && y < H; i++, y++) {
      for (let x = 0; x < W; x++) set(y, x, ch);
    }
  }

  // 2. 太阳（右侧 = 敌人来向）
  const sunX = 268;
  const sunY = 58;
  const sunR = 13;
  for (let yy = -sunR; yy <= sunR; yy++) {
    for (let xx = -sunR; xx <= sunR; xx++) {
      if (xx * xx + yy * yy <= sunR * sunR) {
        set(sunY + yy, sunX + xx, xx * xx + yy * yy <= (sunR * 0.45) ** 2 ? 'W' : 'G');
      }
    }
  }

  // 3. 树线（地平线上的剪影，底部深绿过渡）
  for (let x = 0; x < W; x++) {
    const h = treeLine(x);
    for (let i = 0; i < h; i++) set(86 - i, x, 'K');
    set(85, x, 'd');
    set(86, x, 'q');
    set(87, x, 'M');
  }

  // 4. 雾（像素抖动半透明：低密度，柔化地平线）
  for (let x = 0; x < W; x++) {
    for (let py = 80; py < 88; py++) if ((x + py) % 3 === 0) set(py, x, 'W');
    for (let py = 74; py < 79; py++) if ((x * 3 + py) % 6 === 0) set(py, x, 'i');
  }

  // 5. 地面 + 六车道刈纹
  for (let py = 87; py < H; py++) {
    for (let x = 0; x < W; x++) set(py, x, 'M');
  }
  const laneH = 15;
  for (let lane = 0; lane < 6; lane++) {
    const y0 = 88 + lane * laneH;
    for (let py = y0; py < y0 + laneH && py < H; py++) {
      const mid = py - y0;
      for (let x = 0; x < W; x++) set(py, x, mid >= 3 && mid < laneH - 3 ? 'L' : 'M');
    }
  }

  // 6. 草屑与小花
  const rnd = mulberry(20261009);
  for (let i = 0; i < 900; i++) {
    const x = Math.floor(rnd() * W);
    const py = 88 + Math.floor(rnd() * (H - 88));
    const cur = grid[py]?.[x];
    if (cur === 'L' || cur === 'M') set(py, x, rnd() < 0.72 ? 'h' : 'd');
  }
  for (let i = 0; i < 26; i++) {
    const x = 6 + Math.floor(rnd() * (W - 12));
    const py = 90 + Math.floor(rnd() * (H - 94));
    set(py, x, rnd() < 0.5 ? 'G' : 'W');
  }

  // 7. 左侧木栅栏（玩家侧地标）
  for (let px = 10; px <= 34; px += 8) {
    for (let py = 96; py <= 110; py++) set(py, px, 'N');
    set(97, px, 'n');
    set(109, px, 'K');
  }
  for (const py of [98, 99, 107, 108]) {
    for (let px = 8; px <= 40; px++) if (grid[py]?.[px] === '.') set(py, px, 'n');
  }

  return grid.map((row) => row.join(''));
}
