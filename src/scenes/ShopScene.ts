import Phaser from 'phaser';
import { allUnits } from '../data/archetypes/index.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { UNIT_ACQUISITION } from '../data/economy.ts';
import { readSave, writeSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { palette, typography, radius, hexToInt } from '../ui/tokens.ts';


const C_DARK = '#26402F';
const WALLET_ICON: Record<string, string> = { coins: 'icon_coin', diamonds: 'icon_diamond', seeds: 'icon_seed', plantFood: 'icon_energy' };
const WALLET_LABEL: Record<string, string> = { coins: '金币', diamonds: '钻石', seeds: '种子', plantFood: '能量豆' };

/**
 * 商店场景（M2 E5）：13 角色一览，赠送/金币购/钻石购三渠道，购买即时入档。
 * 交互纪律：命中 zone 全部场景级（容器子 zone 在 depth>0 命中不可靠——选关层教训）。
 */
export class ShopScene extends Phaser.Scene {
  private save?: SaveGame;
  private parts: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Shop');
  }

  create(): void {
    ensurePixelTextures(this);
    this.parts = []; // restart 不残留上轮引用（审查 P2-3）
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    const { width } = this.scale.gameSize;
    this.drawBackdrop(width);
    this.drawWallet(width);
    this.drawUnits(width);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  private track<T extends Phaser.GameObjects.GameObject>(go: T): T {
    this.parts.push(go);
    return go;
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
    const bar = this.track(this.add.graphics().setDepth(2));
    bar.fillStyle(0xffffff, 0.85);
    bar.fillRoundedRect(60, 44, width - 120, 96, radius.lg);
    this.track(this.add.text(96, 92, '商店 · 生灵集市', { ...typography.heading, fontSize: '28px', color: C_DARK }).setOrigin(0, 0.5).setDepth(3));
    if (!wallet) {
      this.track(this.add.text(width / 2, 92, '存档读取失败', { ...typography.body, color: C_DARK }).setOrigin(0.5).setDepth(3));
      return;
    }
    const entries: [string, number][] = [
      ['coins', wallet.coins],
      ['diamonds', wallet.diamonds],
      ['seeds', wallet.seeds],
      ['plantFood', wallet.plantFood],
    ];
    entries.forEach(([key, val], i) => {
      const x = width - 880 + i * 220;
      this.track(this.add.image(x, 92, WALLET_ICON[key] ?? 'icon_coin').setScale(1.4).setDepth(3));
      this.track(this.add.text(x + 52, 92, `${WALLET_LABEL[key]} ${val}`, { ...typography.body, fontSize: '17px', color: C_DARK }).setOrigin(0, 0.5).setDepth(3));
    });
  }

  private drawUnits(width: number): void {
    const owned = this.save?.progress.unlockedUnits ?? [];
    const cols = 5;
    const cw = 300;
    const ch = 230;
    const gap = 40;
    const startX = (width - (cw * cols + gap * (cols - 1))) / 2;
    const y0 = 170;
    allUnits.forEach((u, i) => {
      const acq = UNIT_ACQUISITION[u.id];
      if (!acq) return;
      const isOwned = owned.includes(u.id);
      const x = startX + (i % cols) * (cw + gap);
      const y = y0 + Math.floor(i / cols) * (ch + gap);
      const card = this.track(this.add.container(x, y).setDepth(2));
      const g = this.add.graphics();
      g.fillStyle(0xffffff, isOwned ? 0.92 : 0.82);
      g.fillRoundedRect(0, 0, cw, ch, radius.lg);
      g.lineStyle(3, hexToInt(acq.channel === 'diamonds' ? '#8E6FD8' : acq.channel === 'coins' ? '#F2C14E' : palette.primary), 1);
      g.strokeRoundedRect(0, 0, cw, ch, radius.lg);
      card.add(g);
      card.add(this.add.image(58, 62, `unit_${u.id}`).setScale(1.4));
      card.add(this.add.text(104, 38, u.name, { ...typography.heading, fontSize: '21px', color: C_DARK }));
      const pricePart = acq.channel === 'gift' ? '赠送' : acq.channel === 'coins' ? `金币 ${acq.price}` : `钻石 ${acq.price}`;
      const channelText = `${pricePart} · ${acq.note}`; // note 含 M3 实装标注（审查 P1-1：未实装 behavior 必须明示）
      card.add(this.add.text(104, 72, channelText, { ...typography.caption, fontSize: '14px', color: isOwned ? palette.primaryDeep : '#8A5F3C' }));
      card.add(
        this.add
          .text(20, ch - 58, u.flavor, { ...typography.caption, fontSize: '13px', color: C_DARK })
          .setOrigin(0, 0)
          .setAlpha(0.75)
          .setWordWrapWidth(cw - 32),
      );
      // 右上角状态：已拥有 / 关卡获取（赠送未拥有）/ 购买·差钱
      if (isOwned) {
        this.track(
          this.add
            .text(x + cw - 54, y + 33, '已拥有', { ...typography.body, fontSize: '15px', color: palette.primaryDeep })
            .setOrigin(0.5)
            .setDepth(4)
            .setAlpha(0.9),
        );
      } else if (acq.channel === 'gift') {
        this.track(
          this.add
            .text(x + cw - 66, y + 33, '关卡获取', { ...typography.body, fontSize: '15px', color: '#8A5F3C' })
            .setOrigin(0.5)
            .setDepth(4)
            .setAlpha(0.9),
        );
      } else if (acq.price !== undefined) {
        const canBuy = acq.channel === 'coins' ? (this.save?.wallet.coins ?? 0) >= acq.price : (this.save?.wallet.diamonds ?? 0) >= acq.price;
        const btnG = this.add.graphics().setDepth(3);
        btnG.fillStyle(hexToInt(canBuy ? '#57C173' : '#B3AD9C'), 1);
        btnG.fillRoundedRect(x + cw - 108, y + 12, 96, 42, 8);
        this.track(btnG);
        this.track(this.add.text(x + cw - 60, y + 33, canBuy ? '购买' : '差钱', { ...typography.body, fontSize: '15px', color: '#FFFFFF' }).setOrigin(0.5).setDepth(4));
        const hit = this.track(this.add.zone(x + cw - 108, y + 12, 96, 42).setOrigin(0, 0).setDepth(5).setInteractive({ useHandCursor: canBuy }));
        hit.on('pointerup', () => this.buy(u, acq.channel as 'coins' | 'diamonds', acq.price as number));
      }
    });
  }

  private buy(u: { id: string }, channel: 'coins' | 'diamonds', price: number): void {
    const save = this.save;
    if (!save) return;
    if (save.progress.unlockedUnits.includes(u.id)) return;
    if (channel === 'coins' && save.wallet.coins < price) return;
    if (channel === 'diamonds' && save.wallet.diamonds < price) return;
    if (channel === 'coins') save.wallet.coins -= price;
    else save.wallet.diamonds -= price;
    save.progress.unlockedUnits.push(u.id);
    let ok = true;
    try {
      writeSave(window.localStorage, save, () => {
        ok = false;
      });
    } catch {
      ok = false;
    }
    this.registry.set('save', save);
    if (!ok) {
      this.track(this.add.text(960, 1020, '存档写入失败（浏览器存储不可用），本次购买未保存', { ...typography.body, color: '#B23A2E' }).setOrigin(0.5).setDepth(20));
      return;
    }
    this.scene.restart();
  }
}
