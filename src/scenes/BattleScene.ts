import Phaser from 'phaser';
import type { LevelDef } from '../core/schema/level.ts';
import type { UnitArchetype } from '../core/schema/unit.ts';
import { registryFrom } from '../core/registry.ts';
import { readSave, writeSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { levelClearReward } from '../core/rewards.ts';
import { SPEED_TOGGLE } from '../core/balance.ts';
import { Rng } from '../core/rng.ts';
import { allEnemies, allUnits } from '../data/archetypes/index.ts';
import { meadowBattleBg } from '../data/pixels/bg/meadow.ts';
import type { PixelSprite } from '../data/pixels/palette.ts';
import { PALETTE } from '../data/pixels/palette.ts';
import { unitSprites } from '../data/pixels/units/meadow.ts';
import { enemySprites, projectileSprites } from '../data/pixels/enemies/meadow.ts';
import { pixelIcons } from '../data/pixels/icons.ts';
import { bakePixelTexture } from '../render/pixelTexture.ts';
import { typography } from '../ui/tokens.ts';
import {
  createBattle,
  step,
  drainEvents,
  cmdPlant,
  cmdDig,
  cmdCollectDrop,
  cmdUsePlantFoodOnUnit,
  cmdUsePlantFoodAtCell,
  findCollectableDrop,
} from '../core/battle/sim.ts';
import type { BattleState, BattleEvent } from '../core/battle/types.ts';
import {
  COLS,
  GATE_X,
  GRID_X0,
  ROWS,
  SEED_BAR_H,
  SEED_BAR_Y,
  cellRect,
  cellX,
  cellY,
  enemyFeetY,
  pointerToCell,
} from './battleGeometry.ts';

const CARD_W = 112;
const CARD_H = 128;
const CARD_GAP = 14;
const CARD_X0 = GRID_X0;

const FONT = 'system-ui, "PingFang SC", sans-serif';
const C_GOLD = '#FFD34D';
const C_CREAM = '#FFF0C2';
const C_DARK = '#26402F';
const WOOD = parseInt((PALETTE.N ?? '#9C6B3C').replace('#', ''), 16);
const WOOD_LIGHT = parseInt((PALETTE.n ?? '#C89A5E').replace('#', ''), 16);
const PAPER = parseInt((PALETTE.g ?? '#F5E9C8').replace('#', ''), 16);
const OUTLINE = parseInt((PALETTE.K ?? '#26402F').replace('#', ''), 16);
const GOLD_INT = parseInt((PALETTE.G ?? '#FFD34D').replace('#', ''), 16);
const CREAM_INT = parseInt((PALETTE.B ?? '#FFF0C2').replace('#', ''), 16);

interface CardRef {
  def: UnitArchetype;
  img: Phaser.GameObjects.Image;
  mask: Phaser.GameObjects.Graphics;
  costText?: Phaser.GameObjects.Text;
  hand?: boolean; // 传送带手牌卡：免冷却免费用
}

const ELEMENT_BULLET: Record<string, string> = {
  none: 'bullet_pea',
  fire: 'bullet_fire',
  ice: 'bullet_ice',
  electric: 'bullet_electric',
  water: 'bullet_ice',
};

/** 烘焙全部像素纹理（图鉴/战斗/选卡共用；幂等）。 */
export function ensurePixelTextures(scene: Phaser.Scene): void {
  for (const u of allUnits) bakePixelTexture(scene, `unit_${u.id}`, (unitSprites[u.id] ?? unitSprites.trifold_arrow) as PixelSprite, 4);
  for (const e of allEnemies) {
    const isBoss = e.id === 'stone_hide_giant';
    bakePixelTexture(scene, `enemy_${e.id}`, (enemySprites[e.id] ?? enemySprites.march_ant) as PixelSprite, isBoss ? 4 : 5);
  }
  for (const [name, sprite] of Object.entries(projectileSprites)) bakePixelTexture(scene, name, sprite, 2); // 弹道（审查 P0：漏烘焙致所有子弹渲染成缺图占位块）
  for (const [name, sprite] of Object.entries(pixelIcons)) {
    // world_ 前缀=图鉴世界徽记：纹理键与 CodexScene 的 world_${w.id} 直连（审查 P1-7：此前从未烘焙→缺图空位）
    bakePixelTexture(scene, name.startsWith('world_') ? name : `icon_${name}`, sprite, 4);
  }
  bakePixelTexture(scene, 'bg_meadow', meadowBattleBg(), 6);
}

/**
 * 战斗场景（M3A 渲染壳）：逻辑全部在 core/battle 内核（step/drainEvents/命令函数），
 * 本场景 = 渲染 + 输入 + FX：每帧同步内核实例坐标，事件驱动打击感件套。
 * 布局：顶部信息条(0-108) → 水平种子卡条(108-256) → 6×9 草坪(272-1040) → 左侧篱门。
 * 打击感保留 M2 验收版：闪白/挤压/碎屑/飘字/伤害数字/波次横幅/终波震屏/小推车拦截。
 */
export class BattleScene extends Phaser.Scene {
  private level: LevelDef;
  private save?: SaveGame;
  private reg = registryFrom(allUnits, allEnemies);
  private bt!: BattleState;
  /** 表现层专用随机（不得动内核 state.rng，防破坏确定性）。 */
  private fxRng = new Rng(0xfacade);
  private speed = 1;
  private paused = false;
  private selected?: UnitArchetype;
  private shovelMode = false;
  private foodMode = false;
  private lastHandKey = '';
  private gates: (Phaser.GameObjects.Image | null)[] = [];
  private unitImgs = new Map<number, Phaser.GameObjects.Image>();
  private enemyImgs = new Map<number, Phaser.GameObjects.Image>();
  private projImgs = new Map<number, Phaser.GameObjects.Image>();
  private dropImgs = new Map<number, Phaser.GameObjects.Image>();
  private cardParts: Phaser.GameObjects.GameObject[] = [];
  private handParts: Phaser.GameObjects.GameObject[] = []; // 传送带手牌卡（重建随内核 hand diff）
  private cards: CardRef[] = [];
  private banner?: Phaser.GameObjects.Text;
  private shovelFrame?: Phaser.GameObjects.Graphics;
  private foodFrame?: Phaser.GameObjects.Graphics;
  private selFrame?: Phaser.GameObjects.Graphics;
  private ghost?: Phaser.GameObjects.Image;
  private cellHighlight?: Phaser.GameObjects.Graphics;
  private sunText?: Phaser.GameObjects.Text;
  private waveText?: Phaser.GameObjects.Text;
  private speedText?: Phaser.GameObjects.Text;
  private foodText?: Phaser.GameObjects.Text;
  private waveBar?: Phaser.GameObjects.Graphics;
  private pauseParts: Phaser.GameObjects.GameObject[] = [];
  private pauseBtnText?: Phaser.GameObjects.Text;
  private waveFlag?: Phaser.GameObjects.Image;

  constructor() {
    super('Battle');
    this.level = this.fallbackLevel();
  }

  create(): void {
    const injected = this.registry.get('level') as LevelDef | undefined;
    if (injected) this.level = injected;
    this.registry.remove('level'); // 一次性消费（与 deck 同纪律，审查 P2）
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    this.resetState();
    ensurePixelTextures(this);
    this.input.mouse?.disableContextMenu();

    this.add.image(960, 540, 'bg_meadow').setDisplaySize(1920, 1080);
    this.drawLaneGuides();
    this.drawGates();
    this.drawHud();
    this.drawSeedBar();
    this.drawWaveProgress();

    // 数据错误 fail-fast：绝不放空波让其"零战斗通关"发 3 星（M1C 审查 P1-4 防线，内核侧 pool 过滤后为空即此因）
    if (this.level.pool.length === 0) {
      this.bannerText('关卡数据错误：亮相池为空', 2.5);
      this.time.delayedCall(2600, () => this.scene.start('Menu'));
      return;
    }

    this.bannerText('准备布防！点卡片，再点草地', 1.6);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.updateGhost(p));
    this.input.keyboard?.on('keydown-SPACE', () => this.toggleSpeed());
    this.input.keyboard?.on('keydown-ESC', () => {
      this.selected = undefined;
      this.shovelMode = false;
      this.foodMode = false;
      this.refreshSelectionUi();
    });
  }

  /** 场景重启时重置全部可变状态（审查 P0 惯例）。 */
  private resetState(): void {
    this.bt = createBattle({
      level: this.level,
      units: this.reg.unitById,
      enemies: this.reg.enemyById,
      deck: this.resolveDeck(),
      seed: 0x5eed, // 波次序列可复现
    });
    this.fxRng = new Rng(0xfacade);
    this.speed = 1;
    this.paused = false;
    this.selected = undefined;
    this.shovelMode = false;
    this.foodMode = false;
    this.lastHandKey = '';
    this.gates = Array.from({ length: ROWS }, () => null); // 由 drawGates 填充
    this.unitImgs.clear();
    this.enemyImgs.clear();
    this.projImgs.clear();
    this.dropImgs.clear();
    for (const go of this.cardParts) go.destroy();
    this.cardParts = [];
    for (const go of this.handParts) go.destroy();
    this.handParts = [];
    this.cards = [];
    this.banner?.destroy();
    this.banner = undefined;
    for (const go of this.pauseParts) go.destroy();
    this.pauseParts = [];
    this.ghost?.destroy();
    this.ghost = undefined;
    this.cellHighlight?.destroy();
    this.cellHighlight = undefined;
    this.tweens.timeScale = 1;
  }

  /** 牌组来源：选卡面板注入 → owned 截前 8（M3-D1 兜底）；一次性消费。 */
  private resolveDeck(): string[] {
    const injected = this.registry.get('deck') as string[] | undefined;
    this.registry.remove('deck');
    if (injected && injected.length > 0) return injected.slice(0, 8);
    const owned = this.save?.progress.unlockedUnits.length ? this.save.progress.unlockedUnits : ['firefly_reed', 'thorn_pea'];
    return owned.slice(0, 8);
  }

  private fallbackLevel(): LevelDef {
    return {
      id: 'meadow-1-1',
      world: 'meadow',
      template: 'teach',
      rows: 6,
      cols: 9,
      terrain: { waterColumns: [], brokenCells: [], iceColumns: [], wind: 'none' },
      waves: 10,
      pool: ['march_ant'],
      unlockUnits: ['firefly_reed', 'thorn_pea'],
      starCondition: 'none',
      startingLight: 50,
      plantFood: true,
    };
  }

  // —— 静态绘制 ——
  private drawLaneGuides(): void {
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.14);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const rect = cellRect(c, r);
        g.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
    }
  }

  /** 篱门小推车（一次性护盾，PvZ 参考）；消耗由 mower 事件驱动图像消失。 */
  private drawGates(): void {
    for (let r = 0; r < ROWS; r++) {
      this.gates[r] = this.add.image(GATE_X, cellY(r) + 10, 'icon_mower').setScale(3);
    }
  }

  private drawHud(): void {
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(WOOD, 0.92);
    g.fillRect(0, 0, 1920, 108);
    g.lineStyle(3, WOOD_LIGHT, 1);
    g.lineBetween(0, 106, 1920, 106);

    this.add.image(56, 54, 'icon_lightdew').setScale(3).setDepth(11);
    this.sunText = this.add
      .text(100, 54, String(this.bt.lightdew), { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: C_GOLD })
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.waveText = this.add
      .text(960, 54, `第 ${this.bt.wave} / ${this.level.waves} 波`, { ...typography.heading, fontSize: '26px', color: C_CREAM })
      .setOrigin(0.5)
      .setDepth(11);

    this.speedText = this.add
      .text(1760, 54, `${this.speed}× 速度`, { ...typography.heading, fontSize: '22px', color: C_GOLD })
      .setOrigin(1, 0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    this.speedText.on('pointerup', () => { if (this.bt.status === 'playing' && !this.paused) this.toggleSpeed(); });

    // 暂停/回主菜单入口（审查 P1-1：对局内必须可退出）
    this.pauseBtnText = this.add
      .text(1660, 54, '⏸ 暂停', { ...typography.heading, fontSize: '22px', color: C_CREAM })
      .setOrigin(1, 0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    this.pauseBtnText.on('pointerup', () => this.togglePause());

    this.add
      .text(1880, 100, '空格加速 · 右键/铲子挖除 · 能量豆点单位或空地 · ESC 取消', { ...typography.caption, color: C_CREAM })
      .setOrigin(1, 1)
      .setDepth(11)
      .setAlpha(0.8);
  }

  /** 暂停：停止 update 并弹"继续/回主菜单"层（交互件全部场景级，勿放容器）。 */
  private togglePause(): void {
    if (this.bt.status !== 'playing') return;
    this.paused = !this.paused;
    if (this.pauseBtnText) this.pauseBtnText.setText(this.paused ? '▶ 继续' : '⏸ 暂停');
    if (!this.paused) {
      for (const go of this.pauseParts) go.destroy();
      this.pauseParts = [];
      return;
    }
    const dim = this.add.rectangle(960, 540, 1920, 1080, 0x26402f, 0.55).setDepth(30).setInteractive();
    this.pauseParts.push(dim);
    const panel = this.add.graphics().setDepth(31);
    panel.fillStyle(PAPER, 0.98);
    panel.fillRoundedRect(710, 400, 500, 280, 16);
    panel.lineStyle(3, OUTLINE, 1);
    panel.strokeRoundedRect(710, 400, 500, 280, 16);
    this.pauseParts.push(panel);
    const mkBtn = (label: string, y: number, onClick: () => void): void => {
      const g = this.add.graphics().setDepth(32);
      g.fillStyle(WOOD_LIGHT, 1);
      g.fillRoundedRect(770, y, 380, 64, 10);
      this.pauseParts.push(g);
      const t = this.add
        .text(960, y + 32, label, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: C_DARK })
        .setOrigin(0.5)
        .setDepth(32);
      this.pauseParts.push(t);
      const hit = this.add.zone(770, y, 380, 64).setOrigin(0, 0).setDepth(33).setInteractive({ useHandCursor: true });
      hit.on('pointerup', onClick);
      this.pauseParts.push(hit);
    };
    this.pauseParts.push(this.add.text(960, 450, '已暂停', { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: C_DARK }).setOrigin(0.5).setDepth(32));
    mkBtn('继续布防', 500, () => this.togglePause());
    mkBtn('回主菜单', 590, () => this.scene.start('Menu'));
  }

  /** 种子条：普通关=牌组卡；传送带关=手牌区（syncConveyorHand 同步）+ 工具卡。 */
  private drawSeedBar(): void {
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(WOOD, 0.85);
    g.fillRect(0, SEED_BAR_Y, 1920, SEED_BAR_H);
    g.lineStyle(3, WOOD_LIGHT, 0.9);
    g.lineBetween(0, SEED_BAR_Y, 1920, SEED_BAR_Y);
    g.lineBetween(0, SEED_BAR_Y + SEED_BAR_H, 1920, SEED_BAR_Y + SEED_BAR_H);

    this.selFrame = this.add.graphics().setDepth(12);
    this.shovelFrame = this.add.graphics().setDepth(12);
    this.foodFrame = this.add.graphics().setDepth(12);
    this.buildCards();
    this.add
      .text(1880, this.CARD_Y + CARD_H / 2, `${this.level.id} · ${this.level.waves} 波`, { ...typography.caption, color: C_CREAM })
      .setOrigin(1, 0.5)
      .setDepth(11)
      .setAlpha(0.85);
  }

  private get CARD_Y(): number {
    return SEED_BAR_Y + 10;
  }

  /** 工具卡（铲子/能量豆）位置：内容卡之后固定排布（传送带关固定在手牌上限位后，防手牌变化跳动）。 */
  private toolXs(): { shovel: number; food: number } {
    const n = this.bt.conveyor ? (this.level.conveyor?.handLimit ?? 5) : this.cards.filter((c) => !c.hand).length;
    const shovel = CARD_X0 + n * (CARD_W + CARD_GAP) + 8;
    return { shovel, food: shovel + CARD_W + 8 };
  }

  private mkCard(x: number, def: UnitArchetype, opts: { hand?: boolean; showCost?: boolean } = {}): CardRef {
    const card = this.add.container(x, this.CARD_Y).setDepth(11);
    const bgG = this.add.graphics();
    bgG.fillStyle(PAPER, 0.96);
    bgG.fillRoundedRect(0, 0, CARD_W, CARD_H, 8);
    bgG.lineStyle(2, OUTLINE, 1);
    bgG.strokeRoundedRect(0, 0, CARD_W, CARD_H, 8);
    card.add(bgG);
    const img = this.add.image(CARD_W / 2, opts.showCost === false ? CARD_H / 2 : 52, `unit_${def.id}`).setScale(opts.showCost === false ? 2.1 : 1.7);
    card.add(img);
    let costText: Phaser.GameObjects.Text | undefined;
    if (opts.showCost !== false) {
      card.add(this.add.image(22, CARD_H - 18, 'icon_lightdew').setScale(1.1));
      costText = this.add
        .text(38, CARD_H - 18, String(def.cost), { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: C_DARK })
        .setOrigin(0, 0.5);
      card.add(costText);
    }
    const mask = this.add.graphics();
    card.add(mask);
    this.cardParts.push(card);
    // 命中区：场景级 zone（容器 setInteractive 在 depth>0 命中不可靠——M1B 实测教训）
    const hit = this.add.zone(x, this.CARD_Y, CARD_W, CARD_H).setOrigin(0, 0).setDepth(12).setInteractive({ useHandCursor: true });
    this.cardParts.push(hit);
    hit.on('pointerup', () => {
      if (this.bt.status !== 'playing') return;
      this.shovelMode = false;
      this.foodMode = false;
      this.selected = this.selected?.id === def.id ? undefined : def;
      this.refreshSelectionUi();
    });
    const parts = [card, hit];
    if (opts.hand) this.handParts.push(...parts);
    const ref: CardRef = { def, img, mask, costText, hand: opts.hand };
    this.cards.push(ref);
    return ref;
  }

  private mkToolCard(x: number, icon: string, label: string, onClick: () => void): void {
    const card = this.add.container(x, this.CARD_Y).setDepth(11);
    const sg = this.add.graphics();
    sg.fillStyle(PAPER, 0.9);
    sg.fillRoundedRect(0, 0, CARD_W, CARD_H, 8);
    sg.lineStyle(2, OUTLINE, 1);
    sg.strokeRoundedRect(0, 0, CARD_W, CARD_H, 8);
    card.add(sg);
    card.add(this.add.image(CARD_W / 2, CARD_H / 2 - 10, icon).setScale(3));
    card.add(this.add.text(CARD_W / 2, CARD_H - 22, label, { ...typography.body, color: C_DARK }).setOrigin(0.5));
    this.cardParts.push(card);
    const hit = this.add.zone(x, this.CARD_Y, CARD_W, CARD_H).setOrigin(0, 0).setDepth(12).setInteractive({ useHandCursor: true });
    this.cardParts.push(hit);
    hit.on('pointerup', onClick);
  }

  private buildCards(): void {
    for (const go of this.cardParts) go.destroy();
    this.cardParts = [];
    for (const go of this.handParts) go.destroy();
    this.handParts = [];
    this.cards = [];
    if (this.bt.conveyor) {
      // 传送带关：手牌由 syncConveyorHand 重建；工具卡固定在手牌上限位之后（M3-D2 无选卡）
      const { shovel, food } = this.toolXs();
      this.mkToolCard(shovel, 'icon_shovel', '铲子', () => {
        if (this.bt.status !== 'playing' || this.paused) return;
        this.shovelMode = !this.shovelMode;
        this.selected = undefined;
        this.foodMode = false;
        this.refreshSelectionUi();
      });
      this.drawFoodCard(food);
      return;
    }
    const deckDefs = this.bt.config.deck
      .map((id) => this.reg.unitById.get(id))
      .filter((u): u is UnitArchetype => !!u);
    deckDefs.forEach((u) => this.mkCard(CARD_X0 + this.cards.length * (CARD_W + CARD_GAP), u, { showCost: true }));
    const { shovel, food } = this.toolXs();
    this.mkToolCard(shovel, 'icon_shovel', '铲子', () => {
      if (this.bt.status !== 'playing' || this.paused) return;
      this.shovelMode = !this.shovelMode;
      this.selected = undefined;
      this.foodMode = false;
      this.refreshSelectionUi();
    });
    this.drawFoodCard(food);
  }

  private foodCardX = 0;

  private drawFoodCard(x: number): void {
    this.foodCardX = x;
    const card = this.add.container(x, this.CARD_Y).setDepth(11);
    const g = this.add.graphics();
    g.fillStyle(PAPER, 0.9);
    g.fillRoundedRect(0, 0, CARD_W, CARD_H, 8);
    g.lineStyle(2, OUTLINE, 1);
    g.strokeRoundedRect(0, 0, CARD_W, CARD_H, 8);
    card.add(g);
    card.add(this.add.image(CARD_W / 2, CARD_H / 2 - 14, 'icon_energy').setScale(3));
    this.foodText = this.add
      .text(CARD_W / 2, CARD_H - 22, `×${this.bt.plantFood}`, { ...typography.body, color: C_DARK })
      .setOrigin(0.5);
    card.add(this.foodText);
    this.cardParts.push(card);
    const hit = this.add.zone(x, this.CARD_Y, CARD_W, CARD_H).setOrigin(0, 0).setDepth(12).setInteractive({ useHandCursor: true });
    this.cardParts.push(hit);
    hit.on('pointerup', () => {
      if (this.bt.status !== 'playing' || this.paused) return;
      if (this.bt.plantFood <= 0) {
        this.flashBanner('还没有能量豆', 0.7);
        return;
      }
      this.foodMode = !this.foodMode;
      this.selected = undefined;
      this.shovelMode = false;
      this.refreshSelectionUi();
    });
  }

  /** 传送带手牌 diff 重建（内核 hand 变化才动 UI；工具卡固定不动）。 */
  private syncConveyorHand(): void {
    const c = this.bt.conveyor;
    if (!c) return;
    const key = c.hand.join(',');
    if (key === this.lastHandKey) return;
    this.lastHandKey = key;
    for (const go of this.handParts) go.destroy();
    this.handParts = [];
    this.cards = this.cards.filter((r) => !r.hand);
    const handDefs = c.hand
      .map((id) => this.reg.unitById.get(id))
      .filter((u): u is UnitArchetype => !!u);
    handDefs.forEach((u, i) => this.mkCard(CARD_X0 + i * (CARD_W + CARD_GAP), u, { hand: true, showCost: false }));
    if (this.selected && !c.hand.includes(this.selected.id)) this.selected = undefined;
    this.refreshSelectionUi();
  }

  /** 右侧波次进度带（旗帜随进度下降）。 */
  private drawWaveProgress(): void {
    this.waveBar = this.add.graphics().setDepth(11);
    this.waveFlag = this.add.image(1868, 1020, 'icon_flag').setScale(3).setDepth(12);
    this.redrawWaveBar();
  }

  private redrawWaveBar(): void {
    if (!this.waveBar) return;
    const x = 1858;
    const y0 = 330;
    const y1 = 1020;
    const ratio = this.level.waves > 0 ? this.bt.wave / this.level.waves : 0;
    this.waveBar.clear();
    this.waveBar.fillStyle(OUTLINE, 0.28);
    this.waveBar.fillRoundedRect(x, y0, 20, y1 - y0, 6);
    this.waveBar.lineStyle(2, CREAM_INT, 0.85);
    this.waveBar.strokeRoundedRect(x, y0, 20, y1 - y0, 6);
    if (ratio > 0) {
      const h = Math.max(8, (y1 - y0) * ratio);
      this.waveBar.fillStyle(GOLD_INT, 1);
      this.waveBar.fillRoundedRect(x, y1 - h, 20, h, 6);
    }
    this.waveFlag?.setY(Math.max(y0 + 24, y1 - (y1 - y0) * ratio));
  }

  // —— 选择态 UI ——
  private refreshSelectionUi(): void {
    this.selFrame?.clear();
    this.shovelFrame?.clear();
    this.foodFrame?.clear();
    if (this.selected) {
      const idx = this.cards.findIndex((c) => c.def.id === this.selected?.id);
      if (idx >= 0) {
        const x = CARD_X0 + idx * (CARD_W + CARD_GAP);
        this.selFrame?.lineStyle(4, GOLD_INT, 1);
        this.selFrame?.strokeRoundedRect(x - 2, this.CARD_Y - 2, CARD_W + 4, CARD_H + 4, 10);
      }
      this.ghost?.destroy();
      this.ghost = this.add.image(0, 0, `unit_${this.selected.id}`).setAlpha(0.55).setDepth(2).setVisible(false);
    } else {
      this.ghost?.destroy();
      this.ghost = undefined;
    }
    if (this.shovelMode) {
      const { shovel } = this.toolXs();
      this.shovelFrame?.lineStyle(4, GOLD_INT, 1);
      this.shovelFrame?.strokeRoundedRect(shovel - 2, this.CARD_Y - 2, CARD_W + 4, CARD_H + 4, 10);
    }
    if (this.foodMode) {
      this.foodFrame?.lineStyle(4, GOLD_INT, 1);
      this.foodFrame?.strokeRoundedRect(this.foodCardX - 2, this.CARD_Y - 2, CARD_W + 4, CARD_H + 4, 10);
    }
    this.cellHighlight?.destroy();
    this.cellHighlight = undefined;
  }

  /** 幽灵预览 + 格子高亮（反馈#3：所见即所种）。 */
  private updateGhost(p: Phaser.Input.Pointer): void {
    if (this.bt.status !== 'playing' || this.paused) return;
    this.cellHighlight?.destroy();
    this.cellHighlight = undefined;
    const cell = pointerToCell(p.x, p.y);
    if (!cell) {
      if (this.ghost) this.ghost.setVisible(false);
      return;
    }
    const rect = cellRect(cell.col, cell.row);
    const hl = this.add.graphics().setDepth(1);
    if (this.selected) {
      const occupied = this.bt.units.some((u) => u.row === cell.row && u.col === cell.col);
      const fromConveyor = this.bt.conveyor?.hand.includes(this.selected.id) ?? false;
      const ok = !occupied && (fromConveyor || this.bt.lightdew >= this.selected.cost);
      hl.fillStyle(ok ? 0xffffff : 0xff5555, ok ? 0.16 : 0.2);
      hl.fillRect(rect.x, rect.y, rect.w, rect.h);
      hl.lineStyle(2, ok ? 0xffffff : 0xff5555, 0.8);
      hl.strokeRect(rect.x, rect.y, rect.w, rect.h);
      if (this.ghost) {
        this.ghost.setPosition(cellX(cell.col), cellY(cell.row)).setVisible(ok);
      }
    } else if (this.shovelMode) {
      const hasUnit = this.bt.units.some((u) => u.row === cell.row && u.col === cell.col);
      hl.fillStyle(hasUnit ? 0xffbb55 : 0xffffff, hasUnit ? 0.18 : 0.08);
      hl.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else if (this.foodMode) {
      const hasUnit = this.bt.units.some((u) => u.row === cell.row && u.col === cell.col);
      hl.fillStyle(hasUnit ? 0xffe08a : 0xffffff, hasUnit ? 0.2 : 0.08);
      hl.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      hl.fillStyle(0xffffff, 0.05);
      hl.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    this.cellHighlight = hl;
  }

  private toggleSpeed(): void {
    if (this.bt.status !== 'playing') return;
    this.speed = this.speed === 1 ? SPEED_TOGGLE : 1;
    this.tweens.timeScale = this.speed;
    this.speedText?.setText(`${this.speed}× 速度`);
  }

  // —— 主循环：内核 step → 事件 FX → 图像投影 ——
  update(_time: number, delta: number): void {
    if (this.bt.status !== 'playing' || this.paused) return;
    const clamped = Math.min(delta, 50); // 钳制切后台回来的巨帧
    step(this.bt, clamped * this.speed); // 倍速：dt 缩放后交给内核（now 与计时同步缩放）
    for (const ev of drainEvents(this.bt)) this.onEvent(ev);
    this.syncSprites();
    this.syncConveyorHand();
    this.updateCards();
    this.sunText?.setText(String(this.bt.lightdew));
    this.waveText?.setText(`第 ${this.bt.wave} / ${this.level.waves} 波`);
    this.redrawWaveBar();
  }

  // —— 事件 → 打击感（M2 件套逐块移植） ——
  private onEvent(ev: BattleEvent): void {
    switch (ev.t) {
      case 'plant': {
        const img = this.add.image(ev.unit.x, ev.unit.y, `unit_${ev.unit.def.id}`).setDepth(2);
        this.unitImgs.set(ev.unit.uid, img);
        this.squash(img, 1.18);
        this.debris(img.x, img.y + 40, 'd', 5); // 种植尘土
        this.selected = undefined;
        this.refreshSelectionUi();
        break;
      }
      case 'dig': {
        const img = this.unitImgs.get(ev.unit.uid);
        if (img) {
          this.floatText(img.x, img.y - 30, '已挖除', C_CREAM, 15);
          this.debris(img.x, img.y, 'd', 6);
          img.destroy();
          this.unitImgs.delete(ev.unit.uid);
        }
        break;
      }
      case 'enemySpawn':
        break; // 图像由 syncSprites diff 创建
      case 'enemyDeath': {
        const img = this.enemyImgs.get(ev.enemy.eid);
        if (img) {
          this.debris(img.x, img.y, 'e', 8);
          img.destroy();
          this.enemyImgs.delete(ev.enemy.eid);
        }
        break;
      }
      case 'unitDeath': {
        const img = this.unitImgs.get(ev.unit.uid);
        if (img) {
          this.debris(img.x, img.y, 'M', 8);
          img.destroy();
          this.unitImgs.delete(ev.unit.uid);
        }
        break;
      }
      case 'hit': {
        const img = ev.tid !== undefined ? (ev.target === 'enemy' ? this.enemyImgs.get(ev.tid) : this.unitImgs.get(ev.tid)) : undefined;
        if (ev.target === 'enemy') {
          this.debris(ev.x, img?.y ?? ev.y, 'h', 3);
          if (ev.damage > 0) this.floatText(ev.x, (img?.y ?? ev.y) - 30, String(ev.damage), '#FFFFFF', 15);
        }
        break;
      }
      case 'shoot': {
        // 发射单位挤压（shoot 事件无 id：按发射坐标匹配，producer 与攻击单位两种锚点都试）
        for (const img of this.unitImgs.values()) {
          if (Math.abs(img.x - ev.x) < 8 && (Math.abs(img.y - ev.y) < 8 || Math.abs(img.y - (ev.y + 24)) < 8)) {
            this.squash(img);
            break;
          }
        }
        break;
      }
      case 'blast': {
        this.cameras.main.shake(220, 0.006);
        this.debris(ev.x, ev.y, 'R', 16);
        this.debris(ev.x, ev.y, 'r', 10);
        this.floatText(ev.x, ev.y - 70, '轰！', '#FF8A3D');
        break;
      }
      case 'sunCollect': {
        const img = this.dropImgs.get(ev.did);
        this.dropImgs.delete(ev.did);
        if (ev.amount <= 0) {
          // 露珠蛾偷吃（内核 amount=0）
          if (img) {
            this.debris(img.x, img.y, 'g', 4);
            img.destroy();
          }
          break;
        }
        this.floatText(ev.x, ev.y - 20, `+${ev.amount}`, C_GOLD);
        if (img) {
          this.debris(img.x, img.y, 'y', 4);
          this.tweens.add({
            targets: img,
            x: 56,
            y: 54,
            scale: 0.6,
            duration: 420,
            ease: 'Quad.easeIn',
            onComplete: () => img.destroy(),
          });
        }
        break;
      }
      case 'plantFoodCollect': {
        const img = this.dropImgs.get(ev.did);
        this.dropImgs.delete(ev.did);
        if (img) {
          this.floatText(img.x, img.y - 20, '能量+1', '#9BE564');
          this.tweens.add({
            targets: img,
            x: 56,
            y: 54,
            scale: 0.6,
            duration: 420,
            ease: 'Quad.easeIn',
            onComplete: () => img.destroy(),
          });
        }
        break;
      }
      case 'powerStart': {
        this.unitImgs.get(ev.unit.uid)?.setTint(GOLD_INT);
        break;
      }
      case 'powerEnd': {
        this.unitImgs.get(ev.unit.uid)?.clearTint();
        break;
      }
      case 'knockback': {
        this.cameras.main.shake(160, 0.004);
        this.debris(ev.x, ev.y, 'R', 10);
        break;
      }
      case 'stun':
        this.floatText(ev.x, ev.y - 40, '定身！', '#9BD4FF', 16);
        break;
      case 'web':
        this.floatText(ev.x, ev.y - 40, '被缠住了！', '#DDDDDD', 16);
        break;
      case 'shieldBreak':
        this.floatText(ev.x, ev.y - 40, '铁盾碎裂！', C_CREAM, 16);
        this.debris(ev.x, ev.y, 'h', 8);
        break;
      case 'mower': {
        const gate = this.gates[ev.row];
        if (gate) {
          gate.destroy();
          this.gates[ev.row] = null;
        }
        this.cameras.main.flash(160, 255, 220, 120);
        this.floatText(GATE_X + 60, cellY(ev.row) - 30, '小推车出动！', C_CREAM);
        this.debris(GATE_X + 20, cellY(ev.row), 'n', 10);
        break;
      }
      case 'sunSpawn':
      case 'plantFoodSpawn':
        break; // 掉落图像由 syncSprites diff 创建（事件仅为语义标记）
      case 'waveStart':
        if (ev.final) this.cameras.main.shake(260, 0.005); // 终波震屏
        break;
      case 'waveWarning':
        break; // 横幅由 banner 事件驱动
      case 'banner':
        this.bannerText(ev.text, ev.hold);
        break;
      case 'flash':
        this.flashBanner(ev.text, ev.hold);
        break;
      case 'win':
        this.winLevel();
        break;
      case 'lose':
        this.loseLevel();
        break;
      default:
        break;
    }
  }

  /** 渲染层=内核状态的投影：diff 创建/销毁 + 每帧坐标同步。 */
  private syncSprites(): void {
    // 单位（静止，种植锚点=格心）
    const seenU = new Set<number>();
    for (const u of this.bt.units) {
      seenU.add(u.uid);
      let img = this.unitImgs.get(u.uid);
      if (!img) {
        img = this.add.image(u.x, u.y, `unit_${u.def.id}`).setDepth(2);
        this.unitImgs.set(u.uid, img);
      }
    }
    for (const [uid, img] of this.unitImgs) {
      if (!seenU.has(uid)) {
        img.destroy();
        this.unitImgs.delete(uid);
      }
    }
    // 敌人（地面脚贴行底+摇摆；飞行悬空+内核漂移）
    const seenE = new Set<number>();
    for (const e of this.bt.enemies) {
      seenE.add(e.eid);
      let img = this.enemyImgs.get(e.eid);
      if (!img) {
        img = this.add.image(e.x, 0, `enemy_${e.def.id}`).setDepth(3);
        this.enemyImgs.set(e.eid, img);
      }
      img.x = e.x;
      if (e.def.flying) {
        img.y = cellY(e.row) - 30 + e.yOffset;
      } else {
        img.y = enemyFeetY(e.row, img.displayHeight);
        img.setAngle(Math.sin(this.bt.now / 140) * 2); // 行走摇摆
      }
    }
    for (const [eid, img] of this.enemyImgs) {
      if (!seenE.has(eid)) {
        img.destroy();
        this.enemyImgs.delete(eid);
      }
    }
    // 弹体（straight/lobbed 坐标均由内核插值）
    const seenP = new Set<number>();
    for (const p of this.bt.projectiles) {
      seenP.add(p.pid);
      let img = this.projImgs.get(p.pid);
      if (!img) {
        img = this.add.image(p.x, p.y, ELEMENT_BULLET[p.element] ?? 'bullet_pea').setDepth(4);
        this.projImgs.set(p.pid, img);
      }
      img.setPosition(p.x, p.y);
    }
    for (const [pid, img] of this.projImgs) {
      if (!seenP.has(pid)) {
        img.destroy();
        this.projImgs.delete(pid);
      }
    }
    // 掉落（下落 y 由内核插值；静置浮动/临期闪烁是表现层）
    const seenD = new Set<number>();
    for (const d of this.bt.drops) {
      seenD.add(d.did);
      let img = this.dropImgs.get(d.did);
      if (!img) {
        img = this.add
          .image(d.x, d.y, d.kind === 'light' ? 'icon_lightdew' : 'icon_energy')
          .setDepth(3)
          .setScale(d.kind === 'light' ? 1.6 : 1.4);
        this.dropImgs.set(d.did, img);
      }
      const bob = d.falling ? 0 : Math.sin(this.bt.now / 300 + d.did) * 3;
      img.setPosition(d.x, d.y + bob);
      if (!d.falling) img.setAlpha(d.life < 3 ? 0.35 + 0.65 * Math.abs(Math.sin(this.bt.now / 130)) : 1);
    }
    for (const [did, img] of this.dropImgs) {
      if (!seenD.has(did)) {
        img.destroy();
        this.dropImgs.delete(did);
      }
    }
    // 敌人受击白闪（内核 flashUntil 过期只清字段，表现在此同步清 tint）
    for (const [eid, img] of this.enemyImgs) {
      const e = this.bt.enemies.find((x) => x.eid === eid);
      if (!e) continue;
      if (e.flashUntil > this.bt.now) {
        if (!img.isTinted) img.setTintFill(0xffffff);
      } else if (img.isTinted) {
        img.clearTint();
      }
    }
  }

  // —— 卡片冷却/可购状态 ——
  private updateCards(): void {
    for (const c of this.cards) {
      if (c.hand) continue; // 传送带手牌免冷却免费用
      const cd = this.bt.cooldowns[c.def.id];
      const remaining = cd ? Math.max(0, cd.end - this.bt.now) : 0;
      const total = cd ? Math.max(1, cd.end - cd.start) : 1;
      c.mask.clear();
      if (remaining > 0) {
        const h = (CARD_H * remaining) / total;
        c.mask.fillStyle(OUTLINE, 0.55);
        c.mask.fillRect(0, 0, CARD_W, h);
      }
      const affordable = this.bt.lightdew >= c.def.cost;
      if (!affordable) c.img.setTint(0x9a9a9a);
      else c.img.clearTint();
      c.costText?.setAlpha(affordable ? 1 : 0.45);
    }
    this.foodText?.setText(`×${this.bt.plantFood}`);
  }

  // —— 交互 ——
  private onPointer(p: Phaser.Input.Pointer): void {
    if (this.bt.status !== 'playing' || this.paused) return;
    // 1) 铲除/光标意图优先（审查 P2-1：铲子模式下不被阳光抢走同一次点击）
    if (p.rightButtonDown() || this.shovelMode) {
      const cell = pointerToCell(p.x, p.y);
      if (cell) cmdDig(this.bt, cell.row, cell.col);
      return;
    }
    // 2) 能量豆模式：点单位=该单位大招；点空地=击退+火伤
    if (this.foodMode) {
      const cell = pointerToCell(p.x, p.y);
      if (!cell) return;
      const u = this.bt.units.find((x) => x.row === cell.row && x.col === cell.col);
      const ok = u ? cmdUsePlantFoodOnUnit(this.bt, u.uid) : cmdUsePlantFoodAtCell(this.bt, cell.row, cell.col);
      if (ok) {
        this.foodMode = false;
        this.refreshSelectionUi();
      } else {
        this.flashBanner('这里用不了能量豆', 0.7);
      }
      return;
    }
    // 3) 收集露珠/能量（一次点击只做一个意图；内核只匹配已落地者）
    const drop = findCollectableDrop(this.bt, p.x, p.y);
    if (drop) {
      cmdCollectDrop(this.bt, drop.did);
      return;
    }
    // 4) 种植（命令发内核；失败原因提示）
    if (!this.selected) return;
    const cell = pointerToCell(p.x, p.y);
    if (!cell) return;
    const def = this.selected;
    const fromConveyor = this.bt.conveyor?.hand.includes(def.id) ?? false;
    if (this.bt.units.some((u) => u.row === cell.row && u.col === cell.col)) {
      this.flashBanner('这一格已经有单位了', 0.7);
      return;
    }
    if (!fromConveyor && this.bt.lightdew < def.cost) {
      this.flashBanner('光露不足', 0.8);
      return;
    }
    if (!fromConveyor && this.bt.now < (this.bt.cooldowns[def.id]?.end ?? 0)) {
      this.flashBanner(`${def.name}冷却中`, 0.7);
      return;
    }
    if (!cmdPlant(this.bt, def.id, cell.row, cell.col)) {
      this.flashBanner('无法种植', 0.7);
    }
  }

  // —— 打击感件套（M2 移植；随机一律 fxRng，不碰内核随机序列） ——
  private squash(img: Phaser.GameObjects.Image, overshoot = 1.12): void {
    this.tweens.add({
      targets: img,
      scaleY: img.scaleY * (2 - overshoot),
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private debris(x: number, y: number, colorKey: string, n: number): void {
    const hex = (PALETTE as Record<string, string>)[colorKey] ?? '#FFFFFF';
    const color = Phaser.Display.Color.HexStringToColor(hex).color;
    for (let i = 0; i < n; i++) {
      const r = this.add.rectangle(x, y, 5, 5, color).setDepth(4);
      this.tweens.add({
        targets: r,
        x: x + (this.fxRng.next() - 0.5) * 90,
        y: y + (this.fxRng.next() - 0.5) * 90,
        alpha: 0,
        scale: 0.2,
        duration: 300,
        onComplete: () => r.destroy(),
      });
    }
  }

  private floatText(x: number, y: number, text: string, color: string, size = 20): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private bannerText(text: string, hold: number): void {
    this.banner?.destroy();
    const b = this.add
      .text(960, 420, text, { fontFamily: FONT, fontSize: '52px', fontStyle: 'bold', color: C_GOLD })
      .setOrigin(0.5)
      .setDepth(20)
      .setStroke(C_DARK, 8)
      .setAlpha(0);
    this.banner = b;
    this.tweens.add({
      targets: b,
      alpha: 1,
      duration: 140,
      yoyo: true,
      hold: hold * 1000, // 内核 hold 单位秒，Phaser tween hold 单位 ms（审查 P1 修正）
      onComplete: () => b.destroy(), // 闭包捕获自身 target（审查 P2-5）
    });
  }

  private flashBanner(text: string, hold: number): void {
    this.banner?.destroy();
    this.banner = this.add
      .text(960, 330, text, { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: C_CREAM })
      .setOrigin(0.5)
      .setDepth(20)
      .setStroke(C_DARK, 6)
      .setAlpha(0.95);
    this.tweens.add({ targets: this.banner, alpha: 0, duration: hold * 1000, onComplete: () => this.banner?.destroy() });
  }

  // —— 结算（写档沿用 M2 经济；win/lose 事件驱动） ——
  private winLevel(): void {
    this.persistProgress(3);
    this.bannerText('胜利！晨雾草原守住了', 2);
    this.time.delayedCall(2400 / this.speed, () => this.scene.start('Menu'));
  }

  /** 败北写档：stats.losses（审查 P2-7）。 */
  private persistLoss(): void {
    try {
      const save = readSave(window.localStorage);
      save.stats.losses += 1;
      writeSave(window.localStorage, save);
      this.registry.set('save', save);
    } catch (err) {
      console.error('[save] persist failed', err);
    }
  }

  /** 通关写档：clearedLevels/stars/赠送角色/钱包奖励/wins（localStorage）。 */
  private persistProgress(stars: 1 | 2 | 3): void {
    try {
      const save = readSave(window.localStorage);
      const previousStars = save.progress.stars[this.level.id] ?? null;
      const totalStarsBefore = Object.values(save.progress.stars).reduce((a, b) => a + b, 0);
      if (!save.progress.clearedLevels.includes(this.level.id)) {
        save.progress.clearedLevels.push(this.level.id);
      }
      save.progress.stars[this.level.id] = Math.max(previousStars ?? 0, stars);
      for (const id of this.level.unlockUnits) {
        if (!save.progress.unlockedUnits.includes(id)) save.progress.unlockedUnits.push(id);
      }
      const reward = levelClearReward({ level: this.level, stars, previousStars, totalStarsBefore });
      save.wallet.coins += reward.coins;
      save.wallet.diamonds += reward.diamonds;
      save.wallet.seeds += reward.seeds;
      save.wallet.plantFood += reward.plantFood;
      save.stats.wins += 1;
      writeSave(window.localStorage, save);
      this.registry.set('save', save);
    } catch (err) {
      console.error('[save] persist failed', err);
    }
  }

  private loseLevel(): void {
    if (this.bt.status !== 'lost') return;
    this.persistLoss();
    this.cameras.main.shake(420, 0.012);
    this.cameras.main.flash(300, 120, 20, 20);
    this.bannerText('防线失守…', 2);
    this.time.delayedCall(2400 / this.speed, () => this.scene.start('Menu'));
  }
}
