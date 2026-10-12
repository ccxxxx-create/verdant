import Phaser from 'phaser';
import { allUnits } from '../data/archetypes/index.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { UNIT_ACQUISITION } from '../data/economy.ts';
import { readSave, writeSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { drawPixelBackdrop, pixelButton, walletBar, sceneHeader, sceneEnter, drawAmbient, KIT } from '../ui/components/kit.ts';
import { ROLE_LABEL } from '../ui/components/cards.ts';

const CHANNEL_STROKE: Record<string, number> = {
  coins: 0xd9a53a, // 金币购：晨金
  diamonds: 0x8e6fd8, // 钻石购：紫
  gift: 0x6fa86b, // 赠送：草绿
};
const CHANNEL_LABEL: Record<string, string> = { coins: '金币购', diamonds: '钻石购', gift: '关卡赠送' };

/**
 * 商店场景（M2 E5 建，M3B 统一像素语言）：13 角色三渠道，购买即时入档。
 * 卡片结构（M3B 重排修复文字重叠）：立绘独立图区（左 96px）+ 右侧文字栏 + 底部 flavor + 右下购买钮。
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
    drawPixelBackdrop(this);
    drawAmbient(this);
    sceneHeader(this, '商店 · 生灵集市', { subtitle: 'VERDANT SHOP · 角色获取' });
    walletBar(this, 60, 128, width - 120, this.save?.wallet ? { wallet: this.save.wallet } : undefined);
    this.drawUnits(width);
    sceneEnter(this);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  private track<T extends Phaser.GameObjects.GameObject>(go: T): T {
    this.parts.push(go);
    return go;
  }

  private drawUnits(width: number): void {
    const owned = this.save?.progress.unlockedUnits ?? [];
    const cols = 5;
    const cw = 300;
    const ch = 250;
    const gap = 30;
    const list = allUnits.filter((u) => UNIT_ACQUISITION[u.id]);
    const rows = Math.ceil(list.length / cols);
    const gridW = cols * cw + (cols - 1) * gap;
    const y0 = 250;
    list.forEach((u, i) => {
      const acq = UNIT_ACQUISITION[u.id];
      if (!acq) return;
      const isOwned = owned.includes(u.id);
      const row = Math.floor(i / cols);
      const inRow = row < rows - 1 ? cols : list.length - cols * (rows - 1);
      // 末行居中（消除右侧空白）
      const rowW = inRow * cw + (inRow - 1) * gap;
      const rowX = (width - rowW) / 2;
      const x = rowX + (i % cols) * (cw + gap);
      const y = y0 + row * (ch + gap);

      const stroke = CHANNEL_STROKE[acq.channel] ?? KIT.outline;
      const card = this.track(this.add.container(x, y).setDepth(2));
      const g = this.add.graphics();
      g.fillStyle(KIT.shadow, 0.3);
      g.fillRoundedRect(0, 5, cw, ch, 6);
      g.fillStyle(KIT.paper, 0.97);
      g.fillRoundedRect(0, 0, cw, ch, 6);
      g.lineStyle(3, stroke, 1);
      g.strokeRoundedRect(0, 0, cw, ch, 6);
      card.add(g);
      // 立绘图区（左上 96×96 独立区，杜绝压字）
      const gImg = this.add.graphics();
      gImg.fillStyle(0xffffff, 0.5);
      gImg.fillRoundedRect(14, 14, 96, 96, 4);
      card.add(gImg);
      card.add(this.add.image(62, 64, `unit_${u.id}`).setScale(0.85));
      // 右侧文字栏（立绘右缘 122 起）
      card.add(this.add.text(122, 34, u.name, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '21px', fontStyle: 'bold', color: KIT.textDark }));
      card.add(
        this.add
          .text(122, 64, ROLE_LABEL[u.role] ?? u.role, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '13px', fontStyle: 'bold', color: KIT.textDark })
          .setAlpha(0.65),
      );
      const pricePart = acq.channel === 'gift' ? '赠送' : `${acq.channel === 'coins' ? '金币' : '钻石'} ${acq.price}`;
      card.add(
        this.add
          .text(122, 90, pricePart, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#8A5F3C' }),
      );
      // flavor 底部整行
      card.add(
        this.add
          .text(16, 126, u.flavor, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '13px', color: KIT.textDark })
          .setOrigin(0, 0)
          .setAlpha(0.75)
          .setWordWrapWidth(cw - 32),
      );
      // 渠道徽章（左下小标签）
      card.add(
        this.add
          .text(16, ch - 34, CHANNEL_LABEL[acq.channel] ?? '', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '12px', color: '#8A5F3C' })
          .setAlpha(0.85),
      );
      // 右下状态/购买钮（与徽章同排，互不重叠）
      if (isOwned) {
        card.add(this.add.text(cw - 16, ch - 34, '已拥有', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#5E7A66' }).setOrigin(1, 0));
      } else if (acq.channel === 'gift') {
        card.add(this.add.text(cw - 16, ch - 34, '通关解锁', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '14px', color: '#8A5F3C' }).setOrigin(1, 0));
      } else if (acq.price !== undefined) {
        const canBuy = acq.channel === 'coins' ? (this.save?.wallet.coins ?? 0) >= acq.price : (this.save?.wallet.diamonds ?? 0) >= acq.price;
        pixelButton(this, x + cw - 116, y + ch - 54, 100, 42, canBuy ? '购买' : '差钱', {
          depth: 4,
          accent: canBuy ? 0x6fbf83 : 0xb3ad9c,
          enabled: canBuy,
          onClick: () => this.buy(u, acq.channel as 'coins' | 'diamonds', acq.price as number),
        });
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
      this.track(this.add.text(960, 1020, '存档写入失败（浏览器存储不可用），本次购买未保存', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '16px', color: '#B23A2E' }).setOrigin(0.5).setDepth(20));
      return;
    }
    this.scene.restart();
  }
}
