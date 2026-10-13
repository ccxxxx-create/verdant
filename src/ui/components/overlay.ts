import Phaser from 'phaser';
import { typography, hexToInt, zIndex, motion, FONT } from '../tokens.ts';
import { KIT, pixelPanel, pixelButton, MOTION_ENABLED } from './kit.ts';

/**
 * 通用弹层（M-UI 统一）：遮罩 + 像素面板对话框 + 按钮组。
 * 暂停 / 胜负结算共用；交互件全部场景级（容器交互陷阱防线），由返回的 handle 统一销毁。
 */

export interface ModalHandle {
  destroy(): void;
}

export interface ModalButton {
  label: string;
  sub?: string;
  accent?: number;
  onClick: () => void;
}

/** 模态对话框：遮罩 + 居中面板 + 标题 + 纵向按钮组（含进场动效）。 */
export function modal(
  scene: Phaser.Scene,
  opts: {
    title: string;
    subtitle?: string;
    width?: number;
    height?: number;
    buttons: ModalButton[];
    depth?: number;
  },
): ModalHandle {
  const { width: W, height: H } = scene.scale.gameSize;
  const depth = opts.depth ?? zIndex.overlay;
  const pw = opts.width ?? 520;
  const ph = opts.height ?? 340;
  const px = Math.round((W - pw) / 2);
  const py = Math.round((H - ph) / 2);
  const parts: Phaser.GameObjects.GameObject[] = [];

  const dim = scene.add.rectangle(W / 2, H / 2, W, H, hexToInt(KIT.outlineCss), 0.55).setDepth(depth).setInteractive();
  parts.push(dim);

  const panel = pixelPanel(scene, px, py, pw, ph, { depth: depth + 1, radius: 12 });
  parts.push(panel);

  const title = scene.add
    .text(W / 2, py + 58, opts.title, { ...typography.title, color: KIT.textDark })
    .setOrigin(0.5)
    .setDepth(depth + 2);
  parts.push(title);

  if (opts.subtitle) {
    const sub = scene.add
      .text(W / 2, py + 100, opts.subtitle, { ...typography.caption, color: KIT.textSub })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    parts.push(sub);
  }

  const btnW = pw - 120;
  const btnH = 64;
  const gap = 16;
  const total = opts.buttons.length * btnH + Math.max(0, opts.buttons.length - 1) * gap;
  let by = py + ph - 36 - total;
  for (const b of opts.buttons) {
    const r = pixelButton(scene, px + 60, by, btnW, btnH, b.label, {
      sub: b.sub,
      accent: b.accent,
      depth: depth + 2,
      onClick: b.onClick,
    });
    parts.push(r.container, r.hit);
    by += btnH + gap;
  }

  if (MOTION_ENABLED) {
    dim.setAlpha(0);
    scene.tweens.add({ targets: dim, alpha: 1, duration: motion.transition });
    panel.setAlpha(0).setScale(0.94);
    scene.tweens.add({ targets: panel, alpha: 1, scale: 1, duration: motion.transition, ease: 'Back.easeOut' });
    title.setAlpha(0);
    scene.tweens.add({ targets: title, alpha: 1, duration: motion.transition, delay: 80 });
  }

  return {
    destroy: () => {
      for (const p of parts) p.destroy();
    },
  };
}

/** 结算弹层（胜/负）：星级 + 奖励行 + 返回按钮。 */
export function settlement(
  scene: Phaser.Scene,
  opts: { win: boolean; title: string; stars?: number; lines?: string[]; onContinue: () => void },
): ModalHandle {
  const { width: W, height: H } = scene.scale.gameSize;
  const handle = modal(scene, {
    title: opts.title,
    width: 620,
    height: 420,
    buttons: [{ label: opts.win ? '回到巡野图' : '回主菜单', accent: KIT.woodLight, onClick: opts.onContinue }],
  });

  const extra: Phaser.GameObjects.GameObject[] = [];
  const cy = H / 2 - 46;
  if (opts.win && typeof opts.stars === 'number') {
    const s = Math.max(0, Math.min(3, opts.stars));
    const starText = '★'.repeat(s) + '☆'.repeat(3 - s);
    extra.push(
      scene.add
        .text(W / 2, cy, starText, { fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color: KIT.goldCss })
        .setOrigin(0.5)
        .setStroke(KIT.outlineCss, 6)
        .setDepth(zIndex.dialog + 2),
    );
  }
  (opts.lines ?? []).forEach((line, i) => {
    extra.push(
      scene.add
        .text(W / 2, cy + 66 + i * 30, line, { ...typography.body, color: KIT.textDark })
        .setOrigin(0.5)
        .setDepth(zIndex.dialog + 2),
    );
  });

  const baseDestroy = handle.destroy;
  return {
    destroy: () => {
      for (const e of extra) e.destroy();
      baseDestroy();
    },
  };
}
