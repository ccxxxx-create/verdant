import Phaser from 'phaser';
import { allUnits } from '../data/archetypes/index.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { GACHA_COST, rollOnce, rollTen, prizeTier, type GachaPrize } from '../core/gacha.ts';
import { Rng } from '../core/rng.ts';
import { readSave, writeSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { drawPixelBackdrop, pixelButton, walletBar, sceneHeader, sceneEnter, drawAmbient, KIT } from '../ui/components/kit.ts';
import { typography } from '../ui/tokens.ts';
import { revealCard, gachaMachineIdle, TIER_RECIPE, type MachineHandle, type RevealHandle } from '../ui/components/gachaFx.ts';
import { itemById } from '../data/items.ts';

const PRIZE_ICON: Record<GachaPrize['kind'], string> = {
  unit: 'icon_seed',
  coins: 'icon_coin',
  diamonds: 'icon_diamond',
  seeds: 'icon_seed',
  plantFood: 'icon_energy',
  item: 'icon_sprout',
};
const PRIZE_LABEL: Record<GachaPrize['kind'], string> = {
  unit: '角色',
  coins: '金币',
  diamonds: '钻石',
  seeds: '种子券',
  plantFood: '能量豆',
  item: '道具',
};

// —— 布局（1920×1080 设计基准）——
const CARD_W = 150;
const CARD_H = 128;
const COLS = 5;
const GAP_X = 24;
const GAP_Y = 36;
const MACHINE_X = 960;
const MACHINE_Y = 500;
const TITLE_Y = 618;
const CARD_Y0 = 720;

/**
 * 抽奖场景（M2 E7 建；M-INV 商业化重做：品质分级揭示动画 + 抽奖机 + 十连跳过）。
 *
 * 口径：
 * - 品质档唯一源 = core/gacha 的 `prizeTier`；动效配方唯一源 = ui/components/gachaFx 的 `TIER_RECIPE`。
 * - 普通（金币/种子/能量豆）= 纯翻入；稀有（钻石/稀有道具）= 光晕 + 扫光 + 微光；传说（角色/传说道具）= 蓄势 + 光条 + 闪白 + 爆发 + NEW。
 * - 十连逐张级联（110ms 间隔），可「跳过」立即置终态；跳过后 kill 全部在途 tween（性能预算）。
 * - 全部动效受 MOTION_ENABLED 门控（减弱动态 → 直接显示）。
 * - 交互纪律：命中 zone 全部场景级。
 */
export class DrawScene extends Phaser.Scene {
  private save?: SaveGame;
  private rng = new Rng(0x9a1a);
  private lastPrizes: GachaPrize[] = [];
  /** 本次结果中"首次获得"的下标（按奖品位次，避免同名奖品重复标 NEW）。 */
  private newIdx: number[] = [];
  private machine?: MachineHandle;
  private reveals: RevealHandle[] = [];
  private skipParts: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Draw');
  }

  create(): void {
    ensurePixelTextures(this);
    // lastPrizes 仅在同场景 restart（抽完刷新）保留；离开场景后再进则清空回空态
    if (!this.registry.get('drawKeepResult')) {
      this.lastPrizes = [];
      this.newIdx = [];
    } else {
      this.newIdx = (this.registry.get('drawNewIdx') as number[] | undefined) ?? [];
    }
    this.registry.remove('drawKeepResult');
    this.registry.remove('drawNewIdx');
    this.reveals = [];
    this.skipParts = [];
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    const { width } = this.scale.gameSize;
    drawPixelBackdrop(this);
    drawAmbient(this);
    sceneHeader(this, '生灵抽奖', { subtitle: 'VERDANT GACHA · 种子券单抽 / 钻石十连' });
    walletBar(this, 60, 128, width - 120, this.save?.wallet ? { wallet: this.save.wallet } : undefined);
    this.machine = gachaMachineIdle(this, MACHINE_X, MACHINE_Y, { depth: 2 });
    this.drawButtons(width);
    this.drawResult(width);
    sceneEnter(this);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  private drawButtons(width: number): void {
    const wallet = this.save?.wallet;
    const mkBtn = (label: string, sub: string, x: number, enabled: boolean, accent: number, onClick: () => void): void => {
      pixelButton(this, x, 240, 380, 140, label, { sub, enabled, accent, depth: 3, onClick });
    };
    mkBtn('单 抽', `消耗 1 种子券（现有 ${wallet?.seeds ?? 0}）`, width / 2 - 400, (wallet?.seeds ?? 0) >= GACHA_COST.singleSeed, KIT.success, () => this.pullSingle());
    mkBtn('十 连', `消耗 ${GACHA_COST.diamondTen} 钻石 · 必出未拥有角色`, width / 2 + 20, (wallet?.diamonds ?? 0) >= GACHA_COST.diamondTen, KIT.diamond, () => this.pullTen());
    const gacha = this.save?.gacha;
    this.add
      .text(width / 2, 404, '概率：金币 32% · 种子券 22% · 能量豆 13% · 道具 15% · 钻石 10% · 角色 8%', { ...typography.caption, color: KIT.textSub })
      .setOrigin(0.5)
      .setDepth(3);
    this.add
      .text(
        width / 2,
        432,
        `已抽：单抽 ${gacha?.singlePulls ?? 0} 次 · 十连 ${gacha?.diamondTenPulls ?? 0} 次（十连必出未拥有角色）`,
        { ...typography.caption, color: KIT.textSub },
      )
      .setOrigin(0.5)
      .setDepth(3)
      .setAlpha(0.85);
  }

  private prizeIcon(p: GachaPrize): string {
    if (p.kind === 'item') {
      const def = p.name ? itemById(p.name) : undefined;
      return def ? `icon_${def.icon}` : 'icon_sprout';
    }
    return PRIZE_ICON[p.kind];
  }

  private prizeLabel(p: GachaPrize): string {
    if (p.kind === 'unit') return allUnits.find((u) => u.id === p.name)?.name ?? p.name ?? '角色';
    if (p.kind === 'item') return itemById(p.name ?? '')?.name ?? '道具';
    return `${PRIZE_LABEL[p.kind]} ×${p.amount}`;
  }

  private isNew(index: number): boolean {
    return this.newIdx.includes(index);
  }

  private buildCard(p: GachaPrize, x: number, y: number): Phaser.GameObjects.Container {
    const tier = prizeTier(p);
    const recipe = TIER_RECIPE[tier];
    const card = this.add.container(x, y).setDepth(3);
    const g = this.add.graphics();
    g.fillStyle(KIT.shadow, 0.25);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 5, CARD_W, CARD_H, 8);
    g.fillStyle(KIT.paperDeep, 1);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    g.lineStyle(tier === 'common' ? 3 : 4, recipe.tint, 1);
    g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    card.add(g);
    card.add(this.add.image(0, -16, this.prizeIcon(p)).setDisplaySize(62, 62));
    card.add(this.add.text(0, 40, this.prizeLabel(p), { ...typography.caption, fontStyle: 'bold', color: KIT.textDark }).setOrigin(0.5));
    card.setAlpha(0); // 由 revealCard 控制揭示
    return card;
  }

  private drawResult(width: number): void {
    if (this.lastPrizes.length === 0) {
      // 空态：抽奖机即视觉锚点，下方补引导文案
      this.add
        .text(width / 2, 700, '抽一次试试手气', { ...typography.heading, color: KIT.textDark })
        .setOrigin(0.5)
        .setDepth(3);
      const owned = this.save?.progress.unlockedUnits.length ?? 0;
      this.add
        .text(width / 2, 742, `已收集 ${owned} / ${allUnits.length} 角色 · 钻石十连必出未拥有`, { ...typography.body, color: KIT.textSub })
        .setOrigin(0.5)
        .setDepth(3);
      return;
    }

    const ten = this.lastPrizes.length > 1;
    this.add
      .text(width / 2, TITLE_Y, ten ? '十连结果' : '单抽结果', { ...typography.subheading, color: KIT.textDark })
      .setOrigin(0.5)
      .setDepth(3);

    // 抽奖机反馈：本次有结果即脉冲一次
    this.machine?.pulse();

    const total = this.lastPrizes.length;
    const stagger = 110;
    this.lastPrizes.forEach((p, i) => {
      const col = ten ? i % COLS : 0;
      const row = ten ? Math.floor(i / COLS) : 0;
      const x = ten ? width / 2 + (col - (COLS - 1) / 2) * (CARD_W + GAP_X) : width / 2;
      const y = CARD_Y0 + row * (CARD_H + GAP_Y);
      const card = this.buildCard(p, x, y);
      const handle = revealCard(this, card, {
        tier: prizeTier(p),
        delay: i * stagger,
        isNew: this.isNew(i),
        width: CARD_W,
        height: CARD_H,
        x,
        y,
      });
      this.reveals.push(handle);
    });

    if (ten) this.drawSkipButton(width, total * stagger + 600);
  }

  /** 十连跳过：立即把全部卡片置为终态并移除按钮。 */
  private drawSkipButton(width: number, lifetimeMs: number): void {
    const bx = width - 180;
    const by = TITLE_Y - 28;
    const btn = pixelButton(this, bx, by, 140, 56, '跳过', {
      depth: 5,
      accent: KIT.woodLight,
      onClick: () => this.skipAll(),
    });
    this.skipParts.push(btn.container, btn.hit);
    // 揭示自然结束后自动移除（避免残留可点区域）
    this.time.delayedCall(lifetimeMs, () => this.clearSkipButton());
  }

  private clearSkipButton(): void {
    for (const p of this.skipParts) p.destroy();
    this.skipParts = [];
  }

  private skipAll(): void {
    for (const r of this.reveals) r.finalize();
    this.reveals = [];
    this.clearSkipButton();
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
        case 'item':
          if (p.name) save.inventory[p.name] = (save.inventory[p.name] ?? 0) + p.amount;
          break;
      }
    }
    writeSave(window.localStorage, save);
    this.registry.set('save', save);
  }

  /** 计算"首次获得"的奖品位次（须在 applyPrizes 之前调用，否则持有状态已被改写）。 */
  private collectNewIdx(prizes: GachaPrize[]): number[] {
    const save = this.save;
    if (!save) return [];
    const ownedUnits = new Set(save.progress.unlockedUnits);
    const ownedItems = new Set(Object.keys(save.inventory).filter((k) => (save.inventory[k] ?? 0) > 0));
    const idx: number[] = [];
    prizes.forEach((p, i) => {
      if (!p.name) return;
      if (p.kind === 'unit' && !ownedUnits.has(p.name)) {
        idx.push(i);
        ownedUnits.add(p.name); // 同批内去重：同名只标一次 NEW
      }
      if (p.kind === 'item' && !ownedItems.has(p.name)) {
        idx.push(i);
        ownedItems.add(p.name);
      }
    });
    return idx;
  }

  private pullSingle(): void {
    const save = this.save;
    if (!save || save.wallet.seeds < GACHA_COST.singleSeed) return;
    save.wallet.seeds -= GACHA_COST.singleSeed;
    save.gacha.singlePulls += 1;
    const prizes = [rollOnce(this.rng, save.progress.unlockedUnits)];
    const newIdx = this.collectNewIdx(prizes);
    this.applyPrizes(prizes);
    this.lastPrizes = prizes;
    this.registry.set('drawKeepResult', true);
    this.registry.set('drawNewIdx', newIdx);
    this.scene.restart();
  }

  private pullTen(): void {
    const save = this.save;
    if (!save || save.wallet.diamonds < GACHA_COST.diamondTen) return;
    save.wallet.diamonds -= GACHA_COST.diamondTen;
    save.gacha.diamondTenPulls += 1;
    const prizes = rollTen(this.rng, save.progress.unlockedUnits);
    const newIdx = this.collectNewIdx(prizes);
    this.applyPrizes(prizes);
    this.lastPrizes = prizes;
    this.registry.set('drawKeepResult', true);
    this.registry.set('drawNewIdx', newIdx);
    this.scene.restart();
  }
}
