import Phaser from 'phaser';
import { allUnits } from '../data/archetypes/index.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { ITEM_ACQUISITION, UNIT_ACQUISITION } from '../data/economy.ts';
import { readSave, writeSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { drawPixelBackdrop, pixelPanel, pixelButton, walletBar, sceneHeader, sceneEnter, drawAmbient, chip, KIT } from '../ui/components/kit.ts';
import { ROLE_LABEL } from '../ui/components/cards.ts';
import { typography } from '../ui/tokens.ts';
import { ITEMS, RARITY_LABEL, type ItemDef, type ItemRarity } from '../data/items.ts';

// 渠道描边色：唯一源 = KIT（禁止散落 hex）
const CHANNEL_STROKE: Record<string, number> = {
  coins: KIT.gold, // 金币购：晨金
  diamonds: KIT.diamond, // 钻石购：紫
  gift: KIT.success, // 赠送：草绿
};
const CHANNEL_LABEL: Record<string, string> = { coins: '金币购', diamonds: '钻石购', gift: '关卡赠送' };

/** 道具品质 → 描边色（唯一源 = KIT）。 */
const RARITY_COLOR: Record<ItemRarity, number> = {
  common: KIT.rarityCommon,
  rare: KIT.rarityRare,
  legendary: KIT.rarityLegendary,
};

type ShopTab = 'units' | 'items';

/**
 * 商店场景（M2 E5 建，M3B 统一像素语言）：13 角色三渠道，购买即时入档。
 * 卡片结构（M3B 重排修复文字重叠）：立绘独立图区（左 96px）+ 右侧文字栏 + 底部 flavor + 右下购买钮。
 * 交互纪律：命中 zone 全部场景级（容器子 zone 在 depth>0 命中不可靠——选关层教训）。
 */
export class ShopScene extends Phaser.Scene {
  private save?: SaveGame;
  private tab: ShopTab = 'units';

  constructor() {
    super('Shop');
  }

  create(): void {
    ensurePixelTextures(this);
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    // 页签跨 restart 保留（购买/切页均走 scene.restart 刷新，与 DrawScene 的 drawKeepResult 同纪律）
    const keepTab = this.registry.get('shopTab') as ShopTab | undefined;
    this.tab = keepTab ?? 'units';
    this.registry.remove('shopTab');
    const { width } = this.scale.gameSize;
    drawPixelBackdrop(this);
    drawAmbient(this);
    sceneHeader(this, '商店 · 生灵集市', { subtitle: 'VERDANT SHOP · 角色与道具' });
    walletBar(this, 60, 128, width - 120, this.save?.wallet ? { wallet: this.save.wallet } : undefined);
    this.drawTabs(width);
    if (this.tab === 'units') this.drawUnits(width);
    else this.drawItems(width);
    sceneEnter(this);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  /** 页签：角色 / 道具（切换走 restart，保证旧对象全清）。 */
  private drawTabs(width: number): void {
    const tabs: { id: ShopTab; label: string }[] = [
      { id: 'units', label: '角色' },
      { id: 'items', label: '道具' },
    ];
    const w = 180;
    const h = 52;
    const gap = 16;
    const totalW = tabs.length * w + (tabs.length - 1) * gap;
    const x0 = width / 2 - totalW / 2;
    const y = 232;
    tabs.forEach((t, i) => {
      const x = x0 + i * (w + gap);
      const active = this.tab === t.id;
      const p = pixelButton(this, x, y, w, h, t.label, {
        depth: 3,
        accent: active ? KIT.gold : KIT.paperDeep,
        onClick: () => {
          if (this.tab === t.id) return;
          this.registry.set('shopTab', t.id);
          this.scene.restart();
        },
      });
      void p;
    });
  }

  private drawUnits(width: number): void {
    const owned = this.save?.progress.unlockedUnits ?? [];
    const cols = 5;
    const cw = 280;
    const ch = 220;
    const gap = 24;
    const list = allUnits.filter((u) => UNIT_ACQUISITION[u.id]);
    const rows = Math.ceil(list.length / cols);
    const y0 = 300; // 页签下方起排（M-INV 加页签后下移）
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
      // 统一走 kit.pixelPanel（纸底 + 描边 + 偏移投影 + 受光带），不再手写底板
      const card = pixelPanel(this, x, y, cw, ch, { depth: 2, stroke });
      // 立绘图区（左上 96×96 独立区，杜绝压字）
      const gImg = this.add.graphics();
      gImg.fillStyle(0xffffff, 0.5);
      gImg.fillRoundedRect(14, 14, 96, 96, 4);
      card.add(gImg);
      card.add(this.add.image(62, 64, `unit_${u.id}`).setScale(0.85));
      // 右侧文字栏（立绘右缘 122 起）
      card.add(this.add.text(122, 34, u.name, { ...typography.subheading, color: KIT.textDark }));
      card.add(
        this.add
          .text(122, 64, ROLE_LABEL[u.role] ?? u.role, { ...typography.caption, fontStyle: 'bold', color: KIT.textDark })
          .setAlpha(0.65),
      );
      const pricePart = acq.channel === 'gift' ? '赠送' : `${acq.channel === 'coins' ? '金币' : '钻石'} ${acq.price}`;
      card.add(this.add.text(122, 90, pricePart, { ...typography.body, fontStyle: 'bold', color: KIT.textBrown }));
      // flavor 底部整行
      card.add(
        this.add
          .text(16, 126, u.flavor, { ...typography.caption, color: KIT.textDark })
          .setOrigin(0, 0)
          .setAlpha(0.75)
          .setWordWrapWidth(cw - 32),
      );
      // 渠道徽章（左下小标签）
      card.add(
        this.add
          .text(16, ch - 34, CHANNEL_LABEL[acq.channel] ?? '', { ...typography.caption, color: KIT.textBrown })
          .setAlpha(0.85),
      );
      // 右下状态/购买钮（与徽章同排，互不重叠）
      if (isOwned) {
        card.add(this.add.text(cw - 16, ch - 34, '已拥有', { ...typography.caption, fontStyle: 'bold', color: KIT.textSub }).setOrigin(1, 0));
      } else if (acq.channel === 'gift') {
        card.add(this.add.text(cw - 16, ch - 34, '通关解锁', { ...typography.caption, color: KIT.textBrown }).setOrigin(1, 0));
      } else if (acq.price !== undefined) {
        const canBuy = acq.channel === 'coins' ? (this.save?.wallet.coins ?? 0) >= acq.price : (this.save?.wallet.diamonds ?? 0) >= acq.price;
        pixelButton(this, x + cw - 116, y + ch - 54, 100, 42, canBuy ? '购买' : '差钱', {
          depth: 4,
          accent: KIT.success,
          enabled: canBuy,
          onClick: () => this.buy(u, acq.channel as 'coins' | 'diamonds', acq.price as number),
        });
      }
    });
  }

  /** 道具售卖区（M-INV）：品质描边 + 描述 + 可重复购买（累加持有）。 */
  private drawItems(width: number): void {
    const cols = 4;
    const cw = 340;
    const ch = 300;
    const gap = 30;
    const list = ITEMS.filter((d) => ITEM_ACQUISITION[d.id]);
    const rows = Math.ceil(list.length / cols);
    const y0 = 300;
    list.forEach((def, i) => {
      const acq = ITEM_ACQUISITION[def.id];
      if (!acq) return;
      const row = Math.floor(i / cols);
      const inRow = row < rows - 1 ? cols : list.length - cols * (rows - 1);
      const rowW = inRow * cw + (inRow - 1) * gap;
      const rowX = (width - rowW) / 2;
      const x = rowX + (i % cols) * (cw + gap);
      const y = y0 + row * (ch + gap);

      const card = pixelPanel(this, x, y, cw, ch, { depth: 2, stroke: RARITY_COLOR[def.rarity] });
      card.add(this.add.image(cw / 2, 70, `icon_${def.icon}`).setDisplaySize(88, 88));
      card.add(this.add.text(cw / 2, 136, def.name, { ...typography.subheading, color: KIT.textDark }).setOrigin(0.5));
      card.add(chip(this, cw / 2 - 48, 160, RARITY_LABEL[def.rarity], { color: RARITY_COLOR[def.rarity], width: 96, height: 32 }));
      card.add(
        this.add.text(20, 202, def.desc, { ...typography.caption, color: KIT.textDark }).setAlpha(0.8).setWordWrapWidth(cw - 40),
      );
      card.add(this.add.text(20, 250, `${acq.channel === 'coins' ? '金币' : '钻石'} ${acq.price}`, { ...typography.body, fontStyle: 'bold', color: KIT.textBrown }));
      card.add(this.add.text(20, 276, `持有 ×${this.save?.inventory[def.id] ?? 0}`, { ...typography.caption, color: KIT.textSub }));
      const canBuy = acq.channel === 'coins' ? (this.save?.wallet.coins ?? 0) >= acq.price : (this.save?.wallet.diamonds ?? 0) >= acq.price;
      pixelButton(this, x + cw - 116, y + ch - 56, 100, 42, canBuy ? '购买' : '差钱', {
        depth: 4,
        accent: KIT.success,
        enabled: canBuy,
        onClick: () => this.buyItem(def, acq.channel, acq.price),
      });
    });
  }

  /** 道具购买：可重复，累加 inventory（与角色一次性解锁不同）。 */
  private buyItem(def: ItemDef, channel: 'coins' | 'diamonds', price: number): void {
    const save = this.save;
    if (!save) return;
    if (channel === 'coins' && save.wallet.coins < price) return;
    if (channel === 'diamonds' && save.wallet.diamonds < price) return;
    if (channel === 'coins') save.wallet.coins -= price;
    else save.wallet.diamonds -= price;
    save.inventory[def.id] = (save.inventory[def.id] ?? 0) + 1;
    let ok = true;
    try {
      writeSave(window.localStorage, save, () => {
        ok = false;
      });
    } catch {
      ok = false;
    }
    if (!ok) {
      // 写档失败：回滚内存改动，避免"未保存却已扣钱"的重复点击漏洞
      if (channel === 'coins') save.wallet.coins += price;
      else save.wallet.diamonds += price;
      const back = (save.inventory[def.id] ?? 0) - 1;
      if (back > 0) save.inventory[def.id] = back;
      else delete save.inventory[def.id];
      this.registry.set('save', save);
      this.add.text(960, 1020, '存档写入失败（浏览器存储不可用），本次购买未保存', { ...typography.body, color: KIT.dangerCss }).setOrigin(0.5).setDepth(20);
      return;
    }
    this.registry.set('save', save);
    this.registry.set('shopTab', 'items');
    this.scene.restart();
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
      this.add.text(960, 1020, '存档写入失败（浏览器存储不可用），本次购买未保存', { ...typography.body, color: KIT.dangerCss }).setOrigin(0.5).setDepth(20);
      return;
    }
    this.scene.restart();
  }
}
