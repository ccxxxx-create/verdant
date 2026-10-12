import Phaser from 'phaser';
import { PALETTE } from '../../data/pixels/palette.ts';
import { typography, hexToInt } from '../tokens.ts';

/**
 * Hub/浅色场景统一组件库（M3B 界面统一 pass）：
 * 与 Battle 场景同一像素语言（PAPER 纸底 + OUTLINE 描边 + 实色偏移投影，无模糊阴影）。
 * 场景只允许经本文件取背景/面板/按钮/钱包条/场景头，禁止散落圆角白卡（形状一致性锁）。
 */

const P = PALETTE as Record<string, string>;
export const KIT = {
  paper: parseInt((P.g ?? '#F5E9C8').replace('#', ''), 16), // 纸底
  paperDeep: parseInt((P.B ?? '#FFF0C2').replace('#', ''), 16),
  outline: parseInt((P.K ?? '#26402F').replace('#', ''), 16), // 描边
  outlineCss: P.K ?? '#26402F',
  wood: parseInt((P.N ?? '#9C6B3C').replace('#', ''), 16),
  woodLight: parseInt((P.n ?? '#C89A5E').replace('#', ''), 16),
  shadow: 0x1e3a2e, // 实色投影（相对纸底压暗，非纯黑）
  skyTop: 0xa9d7ef,
  skyMid: 0xc8e8f4,
  skyLow: 0xe4f2ef,
  cloud: 0xffffff,
  grassLit: 0x8fc07a,
  grass: 0x6fa86b,
  grassDeep: 0x4e7e5c,
  hill: 0xb7d6bd,
  textDark: '#26402F',
  textSub: '#5E7A66',
} as const;

/** 全局动效开关（M6 设置场景"减弱动态"接入点）。 */
export const MOTION_ENABLED = true;

const FONT = 'system-ui, "PingFang SC", sans-serif';

/** 像素场景感背景：带状天空 + 像素云 + 远山 + 双层草地锯齿缘 + 稀疏点阵。 */
export function drawPixelBackdrop(scene: Phaser.Scene): void {
  const { width, height } = scene.scale.gameSize;
  const g = scene.add.graphics().setDepth(0);
  // 带状天空（像素风用色带而非平滑渐变）
  const bands = [KIT.skyTop, KIT.skyMid, KIT.skyLow, KIT.paper];
  const bandH = Math.ceil(900 / bands.length);
  bands.forEach((c, i) => {
    g.fillStyle(c, 1);
    g.fillRect(0, i * bandH, width, bandH + 1);
  });
  // 稀疏点阵（原 80px 满铺 → 160px、alpha 0.05，只在天空区）
  g.fillStyle(KIT.outline, 0.05);
  for (let x = 48; x < width; x += 160) {
    for (let y = 48; y < 760; y += 160) {
      g.fillRect(x, y, 4, 4);
    }
  }
  // 像素云（三朵，固定构图）
  const cloud = (cx: number, cy: number, s: number): void => {
    g.fillStyle(KIT.cloud, 0.9);
    g.fillRect(cx - 44 * s, cy - 10 * s, 88 * s, 20 * s);
    g.fillRect(cx - 22 * s, cy - 24 * s, 48 * s, 18 * s);
    g.fillRect(cx + 10 * s, cy - 18 * s, 34 * s, 14 * s);
    g.fillStyle(0xdceef5, 0.9);
    g.fillRect(cx - 44 * s, cy + 6 * s, 88 * s, 4 * s);
  };
  // 云只放在两侧天空可见带（避开全宽顶栏与中央内容区）
  cloud(230, 215, 1);
  cloud(1690, 215, 0.8);
  // 远山剪影
  g.fillStyle(KIT.hill, 1);
  g.fillTriangle(-120, 940, 260, 820, 620, 940);
  g.fillTriangle(380, 940, 800, 790, 1240, 940);
  g.fillTriangle(1060, 940, 1520, 830, 1960, 940);
  // 草地双层
  g.fillStyle(KIT.grass, 1);
  g.fillRect(0, 940, width, height - 940);
  g.fillStyle(KIT.grassDeep, 1);
  g.fillRect(0, 988, width, height - 988);
  // 草缘锯齿
  g.fillStyle(KIT.grass, 1);
  for (let x = 0; x < width; x += 26) {
    g.fillTriangle(x, 944, x + 13, 926, x + 26, 944);
  }
  g.fillStyle(KIT.grassLit, 1);
  for (let x = 13; x < width; x += 52) {
    g.fillTriangle(x, 943, x + 7, 931, x + 14, 943);
  }
}

/** 像素面板：纸底 + 描边 + 底部实色偏移投影（像素语言禁模糊阴影）。 */
export function pixelPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; stroke?: number; depth?: number; shadow?: boolean; radius?: number } = {},
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(opts.depth ?? 2);
  const g = scene.add.graphics();
  if (opts.shadow !== false) {
    g.fillStyle(KIT.shadow, 0.35);
    g.fillRoundedRect(0, 5, w, h, opts.radius ?? 6);
  }
  g.fillStyle(opts.fill ?? KIT.paper, 0.97);
  g.fillRoundedRect(0, 0, w, h, opts.radius ?? 6);
  g.lineStyle(3, opts.stroke ?? KIT.outline, 1);
  g.strokeRoundedRect(0, 0, w, h, opts.radius ?? 6);
  c.add(g);
  return c;
}

export interface PixelButtonResult {
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Zone;
}

/** 像素按钮：木底/accent 底 + 描边 + 按压反馈；命中区场景级（容器交互陷阱防线）。 */
export function pixelButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  opts: { sub?: string; enabled?: boolean; accent?: number; depth?: number; onClick?: () => void } = {},
): PixelButtonResult {
  const enabled = opts.enabled ?? true;
  const accent = opts.accent ?? KIT.woodLight;
  const c = scene.add.container(x, y).setDepth(opts.depth ?? 3);
  const g = scene.add.graphics();
  g.fillStyle(KIT.shadow, enabled ? 0.35 : 0.2);
  g.fillRoundedRect(0, 5, w, h, 6);
  g.fillStyle(enabled ? accent : 0xb3ad9c, 1);
  g.fillRoundedRect(0, 0, w, h, 6);
  if (enabled) {
    // 顶部高光带（受光面），商业按钮质感的核心一笔
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(4, 3, w - 8, Math.max(8, h * 0.22), 4);
  }
  g.lineStyle(3, KIT.outline, enabled ? 1 : 0.6);
  g.strokeRoundedRect(0, 0, w, h, 6);
  c.add(g);
  c.add(
    scene.add
      .text(w / 2, opts.sub ? h / 2 - 16 : h / 2, label, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: KIT.textDark })
      .setOrigin(0.5),
  );
  if (opts.sub) {
    c.add(scene.add.text(w / 2, h / 2 + 22, opts.sub, { fontFamily: FONT, fontSize: '14px', color: KIT.textDark }).setOrigin(0.5).setAlpha(0.75));
  }
  const hit = scene.add.zone(x, y, w, h).setOrigin(0, 0).setDepth((opts.depth ?? 3) + 1).setInteractive({ useHandCursor: enabled });
  pressable(scene, hit, c, enabled);
  if (enabled && opts.onClick) hit.on('pointerup', opts.onClick);
  return { container: c, hit };
}

/** 按压反馈（game-feel-design：点击即响应，0.97 缩放 + 回弹；hit 与视觉件分离时绑 hit）。 */
export function pressable(scene: Phaser.Scene, hit: Phaser.GameObjects.Zone, target: Phaser.GameObjects.Container, enabled = true): void {
  if (!MOTION_ENABLED || !enabled) return;
  hit.on('pointerdown', () => {
    scene.tweens.add({ targets: target, scale: 0.97, duration: 60, ease: 'Quad.easeOut' });
  });
  const up = (): void => {
    scene.tweens.add({ targets: target, scale: 1, duration: 90, ease: 'Back.easeOut' });
  };
  hit.on('pointerup', up);
  hit.on('pointerout', up);
}

/** 呼吸循环（入口大卡等"活物"感；幅度克制）。 */
export function breathe(scene: Phaser.Scene, target: Phaser.GameObjects.Container, dur = 2200, amplitude = 1.012): void {
  if (!MOTION_ENABLED) return;
  scene.tweens.add({ targets: target, scale: { from: 1, to: amplitude }, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/** 场景进入：纸色淡入（全部场景统一 240ms，避免生硬切换）。 */
export function sceneEnter(scene: Phaser.Scene): void {
  if (!MOTION_ENABLED) return;
  scene.cameras.main.fadeIn(240, 244, 241, 234);
}

/** 统一钱包条：四资产 icon + 数量（三场景同构，PAPER 面板承载）。 */
export const WALLET_ITEMS: [string, string, string][] = [
  ['coins', 'icon_coin', '金币'],
  ['diamonds', 'icon_diamond', '钻石'],
  ['seeds', 'icon_seed', '种子'],
  ['plantFood', 'icon_energy', '能量豆'],
];

export function walletBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  save: { wallet: Record<string, number> } | undefined,
  opts: { depth?: number } = {},
): void {
  const panel = pixelPanel(scene, x, y, w, 88, { depth: opts.depth ?? 2 });
  void panel;
  const h = 88;
  if (!save) {
    scene.add.text(x + w / 2, y + h / 2, '存档读取失败', { ...typography.body, color: KIT.textDark }).setOrigin(0.5).setDepth((opts.depth ?? 2) + 1);
    return;
  }
  const n = WALLET_ITEMS.length;
  const slot = w / (n + 1);
  WALLET_ITEMS.forEach(([key, icon, label], i) => {
    const cx = x + slot * (i + 1);
    const cy = y + h / 2;
    scene.add.image(cx - 66, cy, icon).setDisplaySize(44, 44).setDepth((opts.depth ?? 2) + 1);
    scene.add
      .text(cx - 32, cy - 12, label, { fontFamily: FONT, fontSize: '13px', color: KIT.textSub })
      .setOrigin(0, 0.5)
      .setDepth((opts.depth ?? 2) + 1);
    scene.add
      .text(cx - 32, cy + 12, `×${save.wallet[key] ?? 0}`, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: KIT.textDark })
      .setOrigin(0, 0.5)
      .setDepth((opts.depth ?? 2) + 1);
  });
}

/** 场景头：返回钮 + 描边大标题（与主界面 Logo 同技法）+ 右侧信息（三场景同构）。 */
export function sceneHeader(
  scene: Phaser.Scene,
  title: string,
  opts: { subtitle?: string; depth?: number } = {},
): void {
  const depth = opts.depth ?? 3;
  pixelButton(scene, 60, 52, 148, 56, '← 返回', { depth, onClick: () => scene.scene.start('Menu') });
  // 标题：投影层 + 主层（深字描边），与主菜单 Logo 呼应
  const tx = 236;
  const ty = 80;
  scene.add
    .text(tx + 3, ty + 4, title, { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#1E3A2E' })
    .setOrigin(0, 0.5)
    .setAlpha(0.28)
    .setDepth(depth);
  scene.add
    .text(tx, ty, title, { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: KIT.textDark })
    .setOrigin(0, 0.5)
    .setStroke('#F5E9C8', 6)
    .setDepth(depth);
  if (opts.subtitle) {
    scene.add
      .text(scene.scale.gameSize.width - 60, ty, opts.subtitle, { fontFamily: FONT, fontSize: '14px', color: KIT.textSub })
      .setOrigin(1, 0.5)
      .setDepth(depth);
  }
}

/**
 * 氛围层（四子页共享）：淡晨光光晕 + 少量飘浮光露（Menu 全量档的弱化版，不抢内容）。
 * opts.motes 控制粒子数（默认 7），opts.dim 再压暗一档给内容重的页面（图鉴）。
 */
export function drawAmbient(scene: Phaser.Scene, opts: { motes?: number; dim?: boolean } = {}): void {
  const g = scene.add.graphics().setDepth(1);
  const alpha = opts.dim ? 0.6 : 1;
  g.fillStyle(0xffe9a8, 0.06 * alpha);
  g.fillCircle(210, 170, 260);
  g.fillStyle(0xffe9a8, 0.045 * alpha);
  g.fillCircle(210, 170, 380);
  const colors = [0xfff3c4, 0xf7ce6b, 0xe9f2e6];
  const n = opts.motes ?? 7;
  for (let i = 0; i < n; i++) {
    const x = 120 + (i * 233) % 1600;
    const y = 200 + ((i * 127) % 500);
    const dot = scene.add.circle(x, y, 2.5 + (i % 3), colors[i % 3] ?? 0xfff3c4, 0.55 * alpha).setDepth(1);
    scene.tweens.add({
      targets: dot,
      y: y - 38 - (i % 4) * 12,
      alpha: { from: 0.22, to: 0.6 },
      duration: 3600 + (i % 5) * 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

export { hexToInt, FONT };
