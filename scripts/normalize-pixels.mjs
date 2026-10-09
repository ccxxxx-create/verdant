/**
 * 一次性工具：归一化像素矩阵到组固定尺寸（补/修剪尾部 '.' 透明像素，不动可见像素）。
 * 用法：node scripts/normalize-pixels.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unitSprites } from '../src/data/pixels/units/meadow.ts';
import { enemySprites, projectileSprites } from '../src/data/pixels/enemies/meadow.ts';
import { pixelIcons } from '../src/data/pixels/icons.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function toSize(sprite, w, h, bottomAlign = false) {
  // 修剪尾部空白行
  let rows = [...sprite];
  while (rows.length > 0 && rows[rows.length - 1].replace(/\./g, '').length === 0) rows.pop();
  const blank = '.'.repeat(w);
  if (bottomAlign) {
    // 内容贴底：顶部补空白（修敌人漂浮）
    while (rows.length < h) rows.unshift(blank);
  } else {
    while (rows.length < h) rows.push(blank);
  }
  return rows.slice(0, h).map((row) => {
    let r = row;
    while (r.length > w && r.endsWith('.')) r = r.slice(0, -1);
    while (r.length < w) r += '.';
    return r;
  });
}

const units = Object.fromEntries(Object.entries(unitSprites).map(([k, v]) => [k, toSize(v, 32, 32)]));
const enemies = Object.fromEntries(
  Object.entries(enemySprites).map(([k, v]) => {
    if (k === 'stone_hide_giant') return [k, toSize(v, 32, 32, false)];
    const w = Math.max(...v.map((r) => r.replace(/\.+$/, '').length));
    return [k, toSize(v, w, 24, true)];
  }),
);
const projectiles = Object.fromEntries(Object.entries(projectileSprites).map(([k, v]) => [k, toSize(v, 8, 8)]));
const icons = Object.fromEntries(Object.entries(pixelIcons).map(([k, v]) => [k, toSize(v, 16, 16)]));

function emitTable(table) {
  return Object.entries(table)
    .map(([id, sprite]) => `  ${id}: [\n${sprite.map((r) => `    '${r}',`).join('\n')}\n  ],`)
    .join('\n');
}

writeFileSync(
  join(root, 'src/data/pixels/units/meadow.ts'),
  `import type { PixelSprite } from '../palette.ts';\n\n/**\n * 草原 13 单位像素矩阵（32×32，已归一化）。\n * 结构纪律：脸（y15-18 眼+嘴）/ 身体（y13-28）/ 顶部特征件（按职能）。\n */\nexport const unitSprites: Record<string, PixelSprite> = {\n${emitTable(units)}\n};\n`,
  'utf8',
);
writeFileSync(
  join(root, 'src/data/pixels/enemies/meadow.ts'),
  `import type { PixelSprite } from '../palette.ts';\n\n/**\n * 草原 11 敌人像素矩阵（24×24；Boss 32×32）+ 子弹（8×8）。已归一化。\n * 纪律：金色眼睛签名；护甲分层。\n */\nexport const enemySprites: Record<string, PixelSprite> = {\n${emitTable(enemies)}\n};\n\nexport const projectileSprites: Record<string, PixelSprite> = {\n${emitTable(projectiles)}\n};\n`,
  'utf8',
);
writeFileSync(
  join(root, 'src/data/pixels/icons.ts'),
  `import type { PixelSprite } from './palette.ts';\n\n/**\n * 16×16 像素图标集（全站唯一像素体系）。已归一化。\n */\nexport const pixelIcons: Record<string, PixelSprite> = {\n${emitTable(icons)}\n};\n`,
  'utf8',
);

const bad = [];
for (const [n, s] of Object.entries(units)) if (s.length !== 32 || s.some((r) => r.length !== 32)) bad.push(n);
for (const [n, s] of Object.entries(enemies)) if (n !== 'stone_hide_giant' && s.length !== 24) bad.push(n);
console.log(bad.length ? `STILL BAD: ${bad.join(',')}` : 'all normalized to fixed sizes');
