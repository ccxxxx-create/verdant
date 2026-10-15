import { enemyPoints, type UnitInput } from '../../../core/schema/unit.ts';
import { PVZ2_STANDARD_RECHARGE_MS, pvz2Cost, pvz2RechargeMs } from '../../pvz2/plants.ts';

/** 晨雾草原首发 14 单位（GDD §5.3 数值冻结基准 + §14.2 flavor 特色介绍）。 */
export const meadowUnits: readonly UnitInput[] = [
  {
    id: 'firefly_reed',
    world: 'meadow',
    role: 'producer',
    name: '灯心草',
    flavor: '每 24 秒凝出 50 光露，一切布防的起点',
    cost: pvz2Cost('firefly_reed', 50),
    cooldownMs: pvz2RechargeMs('firefly_reed', 5000), // PvZ2 向日葵：充能 5s
    hp: 300,
    behaviors: ['produce'],
    produce: { amount: 50, intervalMs: 24000 }, // PvZ2：一次产出 1 个普通阳光 = 50
    power: { kind: 'produce_burst', params: { mult: 4 } },
    traits: [],
  },
  {
    id: 'twin_glow',
    world: 'meadow',
    role: 'producer',
    name: '双灯草',
    flavor: '进阶产能单位，同节奏产出翻倍（100/24s），撑起中后期经济',
    cost: pvz2Cost('twin_glow', 125),
    cooldownMs: pvz2RechargeMs('twin_glow', 5000), // PvZ2 双胞向日葵：充能 10s
    hp: 300,
    behaviors: ['produce'],
    produce: { amount: 100, intervalMs: 24000 }, // PvZ2：一次产出 2 个普通阳光 = 100
    power: { kind: 'produce_burst', params: { mult: 4 } },
    traits: [],
  },
  {
    id: 'thorn_pea',
    world: 'meadow',
    role: 'attacker',
    name: '豆射手',
    flavor: '最可靠的直线射手，一发 20 点，防线开路先锋',
    cost: pvz2Cost('thorn_pea', 100),
    cooldownMs: pvz2RechargeMs('thorn_pea', 5000), // PvZ2 豌豆射手：充能 5s
    hp: 300,
    behaviors: ['attack'],
    attack: { damage: 20, intervalMs: 1350, kind: 'single', range: 9 }, // PvZ2 豌豆射手：20 伤害 / 1.35s（DPS 14.8，codex 解包口径；wiki 旧 1.425s 作废）
    power: { kind: 'multi_shot', params: { shots: 3 } },
    traits: [],
  },
  {
    id: 'trifold_arrow',
    world: 'meadow',
    role: 'attacker',
    name: '三叶箭',
    flavor: '三连发直线射击，壳甲敌人的噩梦',
    cost: pvz2Cost('trifold_arrow', 300),
    cooldownMs: pvz2RechargeMs('trifold_arrow', 5000), // PvZ2 三线射手：充能 5s
    hp: 300,
    behaviors: ['attack'],
    attack: { damage: 20, intervalMs: 1350, kind: 'multi', range: 9, shots: 3 }, // PvZ2 三线射手：20 伤害 / 1.35s（codex 解包对齐）
    traits: ['vs_shell_efficient'],
  },
  {
    id: 'frost_pea',
    world: 'meadow',
    role: 'attacker',
    name: '冰豆',
    flavor: '冰弹命中减速 45%，专拖突进怪的脚步',
    cost: pvz2Cost('frost_pea', 150), // PvZ2 寒冰射手：150（fallback 与表一致，防表项漂移时静默跳价）
    cooldownMs: pvz2RechargeMs('frost_pea', 5000), // PvZ2 寒冰射手：充能 5s
    hp: 300,
    behaviors: ['attack'],
    attack: { damage: 20, intervalMs: 1350, kind: 'single', range: 9, element: 'ice' }, // PvZ2 寒冰射手：20 伤害 / 1.35s（codex 解包；该条为 pvz2cn 代际，成本与国际版一致）
    traits: ['slow'],
  },
  {
    id: 'ember_fluff',
    world: 'meadow',
    role: 'attacker',
    name: '火豆',
    flavor: '火弹点燃草格蔓延，冰原关里还能烧穿冰面',
    cost: pvz2Cost('ember_fluff', 175), // PvZ2 火焰豌豆：175
    cooldownMs: pvz2RechargeMs('ember_fluff', 5000), // PvZ2 火焰豌豆：充能 5s
    hp: 300,
    behaviors: ['attack'],
    attack: { damage: 40, intervalMs: 1350, kind: 'single', range: 9, element: 'fire' }, // PvZ2 火焰豌豆：40 伤害 / 1.35s（codex 解包全对齐）
    traits: ['burns', 'spreads_grass'],
  },
  {
    id: 'drum_cap',
    world: 'meadow',
    role: 'attacker',
    name: '炸弹菇',
    flavor: '埋地 14 秒后炸翻一小片，廉价的清群手段',
    cost: pvz2Cost('drum_cap', 25),
    cooldownMs: pvz2RechargeMs('drum_cap', 5000), // PvZ2 土豆雷：充能 20s
    hp: 300,
    behaviors: ['attack'],
    attack: { damage: 400, kind: 'trigger', range: 1, radius: 1, prepMs: 14000 }, // 伤害自拟；武装时间 14s = PvZ2 土豆雷 armingTime（codex 解包；PvZ1 为 15s）
    power: { kind: 'instant_trigger', params: {} },
    traits: ['burrowed', 'ground_only', 'one_shot'],
  },
  {
    id: 'wood_core',
    world: 'meadow',
    role: 'defender',
    name: '木墩',
    flavor: '4000 血肉盾，替你挡下啃咬，为后排放输出时间',
    cost: pvz2Cost('wood_core', 50),
    cooldownMs: pvz2RechargeMs('wood_core', 5000), // PvZ2 坚果墙：充能 20s
    hp: 4000,
    behaviors: ['block'],
    traits: ['wall'],
  },
  {
    id: 'lob_shroom',
    world: 'meadow',
    role: 'attacker',
    name: '雾菇',
    flavor: '抛射越过草丛，专打飞行与高台目标',
    cost: pvz2Cost('lob_shroom', 100), // PvZ2 卷心菜投手：100
    cooldownMs: pvz2RechargeMs('lob_shroom', 5000), // PvZ2 卷心菜投手：充能 5s
    hp: 300,
    behaviors: ['attack'],
    // 伤害 40 = PvZ2 卷心菜（codex 解包）；射速 codex 无数字 → 补缺 PvZ1 反编译「2.86~3s/发」取 2900ms（标 PvZ1）
    attack: { damage: 40, intervalMs: 2900, kind: 'lobbed', range: 9, shots: 2 },
    traits: ['vs_air', 'lobs_over_cover'],
  },
  {
    id: 'storm_cap',
    world: 'meadow',
    role: 'attacker',
    name: '闪电菇',
    flavor: '3×3 落雷范围伤害，水格连锁的核心',
    cost: 300,
    cooldownMs: PVZ2_STANDARD_RECHARGE_MS, // PvZ2 同级无对应：取 PvZ2 标准充能 5s
    hp: 300,
    behaviors: ['attack'],
    attack: { damage: 45, intervalMs: 2500, kind: 'aoe', range: 1, radius: 1, element: 'electric' },
    traits: ['aoe_3x3'],
  },
  {
    id: 'tether_moss',
    world: 'meadow',
    role: 'support',
    name: '藤蔓',
    flavor: '一根藤索定身 4 秒，救场与控制位',
    cost: 175,
    cooldownMs: PVZ2_STANDARD_RECHARGE_MS, // PvZ2 同级无对应：取 PvZ2 标准充能 5s
    hp: 300,
    behaviors: ['control'],
    control: { stunMs: 4000 },
    power: { kind: 'stun_lane', params: { durationMs: 5000 } },
    traits: ['ground_only'],
  },
  {
    id: 'nectar_moss',
    world: 'meadow',
    role: 'support',
    name: '蜜草',
    flavor: '花香光环：周围同伴攻速 +20%',
    cost: 100,
    cooldownMs: PVZ2_STANDARD_RECHARGE_MS, // PvZ2 同级无对应：取 PvZ2 标准充能 5s
    hp: 300,
    behaviors: ['aura'],
    aura: { radiusCells: 1, attackSpeedPct: 20 },
    traits: [],
  },
  {
    id: 'mist_lamp',
    world: 'meadow',
    role: 'support',
    name: '雾灯',
    flavor: '驱散高草遮挡，让投掷系百发百中',
    cost: 25,
    cooldownMs: 15000, // 无 PvZ2 对应植物：保留原值（S3 复核）
    hp: 300,
    behaviors: ['reveal'],
    reveal: { durationMs: 30000 },
    traits: ['anti_cover'],
  },
  {
    id: 'dandelion',
    world: 'meadow',
    role: 'attacker',
    name: '蒲公英',
    flavor: '绒球种子乘风追踪全屏敌人，专收漏行漏线的漏网之怪',
    cost: pvz2Cost('dandelion', 275), // PvZ2 蒲公英：275
    cooldownMs: pvz2RechargeMs('dandelion', 15000), // PvZ2 蒲公英：充能 15s
    hp: 300,
    behaviors: ['attack'],
    // 全屏追踪（PvZ2 蒲公英同名单位全对齐）：50 伤害 / 1.9s / 275 阳光 / 充能 15s（codex 解包）。
    // 可打飞行；大招走 generic（强化期 ×2）。
    attack: { damage: 50, intervalMs: 1900, kind: 'homing', range: 99, element: 'wind' },
    traits: ['vs_air'],
  },
];
