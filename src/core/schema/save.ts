import { z } from 'zod';
import { enemyPoints } from './unit';

/**
 * 存档 schema v6（M-INV：新增 inventory 道具持有 + stats.redeemCount 兑换计数；v5 = 减弱动态开关）。
 * 纪律：字段只增不删；未知 key 由 migrate 末端 shapeCurrent 剥离（不整档拒绝）。
 */
export const SaveV6 = z.strictObject({
  schemaVersion: z.literal(6),
  updatedAt: z.string(),
  /** 已读更新公告的版本号（更新公告机制 2026-10-15）：''=尚未读过当前版本公告（新档与升级档同权，用户拍板：每次更新都要有感）；确认后由 MenuScene 写回 GAME_VERSION。 */
  patchSeen: z.string(),
  progress: z.strictObject({
    clearedLevels: z.array(z.string()),
    stars: z.record(z.string(), z.number().int().min(0).max(3)),
    unlockedUnits: z.array(z.string()),
    currentWorld: z.enum(['meadow', 'reef', 'sky', 'frost']),
  }),
  /** 钱包：金币（软货币）/钻石（稀有）/种子（抽奖券）/能量豆（世界能量）。 */
  wallet: z.strictObject({
    coins: z.number().int().nonnegative(),
    diamonds: z.number().int().nonnegative(),
    seeds: z.number().int().nonnegative(),
    plantFood: z.number().int().nonnegative(),
  }),
  /** 道具持有：itemId → 数量（仅非负整数；空对象 = 未持有任何道具）。 */
  inventory: z.record(z.string(), z.number().int().nonnegative()),
  /** 抽奖计数（保底统计用）。 */
  gacha: z.strictObject({
    singlePulls: z.number().int().nonnegative(),
    diamondTenPulls: z.number().int().nonnegative(),
  }),
  settings: z.strictObject({
    master: z.number().min(0).max(1),
    music: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
    quality: z.enum(['auto', 'high', 'medium', 'low']),
    speedDefault: z.union([z.literal(1), z.literal(2)]),
    handLayout: z.enum(['left', 'right']),
    /** 减弱动态（可访问性）：关闭常驻循环动效与氛围粒子。 */
    motion: z.boolean(),
  }),
  stats: z.strictObject({
    playSeconds: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    /** 兑换码累计兑换次数（6666 可重复兑换；为日后切换一次性兑换留接口）。 */
    redeemCount: z.number().int().nonnegative(),
  }),
});

export type SaveGame = z.infer<typeof SaveV6>;
export const CURRENT_SCHEMA_VERSION = 6;

export function defaultSave(): SaveGame {
  return {
    schemaVersion: 6,
    updatedAt: new Date(0).toISOString(),
    patchSeen: '', // 新玩家首启也弹一次公告（用户拍板 2026-10-15 修订：更新要对所有玩家可见）
    progress: {
      clearedLevels: [],
      stars: {},
      unlockedUnits: ['firefly_reed', 'thorn_pea'],
      currentWorld: 'meadow',
    },
    wallet: { coins: 0, diamonds: 0, seeds: 0, plantFood: 0 },
    inventory: {},
    gacha: { singlePulls: 0, diamondTenPulls: 0 },
    settings: { master: 0.8, music: 0.6, sfx: 1, quality: 'auto', speedDefault: 1, handLayout: 'right', motion: true },
    stats: { playSeconds: 0, wins: 0, losses: 0, redeemCount: 0 },
  };
}

// —— 迁移链（字段只增不删，缺失填默认）——

type Unknown = Record<string, unknown>;

function toV2(v1: Unknown): Unknown {
  return {
    ...v1,
    schemaVersion: 2,
    progress: {
      ...(v1['progress'] as Unknown),
      currentWorld: 'meadow',
    },
    settings: {
      ...((v1['settings'] as Unknown) ?? {}),
      master: 0.8,
      music: 0.6,
      sfx: 1,
      speedDefault: 1,
    },
  };
}

function toV3(v2: Unknown): Unknown {
  return {
    ...v2,
    schemaVersion: 3,
    settings: { ...(v2['settings'] as Unknown), quality: 'auto', handLayout: 'right' },
    stats: { playSeconds: 0, wins: 0, losses: 0 },
  };
}

/** v3→v4：新增钱包与抽奖计数（M2 经济；旧档无损）。 */
function toV4(v3: Unknown): Unknown {
  return {
    ...v3,
    schemaVersion: 4,
    wallet: {
      coins: 0,
      diamonds: 0,
      seeds: 0,
      plantFood: 0,
      ...((v3['wallet'] as Unknown) ?? {}),
    },
    gacha: {
      singlePulls: 0,
      diamondTenPulls: 0,
      ...((v3['gacha'] as Unknown) ?? {}),
    },
  };
}

/** v4→v5：新增 settings.motion（减弱动态开关；旧档默认开启动效）。 */
function toV5(v4: Unknown): Unknown {
  return {
    ...v4,
    schemaVersion: 5,
    settings: { ...((v4['settings'] as Unknown) ?? {}), motion: true },
  };
}

/** v5→v6：新增 inventory（道具持有，旧档为空）与 stats.redeemCount（兑换计数）。 */
function toV6(v5: Unknown): Unknown {
  return {
    ...v5,
    schemaVersion: 6,
    inventory: { ...((v5['inventory'] as Unknown) ?? {}) },
    stats: { ...((v5['stats'] as Unknown) ?? {}), redeemCount: 0 },
  };
}

const MIGRATIONS: Record<number, (v: Unknown) => Unknown> = { 1: toV2, 2: toV3, 3: toV4, 4: toV5, 5: toV6 };

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function nonNeg(v: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(num(v, fallback)));
}

/** 末态显式只取已知字段（未知 key 剥离而非整档拒绝，防"来自未来的档"静默清档）。 */
function shapeCurrent(v: Unknown): Unknown {
  const p = (v['progress'] as Unknown) ?? {};
  const s = (v['settings'] as Unknown) ?? {};
  const st = (v['stats'] as Unknown) ?? {};
  const w = (v['wallet'] as Unknown) ?? {};
  const g = (v['gacha'] as Unknown) ?? {};
  const inv = (v['inventory'] as Unknown) ?? {};
  const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : []);
  const WORLDS = ['meadow', 'reef', 'sky', 'frost'];
  const QUALITIES = ['auto', 'high', 'medium', 'low'];
  const starsRaw = p['stars'] && typeof p['stars'] === 'object' ? (p['stars'] as Unknown) : {};
  const stars: Record<string, number> = {};
  for (const [k, val] of Object.entries(starsRaw)) {
    const n = num(val, -1);
    if (Number.isInteger(n) && n >= 0 && n <= 3) stars[k] = n;
  }
  // 道具持有：只保留正整数数量（0 与非法项丢弃，避免脏键堆积）
  const inventory: Record<string, number> = {};
  for (const [k, val] of Object.entries(inv)) {
    const n = num(val, -1);
    if (k.length > 0 && Number.isInteger(n) && n > 0) inventory[k] = n;
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: typeof v['updatedAt'] === 'string' ? v['updatedAt'] : new Date(0).toISOString(),
    // 旧档无此字段 → ''（视作"升级上来尚未读过公告"，下次启动弹一次）；新档由 defaultSave 直接带 GAME_VERSION
    patchSeen: typeof v['patchSeen'] === 'string' ? v['patchSeen'] : '',
    progress: {
      clearedLevels: strArr(p['clearedLevels']),
      stars,
      unlockedUnits: strArr(p['unlockedUnits']),
      currentWorld: WORLDS.includes(String(p['currentWorld'])) ? p['currentWorld'] : 'meadow', // 白名单透传（审查 P1-3：勿静默重置）
    },
    wallet: {
      coins: nonNeg(w['coins']),
      diamonds: nonNeg(w['diamonds']),
      seeds: nonNeg(w['seeds']),
      plantFood: nonNeg(w['plantFood']),
    },
    inventory,
    gacha: {
      singlePulls: nonNeg(g['singlePulls']),
      diamondTenPulls: nonNeg(g['diamondTenPulls']),
    },
    settings: {
      master: Math.min(1, Math.max(0, num(s['master'], 0.8))),
      music: Math.min(1, Math.max(0, num(s['music'], 0.6))),
      sfx: Math.min(1, Math.max(0, num(s['sfx'], 1))),
      quality: QUALITIES.includes(String(s['quality'])) ? s['quality'] : 'auto', // 白名单透传
      speedDefault: s['speedDefault'] === 2 ? 2 : 1,
      handLayout: s['handLayout'] === 'left' ? 'left' : 'right',
      motion: typeof s['motion'] === 'boolean' ? s['motion'] : true,
    },
    stats: {
      playSeconds: nonNeg(st['playSeconds']),
      wins: nonNeg(st['wins']),
      losses: nonNeg(st['losses']),
      redeemCount: nonNeg(st['redeemCount']),
    },
  };
}

/** 逐级升级到当前版本；末态剥离未知字段。 */
export function migrate(raw: Unknown): Unknown {
  let cur = raw;
  const first = cur['schemaVersion'];
  if (typeof first !== 'number') throw new Error('save: missing schemaVersion');
  let version: number = first;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`save: no migration from v${version}`);
    cur = step(cur);
    const next = cur['schemaVersion'];
    if (typeof next !== 'number') throw new Error(`save: migration v${version} lost version`);
    version = next;
  }
  if (version > CURRENT_SCHEMA_VERSION) throw new Error('save: from the future');
  return shapeCurrent(cur);
}

export { enemyPoints };
