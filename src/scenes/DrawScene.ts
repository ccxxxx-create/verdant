import Phaser from 'phaser';
import { allUnits } from '../data/archetypes/index.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { GACHA_COST, rollOnce, rollTen, type GachaPrize } from '../core/gacha.ts';
import { Rng } from '../core/rng.ts';
import { readSave, writeSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { drawPixelBackdrop, pixelPanel, pixelButton, walletBar, sceneHeader, sceneEnter, KIT } from '../ui/components/kit.ts';

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
const RARITY_TINT: Record<GachaPrize['kind'], number | null> = {
  unit: 0xd9a53a, // 角色出货=金卡
  diamonds: 0x8e6fd8,
  coins: null,
  seeds: null,
  plantFood: null,
};

/**
 * 抽奖场景（M2 E7 建，M3B 统一像素语言 + 反馈 pass）：
 * 种子券单抽 + 钻石十连；空状态引导化；结果卡 stagger 翻入（game-feel-design：结果即反馈高潮）。
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
    drawPixelBackdrop(this);
    sceneHeader(this, '生灵抽奖', { subtitle: 'VERDANT GACHA · 种子券单抽 / 钻石十连' });
    walletBar(this, 60, 128, width - 120, this.save?.wallet ? { wallet: this.save.wallet } : undefined);
    this.drawButtons(width);
    this.drawResult(width);
    sceneEnter(this);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  private drawButtons(width: number): void {
    const wallet = this.save?.wallet;
    const mkBtn = (label: string, sub: string, x: number, enabled: boolean, accent: number, onClick: () => void): void => {
      pixelButton(this, x, 250, 380, 150, label, { sub, enabled, accent, depth: 3, onClick });
    };
    mkBtn('单 抽', `消耗 1 种子券（现有 ${wallet?.seeds ?? 0}）`, width / 2 - 400, (wallet?.seeds ?? 0) >= GACHA_COST.singleSeed, 0x6fbf83, () => this.pullSingle());
    mkBtn('十 连', `消耗 ${GACHA_COST.diamondTen} 钻石 · 必出未拥有角色`, width / 2 + 20, (wallet?.diamonds ?? 0) >= GACHA_COST.diamondTen, 0x9b8cd9, () => this.pullTen());
    this.add
      .text(width / 2, 442, '概率：金币 40% · 种子 28% · 能量豆 15% · 钻石 9% · 角色 8%', {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '14px',
        color: KIT.textSub,
      })
      .setOrigin(0.5)
      .setDepth(3);
  }

  private drawResult(width: number): void {
    const hasResult = this.lastPrizes.length > 0;
    const panel = pixelPanel(this, width / 2 - 460, 480, 920, 440, { depth: 2 });
    void panel;
    if (!hasResult) {
      // 空状态：引导构图（icon + 主文案 + 进度），不再是纯空框
      const empty = this.add.container(width / 2, 700).setDepth(3);
      empty.add(this.add.image(0, -60, 'icon_seed').setScale(3).setAlpha(0.85));
      empty.add(
        this.add
          .text(0, 20, '抽一次试试手气', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '24px', fontStyle: 'bold', color: KIT.textDark })
          .setOrigin(0.5),
      );
      const owned = this.save?.progress.unlockedUnits.length ?? 0;
      empty.add(
        this.add
          .text(0, 58, `已收集 ${owned} / ${allUnits.length} 角色 · 钻石十连必出未拥有`, {
            fontFamily: 'system-ui, "PingFang SC", sans-serif',
            fontSize: '15px',
            color: KIT.textSub,
          })
          .setOrigin(0.5),
      );
      return;
    }
    this.add
      .text(width / 2, 516, this.lastPrizes.length > 1 ? '十连结果' : '单抽结果', {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: KIT.textDark,
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.lastPrizes.forEach((p, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = width / 2 - 368 + col * 184;
      const y = 596 + row * 160;
      const unitName = p.kind === 'unit' ? allUnits.find((u) => u.id === p.name)?.name ?? p.name : null;
      const card = this.add.container(x, y).setDepth(3);
      const g = this.add.graphics();
      const tint = RARITY_TINT[p.kind];
      g.fillStyle(KIT.shadow, 0.25);
      g.fillRoundedRect(-70, -55 + 4, 140, 118, 6);
      g.fillStyle(KIT.paperDeep, 1);
      g.fillRoundedRect(-70, -55, 140, 118, 6);
      g.lineStyle(3, tint ?? KIT.outline, 1);
      g.strokeRoundedRect(-70, -55, 140, 118, 6);
      card.add(g);
      card.add(this.add.image(0, -14, PRIZE_ICON[p.kind]).setDisplaySize(52, 52));
      card.add(
        this.add
          .text(0, 34, unitName ?? `${PRIZE_LABEL[p.kind]} ×${p.amount}`, {
            fontFamily: 'system-ui, "PingFang SC", sans-serif',
            fontSize: '15px',
            fontStyle: 'bold',
            color: KIT.textDark,
          })
          .setOrigin(0.5),
      );
      // 翻入动效：scaleX 0→1 逐张 stagger（game-feel-design：结果揭示是反馈高潮）
      if (this.lastPrizes.length > 0) {
        card.setScale(0, 1);
        this.tweens.add({
          targets: card,
          scaleX: 1,
          duration: 220,
          delay: 120 + i * 90,
          ease: 'Back.easeOut',
        });
      }
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
