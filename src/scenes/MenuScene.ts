import Phaser from 'phaser';
import { palette, worldPalette, typography, radius, motion, hexToInt } from '../ui/tokens.ts';
import { readSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { pixelIcons } from '../data/pixels/icons.ts';
import { bakePixelTexture } from '../render/pixelTexture.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { drawPixelBackdrop, pixelPanel, sceneEnter, breathe, pressable, KIT } from '../ui/components/kit.ts';
import { ALL_LEVELS } from '../data/levels/index.ts';

/** 总单位数（图鉴完成度分母；分母取 GDD 首发 51）。 */
const TOTAL_UNITS = 51;

const FONT = 'system-ui, "PingFang SC", sans-serif';

/**
 * 主界面 Hub（W7-1b 重排：商业游戏主界面范式）：
 * 品牌 Logo（左上）→ 主 CTA 继续冒险（左中）→ 次级功能小卡（CTA 下方）
 * → 主角立绘（右侧氛围锚点）→ 紧凑钱包条（右上）→ 角落工具钮（右下）。
 * 层级：一个主动作（冒险），其余功能全部降级为小入口。
 */
export class MenuScene extends Phaser.Scene {
  private hint?: Phaser.GameObjects.Text;
  private hintTimer?: Phaser.Time.TimerEvent;
  private save?: SaveGame;

  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    this.hint = undefined;
    this.hintTimer?.remove();
    this.hintTimer = undefined;

    for (const [name, sprite] of Object.entries(pixelIcons)) bakePixelTexture(this, `icon_${name}`, sprite, 4);
    ensurePixelTextures(this);
    drawPixelBackdrop(this);
    this.drawSunGlow();
    this.drawFloatingMotes();
    this.drawLogo();
    this.drawHero();
    this.drawPrimaryCta();
    this.drawSecondaryRow();
    this.drawWalletChip(width);
    this.drawCornerButtons(width, height);
    sceneEnter(this);
  }

  // —— 氛围：左上晨光光晕 + 飘浮光露粒子 ——
  private drawSunGlow(): void {
    const g = this.add.graphics().setDepth(1);
    const halo = [0.1, 0.07, 0.045];
    halo.forEach((a, i) => {
      g.fillStyle(0xffe9a8, a);
      g.fillCircle(230, 190, 190 + i * 110);
    });
    g.fillStyle(0xfff3c4, 0.5);
    g.fillCircle(230, 190, 64);
  }

  private drawFloatingMotes(): void {
    const colors = [0xfff3c4, 0xf7ce6b, 0xe9f2e6];
    for (let i = 0; i < 12; i++) {
      const x = 140 + (i * 173) % 1500;
      const y = 220 + ((i * 97) % 520);
      const r = 3 + (i % 3) * 2;
      const dot = this.add.circle(x, y, r, colors[i % 3] ?? 0xfff3c4, 0.75).setDepth(1);
      this.tweens.add({
        targets: dot,
        y: y - 46 - (i % 4) * 14,
        x: x + ((i % 2 === 0 ? 1 : -1) * (18 + (i % 3) * 10)),
        alpha: { from: 0.35, to: 0.9 },
        duration: 3400 + (i % 5) * 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // —— 品牌 Logo（左上） ——
  private drawLogo(): void {
    const c = this.add.container(96, 66).setDepth(3);
    // 投影层
    c.add(this.add.text(4, 6, '长 夏', { fontFamily: FONT, fontSize: '104px', fontStyle: 'bold', color: '#1E3A2E' }).setOrigin(0, 0.5).setAlpha(0.35));
    // 主字（金 + 深描边）
    c.add(
      this.add
        .text(0, 0, '长 夏', { fontFamily: FONT, fontSize: '104px', fontStyle: 'bold', color: '#F2C14E' })
        .setOrigin(0, 0.5)
        .setStroke('#26402F', 10),
    );
    c.add(
      this.add
        .text(8, 78, 'VERDANT · 晨雾草原', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#26402F' })
        .setOrigin(0, 0.5)
        .setAlpha(0.85),
    );
    this.tweens.add({ targets: c, y: 70, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // —— 主角立绘（右侧视觉锚点） ——
  private drawHero(): void {
    const cx = 1500;
    const cy = 640;
    const shadow = this.add.ellipse(cx, cy + 196, 360, 56, 0x1e3a2e, 0.28).setDepth(2);
    void shadow;
    const hero = this.add.image(cx, cy, 'unit_firefly_reed').setScale(3.4).setDepth(3);
    this.tweens.add({
      targets: hero,
      y: cy - 12,
      scaleY: 3.4 * 1.015,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // 伴生小单位（层次感）
    const side = this.add.image(cx - 220, cy + 130, 'unit_thorn_pea').setScale(1.9).setDepth(3);
    this.tweens.add({
      targets: side,
      scaleY: 1.9 * 1.03,
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 400,
    });
    // 底座草簇
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x4e7e5c, 1);
    for (let i = 0; i < 7; i++) {
      const gx = cx - 190 + i * 64;
      g.fillTriangle(gx, cy + 190, gx + 12, cy + 156, gx + 24, cy + 190);
    }
  }

  // —— 主 CTA：继续/开始冒险（左中） ——
  private drawPrimaryCta(): void {
    const save = this.save;
    const cleared = save ? save.progress.clearedLevels.length : 0;
    const hasProgress = cleared > 0;
    const label = hasProgress ? '继 续 冒 险' : '开 始 冒 险';
    const stars = save ? Object.values(save.progress.stars).reduce((a, b) => a + b, 0) : 0;
    const sub = hasProgress ? `晨雾草原 · 已通关 ${cleared}/${ALL_LEVELS.length} · ★${stars}` : '晨雾草原 · 一切布防从这里开始';

    const x = 120;
    const y = 430;
    const w = 470;
    const h = 118;
    const c = this.add.container(x, y).setDepth(3);
    const g = this.add.graphics();
    g.fillStyle(KIT.shadow, 0.4);
    g.fillRoundedRect(0, 7, w, h, 8);
    g.fillStyle(0x6fbf83, 1);
    g.fillRoundedRect(0, 0, w, h, 8);
    g.fillStyle(0x8fd4a0, 1);
    g.fillRoundedRect(0, 0, w, 14, 8);
    g.lineStyle(4, KIT.outline, 1);
    g.strokeRoundedRect(0, 0, w, h, 8);
    c.add(g);
    c.add(
      this.add
        .text(w / 2, 42, label, { fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: '#FFFFFF' })
        .setOrigin(0.5)
        .setStroke('#26402F', 7),
    );
    c.add(this.add.text(w / 2, 92, sub, { fontFamily: FONT, fontSize: '15px', color: '#E9F5EC' }).setOrigin(0.5));
    this.tweens.add({ targets: c, scale: { from: 1, to: 1.015 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const hit = this.add.zone(x, y, w, h).setOrigin(0, 0).setDepth(4).setInteractive({ useHandCursor: true });
    pressable(this, hit, c, true);
    hit.on('pointerup', () => this.scene.start('Map'));

    // CTA 侧翼小进度条
    const bw = 470;
    const pb = this.add.graphics().setDepth(3);
    const progress = Math.min(1, cleared / Math.max(1, ALL_LEVELS.length));
    pb.fillStyle(KIT.outline, 0.18);
    pb.fillRoundedRect(x, y + h + 12, bw, 10, 5);
    pb.fillStyle(0xd9a53a, 1);
    pb.fillRoundedRect(x, y + h + 12, Math.max(10, bw * progress), 10, 5);
  }

  // —— 次级功能小卡（CTA 下方三卡） ——
  private drawSecondaryRow(): void {
    const modes: { label: string; icon: string; color: number; action: 'codex' | 'shop' | 'draw' }[] = [
      { label: '图鉴', icon: 'book', color: 0xd9a53a, action: 'codex' },
      { label: '商店', icon: 'coin', color: 0x6fa8c9, action: 'shop' },
      { label: '抽奖', icon: 'seed', color: 0x9b8cd9, action: 'draw' },
    ];
    const cw = 148;
    const ch = 148;
    const gap = 13;
    const y = 640;
    modes.forEach((m, i) => {
      const x = 120 + i * (cw + gap);
      const card = pixelPanel(this, x, y, cw, ch, { depth: 3, stroke: m.color });
      card.add(this.add.image(cw / 2, 52, `icon_${m.icon}`).setDisplaySize(56, 56));
      card.add(this.add.text(cw / 2, 112, m.label, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: KIT.textDark }).setOrigin(0.5));
      const hit = this.add.zone(x, y, cw, ch).setOrigin(0, 0).setDepth(4).setInteractive({ useHandCursor: true });
      pressable(this, hit, card, true);
      hit.on('pointerup', () => {
        if (m.action === 'codex') this.scene.start('Codex');
        else if (m.action === 'shop') this.scene.start('Shop');
        else this.scene.start('Draw');
      });
    });
  }

  // —— 右上紧凑状态条（星星 + 四资产单行） ——
  private drawWalletChip(width: number): void {
    const save = this.save;
    const stars = save ? Object.values(save.progress.stars).reduce((a, b) => a + b, 0) : 0;
    const unlocked = save ? save.progress.unlockedUnits.length : 0;
    const w = 620;
    const x = width - w - 60;
    const y = 44;
    pixelPanel(this, x, y, w, 64, { depth: 3, radius: 4 });
    const cy = y + 32;
    let cx = x + 30;
    this.add.image(cx, cy, 'icon_trophy').setDisplaySize(26, 26).setDepth(4);
    this.add.text(cx + 20, cy, `${stars}`, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#B8860B' }).setOrigin(0, 0.5).setDepth(4);
    cx += 96;
    this.add.image(cx, cy, 'icon_book').setDisplaySize(24, 24).setDepth(4);
    this.add.text(cx + 20, cy, `${unlocked}/${TOTAL_UNITS}`, { fontFamily: FONT, fontSize: '17px', color: KIT.textDark }).setOrigin(0, 0.5).setDepth(4);
    cx += 118;
    const wallet: [string, string][] = [
      ['icon_coin', 'coins'],
      ['icon_diamond', 'diamonds'],
      ['icon_seed', 'seeds'],
      ['icon_energy', 'plantFood'],
    ];
    wallet.forEach(([icon, key]) => {
      this.add.image(cx, cy, icon).setDisplaySize(26, 26).setDepth(4);
      this.add
        .text(cx + 20, cy, `${save?.wallet[key as keyof typeof save.wallet] ?? 0}`, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: KIT.textDark })
        .setOrigin(0, 0.5)
        .setDepth(4);
      cx += 104;
    });
  }

  // —— 右下角工具钮（设置/音效/关于） ——
  private drawCornerButtons(width: number, height: number): void {
    const items: { icon: string; msg: string }[] = [
      { icon: 'settings', msg: '设置场景（音量/画质/触控布局）在 M2 开放' },
      { icon: 'sound', msg: 'WebAudio 程序化音效在 M6 落地' },
      { icon: 'info', msg: 'Verdant《长夏》· 文档见 docs/GDD.md' },
    ];
    const size = 60;
    const gap = 14;
    items.forEach((it, i) => {
      const x = width - 60 - (items.length - i) * (size + gap) + gap;
      const y = height - size - 28;
      const panel = pixelPanel(this, x, y, size, size, { depth: 3, radius: 4 });
      panel.setAlpha(0.9);
      panel.add(this.add.image(size / 2, size / 2, `icon_${it.icon}`).setDisplaySize(30, 30));
      const hit = this.add.zone(x, y, size, size).setOrigin(0, 0).setDepth(4).setInteractive({ useHandCursor: true });
      pressable(this, hit, panel, true);
      hit.on('pointerup', () => this.showHint(x + size / 2, y - 24, it.msg));
    });
  }

  private showHint(x: number, y: number, msg: string): void {
    this.hintTimer?.remove();
    if (!this.hint) {
      this.hint = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: palette.bgDeep }).setOrigin(0.5).setAlpha(0);
    }
    this.hint.setPosition(x, y).setText(msg).setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 0.75, duration: motion.transition });
    this.hintTimer = this.time.delayedCall(2600, () => {
      if (this.hint) this.tweens.add({ targets: this.hint, alpha: 0, duration: motion.transition });
    });
  }
}
