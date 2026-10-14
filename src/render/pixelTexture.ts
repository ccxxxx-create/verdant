import Phaser from 'phaser';
import type { PixelSprite } from '../data/pixels/palette.ts';
import { PALETTE } from '../data/pixels/palette.ts';

/**
 * 像素纹理渲染器：把字符矩阵烘焙为 Phaser CanvasTexture。
 * scale=放大倍率（整数，保像素硬边）；键名前缀由调用方给（unit_/enemy_/icon_/bg_）。
 *
 * 像素风硬边关键：烘焙后必须切 `NEAREST`，否则 Phaser 默认 LINEAR 会把 ×3/×5 的
 * 整数放大插值成"橡皮感"模糊边缘，与硬边像素语言直接冲突（与 game.config 的
 * `render.pixelArt: true` 双保险；Canvas 纹理不受该开关影响，故此处显式设置）。
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
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
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
