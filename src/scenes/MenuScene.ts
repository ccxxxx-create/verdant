import Phaser from 'phaser';
import { palette, typography, motion, zIndex } from '../ui/tokens.ts';
import { readSave, writeSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { GAME_VERSION } from '../core/version.ts';
import { CURRENT_NOTE } from '../data/patchNotes.ts';
import { pixelIcons } from '../data/pixels/icons.ts';
import { bakePixelTexture } from '../render/pixelTexture.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { drawPixelBackdrop, pixelPanel, progressBar, sceneEnter, breathe, pressable, hoverable, KIT, MOTION_ENABLED } from '../ui/components/kit.ts';
import { modal, type ModalHandle } from '../ui/components/overlay.ts';
import { setMotionPreference } from '../ui/settings.ts';
import { openRedeemDialog } from '../ui/redeem.ts';
import { ALL_LEVELS } from '../data/levels/index.ts';

/** 总单位数（图鉴完成度分母；分母取 GDD 首发 51）。 */
const TOTAL_UNITS = 51;

/**
 * 主界面 Hub（W7-1b 重排：商业游戏主界面范式）：
 * 品牌 Logo（左上）→ 主 CTA 继续冒险（左中）→ 次级功能小卡（CTA 下方）
 * → 主角立绘（右侧氛围锚点）→ 紧凑钱包条（右上）→ 角落工具钮（右下）。
 * 层级：一个主动作（冒险），其余功能全部降级为小入口。
 */
export class MenuScene extends Phaser.Scene {
  private hint?: Phaser.GameObjects.Text;
  private hintTimer?: Phaser.Time.TimerEvent;
  private settingsModal?: ModalHandle;
  private patchModal?: ModalHandle;
  private save?: SaveGame;
  /** 右上钱包条的数值文本引用（兑换码发放后原地刷新，避免整场景重启）。 */
  private walletValueTexts: { key: string; text: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    this.hint = undefined;
    this.hintTimer?.remove();
    this.hintTimer = undefined;
    this.settingsModal?.destroy();
    this.settingsModal = undefined;
    this.patchModal?.destroy();
    this.patchModal = undefined;
    this.walletValueTexts = [];

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
    this.drawGearButton(width);
    this.drawCornerButtons(width, height);
    this.maybeShowPatchNotes();
    sceneEnter(this);
  }

  /**
   * 更新公告（用户拍板 2026-10-15 修订：所有玩家每次更新都弹一次，含首启新玩家）。
   * 判据：patchSeen ≠ GAME_VERSION（新档与升级档同为 ''）。确认后写回存档，同版本不再弹。
   */
  private maybeShowPatchNotes(): void {
    const save = this.save;
    if (!save) return;
    if (save.patchSeen === GAME_VERSION) return;

    const note = CURRENT_NOTE;
    const { width: W, height: H } = this.scale.gameSize;
    const pw = 640;
    const ph = 470;
    // py 与 modal() 内部同法计算（面板垂直位置），正文文本水平居中故无需 px
    const py = Math.round((H - ph) / 2);

    this.patchModal = modal(this, {
      title: `更新公告 · v${note.version}`,
      subtitle: note.date,
      width: pw,
      height: ph,
      buttons: [
        {
          label: '知道了',
          accent: KIT.woodLight,
          onClick: () => {
            save.patchSeen = GAME_VERSION;
            writeSave(window.localStorage, save);
            this.patchModal?.destroy();
            this.patchModal = undefined;
          },
        },
      ],
    });

    // modal 无正文区，仿 settlement 在面板上补条目文本（坐标须与 modal 的 px/py 同法计算）
    const extra: Phaser.GameObjects.GameObject[] = note.lines.map((line, i) =>
      this.add
        .text(W / 2, py + 146 + i * 34, line, { ...typography.body, color: KIT.textDark })
        .setOrigin(0.5)
        .setDepth(zIndex.dialog + 2),
    );
    const base = this.patchModal;
    this.patchModal = {
      destroy: () => {
        for (const e of extra) e.destroy();
        base?.destroy();
      },
    };
  }

  // —— 氛围：左上晨光光晕 + 飘浮光露粒子 ——
  private drawSunGlow(): void {
    const g = this.add.graphics().setDepth(1);
    const halo = [0.1, 0.07, 0.045];
    halo.forEach((a, i) => {
      g.fillStyle(KIT.sunGlow, a);
      g.fillCircle(230, 190, 190 + i * 110);
    });
    g.fillStyle(KIT.sunCore, 0.5);
    g.fillCircle(230, 190, 64);
  }

  private drawFloatingMotes(): void {
    if (!MOTION_ENABLED) return; // 减弱动态：不生成氛围粒子
    const colors = [KIT.sunCore, KIT.moteWarm, KIT.moteCool];
    for (let i = 0; i < 12; i++) {
      const x = 140 + (i * 173) % 1500;
      const y = 220 + ((i * 97) % 520);
      const r = 3 + (i % 3) * 2;
      const dot = this.add.circle(x, y, r, colors[i % 3] ?? KIT.sunCore, 0.75).setDepth(1);
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
    c.add(this.add.text(4, 6, '长 夏', { ...typography.brand, color: KIT.shadowCss }).setOrigin(0, 0.5).setAlpha(0.35));
    // 主字（金 + 深描边）
    c.add(
      this.add
        .text(0, 0, '长 夏', { ...typography.brand, color: KIT.accentCss })
        .setOrigin(0, 0.5)
        .setStroke(KIT.outlineCss, 10),
    );
    c.add(
      this.add
        .text(8, 78, 'VERDANT · 晨雾草原', { ...typography.subheading, color: KIT.outlineCss })
        .setOrigin(0, 0.5)
        .setAlpha(0.85),
    );
    if (MOTION_ENABLED) this.tweens.add({ targets: c, y: 70, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // —— 主角立绘（右侧视觉锚点） ——
  private drawHero(): void {
    const cx = 1500;
    const cy = 640;
    const shadow = this.add.ellipse(cx, cy + 196, 360, 56, KIT.shadow, 0.28).setDepth(2);
    void shadow;
    const hero = this.add.image(cx, cy, 'unit_firefly_reed').setScale(3.4).setDepth(3);
    if (MOTION_ENABLED) {
      this.tweens.add({
        targets: hero,
        y: cy - 12,
        scaleY: 3.4 * 1.015,
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    // 伴生小单位（层次感）
    const side = this.add.image(cx - 220, cy + 130, 'unit_thorn_pea').setScale(1.9).setDepth(3);
    if (MOTION_ENABLED) {
      this.tweens.add({
        targets: side,
        scaleY: 1.9 * 1.03,
        duration: 1900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 400,
      });
    }
    // 底座草簇
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(KIT.grassDeep, 1);
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
    g.fillStyle(KIT.success, 1);
    g.fillRoundedRect(0, 0, w, h, 8);
    g.fillStyle(KIT.successLight, 1);
    g.fillRoundedRect(0, 0, w, 14, 8);
    g.lineStyle(4, KIT.outline, 1);
    g.strokeRoundedRect(0, 0, w, h, 8);
    c.add(g);
    // 一级动作升到 display(48)：此前与页标题同号(34)，主次被压平
    c.add(
      this.add
        .text(w / 2, 46, label, { ...typography.display, color: KIT.onAccent })
        .setOrigin(0.5)
        .setStroke(KIT.outlineCss, 8),
    );
    c.add(this.add.text(w / 2, 100, sub, { ...typography.body, color: KIT.onAccentSoft }).setOrigin(0.5));
    if (MOTION_ENABLED) this.tweens.add({ targets: c, scale: { from: 1, to: 1.015 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const hit = this.add.zone(x, y, w, h).setOrigin(0, 0).setDepth(4).setInteractive({ useHandCursor: true });
    pressable(this, hit, c, true);
    hit.on('pointerup', () => this.scene.start('Map'));

    // CTA 侧翼小进度条（统一走 kit.progressBar）
    const bw = 470;
    const progress = Math.min(1, cleared / Math.max(1, ALL_LEVELS.length));
    progressBar(this, x, y + h + 12, bw, 10, progress, { fill: KIT.goldMid, depth: 3 });
  }

  // —— 次级功能小卡（CTA 下方三卡） ——
  private drawSecondaryRow(): void {
    const modes: { label: string; icon: string; color: number; action: 'codex' | 'shop' | 'draw' | 'inventory' }[] = [
      { label: '图鉴', icon: 'book', color: KIT.goldMid, action: 'codex' },
      { label: '商店', icon: 'coin', color: KIT.accentBlue, action: 'shop' },
      { label: '抽奖', icon: 'seed', color: KIT.diamond, action: 'draw' },
      { label: '背包', icon: 'bag', color: KIT.success, action: 'inventory' },
    ];
    const cw = 148;
    const ch = 148;
    const gap = 13;
    const y = 640;
    modes.forEach((m, i) => {
      const x = 120 + i * (cw + gap);
      const card = pixelPanel(this, x, y, cw, ch, { depth: 3, stroke: m.color });
      card.add(this.add.image(cw / 2, 52, `icon_${m.icon}`).setDisplaySize(56, 56));
      card.add(this.add.text(cw / 2, 112, m.label, { ...typography.heading, color: KIT.textDark }).setOrigin(0.5));
      const hit = this.add.zone(x, y, cw, ch).setOrigin(0, 0).setDepth(4).setInteractive({ useHandCursor: true });
      pressable(this, hit, card, true);
      hoverable(this, hit, card); // 次级卡此前无悬停反馈
      hit.on('pointerup', () => {
        if (m.action === 'codex') this.scene.start('Codex');
        else if (m.action === 'shop') this.scene.start('Shop');
        else if (m.action === 'draw') this.scene.start('Draw');
        else this.scene.start('Inventory');
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
    this.add.text(cx + 20, cy, `${stars}`, { ...typography.body, fontStyle: 'bold', color: KIT.goldDeepCss }).setOrigin(0, 0.5).setDepth(4);
    cx += 96;
    this.add.image(cx, cy, 'icon_book').setDisplaySize(24, 24).setDepth(4);
    this.add.text(cx + 20, cy, `${unlocked}/${TOTAL_UNITS}`, { ...typography.body, color: KIT.textDark }).setOrigin(0, 0.5).setDepth(4);
    cx += 118;
    const wallet: [string, string][] = [
      ['icon_coin', 'coins'],
      ['icon_diamond', 'diamonds'],
      ['icon_seed', 'seeds'],
      ['icon_energy', 'plantFood'],
    ];
    wallet.forEach(([icon, key]) => {
      this.add.image(cx, cy, icon).setDisplaySize(26, 26).setDepth(4);
      const valueText = this.add
        .text(cx + 20, cy, `${save?.wallet[key as keyof typeof save.wallet] ?? 0}`, { ...typography.body, fontStyle: 'bold', color: KIT.textDark })
        .setOrigin(0, 0.5)
        .setDepth(4);
      this.walletValueTexts.push({ key, text: valueText });
      cx += 104;
    });
  }

  /** 兑换/购买后原地刷新钱包数值（避免整场景重启）。 */
  private refreshWallet(): void {
    const wallet = this.save?.wallet;
    for (const { key, text } of this.walletValueTexts) {
      text.setText(`${wallet ? (wallet[key as keyof typeof wallet] ?? 0) : 0}`);
    }
  }

  // —— 右上顶栏齿轮（设置入口；标准商业手游形态，热区 108×64 ≥ 48px） ——
  private drawGearButton(width: number): void {
    const w = 108;
    const h = 64;
    const x = width - 620 - 60 - w - 12;
    const y = 44;
    const panel = pixelPanel(this, x, y, w, h, { depth: 3, radius: 4 });
    panel.add(this.add.image(34, h / 2, 'icon_settings').setDisplaySize(30, 30));
    panel.add(this.add.text(62, h / 2, '设置', { ...typography.body, fontStyle: 'bold', color: KIT.textDark }).setOrigin(0, 0.5));
    const hit = this.add.zone(x, y, w, h).setOrigin(0, 0).setDepth(4).setInteractive({ useHandCursor: true });
    pressable(this, hit, panel, true);
    hit.on('pointerup', () => this.openSettings());
  }

  // —— 右下角工具钮（音效/关于；设置已移到右上顶栏齿轮） ——
  private drawCornerButtons(width: number, height: number): void {
    const items: { icon: string; msg: string }[] = [
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

  /** 设置面板（多分区：表现与可访问性 / 兑换码 / 关闭）。 */
  private openSettings(): void {
    const save = this.save;
    if (!save) return;
    this.settingsModal?.destroy();
    this.settingsModal = modal(this, {
      title: '设置',
      subtitle: '长夏 · 表现与可访问性 · 文档见 docs/GDD.md',
      width: 640,
      height: 400,
      buttons: [
        {
          label: `减弱动态：${save.settings.motion ? '开' : '关'}`,
          sub: '关闭后不再播放常驻循环动效与氛围粒子',
          onClick: () => {
            setMotionPreference(save, !save.settings.motion);
            // 立即生效：重启主界面，让常驻循环动效按新开关重建（审查 P1-2）
            this.tweens.killAll();
            this.scene.restart();
          },
        },
        {
          label: '兑换码',
          sub: '输入兑换码领取金币 / 钻石 / 道具',
          accent: KIT.gold,
          onClick: () => {
            openRedeemDialog(this, save, { onGranted: () => this.refreshWallet() });
          },
        },
        {
          label: '关闭',
          onClick: () => {
            this.settingsModal?.destroy();
            this.settingsModal = undefined;
          },
        },
      ],
    });
  }

  private showHint(x: number, y: number, msg: string): void {
    this.hintTimer?.remove();
    if (!this.hint) {
      // 必须压在内容层之上，否则提示会被 depth 3 的立绘/卡片盖住
      this.hint = this.add
        .text(0, 0, '', { ...typography.caption, color: palette.bgDeep })
        .setOrigin(0.5)
        .setDepth(zIndex.overlay + 2)
        .setAlpha(0);
    }
    this.hint.setPosition(x, y).setText(msg).setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 0.75, duration: motion.transition });
    this.hintTimer = this.time.delayedCall(2600, () => {
      if (this.hint) this.tweens.add({ targets: this.hint, alpha: 0, duration: motion.transition });
    });
  }
}
