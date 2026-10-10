/**
 * 图鉴静态网页生成器（M2，用户第 13 轮需求："图鉴单独做一个静态网页，展示数值，便于后期微调"）。
 * 从同一份数据源（src/data/** + src/core/balance.ts）生成 docs/almanac.html：
 * 角色/敌人/关卡/经济/平衡五张表，改数据后重跑即可刷新。
 * 用法：node scripts/gen-almanac.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { meadowUnits as allUnits } from '../src/data/archetypes/units/meadow.ts';
import { meadowEnemies as allEnemies } from '../src/data/archetypes/enemies/meadow.ts';
import { UNIT_ACQUISITION, LEVEL_STAR_REWARDS, REPLAY_FACTOR, STAR_MILESTONES, PLANT_FOOD_PER_CLEAR, FIRST_THREE_STAR_DIAMONDS } from '../src/data/economy.ts';
import { GACHA_POOL, GACHA_COST } from '../src/core/gacha.ts';
import { ARMOR_MULT, WAVE_PACING, SKY_SUN } from '../src/core/balance.ts';
import { readdirSync, readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function unitRows() {
  return allUnits
    .map((u) => {
      const acq = UNIT_ACQUISITION[u.id] ?? { channel: '-', price: '', note: '' };
      const atk = u.attack ? `${u.attack.damage ?? 0} 伤 / ${(u.attack.intervalMs ?? 1400) / 1000}s${u.attack.shots ? ` ×${u.attack.shots}` : ''}${u.attack.element && u.attack.element !== 'none' ? ` / ${u.attack.element}` : ''}` : '—';
      const prod = u.produce ? `${u.produce.amount} 露 / ${(u.produce.intervalMs ?? 0) / 1000}s` : '—';
      const price = acq.channel === 'coins' ? `${acq.price} 金币` : acq.channel === 'diamonds' ? `${acq.price} 钻石` : '赠送';
      return `<tr>
<td>${esc(u.id)}</td><td>${esc(u.name)}</td><td>${esc(u.role)}</td>
<td>${esc(u.cost)}</td><td>${esc(u.cooldownMs)}ms</td><td>${esc(u.hp)}</td>
<td>${esc(atk)}</td><td>${esc(prod)}</td>
<td>${esc(acq.channel)}</td><td>${esc(price)}</td>
<td>${esc((u.traits ?? []).join(', '))}</td><td>${esc(u.flavor)}</td></tr>`;
    })
    .join('\n');
}

function enemyRows() {
  return allEnemies
    .map((e) => {
      const perCell = (1 / (e.speed || 1)).toFixed(1);
      return `<tr>
<td>${esc(e.id)}</td><td>${esc(e.name)}</td><td>${esc(e.hp)}</td>
<td>${esc(e.speed)}</td><td>${esc(perCell)}s/格</td>
<td>${esc(e.biteDps)}</td><td>${esc(e.armor)} ×${esc(ARMOR_MULT[e.armor] ?? 1)}</td>
<td>${esc(e.points)}</td><td>${esc((e.traits ?? []).join(', '))}</td><td>${esc(e.flavor)}</td></tr>`;
    })
    .join('\n');
}

function levelRows() {
  const dir = join(root, 'src/data/levels');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const lv = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
      const gift = (lv.unlockUnits ?? []).join(', ') || '—';
      return `<tr>
<td>${esc(lv.id)}</td><td>${esc(lv.template)}</td><td>${esc(lv.waves)}</td><td>${esc(lv.startingLight)}</td>
<td>${esc((lv.pool ?? []).join(', '))}</td><td>${esc(gift)}</td><td>${esc(lv.starCondition)}</td>
<td>${esc(lv.terrain ? JSON.stringify(lv.terrain) : '—')}</td></tr>`;
    })
    .join('\n');
}

function economyRows() {
  const rows = [
    ['金币获取', `通关 ${LEVEL_STAR_REWARDS[1]}/${LEVEL_STAR_REWARDS[2]}/${LEVEL_STAR_REWARDS[3]} 金币（按星级）`],
    ['金币获取', `重打=首通×${REPLAY_FACTOR}（向下取整）`],
    ['金币获取', '抽奖掉落（40%）/重复角色折算 250'],
    ['钻石获取', `首次通关三星 +${FIRST_THREE_STAR_DIAMONDS}`],
    ['钻石获取', 'Boss 首杀 +5（M3 接入）/抽奖掉落（9%）'],
    ['种子获取', `星星里程碑：${STAR_MILESTONES.map((m) => `${m.stars}★→${m.seeds}`).join(' / ')}`],
    ['种子获取', 'Boss 首杀 +2（M3）/抽奖掉落（28%）'],
    ['能量豆', `每次通关 +${PLANT_FOOD_PER_CLEAR}；抽奖 15%`],
    ['抽奖单价', `种子券单抽 ×${GACHA_COST.singleSeed}；钻石十连 ×${GACHA_COST.diamondTen}（必出未拥有角色）`],
    ['角色渠道', '4 赠送（ firefly_reed / thorn_pea / wood_core / frost_pea ）+ 6 金币购 + 3 钻石购'],
  ];
  return rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('\n');
}

function balanceRows() {
  const rows = [
    ['护甲减伤', `布 ${ARMOR_MULT.cloth} / 皮 ${ARMOR_MULT.hide} / 壳 ${ARMOR_MULT.shell} / 铁 ${ARMOR_MULT.iron}`],
    ['首波等待', `teach ${WAVE_PACING.firstWave.teach}s / 普通 ${WAVE_PACING.firstWave.normal}s`],
    ['波间隔', `teach ${WAVE_PACING.betweenWaves.teach}s / 普通 ${WAVE_PACING.betweenWaves.normal}s`],
    ['波内出生间隔', `teach ${WAVE_PACING.spawnInterval.teach}s / 普通 ${WAVE_PACING.spawnInterval.normal}s`],
    ['波预算', `round(${WAVE_PACING.base} × (1 + w×${WAVE_PACING.growth}) × 模板缩放 × 终波×${WAVE_PACING.finalWaveMult})`],
    ['模板缩放', `teach ${WAVE_PACING.scale.teach} / 普通 ${WAVE_PACING.scale.normal}`],
    ['天空阳光', `首枚 ${SKY_SUN.firstS}s，之后 ${SKY_SUN.intervalMinS}~${SKY_SUN.intervalMaxS}s 一枚，值 ${SKY_SUN.value}，停留 ${SKY_SUN.restS}s`],
    ['产出节奏', '向日葵系 25/24s（PvZ1 口径）'],
    ['攻击节奏', '豌豆系 20 伤 / 1.43s（PvZ1 口径）'],
    ['敌人速度', '普通 0.21 格/秒 ≈ 4.7s/格（PvZ1 口径）'],
    ['起步光露', '50（PvZ1 口径）'],
    ['冷却表', '豌豆系 7.5s / 坚果 30s / 樱桃 50s（PvZ1 口径）'],
  ];
  return rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('\n');
}

const gachaRows = GACHA_POOL.map((e) => `<tr><td>${esc(e.kind)}</td><td>${esc(e.weight)}%</td><td>${esc(e.amount)}</td></tr>`).join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Verdant 图鉴与数值（静态）</title>
<style>
  body { font: 14px/1.6 system-ui, "PingFang SC", sans-serif; background: #A5DFF7; color: #26402F; margin: 0; padding: 24px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 28px 0 8px; border-left: 6px solid #FFD34D; padding-left: 8px; }
  .note { background: #FFF0C2; border: 2px solid #26402F; border-radius: 8px; padding: 10px 14px; max-width: 1100px; }
  table { border-collapse: collapse; background: #fff; max-width: 1100px; box-shadow: 0 2px 0 #26402F; }
  th, td { border: 1px solid #cde; padding: 5px 9px; text-align: left; vertical-align: top; }
  th { background: #F5E9C8; position: sticky; top: 0; }
  tr:nth-child(even) td { background: #F3FAF1; }
  code { background: #E3D2A6; border-radius: 4px; padding: 1px 5px; }
</style>
</head>
<body>
<h1>Verdant 图鉴与数值总表</h1>
<div class="note">
本页由 <code>node scripts/gen-almanac.mjs</code> 从游戏同源数据生成（<code>src/data/**</code> + <code>src/core/balance.ts</code>）。<br>
微调流程：改 <code>src/data/archetypes/**</code> 或 <code>src/core/balance.ts</code> 或 <code>src/data/economy.ts</code> → 重跑上面命令 → 刷新本页核对。<br>
PvZ1 对标口径说明见 <code>docs/RESEARCH-PVZ.md</code>（开源移植参考，未经官方验证）。
</div>

<h2>一、角色（Units）</h2>
<table><thead><tr><th>id</th><th>名称</th><th>职能</th><th>费用</th><th>冷却</th><th>HP</th><th>攻击</th><th>产出</th><th>渠道</th><th>价格</th><th>traits</th><th>特色</th></tr></thead>
<tbody>
${unitRows()}
</tbody></table>

<h2>二、敌人（Enemies）</h2>
<table><thead><tr><th>id</th><th>名称</th><th>HP</th><th>速度(格/秒)</th><th>横穿 1 格</th><th>啃咬</th><th>护甲</th><th>波次点数</th><th>traits</th><th>特色</th></tr></thead>
<tbody>
${enemyRows()}
</tbody></table>

<h2>三、关卡（Levels）</h2>
<table><thead><tr><th>id</th><th>模板</th><th>波数</th><th>起步光露</th><th>亮相池</th><th>通关赠送</th><th>星级条件</th><th>地形</th></tr></thead>
<tbody>
${levelRows()}
</tbody></table>

<h2>四、经济（Economy）</h2>
<table><thead><tr><th>项目</th><th>规则</th></tr></thead>
<tbody>
${economyRows()}
</tbody></table>

<h2>五、抽奖概率（Gacha）</h2>
<table><thead><tr><th>奖品</th><th>权重</th><th>数量</th></tr></thead>
<tbody>
${gachaRows}
</tbody></table>

<h2>六、平衡参数（Balance · 单一事实源）</h2>
<table><thead><tr><th>参数</th><th>当前值</th></tr></thead>
<tbody>
${balanceRows()}
</tbody></table>
</body>
</html>
`;

writeFileSync(join(root, 'docs/almanac.html'), html, 'utf-8');
console.log('almanac written: docs/almanac.html', html.length, 'bytes');
