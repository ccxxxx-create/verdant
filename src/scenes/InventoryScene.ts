import Phaser from 'phaser';
import { typography } from '../ui/tokens.ts';
import {
  drawPixelBackdrop,
  pixelPanel,
  pixelButton,
  sceneHeader,
  sceneEnter,
  drawAmbient,
  walletBar,
  chip,
  hoverable,
  KIT,
  MOTION_ENABLED,
} from '../ui/components/kit.ts';
import { readSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { ITEMS, itemById, RARITY_LABEL, RARITY_ORDER, type ItemDef, type ItemRarity } from '../data/items.ts';
import { ensurePixelTextures } from './BattleScene.ts';

/**
 * 背包场景（M-INV）：品质页签 + 槽位网格 + 详情面板 + 空态引导。
 *
 * 纪律：
 * - 命中区一律**场景级** zone（容器交互在 depth > 0 不可靠）；页签重建必须销毁旧 zone。
 * - 色值只经 KIT（含品质色 rarityCommon/Rare/Legendary），禁止散落 hex。
 * - 未持有道具以半透明展示（给出收集目标），不隐藏。
 */

/** 道具品质 → 描边色（唯一源 = KIT）。 */
const RARITY_COLOR: Record<ItemRarity, number> = {
  common: KIT.rarityCommon,
  rare: KIT.rarityRare,
  legendary: KIT.rarityLegendary,
};

type TabId = 'all' | ItemRarity;

const TABS: TabId[] = ['all', 'common', 'rare', 'legendary'];
const TAB_LABEL: Record<TabId, string> = { all: '全部', common: '普通', rare: '稀有', legendary: '传说' };

/** 效果 → 人话（详情面板用；数值唯一源 = data/items.ts）。 */
function effectText(def: ItemDef): string {
  const e = def.effect;
  switch (e.t) {
    case 'bonusLightdew':
      return `开局光露 +${e.amount}`;
    case 'bonusPlantFood':
      return `开局能量豆 +${e.amount}`;
    case 'mowerWard':
      return `开局 ${e.durationS} 秒内，每行割草机被突破时免消耗一次`;
    case 'clearBonus':
      return `本局通关金币 ×${e.coinMult} · 额外种子券 +${e.bonusSeeds}`;
  }
}

export class InventoryScene extends Phaser.Scene {
  private save?: SaveGame;
  private tab: TabId = 'all';
  private selectedId?: string;
  private tabParts: Phaser.GameObjects.GameObject[] = [];
  private tabHits: Phaser.GameObjects.Zone[] = [];
  private contentParts: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Inventory');
  }

  create(): void {
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    this.tab = 'all';
    this.selectedId = undefined;
    this.tabParts = [];
    this.tabHits = [];
    this.contentParts = [];
    ensurePixelTextures(this);
    drawPixelBackdrop(this);
    drawAmbient(this);
    sceneHeader(this, '背包', { subtitle: 'VERDANT BAG · 出战前可携带 1 件' });
    walletBar(this, 60, 128, this.scale.gameSize.width - 120, this.save?.wallet ? { wallet: this.save.wallet } : undefined);
    this.drawTabs();
    this.renderTab();
    sceneEnter(this);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  private drawTabs(): void {
    for (const p of this.tabParts) p.destroy();
    for (const h of this.tabHits) h.destroy();
    this.tabParts = [];
    this.tabHits = [];
    const x0 = 80;
    const y = 252;
    const w = 150;
    const h = 56;
    const gap = 16;
    TABS.forEach((id, i) => {
      const x = x0 + i * (w + gap);
      const active = this.tab === id;
      const p = pixelPanel(this, x, y, w, h, {
        depth: 3,
        radius: 6,
        stroke: active ? KIT.gold : KIT.outline,
        fill: active ? KIT.paperDeep : KIT.paper,
      });
      p.add(this.add.text(w / 2, h / 2, TAB_LABEL[id], { ...typography.body, fontStyle: 'bold', color: KIT.textDark }).setOrigin(0.5));
      this.tabParts.push(p);
      const hit = this.add.zone(x, y, w, h).setOrigin(0, 0).setDepth(4).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.tab === id) return;
        this.tab = id;
        this.drawTabs();
        this.renderTab();
      });
      this.tabHits.push(hit);
    });
  }

  private renderTab(): void {
    for (const p of this.contentParts) p.destroy();
    this.contentParts = [];
    const save = this.save;
    const items = ITEMS.filter((d) => this.tab === 'all' || d.rarity === this.tab)
      .slice()
      .sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]);
    const ownedAny = ITEMS.some((d) => (save?.inventory[d.id] ?? 0) > 0);
    if (!ownedAny) {
      this.drawEmpty();
      return;
    }
    if (!this.selectedId || !items.some((d) => d.id === this.selectedId)) {
      this.selectedId = items.find((d) => (save?.inventory[d.id] ?? 0) > 0)?.id ?? items[0]?.id;
    }
    this.drawGrid(items);
    this.drawDetail();
  }

  private drawGrid(items: ItemDef[]): void {
    const x0 = 80;
    const y0 = 336;
    const cols = 5;
    const size = 150;
    const gap = 20;
    const save = this.save;
    items.forEach((def, i) => {
      const x = x0 + (i % cols) * (size + gap);
      const y = y0 + Math.floor(i / cols) * (size + gap);
      const count = save?.inventory[def.id] ?? 0;
      const owned = count > 0;
      const selected = this.selectedId === def.id;
      const p = pixelPanel(this, x, y, size, size, {
        depth: 3,
        radius: 8,
        stroke: selected ? KIT.gold : RARITY_COLOR[def.rarity],
        fill: owned ? KIT.paper : KIT.paperDeep,
      });
      p.setAlpha(owned ? 1 : 0.45);
      p.add(this.add.image(size / 2, size / 2 - 16, `icon_${def.icon}`).setDisplaySize(72, 72));
      p.add(this.add.text(size / 2, size - 30, def.name, { ...typography.body, fontStyle: 'bold', color: KIT.textDark }).setOrigin(0.5));
      p.add(
        owned
          ? this.add.text(size - 10, 18, `×${count}`, { ...typography.body, fontStyle: 'bold', color: KIT.textBrown }).setOrigin(1, 0.5)
          : this.add.text(size / 2, 18, '未持有', { ...typography.caption, color: KIT.textSub }).setOrigin(0.5),
      );
      this.contentParts.push(p);
      const hit = this.add.zone(x, y, size, size).setOrigin(0, 0).setDepth(4).setInteractive({ useHandCursor: true });
      hoverable(this, hit, p); // 槽位悬停高光（此前完全无反馈）
      hit.on('pointerup', () => {
        this.selectedId = def.id;
        this.renderTab();
      });
      this.contentParts.push(hit);
    });
  }

  private drawDetail(): void {
    const dx = 960;
    const dy = 250;
    const dw = 880;
    const dh = 700;
    const p = pixelPanel(this, dx, dy, dw, dh, { depth: 3, radius: 10 });
    this.contentParts.push(p);
    const def = this.selectedId ? itemById(this.selectedId) : undefined;
    if (!def) {
      p.add(this.add.text(dw / 2, dh / 2, '选择一件道具查看详情', { ...typography.body, color: KIT.textSub }).setOrigin(0.5));
      return;
    }
    const count = this.save?.inventory[def.id] ?? 0;
    p.add(this.add.image(150, 150, `icon_${def.icon}`).setDisplaySize(160, 160));
    p.add(this.add.text(300, 104, def.name, { ...typography.title, color: KIT.textDark }));
    p.add(chip(this, 300, 154, RARITY_LABEL[def.rarity], { color: RARITY_COLOR[def.rarity], width: 96, height: 36 }));
    p.add(this.add.text(300, 206, `持有 ×${count}`, { ...typography.body, color: KIT.textBrown }));
    p.add(this.add.text(60, 330, def.desc, { ...typography.body, color: KIT.textDark }).setWordWrapWidth(dw - 120));
    p.add(this.add.text(60, 430, `效果：${effectText(def)}`, { ...typography.body, fontStyle: 'bold', color: KIT.textDark }));
    p.add(
      this.add.text(60, 486, '出战前在「选择出战卡组」面板携带 1 件，开局自动生效。', { ...typography.caption, color: KIT.textSub }),
    );
    p.add(this.add.text(60, 518, '传送带关卡不经选卡，本局不携带。', { ...typography.caption, color: KIT.textSub }));
  }

  private drawEmpty(): void {
    const px = 460;
    const py = 360;
    const p = pixelPanel(this, px, py, 1000, 500, { depth: 3, radius: 12 });
    this.contentParts.push(p);
    const icon = this.add.image(px + 500, py + 168, 'icon_item_lucky_clover').setDisplaySize(128, 128).setAlpha(0.9);
    p.add(icon);
    if (MOTION_ENABLED) {
      this.tweens.add({ targets: icon, scale: { from: 1, to: 1.05 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    p.add(this.add.text(px + 500, py + 272, '背包空空如也', { ...typography.title, color: KIT.textDark }).setOrigin(0.5));
    p.add(
      this.add
        .text(px + 500, py + 328, '去「抽奖」或「商店」获取道具，设置里的兑换码也可领取', { ...typography.body, color: KIT.textSub })
        .setOrigin(0.5),
    );
    // 直达入口（不让玩家自己找路）
    const draw = pixelButton(this, px + 500 - 250, py + 388, 230, 64, '去 抽 奖', {
      depth: 4,
      accent: KIT.diamond,
      onClick: () => this.scene.start('Draw'),
    });
    const shop = pixelButton(this, px + 500 + 20, py + 388, 230, 64, '去 商 店', {
      depth: 4,
      accent: KIT.accentBlue,
      onClick: () => this.scene.start('Shop'),
    });
    this.contentParts.push(draw.container, draw.hit, shop.container, shop.hit);
  }
}
