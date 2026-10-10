import Phaser from 'phaser';
import { allUnits } from '../data/archetypes/index.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { GACHA_COST, rollOnce, rollTen, type GachaPrize } from '../core/gacha.ts';
import { Rng } from '../core/rng.ts';
import { readSave, writeSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { bakePixelTexture } from '../render/pixelTexture.ts';
import { pixelIcons } from '../data/pixels/icons.ts';
import { palette, typography, radius, hexToInt } from '../ui/tokens.ts';

void pixelIcons;

const FONT = 'system-ui, "PingFang SC", sans-serif';
const C_DARK = '#26402F';

const PRIZE_ICON: Record<GachaPrize['kind'], string> = {
  unit: 'icon_seed',
  coins: 'icon_coin',
  diamonds: 'icon_diamond',
  seeds: 'icon_seed',
  plantFood: 'icon_energy',
};
const PRIZE_LABEL: Record<GachaPrize['kind'], string> = {
  unit: '角色',
  coins: '金币',
  diamonds: '钻石',
  seeds: '种子',
  plantFood: '能量豆',
};

/**
 * 抽奖场景（M2 E7）：种子券单抽 + 钻石十连（必出未拥有角色）。
 * 交互纪律：命中 zone 场景级。
 */
export class DrawScene extends Phaser.Scene {
  private save?: SaveGame;
  private rng = new Rng(0x9a1a);
  private lastPrizes: GachaPrize[] = [];

  constructor() {
    super('Draw');
  }

  create(): void {
    ensurePixelTextures(this);
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    const { width } = this.scale.gameSize;
    this.drawBackdrop(width);
    this.drawWallet(width);
    this.drawButtons(width);
    this.drawResult(width);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  private drawBackdrop(width: number): void {
    const g = this.add.graphics();
    for (let x = 40; x < width; x += 80) {
      for (let y = 40; y < 1040; y += 80) {
        g.fillStyle(0x1e4a3b, 1);
        g.fillRect(x, y, 4, 4);
      }
    }
  }

  private drawWallet(width: number): void {
    const wallet = this.save?.wallet;
    const bar = this.add.graphics().setDepth(2);
    bar.fillStyle(0xffffff, 0.85);
    bar.fillRoundedRect(60, 44, width - 120, 96, radius.lg);
    this.add.text(96, 92, '幸运转盘 · 生灵抽奖', { ...typography.heading, fontSize: '28px', color: C_DARK }).setOrigin(0, 0.5).setDepth(3);
    if (!wallet) return;
    const entries: [string, number][] = [
      ['seeds', wallet.seeds],
      ['plantFood', wallet.plantFood],
      ['diamonds', wallet.diamonds],
      ['coins', wallet.coins],
    ];
    entries.forEach(([key, val], i) => {
      const x = width - 820 + i * 200;
      this.add.image(x, 92, `icon_${key === 'seeds' ? 'seed' : key === 'plantFood' ? 'energy' : key === 'diamonds' ? 'diamond' : 'coin'}`).setScale(1.4).setDepth(3);
      this.add.text(x + 52, 92, `×${val}`, { ...typography.body, fontSize: '18px', color: C_DARK }).setOrigin(0, 0.5).setDepth(3);
    });
  }

  private drawButtons(width: number): void {
    const wallet = this.save?.wallet;
    const mkBtn = (label: string, sub: string, x: number, y: number, enabled: boolean, onClick: () => void): void => {
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0xffffff, 0.9);
      g.fillRoundedRect(x, y, 380, 150, radius.lg);
      g.lineStyle(3, hexToInt(enabled ? '#57C173' : '#B3AD9C'), 1);
      g.strokeRoundedRect(x, y, 380, 150, radius.lg);
      this.add.text(x + 190, y + 52, label, { ...typography.heading, fontSize: '26px', color: C_DARK }).setOrigin(0.5).setDepth(3);
      this.add.text(x + 190, y + 100, sub, { ...typography.caption, fontSize: '15px', color: C_DARK }).setOrigin(0.5).setAlpha(0.7).setDepth(3);
      const hit = this.add.zone(x, y, 380, 150).setOrigin(0, 0).setDepth(5).setInteractive({ useHandCursor: enabled });
      hit.on('pointerup', onClick);
    };
    const y = 220;
    mkBtn('单抽', `消耗 1 种子券（现有 ${wallet?.seeds ?? 0}）`, width / 2 - 400, y, (wallet?.seeds ?? 0) >= GACHA_COST.singleSeed, () => this.pullSingle());
    mkBtn('十连', `消耗 ${GACHA_COST.diamondTen} 钻石 · 必出未拥有角色`, width / 2 + 20, y, (wallet?.diamonds ?? 0) >= GACHA_COST.diamondTen, () => this.pullTen());
    this.add.text(width / 2, 420, '概率：金币 40% / 种子 28% / 能量豆 15% / 钻石 9% / 角色 8%', { ...typography.caption, fontSize: '14px', color: C_DARK }).setOrigin(0.5).setAlpha(0.7).setDepth(3);
  }

  private drawResult(width: number): void {
    const panel = this.add.graphics().setDepth(2);
    panel.fillStyle(0xffffff, 0.9);
    panel.fillRoundedRect(width / 2 - 460, 460, 920, 420, radius.lg);
    this.add
      .text(width / 2, 492, this.lastPrizes.length > 0 ? '抽奖结果' : '尚未抽奖', { ...typography.heading, fontSize: '22px', color: C_DARK })
      .setOrigin(0.5)
      .setDepth(3);
    this.lastPrizes.forEach((p, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = width / 2 - 400 + col * 160;
      const y = 560 + row * 150;
      const unitName = p.kind === 'unit' ? allUnits.find((u) => u.id === p.name)?.name ?? p.name : null;
      this.add.image(x, y, PRIZE_ICON[p.kind]).setScale(2).setDepth(3);
      this.add
        .text(x, y + 46, unitName ?? `${PRIZE_LABEL[p.kind]} ×${p.amount}`, { ...typography.caption, fontSize: '14px', color: C_DARK })
        .setOrigin(0.5)
        .setDepth(3);
    });
  }

  private applyPrizes(prizes: GachaPrize[]): void {
    const save = this.save;
    if (!save) return;
    for (const p of prizes) {
      switch (p.kind) {
        case 'coins':
          save.wallet.coins += p.amount;
          break;
        case 'diamonds':
          save.wallet.diamonds += p.amount;
          break;
        case 'seeds':
          save.wallet.seeds += p.amount;
          break;
        case 'plantFood':
          save.wallet.plantFood += p.amount;
          break;
        case 'unit':
          if (p.name && !save.progress.unlockedUnits.includes(p.name)) save.progress.unlockedUnits.push(p.name);
          else save.wallet.coins += 250;
          break;
      }
    }
    writeSave(window.localStorage, save);
    this.registry.set('save', save);
  }

  private pullSingle(): void {
    const save = this.save;
    if (!save || save.wallet.seeds < GACHA_COST.singleSeed) return;
    save.wallet.seeds -= GACHA_COST.singleSeed;
    save.gacha.singlePulls += 1;
    const prizes = [rollOnce(this.rng, save.progress.unlockedUnits)];
    this.applyPrizes(prizes);
    this.lastPrizes = prizes;
    this.scene.restart();
  }

  private pullTen(): void {
    const save = this.save;
    if (!save || save.wallet.diamonds < GACHA_COST.diamondTen) return;
    save.wallet.diamonds -= GACHA_COST.diamondTen;
    save.gacha.diamondTenPulls += 1;
    const prizes = rollTen(this.rng, save.progress.unlockedUnits);
    this.applyPrizes(prizes);
    this.lastPrizes = prizes;
    this.scene.restart();
  }
}
