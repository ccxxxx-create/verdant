/**
 * 程序化 SVG 资产生成器（GDD §11 规范：viewBox 100×100/200×200，描边 3-4px，≤4 色+描边，无滤镜）。
 * 运行：npm run assets → 输出到 public/assets/svg/。
 * M1B：扩展参数化角色立绘（13 单位 + 11 敌人），body/weapon/pattern 三组参数差异化。
 * 调色板唯一事实源：src/ui/tokens.json（与运行时 UI 共享）。
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'assets', 'svg');

const { palette: C } = JSON.parse(readFileSync(join(root, 'src', 'ui', 'tokens.json'), 'utf8'));
const INK = C.bgDeep;

const wrap = (body, w = 200, h = 200) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${body}\n</svg>\n`;

const shadow = `<ellipse cx="100" cy="168" rx="52" ry="9" fill="${INK}" opacity="0.10"/>`;

// —— 世界图标（6 个 M0 资产，保留） ——
const svgs = {
  world_meadow: wrap(`
  <circle cx="76" cy="24" r="10" fill="${C.accent}"/>
  <path d="M6 78 Q30 44 54 78 Z" fill="${C.moss}"/>
  <path d="M48 78 Q72 40 96 78 Z" fill="${C.moss}"/>
  <path d="M6 78 L94 78" stroke="${C.primaryDeep}" stroke-width="3" stroke-linecap="round"/>
  <path d="M30 78 L30 58 M30 66 L22 58 M30 66 L38 58" stroke="${C.primaryDeep}" stroke-width="3" stroke-linecap="round" fill="none"/>
  <path d="M66 78 L66 54 M66 64 L57 55 M66 64 L75 55" stroke="${C.primaryDeep}" stroke-width="3" stroke-linecap="round" fill="none"/>`, 100, 100),

  world_reef: wrap(`
  <path d="M28 82 Q28 48 46 40 Q40 58 52 52 Q58 34 74 38 Q66 56 76 60 Q84 66 82 82 Z" fill="${C.reef}"/>
  <path d="M28 82 L82 82" stroke="${C.primaryDeep}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="20" cy="26" r="4" fill="none" stroke="${C.primaryDeep}" stroke-width="3"/>
  <circle cx="34" cy="16" r="3" fill="none" stroke="${C.primaryDeep}" stroke-width="3"/>
  <path d="M62 20 q6 -8 12 0 q-6 8 -12 0 Z" fill="${C.accent}"/>`, 100, 100),

  world_sky: wrap(`
  <path d="M22 70 Q50 52 78 70 Q72 88 50 88 Q28 88 22 70 Z" fill="${C.sky}"/>
  <path d="M22 70 Q50 52 78 70" fill="none" stroke="${C.primaryDeep}" stroke-width="3" stroke-linecap="round"/>
  <path d="M50 88 L50 78" stroke="${C.primaryDeep}" stroke-width="3" stroke-linecap="round"/>
  <path d="M40 34 q4 -8 8 0 q4 8 8 0" fill="none" stroke="${C.primaryDeep}" stroke-width="3" stroke-linecap="round"/>
  <path d="M50 40 q-8 4 -12 14 M50 40 q8 4 12 14" fill="none" stroke="${C.moss}" stroke-width="3" stroke-linecap="round"/>`, 100, 100),

  world_frost: wrap(`
  <g stroke="${C.primaryDeep}" stroke-width="3" stroke-linecap="round">
    <path d="M50 18 L50 82 M28 32 L72 68 M28 68 L72 32"/>
    <path d="M50 30 L42 22 M50 30 L58 22 M50 70 L42 78 M50 70 L58 78"/>
  </g>
  <circle cx="50" cy="50" r="8" fill="${C.frost}"/>
  <path d="M18 82 L82 82" stroke="${C.frost}" stroke-width="3" stroke-linecap="round"/>`, 100, 100),

  icon_lightdew: wrap(`
  <path d="M50 14 C64 36 74 46 74 58 A24 24 0 0 1 26 58 C26 46 36 36 50 14 Z" fill="${C.accent}"/>
  <path d="M42 52 A10 10 0 0 0 46 64" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
  <path d="M50 14 C64 36 74 46 74 58 A24 24 0 0 1 26 58 C26 46 36 36 50 14 Z" fill="none" stroke="${C.primaryDeep}" stroke-width="3"/>`, 100, 100),

  band_fog: wrap(
    `<rect x="0" y="30" width="1920" height="80" rx="40" fill="${C.primaryDeep}" opacity="0.10"/>
  <rect x="160" y="70" width="1600" height="70" rx="35" fill="${C.primaryDeep}" opacity="0.07"/>
  <rect x="380" y="110" width="1160" height="60" rx="30" fill="${C.primaryDeep}" opacity="0.05"/>`,
    1920, 260,
  ),
};

// 立绘已迁移至 src/data/pixels/ 像素矩阵（M1B：全像素体系）。
