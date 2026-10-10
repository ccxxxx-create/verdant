import Phaser from 'phaser';
import type { EnemyArchetype, UnitArchetype } from '../core/schema/unit.ts';
import type { LevelDef } from '../core/schema/level.ts';
import { registryFrom } from '../core/registry.ts';
import { producerTick } from '../core/economy.ts';
import { readSave, writeSave } from '../core/save.ts';
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
  COL_W,
  COLS,
  GATE_X,
  GRID_Y0,
  GRID_X0,
  ROWS,
  SEED_BAR_H,
  SEED_BAR_Y,
  SUN_PICK_R,
  SUN_REST_X0,
  SUN_REST_X1,
  SUN_REST_Y0,
  SUN_REST_Y1,
  cellRect,
  cellX,
  cellY,
  enemyFeetY,
  pointerToCell,
} from './battleGeometry.ts';

/** 护甲减伤系数（GDD §6.2：布 0/皮 15%/壳 30%/铁 45%）。 */
const ARMOR_MULT: Record<string, number> = { cloth: 1, hide: 0.85, shell: 0.7, iron: 0.55 };

/** 难度节奏（M1C 调参：反馈#4 难度过高——首波推迟/波间拉长/亮相限流）。 */
const FIRST_WAVE_S: Record<string, number> = { teach: 20, normal: 14 };
const BETWEEN_WAVES_S: Record<string, number> = { teach: 16, normal: 12 };
const SPAWN_INTERVAL_S: Record<string, number> = { teach: 2.2, normal: 1.8 };
const WAVE_SCALE: Record<string, number> = { teach: 0.35, normal: 1 };
const FIRST_WAVE_DEFAULT_S = 14;

const CARD_W = 112;
const CARD_H = 128;
const CARD_GAP = 14;
const CARD_X0 = GRID_X0;
const CARD_Y = SEED_BAR_Y + 10;

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

interface UnitInst {
  def: UnitArchetype;
  row: number;
  col: number;
  hp: number;
  img: Phaser.GameObjects.Image;
  lastShot: number;
}

interface EnemyInst {
  def: EnemyArchetype;
  row: number;
  hp: number;
  x: number;
  img: Phaser.GameObjects.Image;
  slowUntil: number;
  burnUntil: number;
  flashUntil: number;
  biteTarget?: UnitInst;
}

interface ProjInst {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  row: number;
  damage: number;
  element: string;
}

interface DropInst {
  x: number;
  restY: number;
  img: Phaser.GameObjects.Image;
  life: number;
  falling: boolean;
}

interface CardRef {
  def: UnitArchetype;
  img: Phaser.GameObjects.Image;
  mask: Phaser.GameObjects.Graphics;
  costText: Phaser.GameObjects.Text;
}

const ELEMENT_BULLET: Record<string, string> = {
  none: 'bullet_pea',
  fire: 'bullet_fire',
  ice: 'bullet_ice',
  electric: 'bullet_electric',
  water: 'bullet_ice',
};

/** 烘焙全部像素纹理（图鉴/战斗共用；幂等）。 */
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
 * 战斗场景（M1C）：PvZ 式布局 + 明亮草原。
 * 布局：顶部信息条(0-108) → 水平种子卡条(108-256) → 6×9 草坪(272-1040) → 左侧篱门。
 * 反馈闭环：#3 点击=格心+幽灵预览；#5 UI 与草坪零重叠；#6 参考 PvZ；#7 光露从天而降。
 * 打击感：闪白/挤压/碎屑/飘字/伤害数字/波次横幅/终波震屏/篱门拦截。
 */
export class BattleScene extends Phaser.Scene {
  private level: LevelDef;
  private archetypes = registryFrom(allUnits, allEnemies);
  private rng = new Rng(0x5eed);
  private units: UnitInst[] = [];
  private enemies: EnemyInst[] = [];
  private projectiles: ProjInst[] = [];
  private drops: DropInst[] = [];
  private lightdew = 150;
  private wave = 0;
  private waveTimer = 20;
  private inWave = false;
  private spawnQueue: { id: string; row: number }[] = [];
  private spawnTimer = 0;
  private dropTimer = 4.5;
  private speed = 1;
  private state: 'playing' | 'won' | 'lost' = 'playing';
  private paused = false;
  private selected?: UnitArchetype;
  private shovelMode = false;
  private cooldownEnd = new Map<string, number>();
  private cooldownStart = new Map<string, number>();
  private now = 0;
  private kills = 0;
  private gates: (Phaser.GameObjects.Image | null)[] = [];
  private banner?: Phaser.GameObjects.Text;
  private cards: CardRef[] = [];
  private shovelBtn?: Phaser.GameObjects.Container;
  private shovelFrame?: Phaser.GameObjects.Graphics;
  private selFrame?: Phaser.GameObjects.Graphics;
  private ghost?: Phaser.GameObjects.Image;
  private cellHighlight?: Phaser.GameObjects.Graphics;
  private sunText?: Phaser.GameObjects.Text;
  private waveText?: Phaser.GameObjects.Text;
  private speedText?: Phaser.GameObjects.Text;
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
    this.resetState();
    ensurePixelTextures(this);
    this.input.mouse?.disableContextMenu();

    this.add.image(960, 540, 'bg_meadow').setDisplaySize(1920, 1080);
    this.drawLaneGuides();
    this.drawGates();
    this.drawHud();
    this.drawSeedBar();
    this.drawWaveProgress();

    this.bannerText('准备布防！点卡片，再点草地', 1.6);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.updateGhost(p));
    this.input.keyboard?.on('keydown-SPACE', () => this.toggleSpeed());
    this.input.keyboard?.on('keydown-ESC', () => {
      this.selected = undefined;
      this.shovelMode = false;
      this.refreshSelectionUi();
    });
  }

  /** 场景重启时重置全部可变状态（审查 P0 惯例，扩展篱门/阳光/铲子）。 */
  private resetState(): void {
    this.rng = new Rng(0x5eed); // 波次序列可复现
    this.units = [];
    this.enemies = [];
    this.projectiles = [];
    this.drops = [];
    this.spawnQueue = [];
    this.cooldownEnd.clear();
    this.cooldownStart.clear();
    this.cards = [];
    this.lightdew = this.level.startingLight;
    this.wave = 0;
    this.waveTimer = FIRST_WAVE_S[this.level.template] ?? FIRST_WAVE_DEFAULT_S;
    this.inWave = false;
    this.spawnTimer = 0;
    this.dropTimer = 4.5;
    this.speed = 1;
    this.state = 'playing';
    this.paused = false;
    this.selected = undefined;
    this.shovelMode = false;
    this.now = 0;
    this.kills = 0;
    this.gates = Array.from({ length: ROWS }, () => null); // 由 drawGates 填充
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
      startingLight: 150,
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

  /** 篱门（割草机式一次性护盾，PvZ 参考反馈#6）；消耗时图像随之消失。 */
  private drawGates(): void {
    for (let r = 0; r < ROWS; r++) {
      this.gates[r] = this.add.image(GATE_X, cellY(r) + 10, 'icon_gate').setScale(3);
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
      .text(100, 54, String(this.lightdew), { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: C_GOLD })
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.waveText = this.add
      .text(960, 54, `第 ${this.wave} / ${this.level.waves} 波`, { ...typography.heading, fontSize: '26px', color: C_CREAM })
      .setOrigin(0.5)
      .setDepth(11);

    this.speedText = this.add
      .text(1760, 54, `${this.speed}× 速度`, { ...typography.heading, fontSize: '22px', color: C_GOLD })
      .setOrigin(1, 0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    this.speedText.on('pointerup', () => { if (this.state === 'playing' && !this.paused) this.toggleSpeed(); });

    // 暂停/回主菜单入口（审查 P1-1：此前对局内无任何退出路径，平板只能关标签页）
    this.pauseBtnText = this.add
      .text(1660, 54, '⏸ 暂停', { ...typography.heading, fontSize: '22px', color: C_CREAM })
      .setOrigin(1, 0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    this.pauseBtnText.on('pointerup', () => this.togglePause());

    this.add
      .text(1880, 100, '空格加速 · 右键/铲子挖除 · ESC 取消', { ...typography.caption, color: C_CREAM })
      .setOrigin(1, 1)
      .setDepth(11)
      .setAlpha(0.8);
  }

  /** 暂停：停止 update 并弹"继续/回主菜单"层（交互件全部场景级，勿放容器）。 */
  private togglePause(): void {
    if (this.state !== 'playing') return;
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

  private drawSeedBar(): void {
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(WOOD, 0.85);
    g.fillRect(0, SEED_BAR_Y, 1920, SEED_BAR_H);
    g.lineStyle(3, WOOD_LIGHT, 0.9);
    g.lineBetween(0, SEED_BAR_Y, 1920, SEED_BAR_Y);
    g.lineBetween(0, SEED_BAR_Y + SEED_BAR_H, 1920, SEED_BAR_Y + SEED_BAR_H);

    const defaultDeck = ['firefly_reed', 'thorn_pea', 'frost_pea', 'ember_fluff', 'wood_core'];
    const deckIds = this.level.unlockUnits.length > 0 ? this.level.unlockUnits : defaultDeck;
    const deck = deckIds.map((id) => this.archetypes.unitById.get(id)).filter((u): u is UnitArchetype => !!u);
    this.cards = [];
    this.selFrame = this.add.graphics().setDepth(12);
    deck.forEach((u, i) => {
      const x = CARD_X0 + i * (CARD_W + CARD_GAP);
      const card = this.add.container(x, CARD_Y).setDepth(11);
      const bgG = this.add.graphics();
      bgG.fillStyle(PAPER, 0.96);
      bgG.fillRoundedRect(0, 0, CARD_W, CARD_H, 8);
      bgG.lineStyle(2, OUTLINE, 1);
      bgG.strokeRoundedRect(0, 0, CARD_W, CARD_H, 8);
      card.add(bgG);
      const img = this.add.image(CARD_W / 2, 52, `unit_${u.id}`).setScale(1.7);
      card.add(img);
      card.add(this.add.image(22, CARD_H - 18, 'icon_lightdew').setScale(1.1));
      const costText = this.add
        .text(38, CARD_H - 18, String(u.cost), { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: C_DARK })
        .setOrigin(0, 0.5);
      card.add(costText);
      const mask = this.add.graphics();
      card.add(mask);
      this.cards.push({ def: u, img, mask, costText });

      // 命中区：场景级 zone（容器 setInteractive 在 depth>0 命中不可靠，实测选卡无响应——与选关层同款修复）
      const hit = this.add.zone(x, CARD_Y, CARD_W, CARD_H).setOrigin(0, 0).setDepth(12).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.state !== 'playing') return;
        this.shovelMode = false;
        this.selected = this.selected?.id === u.id ? undefined : u;
        this.refreshSelectionUi();
      });
    });

    // 铲子按钮（卡片行末尾；平板无右键，PvZ 铲子工具）
    const shovelX = CARD_X0 + deck.length * (CARD_W + CARD_GAP) + 8;
    this.shovelBtn = this.add.container(shovelX, CARD_Y).setDepth(11);
    const sg = this.add.graphics();
    sg.fillStyle(PAPER, 0.9);
    sg.fillRoundedRect(0, 0, CARD_W, CARD_H, 8);
    sg.lineStyle(2, OUTLINE, 1);
    sg.strokeRoundedRect(0, 0, CARD_W, CARD_H, 8);
    this.shovelBtn.add(sg);
    this.shovelBtn.add(this.add.image(CARD_W / 2, CARD_H / 2 - 10, 'icon_shovel').setScale(3));
    this.shovelBtn.add(this.add.text(CARD_W / 2, CARD_H - 22, '铲子', { ...typography.body, color: C_DARK }).setOrigin(0.5));
    this.shovelFrame = this.add.graphics().setDepth(12);
    const shovelHit = this.add.zone(shovelX, CARD_Y, CARD_W, CARD_H).setOrigin(0, 0).setDepth(12).setInteractive({ useHandCursor: true });
    shovelHit.on('pointerup', () => {
      if (this.state !== 'playing' || this.paused) return;
      this.shovelMode = !this.shovelMode;
      this.selected = undefined;
      this.refreshSelectionUi();
    });

    this.add
      .text(1880, CARD_Y + CARD_H / 2, `${this.level.id} · ${this.level.waves} 波`, { ...typography.caption, color: C_CREAM })
      .setOrigin(1, 0.5)
      .setDepth(11)
      .setAlpha(0.85);
  }

  /** 右侧波次进度带（PvZ 旗杆进度参考：旗帜随进度下降，填充上限即当前波）。 */
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
    const ratio = this.level.waves > 0 ? this.wave / this.level.waves : 0;
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
    if (this.selected) {
      const idx = this.cards.findIndex((c) => c.def.id === this.selected?.id);
      if (idx >= 0) {
        const x = CARD_X0 + idx * (CARD_W + CARD_GAP);
        this.selFrame?.lineStyle(4, GOLD_INT, 1);
        this.selFrame?.strokeRoundedRect(x - 2, CARD_Y - 2, CARD_W + 4, CARD_H + 4, 10);
      }
      this.ghost?.destroy();
      this.ghost = this.add.image(0, 0, `unit_${this.selected.id}`).setAlpha(0.55).setDepth(2).setVisible(false);
    } else {
      this.ghost?.destroy();
      this.ghost = undefined;
    }
    if (this.shovelMode) {
      const x = CARD_X0 + this.cards.length * (CARD_W + CARD_GAP) + 8;
      this.shovelFrame?.lineStyle(4, GOLD_INT, 1);
      this.shovelFrame?.strokeRoundedRect(x - 2, CARD_Y - 2, CARD_W + 4, CARD_H + 4, 10);
    }
    this.cellHighlight?.destroy();
    this.cellHighlight = undefined;
  }

  /** 幽灵预览 + 格子高亮（反馈#3：所见即所种）。 */
  private updateGhost(p: Phaser.Input.Pointer): void {
    if (this.state !== 'playing' || this.paused) return;
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
      const occupied = this.units.some((u) => u.row === cell.row && u.col === cell.col);
      const ok = !occupied && this.lightdew >= this.selected.cost;
      hl.fillStyle(ok ? 0xffffff : 0xff5555, ok ? 0.16 : 0.2);
      hl.fillRect(rect.x, rect.y, rect.w, rect.h);
      hl.lineStyle(2, ok ? 0xffffff : 0xff5555, 0.8);
      hl.strokeRect(rect.x, rect.y, rect.w, rect.h);
      if (this.ghost) {
        this.ghost.setPosition(cellX(cell.col), cellY(cell.row)).setVisible(ok);
      }
    } else if (this.shovelMode) {
      const hasUnit = this.units.some((u) => u.row === cell.row && u.col === cell.col);
      hl.fillStyle(hasUnit ? 0xffbb55 : 0xffffff, hasUnit ? 0.18 : 0.08);
      hl.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      hl.fillStyle(0xffffff, 0.05);
      hl.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    this.cellHighlight = hl;
  }

  private toggleSpeed(): void {
    if (this.state !== 'playing') return;
    this.speed = this.speed === 1 ? 2 : 1;
    this.tweens.timeScale = this.speed;
    this.speedText?.setText(`${this.speed}× 速度`);
  }

  // —— 主循环 ——
  update(_time: number, delta: number): void {
    if (this.state !== 'playing' || this.paused) return;
    const clamped = Math.min(delta, 50); // 钳制切后台回来的巨帧
    const dt = (clamped / 1000) * this.speed;
    this.now += clamped * this.speed; // 统一时基：倍速下所有计时同步（now 与 dt 同钳制）

    this.updateSunSpawns(dt);
    this.updateDrops(dt);
    this.updateWaves(dt);
    this.updateUnits();
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateCards();
    this.sunText?.setText(String(this.lightdew));
    this.waveText?.setText(`第 ${this.wave} / ${this.level.waves} 波`);
    this.redrawWaveBar();
  }

  // —— 光露（反馈#7：从天而降 + 植株产出，落地停留可收集） ——
  private updateSunSpawns(dt: number): void {
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = 7 + this.rng.next() * 4;
      this.spawnSkySun();
    }
  }

  private spawnSkySun(): void {
    const x = SUN_REST_X0 + this.rng.next() * (SUN_REST_X1 - SUN_REST_X0);
    const restY = SUN_REST_Y0 + this.rng.next() * (SUN_REST_Y1 - SUN_REST_Y0);
    const img = this.add.image(x, -40, 'icon_lightdew').setScale(1.6).setDepth(3);
    const drop: DropInst = { x, restY, img, life: 14, falling: true };
    this.drops.push(drop);
    this.tweens.add({
      targets: img,
      y: restY,
      duration: 4200,
      ease: 'Sine.easeIn',
      onComplete: () => {
        drop.falling = false;
      },
    });
  }

  private spawnPlantSun(u: UnitInst): void {
    const restY = u.img.y - 44;
    const img = this.add.image(u.img.x + 14, u.img.y - 70, 'icon_lightdew').setScale(1.3).setDepth(3);
    const drop: DropInst = { x: img.x, restY, img, life: 14, falling: true };
    this.drops.push(drop);
    this.tweens.add({
      targets: img,
      y: restY,
      duration: 420,
      ease: 'Back.easeOut',
      onComplete: () => {
        drop.falling = false;
      },
    });
  }

  private updateDrops(dt: number): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (!d || d.falling) continue;
      d.life -= dt;
      d.img.y = d.restY + Math.sin(this.now / 300 + i) * 3;
      d.img.setAlpha(d.life < 3 ? 0.35 + 0.65 * Math.abs(Math.sin(this.now / 130)) : 1);
      if (d.life <= 0) {
        d.img.destroy();
        this.drops.splice(i, 1);
      }
    }
  }

  /** 收集阳光：飞向左上计数器（PvZ 式）。 */
  private collectSun(d: DropInst): void {
    this.lightdew += 25;
    this.floatText(d.x, d.img.y - 20, '+25', C_GOLD);
    this.debris(d.x, d.img.y, 'y', 4);
    const img = d.img;
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

  // —— 波次导演（GDD §8.2 简化口径 + M1C 节奏调参） ——
  private updateWaves(dt: number): void {
    if (!this.inWave) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0 && this.wave < this.level.waves) this.startWave();
      return;
    }
    this.spawnTimer -= dt;
    if (this.spawnQueue.length > 0 && this.spawnTimer <= 0) {
      const item = this.spawnQueue.shift();
      if (item) this.spawnEnemy(item.id, item.row);
      this.spawnTimer = SPAWN_INTERVAL_S[this.level.template] ?? 1.8;
    }
    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.inWave = false;
      if (this.wave >= this.level.waves) {
        this.winLevel();
        return;
      }
      this.waveTimer = BETWEEN_WAVES_S[this.level.template] ?? 12;
    }
  }

  private startWave(): void {
    const scale = WAVE_SCALE[this.level.template] ?? 1;
    const isFinal = this.wave + 1 === this.level.waves;
    const budget = Math.max(1, Math.round(6 * (1 + (this.wave + 1) * 0.3) * scale * (isFinal ? 2.5 : 1)));
    const pool = this.level.pool.map((id) => this.archetypes.enemyById.get(id)).filter((e): e is EnemyArchetype => !!e);
    if (pool.length === 0) {
      // 数据错误 fail-fast：绝不放空波让其"零战斗通关"发 3 星（审查 P1-4）
      this.bannerText('关卡数据错误：亮相池为空', 2.5);
      this.time.delayedCall(2600 / this.speed, () => this.scene.start('Menu'));
      return;
    }
    this.wave += 1;
    this.inWave = true;
    this.spawnQueue = [];
    let left = budget;
    let guard = 0;
    let laneCursor = 0;
    // teach 前 3 波每行至多 1 只（审查 P1-3：原首波 2 只同行概率 44.5%，新手看不见来向=必败风险）
    const laneDedupe = this.level.template === 'teach' && this.wave <= 3;
    while (left > 0 && guard++ < 80) {
      const pick = pool[this.rng.int(0, pool.length)];
      if (!pick || pick.points <= 0) break; // 点数 0（Boss）不入普通波池
      if (pick.points > left) continue; // 点数超预算换一只（勿 break 浪费预算）
      this.spawnQueue.push({ id: pick.id, row: laneDedupe ? laneCursor++ % ROWS : this.rng.int(0, ROWS) });
      left -= pick.points;
    }
    this.spawnTimer = 0.5;
    if (isFinal) {
      this.bannerText('一大波敌人来袭！', 1.8);
      this.cameras.main.shake(260, 0.005);
    } else {
      this.bannerText(`第 ${this.wave} 波`, 1);
    }
  }

  private spawnEnemy(id: string, row: number): void {
    const def = this.archetypes.enemyById.get(id);
    if (!def) return;
    const img = this.add.image(1960, 0, `enemy_${id}`);
    const h = img.displayHeight;
    // 飞行单位悬空于车道上方（PvZ 气球式）；地面单位脚贴行底（防漂浮）
    img.y = def.flying ? cellY(row) - 30 : enemyFeetY(row, h);
    this.enemies.push({ def, row, hp: def.hp, x: 1960, img, slowUntil: 0, burnUntil: 0, flashUntil: 0 });
  }

  // —— 单位行为 ——
  private updateUnits(): void {
    for (const u of this.units) {
      const def = u.def;
      if (def.produce && this.now - u.lastShot >= def.produce.intervalMs) {
        u.lastShot = this.now;
        // 收益只走掉落路径：立即到账为 0，阳光须玩家点击收集（反馈#7 + 审查 P1-1）
        const tick = producerTick(def);
        this.lightdew += tick.immediateGain;
        if (tick.spawnsDrop) this.spawnPlantSun(u);
        this.squash(u.img);
        continue;
      }
      const a = def.attack;
      if (!a) continue;
      const interval = a.intervalMs ?? 1400;
      if (this.now - u.lastShot < interval) continue;
      const target = this.nearestEnemyInRow(u.row, u.img.x - 20);
      if (!target) continue;
      u.lastShot = this.now;
      this.squash(u.img);
      const el = a.element ?? 'none';
      const key = ELEMENT_BULLET[el] ?? 'bullet_pea';
      const img = this.add.image(u.img.x + 40, u.img.y - 24, key);
      this.projectiles.push({
        img,
        x: img.x,
        y: img.y,
        row: u.row,
        damage: (a.damage ?? 20) * (a.shots ?? 1),
        element: el,
      });
    }
  }

  private nearestEnemyInRow(row: number, fromX: number): EnemyInst | undefined {
    let best: EnemyInst | undefined;
    for (const e of this.enemies) {
      if (e.row !== row || e.x < fromX) continue;
      if (!best || e.x < best.x) best = e;
    }
    return best;
  }

  // —— 敌人行为 ——
  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e) continue;
      const fireResist = e.def.traits?.includes('fire_resist') ?? false;
      if (e.burnUntil > this.now) {
        e.hp -= (fireResist ? 7 : 15) * dt;
        if (this.rng.next() < dt * 6) this.debris(e.x, e.img.y, 'R', 1);
      }
      if (e.flashUntil && e.flashUntil < this.now) {
        e.img.clearTint();
        e.flashUntil = 0;
      }
      if (!e.def.flying) {
        if (!e.biteTarget) {
          // 咬同 row 身前最近的单位
          let best: UnitInst | undefined;
          for (const u of this.units) {
            if (u.row !== e.row || u.hp <= 0) continue;
            const dx = e.x - 14 - u.img.x;
            if (dx >= -10 && dx < COL_W * 0.7) {
              if (!best || u.img.x > best.img.x) best = u;
            }
          }
          if (best) e.biteTarget = best;
        }
        if (e.biteTarget) {
          e.biteTarget.hp -= e.def.biteDps * dt;
          e.img.x = e.biteTarget.img.x + 20;
          e.x = e.img.x; // 同步逻辑坐标（命中/飘字用）
          if (e.biteTarget.hp <= 0) {
            const dead = e.biteTarget;
            e.biteTarget = undefined;
            this.removeUnit(dead, true);
          }
        } else {
          const slowImmune = e.def.traits?.includes('slow_immune') ?? false;
          const slow = !slowImmune && e.slowUntil > this.now ? 0.55 : 1;
          e.x -= e.def.speed * COL_W * slow * dt;
          e.img.x = e.x;
          e.img.setAngle(Math.sin(this.now / 140) * 2); // 行走摇摆
        }
      } else {
        // 飞行：掠过单位直扑篱门（减速同样尊重 slow_immune，审查 P2-6）
        const slowImmune = e.def.traits?.includes('slow_immune') ?? false;
        const slow = !slowImmune && e.slowUntil > this.now ? 0.6 : 1;
        e.x -= e.def.speed * COL_W * slow * dt;
        e.img.x = e.x;
        e.img.y = cellY(e.row) - 30 + Math.sin(this.now / 220) * 6;
      }
      if (e.x < GATE_X + 20) {
        const gate = this.gates[e.row];
        if (gate) {
          // 篱门拦截：一次性护盾（割草机式，反馈#6/#4），消耗后图标消失
          gate.destroy();
          this.gates[e.row] = null;
          this.cameras.main.flash(160, 255, 220, 120);
          this.floatText(GATE_X + 60, cellY(e.row) - 30, '篱门拦截！', C_CREAM);
          this.debris(GATE_X + 20, cellY(e.row), 'n', 10);
          this.killEnemy(i);
          continue;
        }
        this.loseLevel();
        return;
      }
      if (e.hp <= 0) this.killEnemy(i);
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p) continue;
      p.x += 620 * dt;
      p.img.x = p.x;
      const hit = this.nearestEnemyInRow(p.row, p.x - 10);
      if (hit && Math.abs(hit.x - p.x) < 30) {
        const mult = ARMOR_MULT[hit.def.armor] ?? 1;
        const dmg = Math.round(p.damage * mult);
        hit.hp -= dmg;
        hit.img.setTintFill(0xffffff);
        hit.flashUntil = this.now + 80;
        if (p.element === 'ice' && !(hit.def.traits?.includes('slow_immune') ?? false)) hit.slowUntil = this.now + 2200;
        if (p.element === 'fire' && !(hit.def.traits?.includes('fire_resist') ?? false)) hit.burnUntil = this.now + 4000;
        this.debris(p.x, p.y, 'h', 3);
        this.floatText(hit.x, hit.img.y - 30, String(dmg), '#FFFFFF', 15);
        p.img.destroy();
        this.projectiles.splice(i, 1);
        if (hit.hp <= 0) this.killEnemy(this.enemies.indexOf(hit));
      } else if (p.x > 1980) {
        p.img.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  // —— 交互 ——
  private onPointer(p: Phaser.Input.Pointer): void {
    if (this.state !== 'playing' || this.paused) return;
    // 1) 铲除/光标意图优先（审查 P2-1：铲子模式下不再被阳光抢走同一次点击）
    if (p.rightButtonDown() || this.shovelMode) {
      const cell = pointerToCell(p.x, p.y);
      if (cell) this.digAt(cell.row, cell.col);
      return;
    }
    // 2) 收集阳光（一次点击只做一个意图；顶条后的下落阳光不可见也不可点）
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (!d || d.img.y < GRID_Y0) continue;
      if (Phaser.Math.Distance.Between(p.x, p.y, d.x, d.img.y) < SUN_PICK_R) {
        this.collectSun(d);
        this.drops.splice(i, 1);
        return;
      }
    }
    // 3) 种植
    if (!this.selected) return;
    const cell = pointerToCell(p.x, p.y);
    if (!cell) return;
    const { row, col } = cell;
    if (this.units.some((u) => u.row === row && u.col === col)) {
      this.flashBanner('这一格已经有单位了', 0.7);
      return;
    }
    const def = this.selected;
    if (this.lightdew < def.cost) {
      this.flashBanner('光露不足', 0.8);
      return;
    }
    if (this.now < (this.cooldownEnd.get(def.id) ?? 0)) {
      this.flashBanner(`${def.name}冷却中`, 0.7);
      return;
    }
    this.plant(def, row, col);
  }

  private plant(def: UnitArchetype, row: number, col: number): void {
    this.lightdew -= def.cost;
    const img = this.add.image(cellX(col), cellY(row), `unit_${def.id}`); // 落点=格心（反馈#3）
    this.units.push({ def, row, col, hp: def.hp, img, lastShot: this.now });
    this.cooldownStart.set(def.id, this.now);
    this.cooldownEnd.set(def.id, this.now + def.cooldownMs);
    this.squash(img, 1.18);
    this.debris(img.x, img.y + 40, 'd', 5); // 种植尘土
    this.selected = undefined;
    this.refreshSelectionUi();
  }

  /** 挖除指定格（右键/铲子；无返还，PvZ 惯例）。 */
  private digAt(row: number, col: number): void {
    const hit = this.units.find((u) => u.row === row && u.col === col);
    if (!hit) return;
    this.removeUnit(hit, false);
    this.floatText(cellX(col), cellY(row) - 30, '已挖除', C_CREAM, 15);
    this.debris(cellX(col), cellY(row), 'd', 6);
  }

  private removeUnit(u: UnitInst, byDeath: boolean): void {
    const idx = this.units.indexOf(u);
    if (idx >= 0) this.units.splice(idx, 1);
    for (const e of this.enemies) {
      if (e.biteTarget === u) {
        e.biteTarget = undefined;
        e.x = e.img.x; // 逻辑位置回同步（防瞬移回跳）
      }
    }
    if (byDeath) this.debris(u.img.x, u.img.y, 'M', 8);
    u.img.destroy();
  }

  private killEnemy(index: number): void {
    const e = this.enemies[index];
    if (!e) return;
    this.kills += 1;
    this.debris(e.x, e.img.y, 'e', 8);
    e.img.destroy();
    this.enemies.splice(index, 1);
  }

  // —— 卡片冷却/可购状态 ——
  private updateCards(): void {
    for (const c of this.cards) {
      const end = this.cooldownEnd.get(c.def.id) ?? 0;
      const start = this.cooldownStart.get(c.def.id) ?? 0;
      const remaining = Math.max(0, end - this.now);
      const total = Math.max(1, end - start);
      c.mask.clear();
      if (remaining > 0) {
        const h = (CARD_H * remaining) / total;
        c.mask.fillStyle(OUTLINE, 0.55);
        c.mask.fillRect(0, 0, CARD_W, h);
      }
      const affordable = this.lightdew >= c.def.cost;
      if (!affordable) c.img.setTint(0x9a9a9a);
      else c.img.clearTint();
      c.costText.setAlpha(affordable ? 1 : 0.45);
    }
  }

  // —— 打击感件套 ——
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
        x: x + (this.rng.next() - 0.5) * 90,
        y: y + (this.rng.next() - 0.5) * 90,
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
      hold,
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

  // —— 结算 ——
  private winLevel(): void {
    this.state = 'won';
    this.persistProgress(3);
    this.bannerText('胜利！晨雾草原守住了', 2);
    this.time.delayedCall(2400 / this.speed, () => this.scene.start('Menu'));
  }

  /** 败北写档：stats.losses（审查 P2-7：此前永不更新）。 */
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

  /** 通关写档：clearedLevels/stars/unlockedUnits/kills（localStorage）。 */
  private persistProgress(stars: number): void {
    try {
      const save = readSave(window.localStorage);
      if (!save.progress.clearedLevels.includes(this.level.id)) {
        save.progress.clearedLevels.push(this.level.id);
      }
      save.progress.stars[this.level.id] = Math.max(save.progress.stars[this.level.id] ?? 0, stars);
      for (const id of this.level.unlockUnits) {
        if (!save.progress.unlockedUnits.includes(id)) save.progress.unlockedUnits.push(id);
      }
      save.stats.wins += 1;
      writeSave(window.localStorage, save);
      this.registry.set('save', save);
    } catch (err) {
      console.error('[save] persist failed', err);
    }
  }

  private loseLevel(): void {
    if (this.state === 'lost') return;
    this.state = 'lost';
    this.persistLoss();
    this.cameras.main.shake(420, 0.012);
    this.cameras.main.flash(300, 120, 20, 20);
    this.bannerText('防线失守…', 2);
    this.time.delayedCall(2400 / this.speed, () => this.scene.start('Menu'));
  }
}
