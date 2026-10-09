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

// —— 角色立绘（200×200）——
const W = { meadow: C.moss, reef: C.reef, sky: C.sky, frost: C.frost };

/** 单位身体（按职能）+ 武器（按 id）+ 花纹（按 traits）三组参数。 */
function unitPortrait(u) {
  const col = W[u.world] ?? C.moss;
  const deep = C.primaryDeep;
  const parts = [shadow];
  let body = '';
  switch (u.role) {
    case 'producer': // 圆润穗形
      body = `
  <circle cx="100" cy="108" r="40" fill="${col}"/>
  <circle cx="100" cy="108" r="24" fill="${C.accent}" opacity="0.35"/>
  <path d="M100 60 Q86 40 92 26 Q104 38 100 60 Z" fill="${col}"/>
  <path d="M100 60 Q114 40 108 26 Q96 38 100 60 Z" fill="${col}"/>
  <path d="M78 130 q-8 14 -18 16 M122 130 q8 14 18 16" stroke="${deep}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
      break;
    case 'defender': // 厚重壳形（年轮/木纹）
      body = `
  <circle cx="100" cy="110" r="44" fill="${col}"/>
  <circle cx="100" cy="110" r="30" fill="none" stroke="${deep}" stroke-width="4"/>
  <circle cx="100" cy="110" r="16" fill="none" stroke="${deep}" stroke-width="4"/>
  <circle cx="100" cy="110" r="5" fill="${deep}"/>
  <path d="M56 110 q18 -12 0 -24 M144 110 q-18 -12 0 -24" stroke="${deep}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      break;
    case 'support': // 细长茎+点缀
      body = `
  <path d="M100 160 Q96 120 100 96" stroke="${col}" stroke-width="10" stroke-linecap="round" fill="none"/>
  <circle cx="100" cy="88" r="20" fill="${col}"/>
  <circle cx="100" cy="88" r="9" fill="${C.accent}"/>
  <path d="M100 116 q-26 -6 -30 -26 M100 116 q26 -6 30 -26" stroke="${col}" stroke-width="8" stroke-linecap="round" fill="none"/>`;
      break;
    default: // attacker：椭圆荚体+武器基座
      body = `
  <ellipse cx="100" cy="112" rx="34" ry="38" fill="${col}"/>
  <ellipse cx="100" cy="104" rx="20" ry="22" fill="${deep}" opacity="0.18"/>
  <path d="M100 74 q-10 -16 -2 -26 q8 10 2 26" fill="${col}"/>`;
  }
  parts.push(body);

  // 武器层（按 id 语义）
  const weapon = {
    thorn_pea: `<path d="M132 100 l24 -10 -24 -10 z" fill="${deep}"/><circle cx="160" cy="90" r="7" fill="${deep}"/>`,
    trifold_arrow: `<g fill="${deep}"><path d="M132 96 l30 -16 -6 22 z"/><path d="M132 104 l30 16 -22 6 z"/><path d="M132 100 l28 0 -8 12 z"/></g>`,
    frost_pea: `<g stroke="${C.frost}" stroke-width="5" stroke-linecap="round"><path d="M150 84 L150 116 M136 92 L164 108 M136 108 L164 92"/></g><circle cx="150" cy="100" r="6" fill="${C.frost}"/>`,
    ember_fluff: `<path d="M148 82 q16 12 8 30 q18 -6 14 -28 q10 20 -4 36 q18 2 20 -20 q6 26 -18 40 q-26 -8 -28 -36 q-2 -24 8 -22 z" fill="${C.accent}"/>`,
    lob_shroom: `<path d="M60 60 q40 -30 80 4" stroke="${deep}" stroke-width="4" fill="none" stroke-dasharray="6 8"/><circle cx="146" cy="58" r="8" fill="${col}"/><circle cx="120" cy="48" r="6" fill="${col}"/>`,
    storm_cap: `<path d="M64 96 a36 36 0 0 1 72 0 z" fill="${col}"/><path d="M100 92 l12 14 -10 4 10 14" stroke="${deep}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    drum_cap: `<path d="M56 148 a44 26 0 0 1 88 0 z" fill="${col}"/><path d="M100 122 v-14" stroke="${deep}" stroke-width="4"/><circle cx="100" cy="104" r="8" fill="${deep}"/>`,
    tether_moss: `<path d="M138 84 q22 16 4 34 q-18 14 0 30" stroke="${col}" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="140" cy="154" r="9" fill="${C.accent}"/>`,
    nectar_moss: `<circle cx="100" cy="112" r="56" fill="none" stroke="${C.accent}" stroke-width="4" stroke-dasharray="4 10"/>`,
    mist_lamp: `<path d="M84 92 h32 l8 26 h-48 z" fill="${col}"/><circle cx="100" cy="130" r="7" fill="${C.accent}"/><circle cx="100" cy="126" r="26" fill="${C.accent}" opacity="0.15"/>`,
    firefly_reed: `<circle cx="146" cy="70" r="7" fill="${C.accent}"/><circle cx="162" cy="92" r="5" fill="${C.accent}"/><circle cx="132" cy="52" r="4" fill="${C.accent}"/>`,
    twin_glow: `<circle cx="140" cy="64" r="8" fill="${C.accent}"/><circle cx="160" cy="86" r="8" fill="${C.accent}"/>`,
    wood_core: ``,
  }[u.id];
  if (weapon) parts.push(weapon);

  // 花纹层（按 traits，差异化关键轴）
  const pattern = {
    vs_shell_efficient: `<path d="M84 120 l16 16 16 -16" stroke="${deep}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    slow: `<path d="M88 132 q12 -10 24 0" stroke="${C.frost}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    burns: `<circle cx="82" cy="126" r="3" fill="${C.accent}"/><circle cx="118" cy="134" r="3" fill="${C.accent}"/>`,
    vs_air: `<path d="M76 92 q10 -12 20 0 q10 12 20 0" stroke="${deep}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    wall: `<path d="M80 140 q20 8 40 0" stroke="${deep}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  };
  for (const t of u.traits ?? []) if (pattern[t]) parts.push(pattern[t]);

  // 眼睛（统一签名：墨点+高光）
  parts.push(`
  <circle cx="90" cy="102" r="5" fill="${INK}"/><circle cx="110" cy="102" r="5" fill="${INK}"/>
  <circle cx="92" cy="100" r="1.8" fill="#FFFFFF"/><circle cx="112" cy="100" r="1.8" fill="#FFFFFF"/>`);
  return wrap(parts.join('\n'));
}

/** 敌人立绘：护甲体（cloth/hide/shell/iron）+ 头 + 特征（flying/horn/web/beak…）+ 金色眼睛签名。 */
function enemyPortrait(e) {
  const deep = C.primaryDeep;
  const bodyCol = '#8A8578'; // 中性躯干（与守护方区分）
  const armorCol = W[e.world] ?? C.moss;
  const parts = [shadow];
  let body = '';
  switch (e.armor) {
    case 'hide':
      body = `<ellipse cx="100" cy="118" rx="38" ry="32" fill="${bodyCol}"/>
  <path d="M78 96 l-8 -18 18 8 z M100 90 l-6 -20 16 12 z M122 96 l8 -18 -18 8 z" fill="${deep}"/>`;
      break;
    case 'shell':
      body = `<ellipse cx="100" cy="120" rx="36" ry="30" fill="${bodyCol}"/>
  <path d="M64 116 a36 30 0 0 1 72 0 z" fill="${armorCol}"/>
  <path d="M76 118 a24 22 0 0 1 48 0" fill="none" stroke="${deep}" stroke-width="3"/>`;
      break;
    case 'iron':
      body = `<ellipse cx="100" cy="118" rx="40" ry="32" fill="#6E7278"/>
  <g fill="${armorCol}"><rect x="72" y="96" width="16" height="14" rx="3"/><rect x="94" y="92" width="16" height="14" rx="3"/><rect x="116" y="96" width="14" height="14" rx="3"/><rect x="82" y="116" width="14" height="12" rx="3"/><rect x="104" y="116" width="14" height="12" rx="3"/></g>
  <g fill="${INK}"><circle cx="80" cy="103" r="2.4"/><circle cx="102" cy="99" r="2.4"/><circle cx="123" cy="103" r="2.4"/><circle cx="89" cy="122" r="2.4"/><circle cx="111" cy="122" r="2.4"/></g>`;
      break;
    default: // cloth
      body = `<ellipse cx="100" cy="118" rx="34" ry="30" fill="${bodyCol}"/>`;
  }
  parts.push(body);

  // 头（默认偏上）+ 飞行翅膀 + 特征件
  parts.push(`<circle cx="100" cy="86" r="20" fill="${bodyCol}"/>`);
  if (e.flying) parts.push(`<path d="M78 84 q-34 -26 -50 -4 q22 2 34 16 z M122 84 q34 -26 50 -4 q-22 2 -34 16 z" fill="${armorCol}" opacity="0.8"/>`);
  const extra = {
    iron_beak_sparrow: `<path d="M120 82 l16 6 -16 8 z" fill="${C.accent}"/>`,
    gnaw_back_rat: `<circle cx="86" cy="66" r="7" fill="${bodyCol}"/><circle cx="114" cy="66" r="7" fill="${bodyCol}"/><path d="M108 96 l10 10 -12 4 z" fill="#FFFFFF"/>`,
    grey_tide_swarm: `<circle cx="72" cy="130" r="10" fill="${bodyCol}"/><circle cx="128" cy="132" r="9" fill="${bodyCol}"/>`,
    vine_boa: `<path d="M64 150 q18 -14 36 0 q18 14 36 0" stroke="${bodyCol}" stroke-width="12" fill="none" stroke-linecap="round"/>`,
    web_spider: `<g stroke="${deep}" stroke-width="4" stroke-linecap="round"><path d="M84 96 l-22 -14 M84 108 l-24 4 M116 96 l22 -14 M116 108 l24 4"/></g><circle cx="100" cy="70" r="14" fill="none" stroke="${deep}" stroke-width="3" stroke-dasharray="3 6"/>`,
    shell_raiser: `<path d="M124 78 a30 34 0 0 1 4 44 l-8 -6 a22 26 0 0 0 -2 -32 z" fill="${armorCol}"/>`,
    vine_gnawer: `<path d="M92 96 l8 12 -14 2 z M108 96 l-8 12 14 2 z" fill="#FFFFFF"/>`,
    lightdew_moth: `<path d="M78 86 q-30 -22 -44 -2 q18 0 30 14 z M122 86 q30 -22 44 -2 q-18 0 -30 14 z" fill="${armorCol}" opacity="0.85"/><path d="M92 68 q-8 -14 2 -18 M108 68 q8 -14 -2 -18" stroke="${deep}" stroke-width="3" fill="none"/>`,
    stone_hide_beast: `<path d="M76 90 l-6 -20 16 10 z M100 84 l-4 -22 14 14 z M124 90 l6 -20 -16 10 z" fill="${armorCol}"/>`,
    stone_hide_giant: `<path d="M80 66 l-10 -34 24 18 z M120 66 l10 -34 -24 18 z" fill="${deep}"/><path d="M84 150 l-10 14 M116 150 l10 14" stroke="${deep}" stroke-width="6" stroke-linecap="round"/>`,
  }[e.id];
  if (extra) parts.push(extra);

  // 金色眼睛签名（敌人统一）
  parts.push(`
  <circle cx="93" cy="82" r="4.6" fill="${C.accent}"/><circle cx="107" cy="82" r="4.6" fill="${C.accent}"/>
  <circle cx="93" cy="82" r="1.8" fill="${INK}"/><circle cx="107" cy="82" r="1.8" fill="${INK}"/>`);
  return wrap(parts.join('\n'));
}

// —— 从注册表数据生成立绘（单一数据源） ——
import { meadowUnits } from '../src/data/archetypes/units/meadow.ts';
import { meadowEnemies } from '../src/data/archetypes/enemies/meadow.ts';

for (const u of meadowUnits) {
  svgs[`unit_${u.id}`] = unitPortrait(u);
}
for (const e of meadowEnemies) {
  svgs[`enemy_${e.id}`] = enemyPortrait(e);
}

mkdirSync(outDir, { recursive: true });
let count = 0;
for (const [name, svg] of Object.entries(svgs)) {
  writeFileSync(join(outDir, `${name}.svg`), svg, 'utf8');
  count++;
}
console.log(`done: ${count} files (icons 6 + unit portraits ${meadowUnits.length} + enemy portraits ${meadowEnemies.length})`);
