import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/data/pixels/palette.ts';
import { allUnitSprites, allEnemySprites, allProjectileSprites, allPixelIcons, validatePixelSprite } from '../src/data/pixels/index.ts';
import { meadowBattleBg } from '../src/data/pixels/bg/meadow.ts';

const keys = new Set(Object.keys(PALETTE));

describe('pixel sprite data integrity', () => {
  it('all 13 unit sprites are rectangular & in-palette', () => {
    const names = Object.keys(allUnitSprites);
    expect(names).toHaveLength(13);
    for (const [name, sprite] of Object.entries(allUnitSprites)) {
      expect(validatePixelSprite(name, sprite, keys)).toEqual([]);
    }
  });

  it('all 11 enemy sprites + 4 projectiles + 20 icons are valid', () => {
    expect(Object.keys(allEnemySprites)).toHaveLength(11);
    expect(Object.keys(allProjectileSprites)).toHaveLength(4);
    expect(Object.keys(allPixelIcons)).toHaveLength(29);
    expect(allPixelIcons.lightdew).toBeDefined();
    expect(allPixelIcons.gate).toBeDefined();
    expect(allPixelIcons.flag).toBeDefined();
    expect(allPixelIcons.shovel).toBeDefined();
    expect(PALETTE.x).toBeDefined(); // 铁甲深色（护甲四分层）
    const tables = { ...allEnemySprites, ...allProjectileSprites, ...allPixelIcons };
    for (const [name, sprite] of Object.entries(tables)) {
      expect(validatePixelSprite(name, sprite, keys)).toEqual([]);
    }
  });

  it('key palette colors stay bright (user feedback #1/#2: 反"太暗"回归防线)', () => {
    const lum = (hex: string): number => {
      const c = hex.replace('#', '');
      const f = (i: number) => {
        const v = parseInt(c.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4);
    };
    // 植株/草地/天空/资源主体必须保持明亮（阈值=相对亮度）
    for (const key of ['M', 'L', 'h', 'v', 'o', 'S', 's', 'G', 'B']) {
      expect(PALETTE[key], `palette ${key}`).toBeDefined();
      expect(lum(PALETTE[key] as string)).toBeGreaterThan(0.35);
    }
    for (const key of ['E', 'F', 'X', 'g']) {
      expect(PALETTE[key], `palette ${key}`).toBeDefined();
      expect(lum(PALETTE[key] as string)).toBeGreaterThan(0.25);
    }
  });

  it('sprite ids match archetype registry ids', async () => {
    const { allUnits, allEnemies } = await import('../src/data/archetypes/index.ts');
    for (const u of allUnits) expect(allUnitSprites[u.id], `unit ${u.id}`).toBeDefined();
    for (const e of allEnemies) expect(allEnemySprites[e.id], `enemy ${e.id}`).toBeDefined();
  });

  it('battle bg generates deterministic 320x180 grid', () => {
    const bg = meadowBattleBg();
    expect(bg).toHaveLength(180);
    for (const row of bg) expect(row).toHaveLength(320);
    // 确定性：两次生成完全一致
    expect(meadowBattleBg()).toEqual(bg);
    // 内容 sanity：天空有色、地面是草色
    expect(bg[10]?.[100]).toMatch(/^[SsW]$/);
    expect(bg[150]?.[160]).toMatch(/^[vohd]$/);
  });
});
