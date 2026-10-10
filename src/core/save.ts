import { SaveV3, defaultSave, migrate, type SaveGame } from './schema/save';

/** 可注入存储：浏览器 localStorage / 测试用内存对象同构。 */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const SAVE_KEY = 'verdant.save.v1';

/**
 * 读取存档：解析失败不毁档，退回默认档并回调错误（GDD §9.2 可读报错，不黑屏）。
 * 不依赖 Phaser：核心逻辑在 node 测试环境可跑（DEV-PLAN §4）。
 */
export function readSave(storage: SaveStorage, onError?: (err: unknown) => void): SaveGame {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return defaultSave();
  try {
    const migrated = migrate(JSON.parse(raw) as Record<string, unknown>);
    return SaveV3.parse(migrated);
  } catch (err) {
    onError?.(err);
    // 解析失败先备份原始档再退默认档（审查 P1-2：此前静默清档零感知，进度全丢）
    try {
      storage.setItem(`${SAVE_KEY}.bak`, raw);
    } catch {
      /* 备份失败不阻塞回退 */
    }
    return defaultSave();
  }
}

export function writeSave(storage: SaveStorage, save: SaveGame, onError?: (err: unknown) => void): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, updatedAt: new Date().toISOString() }));
  } catch (err) {
    onError?.(err);
  }
}
