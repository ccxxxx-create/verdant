import Phaser from 'phaser';
import { FONT, typography, zIndex } from '../tokens.ts';
import { KIT } from './kit.ts';

/**
 * 战斗 HUD 组件（M-UI 统一）：把 BattleScene 原先内联的"木纹条 / 资源徽记 / 种子卡底板 / 波次进度条"
 * 收敛为共享件，与 Hub 层同一像素语言（纸底 + 描边 + 实色偏移投影 + 顶部受光带）。
 * 场景只提供数据与回调，样式一律来自本文件。
 */

/** 顶部木纹信息带（HUD 顶栏与种子条共用同一带样式）。 */
export function woodBand(
  scene: Phaser.Scene,
  y: number,
  h: number,
  opts: { alpha?: number; depth?: number; topLine?: boolean; bottomLine?: boolean } = {},
): Phaser.GameObjects.Graphics {
  const w = scene.scale.gameSize.width;
  const g = scene.add.graphics().setDepth(opts.depth ?? zIndex.hud);
  g.fillStyle(KIT.wood, opts.alpha ?? 0.92);
  g.fillRect(0, y, w, h);
  // 顶部受光，模拟木纹条厚度
  g.fillStyle(KIT.woodLight, 0.5);
  g.fillRect(0, y, w, 4);
  if (opts.topLine !== false) {
    g.lineStyle(3, KIT.woodLight, 1);
    g.lineBetween(0, y + 2, w, y + 2);
  }
  if (opts.bottomLine !== false) {
    g.lineStyle(3, KIT.woodLight, 1);
    g.lineBetween(0, y + h - 2, w, y + h - 2);
  }
  return g;
}

/** 资源徽记（图标 + 数值）。 */
export function resourceBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  icon: string,
  value: string,
  opts: { depth?: number; color?: string; iconSize?: number } = {},
): { container: Phaser.GameObjects.Container; valueText: Phaser.GameObjects.Text } {
  const c = scene.add.container(x, y).setDepth(opts.depth ?? zIndex.hud + 1);
  // 图标用显示尺寸锁定（icon_ 纹理 16×16×4=64px；setScale(3) 会放大到 192px 并溢出 HUD 带）
  c.add(scene.add.image(0, 0, icon).setDisplaySize(opts.iconSize ?? 44, opts.iconSize ?? 44));
  const valueText = scene.add
    .text(38, 0, value, { ...typography.numeric, color: opts.color ?? KIT.goldCss })
    .setOrigin(0, 0.5);
  c.add(valueText);
  return { container: c, valueText };
}

/** 种子/工具卡底板（纸卡 + 描边 + 顶部受光带）；内容由调用方添加。 */
export function seedCardBase(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { depth?: number } = {},
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(opts.depth ?? zIndex.hud + 1);
  const g = scene.add.graphics();
  g.fillStyle(KIT.shadow, 0.3);
  g.fillRoundedRect(0, 4, w, h, 8);
  g.fillStyle(KIT.paper, 0.96);
  g.fillRoundedRect(0, 0, w, h, 8);
  g.fillStyle(0xffffff, 0.22);
  g.fillRoundedRect(4, 3, w - 8, Math.max(8, h * 0.14), 5);
  g.lineStyle(2, KIT.outline, 1);
  g.strokeRoundedRect(0, 0, w, h, 8);
  c.add(g);
  return c;
}

/** 造价徽记（光露图标 + 数字）。 */
export function costBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cost: number,
  opts: { depth?: number; color?: string } = {},
): { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text } {
  const c = scene.add.container(x, y).setDepth(opts.depth ?? 0);
  c.add(scene.add.image(0, 0, 'icon_lightdew').setDisplaySize(22, 22));
  const text = scene.add
    .text(16, 0, String(cost), { ...typography.subheading, color: opts.color ?? KIT.outlineCss })
    .setOrigin(0, 0.5);
  c.add(text);
  return { container: c, text };
}

/** 竖向波次进度条：clear 后重绘（每波刷新），返回旗帜建议 y 坐标。 */
export function drawWaveProgress(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y0: number,
  y1: number,
  ratio: number,
  opts: { width?: number } = {},
): number {
  const w = opts.width ?? 20;
  const r = Math.max(0, Math.min(1, ratio));
  g.clear();
  g.fillStyle(KIT.outline, 0.28);
  g.fillRoundedRect(x, y0, w, y1 - y0, 6);
  g.lineStyle(2, KIT.paperDeep, 0.85);
  g.strokeRoundedRect(x, y0, w, y1 - y0, 6);
  if (r > 0) {
    const h = Math.max(8, (y1 - y0) * r);
    g.fillStyle(KIT.gold, 1);
    g.fillRoundedRect(x, y1 - h, w, h, 6);
  }
  // r=0（每局开局）时也要保证旗帜完整可见：clamp 上下各留半个旗高
  return Math.min(y1 - 40, Math.max(y0 + 40, y1 - (y1 - y0) * r));
}
