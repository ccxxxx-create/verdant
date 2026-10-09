import Phaser from 'phaser';
import { palette, worldPalette, typography, motion, radius } from '../ui/tokens';

interface WorldCard {
  id: keyof typeof worldPalette;
  name: string;
  sub: string;
}

const WORLDS: readonly WorldCard[] = [
  { id: 'meadow', name: '晨雾草原', sub: '第 1 世界 · M3 量产' },
  { id: 'reef', name: '珊瑚深海', sub: '第 2 世界 · M4 量产' },
  { id: 'sky', name: '天空浮岛', sub: '第 3 世界 · M5 量产' },
  { id: 'frost', name: '冰原霜境', sub: '第 4 世界 · M5 量产' },
];

/**
 * 主菜单（设计方案「雾岬」，见 PLAN-M0 §视觉闸门）：
 * 雾白底 + 签名雾带 + 露珠徽记 + VERDANT 标题 + 四世界路线图 + 主按钮。
 * 单层菜单：不含子界面（M2 做完整 UI 系统）。
 */
export class MenuScene extends Phaser.Scene {
  private hint?: Phaser.GameObjects.Text;
  private hintTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale.gameSize;

    this.drawFogBands(width);
    this.drawHeader(width);
    this.drawWorldCards(width);
    this.drawStartButton(width);
    this.drawFooter(width, height);
  }

  /** 签名元素：三层雾带差速横移（GDD §11.2）。 */
  private drawFogBands(width: number): void {
    const bands: { y: number; alpha: number; scaleY: number; dur: number }[] = [
      { y: 120, alpha: 0.5, scaleY: 1.0, dur: 12000 },
      { y: 520, alpha: 0.4, scaleY: 1.0, dur: 16000 },
      { y: 900, alpha: 0.35, scaleY: 0.8, dur: 18000 },
    ];
    for (const b of bands) {
      const band = this.add.image(width / 2, b.y, 'band_fog').setAlpha(b.alpha).setScale(1, b.scaleY);
      band.x = width / 2 + 60;
      this.tweens.add({
        targets: band,
        x: width / 2 - 60,
        duration: b.dur,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawHeader(width: number): void {
    this.add.image(width / 2, 132, 'icon_lightdew').setScale(0.7);

    this.add
      .text(width / 2, 216, 'VERDANT', { ...typography.display, color: palette.primaryDeep })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 268, '内部代号阶段 · M0 脚手架 · 游戏名待定', { ...typography.body, color: palette.bgDeep })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

  private drawWorldCards(width: number): void {
    const cardW = 380;
    const cardH = 220;
    const gap = 32;
    const total = WORLDS.length * cardW + (WORLDS.length - 1) * gap;
    const startX = (width - total) / 2;
    const top = 380;

    WORLDS.forEach((w, i) => {
      const x = startX + i * (cardW + gap);
      const color = worldPalette[w.id];
      const card = this.add.container(x, top);

      const frame = this.add.graphics();
      frame.fillStyle(0xffffff, 0.72);
      frame.fillRoundedRect(0, 0, cardW, cardH, radius.lg);
      frame.lineStyle(3, Phaser.Display.Color.HexStringToColor(color).color, 1);
      frame.strokeRoundedRect(0, 0, cardW, cardH, radius.lg);
      card.add(frame);

      card.add(this.add.image(cardW / 2, 84, `world_${w.id}`).setScale(0.72));
      card.add(
        this.add
          .text(cardW / 2, 142, w.name, { ...typography.heading, color: palette.bgDeep })
          .setOrigin(0.5),
      );
      card.add(
        this.add
          .text(cardW / 2, 176, w.sub, { ...typography.caption, color: palette.bgDeep })
          .setOrigin(0.5)
          .setAlpha(0.55),
      );
    });
  }

  private drawStartButton(width: number): void {
    const btnW = 320;
    const btnH = 72;
    const cx = width / 2;
    const y = 760;

    const btn = this.add.container(cx - btnW / 2, y);

    const g = this.add.graphics();
    // 常态用雾青深 #3E6156：白字对比度 6.9:1，达小字 4.5:1 硬指标（GDD §10.2 注）。
    const paint = (fill: string, stroke: string, strokeW: number) => {
      g.clear();
      g.fillStyle(Phaser.Display.Color.HexStringToColor(fill).color, 1);
      g.fillRoundedRect(0, 0, btnW, btnH, radius.md);
      g.lineStyle(strokeW, Phaser.Display.Color.HexStringToColor(stroke).color, 1);
      g.strokeRoundedRect(0, 0, btnW, btnH, radius.md);
    };
    paint(palette.primaryDeep, palette.primary, 2);
    btn.add(g);

    const label = this.add
      .text(btnW / 2, btnH / 2, '开始冒险', { ...typography.heading, color: '#FFFFFF' })
      .setOrigin(0.5);
    btn.add(label);

    btn.setSize(btnW, btnH);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      paint(palette.primaryDeep, palette.accent, 4);
      this.tweens.add({ targets: btn, scale: 1.02, duration: motion.feedback, ease: 'Quad.easeOut' });
    });
    btn.on('pointerout', () => {
      paint(palette.primaryDeep, palette.primary, 2);
      this.tweens.add({ targets: btn, scale: 1, duration: motion.feedback, ease: 'Quad.easeOut' });
    });
    btn.on('pointerdown', () => {
      paint(palette.primaryDeep, palette.accent, 4);
      this.tweens.add({ targets: btn, scale: 0.98, duration: motion.feedback, ease: 'Quad.easeOut' });
    });
    btn.on('pointerup', () => {
      paint(palette.primaryDeep, palette.accent, 4);
      this.tweens.add({ targets: btn, scale: 1.02, duration: motion.feedback, ease: 'Quad.easeOut' });
      this.showHint(cx, y + btnH + 28);
    });

    this.hint = this.add
      .text(cx, y + btnH + 28, '', { ...typography.caption, color: palette.bgDeep })
      .setOrigin(0.5)
      .setAlpha(0);
  }

  private showHint(x: number, y: number): void {
    if (!this.hint) return;
    this.hintTimer?.remove();
    this.hint.setPosition(x, y).setText('对局在 M1 开放（见 docs/DEV-PLAN.md）');
    this.tweens.add({ targets: this.hint, alpha: 0.55, duration: motion.transition });
    this.hintTimer = this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: this.hint, alpha: 0, duration: motion.transition });
    });
  }

  private drawFooter(width: number, height: number): void {
    this.add
      .text(width / 2, height - 80, 'VERDANT · v0.1.0 · M0', {
        ...typography.caption,
        color: palette.bgDeep,
      })
      .setOrigin(0.5)
      .setAlpha(0.4);
  }
}
