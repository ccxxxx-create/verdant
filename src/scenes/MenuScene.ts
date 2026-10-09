import Phaser from 'phaser';
import { palette, worldPalette, typography, radius, motion, withAlpha, hexToInt } from '../ui/tokens.ts';
import { readSave, writeSave, type SaveStorage } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { LevelDef } from '../core/schema/level.ts';
import { pixelIcons } from '../data/pixels/icons.ts';
import { bakePixelTexture } from '../render/pixelTexture.ts';
import level11 from '../data/levels/meadow-1-1.json';

/** 总单位数（图鉴完成度分母；M1B 仅草原 13，分母取 GDD 首发 51）。 */
const TOTAL_UNITS = 51;

/**
 * 主界面 Hub（M1B C6，PvZ2 式常驻导航壳）：
 * 顶部资源条（玩家档卡+星星+图鉴完成度）→ 中央巡野图入口卡 → 模式入口行 → 底部功能条。
 * 层级纪律：hub 不做关卡节点（巡野图本体 M2）；对局逻辑 M1。
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

    for (const [name, sprite] of Object.entries(pixelIcons)) bakePixelTexture(this, `icon_${name}`, sprite, 4);
    this.drawBackdrop(width);
    this.drawTopBar(width);
    this.drawAdventureCard(width);
    this.drawModeRow(width);
    this.drawBottomBar(width, height);
  }

  // —— 背景：纯色底 + 像素网格点阵（像素风签名） ——
  private drawBackdrop(width: number): void {
    const g = this.add.graphics();
    for (let x = 40; x < width; x += 80) {
      for (let y = 40; y < 1040; y += 80) {
        g.fillStyle(0x1e4a3b, 1);
        g.fillRect(x, y, 4, 4);
      }
    }
  }

  // —— 顶部：玩家档卡 + 资源 ——
  private drawTopBar(width: number): void {
    const save = this.save;
    const stars = save ? Object.values(save.progress.stars).reduce((a, b) => a + b, 0) : 0;
    const unlocked = save ? save.progress.unlockedUnits.length : 0;
    const completion = Math.round((unlocked / TOTAL_UNITS) * 100);
    const level = 1 + Math.floor(stars / 10);
    const xpInLevel = (stars % 10) / 10;

    const bar = this.add.container(60, 44);
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.72);
    g.fillRoundedRect(0, 0, width - 120, 96, radius.lg);
    g.lineStyle(2, hexToInt(palette.bgDeep), 0.12);
    g.strokeRoundedRect(0, 0, width - 120, 96, radius.lg);
    bar.add(g);

    // 头像（露珠徽记复用）
    bar.add(this.add.image(56, 48, 'icon_sprout').setDisplaySize(56, 56));
    bar.add(this.add.text(100, 30, '看火人', { ...typography.heading, color: palette.bgDeep }));
    // 等级胶囊 + 经验条
    const lvG = this.add.graphics();
    lvG.fillStyle(Phaser.Display.Color.HexStringToColor(palette.primaryDeep).color, 1);
    lvG.fillRoundedRect(216, 22, 64, 28, radius.sm);
    bar.add(lvG);
    bar.add(this.add.text(248, 37, `Lv.${level}`, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#FFFFFF' }).setOrigin(0.5));
    const xpBg = this.add.graphics();
    xpBg.fillStyle(hexToInt(palette.bgDeep), 0.15);
    xpBg.fillRoundedRect(296, 32, 200, 10, radius.sm);
    bar.add(xpBg);
    const xpFg = this.add.graphics();
    xpFg.fillStyle(Phaser.Display.Color.HexStringToColor(palette.accent).color, 1);
    xpFg.fillRoundedRect(296, 32, Math.max(10, 200 * xpInLevel), 10, radius.sm);
    bar.add(xpFg);
    bar.add(this.add.text(296, 60, `还需 ${10 - (stars % 10)} 星升级`, { ...typography.caption, color: palette.bgDeep }).setAlpha(0.55));

    // 资源：星星 + 图鉴完成度
    bar.add(this.add.text(width - 380, 30, `★ 星星 ${stars}`, { ...typography.body, color: palette.bgDeep }));
    bar.add(this.add.text(width - 380, 60, `📖 图鉴 ${unlocked}/${TOTAL_UNITS}（${completion}%）`, { ...typography.caption, color: palette.bgDeep }).setAlpha(0.7));
  }

  // —— 中央：巡野图入口大卡 ——
  private drawAdventureCard(width: number): void {
    const save = this.save;
    const cleared = save ? save.progress.clearedLevels.length : 0;
    const totalLevels = 131;
    const progress = Math.min(1, cleared / 32);

    const cw = 1100;
    const ch = 400;
    const cx = (width - cw) / 2;
    const cy = 180;
    const card = this.add.container(cx, cy);
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.8);
    g.fillRoundedRect(0, 0, cw, ch, radius.lg);
    g.lineStyle(3, Phaser.Display.Color.HexStringToColor(worldPalette.meadow).color, 1);
    g.strokeRoundedRect(0, 0, cw, ch, radius.lg);
    card.add(g);
    card.add(this.add.image(cw / 2, 150, 'icon_mountain').setDisplaySize(128, 128));
    card.add(
      this.add.text(cw / 2, 250, '巡 野 图', {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: palette.primaryDeep,
      }).setOrigin(0.5),
    );
    card.add(
      this.add
        .text(cw / 2, 306, `晨雾草原 · 第 1 世界 · 进度 ${cleared}/${totalLevels}`, { ...typography.body, color: palette.bgDeep })
        .setOrigin(0.5)
        .setAlpha(0.75),
    );
    // 进度条
    const bw = 520;
    const pb = this.add.graphics();
    pb.fillStyle(hexToInt(palette.bgDeep), 0.12);
    pb.fillRoundedRect(cw / 2 - bw / 2, 340, bw, 12, radius.sm);
    pb.fillStyle(Phaser.Display.Color.HexStringToColor(worldPalette.meadow).color, 1);
    pb.fillRoundedRect(cw / 2 - bw / 2, 340, Math.max(12, bw * progress), 12, radius.sm);
    card.add(pb);

    const hit = this.add.zone(0, 0, cw, ch).setOrigin(0, 0);
    card.add(hit);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => card.setScale(1.01));
    hit.on('pointerout', () => card.setScale(1));
    hit.on('pointerup', () => this.showHint(cx + cw / 2, cy + ch + 34, '巡野图（关卡地图）在 M2 开放 · DEV-PLAN §5'));
  }

  // —— 模式入口行 ——
  private drawModeRow(width: number): void {
    const modes: { label: string; sub: string; color: string; ready: boolean; icon: string; action: 'battle' | 'codex' | 'hint' }[] = [
      { label: '冒险', sub: '晨雾草原 · 1-1', color: palette.primary, ready: true, icon: 'sprout', action: 'battle' },
      { label: '图鉴', sub: '51 生灵 / 44 怪兽', color: palette.accent, ready: true, icon: 'book', action: 'codex' },
      { label: '竞技场', sub: 'M6 规划中', color: palette.reef, ready: false, icon: 'skull', action: 'hint' },
      { label: '每日挑战', sub: 'BACKLOG', color: palette.sky, ready: false, icon: 'calendar', action: 'hint' },
    ];
    const bw = 360;
    const bh = 150;
    const gap = 32;
    const startX = (width - (bw * 4 + gap * 3)) / 2;
    const y = 640;
    modes.forEach((m, i) => {
      const btn = this.add.container(startX + i * (bw + gap), y);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, m.ready ? 0.8 : 0.45);
      g.fillRoundedRect(0, 0, bw, bh, radius.lg);
      g.lineStyle(3, hexToInt(m.ready ? m.color : palette.bgDeep), m.ready ? 1 : 0.2);
      g.strokeRoundedRect(0, 0, bw, bh, radius.lg);
      btn.add(g);
      btn.add(this.add.image(bw / 2, 46, `icon_${(m.icon ?? 'sprout')}`).setDisplaySize(48, 48));
      btn.add(
        this.add
          .text(bw / 2, 88, m.label, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '26px', fontStyle: 'bold', color: m.ready ? palette.bgDeep : withAlpha(palette.bgDeep, 0.45) })
          .setOrigin(0.5),
      );
      btn.add(
        this.add
          .text(bw / 2, 120, m.sub, { ...typography.caption, color: palette.bgDeep })
          .setOrigin(0.5)
          .setAlpha(m.ready ? 0.6 : 0.35),
      );
      const hit = this.add.zone(0, 0, bw, Math.max(bh, 48)).setOrigin(0, 0);
      btn.add(hit);
      hit.setInteractive({ useHandCursor: m.ready });
      hit.on('pointerover', () => m.ready && this.tweens.add({ targets: btn, scale: 1.02, duration: motion.feedback }));
      hit.on('pointerout', () => this.tweens.add({ targets: btn, scale: 1, duration: motion.feedback }));
      hit.on('pointerup', () => {
        if (m.action === 'codex') {
          this.scene.start('Codex');
          return;
        }
        if (m.action === 'battle') {
          const parsed = LevelDef.safeParse(level11);
          if (parsed.success) {
            this.registry.set('level', parsed.data);
            this.scene.start('Battle');
          } else {
            this.showHint(width / 2, y + bh + 34, '关卡数据校验失败（见控制台）');
            console.error('[level] invalid meadow-1-1:', parsed.error.issues);
          }
          return;
        }
        this.showHint(width / 2, y + bh + 34, `${m.label}在后续里程碑开放（docs/BACKLOG.md）`);
      });
    });
  }

  // —— 底部功能条 ——
  private drawBottomBar(width: number, height: number): void {
    const y = height - 88;
    const items: { label: string; icon: string; ready: boolean; msg: string }[] = [
      { label: '设置', icon: 'settings', ready: false, msg: '设置场景（音量/画质/触控布局）在 M2 开放' },
      { label: '音效', icon: 'sound', ready: false, msg: 'WebAudio 程序化音效在 M6 落地' },
      { label: '关于', icon: 'info', ready: false, msg: 'Verdant · M1B · 文档见 docs/GDD.md' },
    ];
    const bw = 220;
    const gap = 24;
    const startX = (width - (bw * 3 + gap * 2)) / 2;
    items.forEach((it, i) => {
      const btn = this.add.container(startX + i * (bw + gap), y);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.55);
      g.fillRoundedRect(0, 0, bw, 56, radius.md);
      g.lineStyle(2, hexToInt(palette.bgDeep), 0.2);
      g.strokeRoundedRect(0, 0, bw, 56, radius.md);
      btn.add(g);
      btn.add(this.add.image(bw / 2 - 52, 28, `icon_${(it.icon ?? 'settings')}`).setDisplaySize(28, 28));
      btn.add(this.add.text(bw / 2 + 12, 28, it.label, { ...typography.body, color: palette.bgDeep }).setOrigin(0.5).setAlpha(0.8));
      const hit = this.add.zone(0, 0, bw, 56).setOrigin(0, 0);
      btn.add(hit);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.showHint(width / 2, y - 28, it.msg));
    });

    this.add
      .text(width / 2, y + 76, 'VERDANT · v0.1.0 · M1B', { ...typography.caption, color: palette.bgDeep })
      .setOrigin(0.5)
      .setAlpha(0.4);
  }

  private showHint(x: number, y: number, msg: string): void {
    this.hintTimer?.remove();
    if (!this.hint) {
      this.hint = this.add.text(x, y, '', { ...typography.caption, color: palette.bgDeep }).setOrigin(0.5).setAlpha(0);
    }
    this.hint.setPosition(x, y).setText(msg).setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 0.7, duration: motion.transition });
    this.hintTimer = this.time.delayedCall(2600, () => {
      if (this.hint) this.tweens.add({ targets: this.hint, alpha: 0, duration: motion.transition });
    });
  }
}

/** 供设置场景占位引用（避免未用告警的类型导出）。 */
export type { SaveStorage };
