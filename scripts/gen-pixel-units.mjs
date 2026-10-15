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

/**
 * 白睛黑瞳+高光（可爱脸核心，反馈#1：不再是大黑窟窿）。
 * mood：calm 常规 / cool 冷脸半眯（冰系） / aim 专注瞄准（射手）/ sharp 怒目（雷系）
 */
function eyes(g, cy, gap, pupilDx = 0, mood = 'calm') {
  for (const sx of [-1, 1]) {
    const cx = 16 + sx * gap;
    ellipse(g, cx, cy, 2, 3, 'W');
    if (mood === 'cool') {
      // 半眯：瞳压扁一行 + 上眼皮 K 压沿
      rect(g, cx - 1 + pupilDx * sx, cy - 1, cx + pupilDx * sx, cy, 'K');
      set(g, cy - 1, cx - 1 + pupilDx * sx, 'W');
      rect(g, cx - 2, cy - 3, cx + 2, cy - 3, 'K');
    } else if (mood === 'aim') {
      rect(g, cx - 1, cy - 1, cx + 1, cy + 1, 'K');
      set(g, cy, cx - 1, 'W'); // 高光偏向光标
      rect(g, cx - 2, cy + 3, cx + 1, cy + 3, 'K'); // 下眼线
    } else if (mood === 'sharp') {
      rect(g, cx - 1 + pupilDx * sx, cy - 1, cx + pupilDx * sx, cy + 1, 'K');
      set(g, cy - 2, cx - 1 + pupilDx * sx, 'W');
      set(g, cy - 3, cx - 1 + sx, 'K'); // 眉
      set(g, cy - 3, cx + sx, 'K');
    } else {
      rect(g, cx - 1 + pupilDx * sx, cy - 1, cx + pupilDx * sx, cy + 1, 'K');
      set(g, cy - 1, cx - 1 + pupilDx * sx, 'W'); // 瞳内高光
    }
  }
}
/** 嘴型：smile 微笑 / grin 咧嘴笑 / closed 严肃抿嘴 / o 圆嘴。 */
function smile(g, y, kind = 'smile') {
  if (kind === 'grin') {
    set(g, y, 12, 'K');
    for (let x = 13; x <= 18; x++) set(g, y, x, 'K');
    set(g, y, 19, 'K');
    set(g, y - 1, 12, 'K');
    set(g, y - 1, 19, 'K');
  } else if (kind === 'closed') {
    rect(g, 13, y, 18, y, 'K');
    set(g, y - 1, 15, 'K');
    set(g, y - 1, 16, 'K');
  } else if (kind === 'o') {
    rect(g, 14, y - 1, 17, y, 'K');
    set(g, y - 1, 15, 'W');
  } else {
    set(g, y, 13, 'K');
    set(g, y + 1, 14, 'K');
    set(g, y + 1, 15, 'K');
    set(g, y + 1, 16, 'K');
    set(g, y, 17, 'K');
  }
}
function blush(g, y, on = true) {
  if (!on) return;
  set(g, y, 8, 'f');
  set(g, y, 9, 'f');
  set(g, y, 22, 'f');
  set(g, y, 23, 'f');
}
/** 三阶明暗身体：高光（左上）+ 主色 + 底部暗边。色阶可传（元素单位身体元素化，PvZ 寒冰射手式）。 */
function body(g, cx = 16, cy = 19, rx = 9, ry = 8, main = 'M', hi = 'L', lo = 'D') {
  ring(g, cx, cy, rx, ry, 'K', main);
  ellipse(g, cx - 3, cy - 3, 4, 3, hi);
  ellipse(g, cx + 4, cy + 4, 2.5, 2, lo);
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
  hline(g, 15, 16, 11, 'd'); // 高茎（瘦高体型，与双灯草矮墩对位）
  hline(g, 15, 16, 12, 'd');
  petalCrown(g, 5, 5);
  body(g, 16, 20, 7, 8); // 瘦高
  // 萤火虫绕身（产能光点）
  ring(g, 8, 15, 1.5, 1.5, 'K', 'G');
  set(g, 14, 7, 'W');
  ring(g, 25, 13, 1.5, 1.5, 'K', 'G');
  set(g, 12, 24, 'W');
  set(g, 26, 18, 'G');
  set(g, 6, 22, 'G');
  leafPair(g, 23);
  eyes(g, 16, 4);
  smile(g, 20, 'grin');
  blush(g, 19);
  feet(g);
  return g;
}
function twin_glow() {
  const g = blank();
  for (const cx of [11, 21]) {
    rect(g, cx, 2, cx + 1, 8, 'd');
    ring(g, cx, 5, 2.5, 2.5, 'K', 'G');
    set(g, 4, cx - 1, 'W');
  }
  body(g, 16, 17, 9, 7); // 矮墩（双灯压顶，视觉重心全在灯上）
  eyes(g, 15, 4);
  smile(g, 19, 'closed');
  blush(g, 18);
  feet(g);
  return g;
}
function thorn_pea() {
  const g = blank();
  body(g);
  // 发射管（朝右，PvZ 式射手剪影）+ 弹仓（B 弹药包，攒射感）
  rect(g, 22, 14, 28, 18, 'M');
  hline(g, 22, 28, 13, 'K');
  hline(g, 22, 28, 19, 'K');
  rect(g, 29, 14, 29, 18, 'K');
  set(g, 16, 28, 'D');
  set(g, 17, 28, 'D');
  set(g, 15, 24, 'L'); // 管身受光
  // 弹仓（背上两发备弹）
  rect(g, 9, 10, 11, 13, 'B');
  rect(g, 13, 10, 15, 13, 'B');
  hline(g, 9, 11, 9, 'K');
  hline(g, 13, 15, 9, 'K');
  set(g, 11, 10, 'L');
  set(g, 15, 10, 'L');
  eyes(g, 14, 4, 1, 'aim'); // 侧目瞄准专注脸
  smile(g, 20, 'closed'); // 抿嘴：蓄势
  blush(g, 19, false);
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
  eyes(g, 15, 5, 0, 'aim');
  smile(g, 19, 'grin'); // 三连发的张扬笑脸（与冰/火气质三方拉开）
  blush(g, 18);
  feet(g);
  return g;
}
function frost_pea() {
  const g = blank();
  body(g, 16, 19, 9, 8, 'i', 'W', 'I'); // 冰蓝身：亮冰肤 + 白高光 + 冰主暗部（PvZ 寒冰射手式元素身体化）
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
  // 霜纹（身侧冰花）
  set(g, 13, 11, 'I');
  set(g, 14, 10, 'i');
  set(g, 20, 11, 'I');
  set(g, 21, 10, 'i');
  set(g, 13, 21, 'I');
  set(g, 14, 22, 'i');
  set(g, 20, 21, 'I');
  set(g, 21, 22, 'i');
  eyes(g, 15, 5, 0, 'cool'); // 冷脸：与火豆的咧嘴形成气质对位
  smile(g, 19, 'closed'); // 严肃抿嘴
  blush(g, 18, false); // 冰系无腮红（冷感）
  feet(g);
  return g;
}
function ember_fluff() {
  const g = blank();
  body(g, 16, 19, 9, 8, 'r', 'W', 'R'); // 火橙身：亮火肤 + 白高光 + 火主暗部
  // 火苗（顶）
  for (const [cx, y0] of [
    [16, 1],
    [10, 6],
    [22, 6],
  ]) {
    set(g, y0, cx, 'R');
    set(g, y0 + 1, cx, 'r');
    set(g, y0 + 2, cx, 'R');
    set(g, y0 + 2, cx - 1, 'R');
    set(g, y0 + 2, cx + 1, 'R');
    set(g, y0 + 3, cx, 'R');
    set(g, y0 - 1, cx, 'K');
    set(g, y0 + 3, cx - 1, 'K');
    set(g, y0 + 3, cx + 1, 'K');
  }
  // 焰纹（身侧小火苗）
  set(g, 13, 11, 'R');
  set(g, 12, 10, 'r');
  set(g, 20, 11, 'R');
  set(g, 19, 10, 'r');
  set(g, 13, 21, 'R');
  set(g, 12, 22, 'r');
  set(g, 20, 21, 'R');
  set(g, 19, 22, 'r');
  eyes(g, 15, 5);
  smile(g, 19, 'grin'); // 咧嘴大笑：与冰豆冷脸对位
  blush(g, 18, false);
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
  // 扁横大伞盖（rx10×ry4，横向铺展=抛掷手势，与闪电菇高束对位）
  ellipse(g, 16, 11, 11, 4.5, 'K');
  ellipse(g, 16, 11, 10, 3.5, 'I');
  rect(g, 11, 8, 13, 10, 'i');
  rect(g, 20, 8, 22, 10, 'i');
  set(g, 7, 11, 'I');
  set(g, 7, 22, 'I');
  // 雾汽（帽下飘散）
  set(g, 15, 6, 'i');
  set(g, 14, 26, 'i');
  set(g, 16, 27, 'i');
  // 柄（加宽防头重脚轻）
  rect(g, 12, 14, 19, 26, 'B');
  rect(g, 12, 14, 12, 26, 'K');
  rect(g, 19, 14, 19, 26, 'K');
  hline(g, 12, 19, 26, 'K');
  eyes(g, 19, 4);
  smile(g, 22, 'o'); // 呆圆嘴
  blush(g, 21);
  return g;
}
function storm_cap() {
  const g = blank();
  // 高束伞盖（rx7×ry8，尖塔束状=聚雷，与雾菇扁盘对位）
  ellipse(g, 16, 11, 7, 7, 'K');
  ellipse(g, 16, 11, 6, 6, 'P');
  ellipse(g, 16, 9, 3.5, 3, 'Z');
  rect(g, 11, 9, 13, 11, 'Z');
  rect(g, 20, 9, 22, 11, 'Z');
  // 帽顶闪电
  set(g, 3, 16, 'y');
  set(g, 4, 16, 'y');
  set(g, 5, 16, 'y');
  set(g, 6, 15, 'y');
  set(g, 7, 16, 'y');
  set(g, 8, 16, 'y');
  set(g, 9, 16, 'y');
  // 电斑（身侧电弧）
  set(g, 17, 15, 'Z');
  set(g, 18, 16, 'y');
  rect(g, 13, 14, 18, 26, 'B');
  rect(g, 13, 14, 13, 26, 'K');
  rect(g, 18, 14, 18, 26, 'K');
  hline(g, 13, 18, 26, 'K');
  eyes(g, 19, 4, 0, 'sharp'); // 怒目脸
  smile(g, 22, 'closed');
  blush(g, 21, false);
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
  // 蜜草（大花冠粉芯金蕊——花仙造型，与雾灯的灯柱对位）
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
  // 身体（略小，让花冠成为绝对主体）
  body(g, 16, 22, 7, 5);
  eyes(g, 20, 3);
  smile(g, 23, 'grin'); // 笑脸上扬
  blush(g, 21, false);
  return g;
}
function mist_lamp() {
  const g = blank();
  // 雾灯（职能破例：去脸化——灯体即头，物件逻辑）
  // 底座
  rect(g, 12, 27, 19, 27, 'N');
  rect(g, 11, 28, 20, 28, 'n');
  set(g, 29, 12, 'K');
  set(g, 29, 19, 'K');
  // 灯柱
  rect(g, 14, 16, 17, 26, 'N');
  rect(g, 14, 14, 17, 14, 'n');
  set(g, 18, 16, 'n');
  // 灯笼主体（暖光 G + 灯芯 y + 高光 W）
  rect(g, 10, 3, 21, 11, 'K');
  rect(g, 11, 4, 20, 10, 'G');
  rect(g, 12, 5, 15, 8, 'y');
  set(g, 6, 13, 'W'); // 灯芯高光
  // 顶梁+提手
  rect(g, 13, 1, 18, 1, 'N');
  set(g, 0, 13, 'y');
  set(g, 0, 18, 'y');
  set(g, 2, 15, 'y');
  set(g, 2, 16, 'y');
  // 驱散之光（职能件：向四周散出）
  set(g, 12, 6, 'W');
  set(g, 12, 23, 'W');
  set(g, 19, 6, 'W');
  set(g, 19, 23, 'W');
  set(g, 7, 15, 'y');
  set(g, 7, 16, 'y');
  set(g, 24, 15, 'y');
  set(g, 24, 16, 'y');
  return g; // 无脸（用户拍板职能破例：灯柱类不做五官）
}

/** 蒲公英：白绒球（受风将散）+ 絮丝 + 绿茎，职能件置顶（全屏追踪=乘风）。 */
function dandelion() {
  const g = blank();
  body(g);
  // 絮丝（头顶放射细线）
  for (const [dx, dy] of [
    [-6, -1],
    [-4, -5],
    [0, -7],
    [4, -5],
    [6, -1],
  ]) {
    hline(g, 16 + Math.min(0, dx), 16 + Math.max(0, dx), 5 + dy, 'W');
  }
  // 绒球主体（白芯 + 深描边 + 底影）
  ring(g, 16, 5, 6, 5, 'K', 'W');
  ellipse(g, 16, 7, 3, 2, 'W');
  set(g, 9, 4, 'K');
  set(g, 9, 6, 'K');
  set(g, 10, 3, 'W');
  set(g, 22, 4, 'K');
  set(g, 22, 6, 'K');
  set(g, 21, 3, 'W');
  set(g, 13, 3, 'W');
  set(g, 19, 4, 'W');
  set(g, 16, 2, 'K');
  // 绿茎（与身体衔接）
  rect(g, 15, 10, 16, 12, 'd');
  set(g, 11, 14, 'K');
  set(g, 9, 15, 'd');
  eyes(g, 15, 5);
  smile(g, 19);
  blush(g, 18);
  feet(g);
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
  dandelion: dandelion(),
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
  `import type { PixelSprite } from '../palette.ts';\n\n/**\n * 草原 14 单位像素矩阵（32×32，生成器产出，勿手改：改 scripts/gen-pixel-units.mjs）。\n * 设计纪律：白睛黑瞳+瞳内高光、腮红、三阶明暗（K 描边/M 主/L 受光）、职能特征件置顶、内容垂直居中。\n */\nexport const unitSprites: Record<string, PixelSprite> = {\n${emitTable(sprites)}\n};\n`,
  'utf8',
);
console.log('unit sprites regenerated:', Object.keys(sprites).length);
