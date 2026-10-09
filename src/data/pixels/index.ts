import type { PixelSprite } from './palette.ts';
import { unitSprites } from './units/meadow.ts';
import { enemySprites, projectileSprites } from './enemies/meadow.ts';
import { pixelIcons } from './icons.ts';

/** 像素资产注册表：单位/敌人/子弹/图标。 */
export const allUnitSprites = unitSprites;
export const allEnemySprites = enemySprites;
export const allProjectileSprites = projectileSprites;
export const allPixelIcons = pixelIcons;

export function findSprite(kind: 'unit' | 'enemy' | 'projectile' | 'icon', id: string): PixelSprite | undefined {
  const table =
    kind === 'unit' ? allUnitSprites : kind === 'enemy' ? allEnemySprites : kind === 'projectile' ? allProjectileSprites : allPixelIcons;
  return table[id];
}

/** 校验：矩形网格 + 字符在调色板内（tests/pixels.test.ts 用）。 */
export function validatePixelSprite(name: string, sprite: PixelSprite, paletteKeys: Set<string>): string[] {
  const issues: string[] = [];
  if (sprite.length === 0) {
    issues.push(`${name}: empty`);
    return issues;
  }
  const w = sprite[0]?.length ?? 0;
  sprite.forEach((row, i) => {
    if (row.length !== w) issues.push(`${name}: row ${i} width ${row.length} != ${w}`);
    for (const ch of row) {
      if (ch !== '.' && !paletteKeys.has(ch)) issues.push(`${name}: row ${i} char '${ch}' not in palette`);
    }
  });
  return issues;
}
