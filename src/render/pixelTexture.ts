import type Phaser from 'phaser';
import type { PixelSprite } from '../data/pixels/palette.ts';
import { PALETTE } from '../data/pixels/palette.ts';

/**
 * 像素纹理渲染器：把字符矩阵烘焙为 Phaser CanvasTexture。
 * scale=放大倍率（整数，保像素硬边）；键名前缀由调用方给（unit_/enemy_/icon_/bg_）。
 */
export function bakePixelTexture(
  scene: Phaser.Scene,
  key: string,
  sprite: PixelSprite,
  scale = 1,
): void {
  if (scene.textures.exists(key)) return;
  const h = sprite.length;
  const w = sprite[0]?.length ?? 0;
  const tex = scene.textures.createCanvas(key, w * scale, h * scale);
  if (!tex) return;
  const ctx = tex.getContext();
  for (let y = 0; y < h; y++) {
    const row = sprite[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x] ?? ''];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  tex.refresh();
}

/** 便捷：返回 Image 对象（已烘焙）。 */
export function pixelImage(
  scene: Phaser.Scene,
  key: string,
  sprite: PixelSprite,
  scale = 1,
  x?: number,
  y?: number,
): Phaser.GameObjects.Image {
  bakePixelTexture(scene, key, sprite, scale);
  return scene.add.image(x ?? 0, y ?? 0, key);
}
