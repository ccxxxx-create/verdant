import { LevelDef } from '../../core/schema/level.ts';

/**
 * 关卡批量导入（W7-1）：`import.meta.glob` 构建期打包，新关 JSON 落盘即自动进表。
 * 排序用 numeric 语义（meadow-1-2 < meadow-1-10 < meadow-2-1），即巡野图解锁链顺序。
 */
const modules = import.meta.glob('./*.json', { eager: true });

export const ALL_LEVELS: LevelDef[] = Object.values(modules)
  .map((m) => LevelDef.safeParse((m as { default: unknown }).default))
  .map((r) => {
    if (!r.success) {
      console.error('[levels] JSON 校验失败，跳过该关（不炸启动）', r.error.issues);
      return null;
    }
    return r.data;
  })
  .filter((l): l is LevelDef => !!l)
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

export function levelById(id: string): LevelDef | undefined {
  return ALL_LEVELS.find((l) => l.id === id);
}
