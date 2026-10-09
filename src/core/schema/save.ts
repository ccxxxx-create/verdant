import { z } from 'zod';
import { enemyPoints } from './unit';

export const SaveV3 = z.strictObject({
  schemaVersion: z.literal(3),
  updatedAt: z.string(),
  progress: z.strictObject({
    clearedLevels: z.array(z.string()),
    stars: z.record(z.string(), z.number().int().min(0).max(3)),
    unlockedUnits: z.array(z.string()),
    currentWorld: z.enum(['meadow', 'reef', 'sky', 'frost']),
  }),
  settings: z.strictObject({
    master: z.number().min(0).max(1),
    music: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
    quality: z.enum(['auto', 'high', 'medium', 'low']),
    speedDefault: z.union([z.literal(1), z.literal(2)]),
    handLayout: z.enum(['left', 'right']),
  }),
  stats: z.strictObject({
    playSeconds: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
  }),
});

export type SaveGame = z.infer<typeof SaveV3>;

export function defaultSave(): SaveGame {
  return {
    schemaVersion: 3,
    updatedAt: new Date(0).toISOString(),
    progress: {
      clearedLevels: [],
      stars: {},
      unlockedUnits: ['firefly_reed', 'thorn_pea'],
      currentWorld: 'meadow',
    },
    settings: { master: 0.8, music: 0.6, sfx: 1, quality: 'auto', speedDefault: 1, handLayout: 'right' },
    stats: { playSeconds: 0, wins: 0, losses: 0 },
  };
}

// —— 迁移链（GDD §9.2：字段只增不删，缺失填默认值）——

type Unknown = Record<string, unknown>;

export const CURRENT_SCHEMA_VERSION = 3;

function toV2(v1: Unknown): Unknown {
  return {
    ...v1,
    schemaVersion: 2,
    progress: {
      ...(v1['progress'] as Unknown),
      currentWorld: 'meadow',
    },
    settings: { master: 0.8, music: 0.6, sfx: 1, speedDefault: 1 },
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

const MIGRATIONS: Record<number, (v: Unknown) => Unknown> = { 1: toV2, 2: toV3 };

/** 逐级升级到当前版本；未知版本号抛错（不毁档，由调用方回退默认档）。 */
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
  return cur;
}

export { enemyPoints };
