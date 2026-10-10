/**
 * 单位像素精灵生成器（M1C 美术提亮，纯代码像素）。
 * 产出 32×32 字符矩阵写入 src/data/pixels/units/meadow.ts（与 normalize-pixels.mjs 的输出格式一致）。
 * 设计纪律（用户第 12 轮反馈#1）：白睛黑瞳+高光、腮红、三阶明暗（K 描边/M 主/L 受光）、
 * 职能特征件置顶、内容垂直居中（落点=格心，反馈#3 几何同源）。
 * 运行：node scripts/gen-pixel-units.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE } from '../src/data/pixels/palette.ts';

const S = 32;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function blank() {
  return Array.from({ length: S }, () => Array.from({ length: S }, () => '.'));
}
function set(g, y, x, ch) {
  if (y >= 0 && y < S && x >= 0 && x < S) g[y][x] = ch;
}
function ellipse(g, cx, cy, rx, ry, ch) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(g, y, x, ch);
    }
  }
}
/** 描边+填充椭圆：先画大 1px 的描边色，再画内圈填充色。 */
function ring(g, cx, cy, rx, ry, outline, fill) {
  ellipse(g, cx, cy, rx, ry, outline);
  ellipse(g, cx, cy, Math.max(0.5, rx - 1), Math.max(0.5, ry - 1), fill);
}
function rect(g, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, y, x, ch);
}
function hline(g, x0, x1, y, ch) {
  for (let x = x0; x <= x1; x++) set(g, y, x, ch);
}

/** 白睛黑瞳+高光（可爱脸核心，反馈#1：不再是大黑窟窿）。 */
function eyes(g, cy, gap, pupilDx = 0) {
  for (const sx of [-1, 1]) {
    const cx = 16 + sx * gap;
    ellipse(g, cx, cy, 2, 3, 'W');
    rect(g, cx - 1 + pupilDx * sx, cy - 1, cx + pupilDx * sx, cy + 1, 'K');
    set(g, cy - 1, cx - 1 + pupilDx * sx, 'W'); // 瞳内高光
  }
}
/** 微笑（5 像素小嘴）。 */
function smile(g, y) {
  set(g, y, 13, 'K');
  set(g, y + 1, 14, 'K');
  set(g, y + 1, 15, 'K');
  set(g, y + 1, 16, 'K');
  set(g, y, 17, 'K');
}
function blush(g, y) {
  set(g, y, 8, 'f');
  set(g, y, 9, 'f');
  set(g, y, 22, 'f');
  set(g, y, 23, 'f');
}
/** 三阶明暗身体：高光（左上）+ 主色 + 底部暗边。 */
function body(g, cx = 16, cy = 19, rx = 9, ry = 8, main = 'M') {
  ring(g, cx, cy, rx, ry, 'K', main);
  ellipse(g, cx - 3, cy - 3, 4, 3, 'L');
  ellipse(g, cx + 4, cy + 4, 2.5, 2, 'D');
}
function feet(g, y = 27) {
  rect(g, 10, y, 13, y + 1, 'd');
  rect(g, 18, y, 21, y + 1, 'd');
  set(g, y + 2, 10, 'K');
  set(g, y + 2, 13, 'K');
  set(g, y + 2, 18, 'K');
  set(g, y + 2, 21, 'K');
}
/** 侧叶（左右各一片，l 亮边）。 */
function leafPair(g, y, main = 'm') {
  for (const sx of [-1, 1]) {
    const cx = 16 + sx * 11;
    ellipse(g, cx, y, 2.5, 3.5, 'K');
    ellipse(g, cx, y, 1.5, 2.5, main);
    set(g, y - 2, cx - 1, 'l');
    set(g, y - 1, cx - 1, 'l');
  }
}
/** 花瓣环（产能单位花冠）。 */
function petalCrown(g, cy, r, petal = 'h', center = 'G') {
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    const px = Math.round(16 + Math.cos(ang) * r);
    const py = Math.round(cy + Math.sin(ang) * r * 0.8);
    rect(g, px - 1, py - 1, px, py, petal);
  }
  ellipse(g, 16, cy, 2, 2, 'G');
  set(g, cy - 1, 15, 'W');
}

// —— 逐单位装配 ——
function firefly_reed() {
  const g = blank();
  hline(g, 15, 16, 9, 'd'); // 花茎
  hline(g, 15, 16, 10, 'd');
  petalCrown(g, 6, 5);
  body(g);
  leafPair(g, 23);
  eyes(g, 15, 5);
  smile(g, 19);
  blush(g, 18);
  feet(g);
  return g;
}
function twin_glow() {
  const g = blank();
  for (const cx of [11, 21]) {
    hline(g, cx, cx + 1, 8, 'd');
    hline(g, cx, cx + 1, 9, 'd');
    ring(g, cx, 6, 2.5, 2.5, 'K', 'G');
    set(g, 5, cx - 1, 'W');
  }
  body(g);
  leafPair(g, 23);
  eyes(g, 15, 5);
  smile(g, 19);
  blush(g, 18);
  feet(g);
  return g;
}
function thorn_pea() {
  const g = blank();
  body(g);
  // 发射管（朝右，PvZ 式射手剪影）
  rect(g, 22, 14, 28, 18, 'M');
  hline(g, 22, 28, 13, 'K');
  hline(g, 22, 28, 19, 'K');
  rect(g, 29, 14, 29, 18, 'K');
  set(g, 16, 28, 'D');
  set(g, 17, 28, 'D');
  set(g, 15, 24, 'L'); // 管身受光
  eyes(g, 14, 4, 1);
  smile(g, 20);
  blush(g, 19);
  feet(g);
  return g;
}
function trifold_arrow() {
  const g = blank();
  body(g);
  // 三叶箭羽（中高两低）
  for (const [cx, y0, hgt] of [
    [16, 2, 8],
    [11, 5, 5],
    [21, 5, 5],
  ]) {
    rect(g, cx - 1, y0, cx + 1, y0 + hgt, 'm');
    rect(g, cx - 1, y0, cx + 1, y0, 'K');
    hline(g, cx - 1, cx + 1, y0 + hgt, 'K');
    set(g, y0 + 1, cx - 1, 'K');
    set(g, y0 + 1, cx + 1, 'K');
    set(g, y0 + 2, cx, 'l');
  }
  eyes(g, 15, 5);
  smile(g, 19);
  blush(g, 18);
  feet(g);
  return g;
}
function frost_pea() {
  const g = blank();
  body(g);
  // 冰晶三棱（顶）
  for (const [cx, y0] of [
    [16, 3],
    [10, 6],
    [22, 6],
  ]) {
    set(g, y0, cx, 'I');
    set(g, y0 + 1, cx, 'i');
    set(g, y0 + 2, cx, 'I');
    set(g, y0 + 2, cx - 1, 'I');
    set(g, y0 + 2, cx + 1, 'I');
    set(g, y0 + 3, cx, 'I');
    set(g, y0 - 1, cx, 'K');
    set(g, y0 + 3, cx - 1, 'K');
    set(g, y0 + 3, cx + 1, 'K');
  }
  eyes(g, 15, 5);
  smile(g, 19);
  blush(g, 18);
  feet(g);
  return g;
}
function ember_fluff() {
  const g = blank();
  body(g);
  // 火苗（顶）
  for (const [cx, y0] of [
    [16, 2],
    [11, 5],
    [21, 5],
  ]) {
    set(g, y0, cx, 'R');
    set(g, y0 + 1, cx, 'R');
    set(g, y0 + 2, cx, 'r');
    set(g, y0 + 3, cx, 'R');
    set(g, y0 + 3, cx - 1, 'R');
    set(g, y0 + 3, cx + 1, 'R');
    set(g, y0 + 4, cx, 'r');
    set(g, y0 - 1, cx, 'K');
    set(g, y0 + 4, cx - 1, 'K');
    set(g, y0 + 4, cx + 1, 'K');
  }
  eyes(g, 15, 5);
  smile(g, 19);
  blush(g, 18);
  feet(g);
  return g;
}
function drum_cap() {
  const g = blank();
  // 菌盖（炸弹）
  ellipse(g, 16, 13, 10, 6.5, 'K');
  ellipse(g, 16, 13, 9, 5.5, 'N');
  rect(g, 11, 10, 13, 12, 'W'); // 斑点
  rect(g, 20, 10, 22, 12, 'W');
  set(g, 8, 12, 'n');
  set(g, 9, 11, 'n');
  // 引信+火星
  rect(g, 16, 6, 16, 8, 'e');
  set(g, 5, 17, 'e');
  set(g, 4, 17, 'G');
  set(g, 4, 18, 'y');
  // 柄+脸
  rect(g, 11, 15, 20, 26, 'B');
  rect(g, 11, 15, 11, 26, 'K');
  rect(g, 20, 15, 20, 26, 'K');
  hline(g, 11, 20, 26, 'K');
  rect(g, 12, 26, 19, 27, 'B');
  hline(g, 12, 19, 28, 'K');
  eyes(g, 20, 4);
  smile(g, 23);
  blush(g, 22);
  return g;
}
function wood_core() {
  const g = blank();
  // 木墩（肉盾）
  ellipse(g, 16, 20, 9, 9, 'K');
  ellipse(g, 16, 20, 8, 8, 'N');
  ellipse(g, 16, 14, 6.5, 3.5, 'n'); // 年轮顶
  ellipse(g, 16, 14, 3, 1.5, 'N');
  hline(g, 8, 23, 25, 'n');
  set(g, 12, 18, 'n');
  set(g, 13, 18, 'n');
  set(g, 19, 22, 'n');
  eyes(g, 17, 5);
  smile(g, 21);
  blush(g, 20);
  // 根
  rect(g, 9, 28, 11, 29, 'N');
  rect(g, 20, 28, 22, 29, 'N');
  return g;
}
function lob_shroom() {
  const g = blank();
  // 雾菇（抛射）
  ellipse(g, 16, 12, 10, 6.5, 'K');
  ellipse(g, 16, 12, 9, 5.5, 'I');
  rect(g, 11, 9, 13, 11, 'i');
  rect(g, 20, 9, 22, 11, 'i');
  set(g, 8, 11, 'I');
  set(g, 23, 11, 'I');
  rect(g, 11, 14, 20, 26, 'B');
  rect(g, 11, 14, 11, 26, 'K');
  rect(g, 20, 14, 20, 26, 'K');
  hline(g, 11, 20, 26, 'K');
  eyes(g, 19, 4);
  smile(g, 22);
  blush(g, 21);
  return g;
}
function storm_cap() {
  const g = blank();
  // 闪电菇
  ellipse(g, 16, 12, 10, 6.5, 'K');
  ellipse(g, 16, 12, 9, 5.5, 'P');
  rect(g, 11, 9, 13, 11, 'Z');
  rect(g, 20, 9, 22, 11, 'Z');
  // 帽顶闪电
  set(g, 5, 16, 'y');
  set(g, 6, 16, 'y');
  set(g, 7, 15, 'y');
  set(g, 8, 16, 'y');
  set(g, 9, 16, 'y');
  rect(g, 11, 14, 20, 26, 'B');
  rect(g, 11, 14, 11, 26, 'K');
  rect(g, 20, 14, 20, 26, 'K');
  hline(g, 11, 20, 26, 'K');
  eyes(g, 19, 4);
  smile(g, 22);
  blush(g, 21);
  return g;
}
function tether_moss() {
  const g = blank();
  // 藤索（顶部套环）
  hline(g, 16, 16, 3, 'd');
  hline(g, 16, 16, 4, 'd');
  for (let y = 4; y <= 12; y++) {
    for (const x of [11, 21]) {
      const dy = (y - 8) / 4.5;
      if (Math.abs(y - 8) <= 4) set(g, y, Math.round(16 + Math.sign(x - 16) * Math.sqrt(Math.max(0, 1 - dy * dy)) * 5), 'K');
    }
  }
  rect(g, 12, 5, 12, 12, 'm');
  rect(g, 19, 5, 19, 12, 'm');
  hline(g, 12, 19, 4, 'K');
  // 身体
  body(g, 16, 20, 9, 7);
  // 双臂藤须
  hline(g, 5, 8, 21, 'd');
  hline(g, 23, 26, 21, 'd');
  set(g, 21, 5, 'l');
  set(g, 21, 26, 'l');
  eyes(g, 18, 5);
  smile(g, 22);
  blush(g, 21);
  return g;
}
function nectar_moss() {
  const g = blank();
  // 蜜草（粉冠金芯）
  for (let a = 0; a < 10; a++) {
    const ang = (a / 10) * Math.PI * 2;
    const px = Math.round(16 + Math.cos(ang) * 8);
    const py = Math.round(9 + Math.sin(ang) * 6);
    rect(g, px - 1, py - 1, px, py, 'f');
  }
  ellipse(g, 16, 9, 5, 4, 'K');
  ellipse(g, 16, 9, 4, 3, 'f');
  ellipse(g, 16, 9, 2.5, 2, 'G');
  set(g, 8, 15, 'W');
  // 身体
  body(g, 16, 21, 8, 6, 'M');
  eyes(g, 20, 4);
  smile(g, 23);
  blush(g, 22);
  return g;
}
function mist_lamp() {
  const g = blank();
  // 雾灯（灯笼）
  rect(g, 15, 6, 16, 12, 'd');
  rect(g, 10, 3, 21, 10, 'K');
  rect(g, 11, 4, 20, 9, 'G'); // 暖光灯罩（读作灯而非屏幕）
  rect(g, 12, 5, 15, 8, 'y');
  set(g, 6, 13, 'W'); // 灯芯高光
  rect(g, 13, 2, 18, 2, 'N');
  set(g, 3, 12, 'y');
  set(g, 3, 19, 'y');
  set(g, 11, 15, 'G'); // 灯芯火
  set(g, 10, 15, 'y');
  // 身体
  body(g, 16, 21, 8, 6);
  eyes(g, 20, 4);
  smile(g, 23);
  blush(g, 22);
  return g;
}

const sprites = {
  firefly_reed: firefly_reed(),
  twin_glow: twin_glow(),
  thorn_pea: thorn_pea(),
  trifold_arrow: trifold_arrow(),
  frost_pea: frost_pea(),
  ember_fluff: ember_fluff(),
  drum_cap: drum_cap(),
  wood_core: wood_core(),
  lob_shroom: lob_shroom(),
  storm_cap: storm_cap(),
  tether_moss: tether_moss(),
  nectar_moss: nectar_moss(),
  mist_lamp: mist_lamp(),
};

// —— 校验 + 落盘（与 normalize 输出同格式） ——
const valid = new Set(Object.keys(PALETTE));
const bad = [];
for (const [id, g] of Object.entries(sprites)) {
  const rows = g.map((r) => r.join(''));
  if (rows.length !== S || rows.some((r) => r.length !== S)) bad.push(`${id}: 尺寸`);
  for (const row of rows) {
    for (const ch of row) {
      if (ch !== '.' && !valid.has(ch)) bad.push(`${id}: 色板外字符 ${ch}`);
    }
  }
}
if (bad.length) {
  console.error(`INVALID:\n${bad.join('\n')}`);
  process.exit(1);
}

function emitTable(table) {
  return Object.entries(table)
    .map(([id, g]) => `  ${id}: [\n${g.map((r) => `    '${r.join('')}',`).join('\n')}\n  ],`)
    .join('\n');
}
writeFileSync(
  join(root, 'src/data/pixels/units/meadow.ts'),
  `import type { PixelSprite } from '../palette.ts';\n\n/**\n * 草原 13 单位像素矩阵（32×32，生成器产出，勿手改：改 scripts/gen-pixel-units.mjs）。\n * 设计纪律：白睛黑瞳+瞳内高光、腮红、三阶明暗（K 描边/M 主/L 受光）、职能特征件置顶、内容垂直居中。\n */\nexport const unitSprites: Record<string, PixelSprite> = {\n${emitTable(sprites)}\n};\n`,
  'utf8',
);
console.log('unit sprites regenerated:', Object.keys(sprites).length);
