import Phaser from 'phaser';
import type { EnemyArchetype, UnitArchetype } from '../core/schema/unit.ts';
import type { LevelDef } from '../core/schema/level.ts';
import { registryFrom } from '../core/registry.ts';
import { Rng } from '../core/rng.ts';
import { allEnemies, allUnits } from '../data/archetypes/index.ts';
import { meadowBattleBg } from '../data/pixels/bg/meadow.ts';
import type { PixelSprite } from '../data/pixels/palette.ts';
import { unitSprites } from '../data/pixels/units/meadow.ts';
import { enemySprites, projectileSprites } from '../data/pixels/enemies/meadow.ts';
import { bakePixelTexture } from '../render/pixelTexture.ts';
import { palette, typography } from '../ui/tokens.ts';

const ROWS = 6;
const COLS = 9;
const GATE_X = 130;
const GRID_X0 = 150;
const GRID_Y0 = 150;
const COL_W = (1920 - GRID_X0 - 60) / COLS;
const ROW_H = (1040 - GRID_Y0) / ROWS;

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
  y: number;
  img: Phaser.GameObjects.Image;
  life: number;
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
  for (const u of allUnits) bakePixelTexture(scene, `unit_${u.id}`, (unitSprites[u.id] ?? unitSprites.trifold_arrow) as PixelSprite, 3);
  for (const e of allEnemies) bakePixelTexture(scene, `enemy_${e.id}`, (enemySprites[e.id] ?? enemySprites.march_ant) as PixelSprite, 5);
  bakePixelTexture(scene, 'bg_meadow', meadowBattleBg(), 6);
}

/**
 * 战斗场景（M1）：草原第一关可玩闭环。
 * 循环：选卡→种下→光露产出→自动射击→波次来袭→啃食→破门失败 / 清波胜利。
 * 打击感：闪白 / 挤压 / 死亡碎屑 / 飘字 / 波次横幅 / 破门震屏。
 */
export class BattleScene extends Phaser.Scene {
  private level: LevelDef;
  private archetypes = registryFrom(allUnits, allEnemies);
  private rng = new Rng(0x5eed);
  private units: UnitInst[] = [];
  private enemies: EnemyInst[] = [];
  private projectiles: ProjInst[] = [];
  private drops: DropInst[] = [];
  private lightdew = 50;
  private wave = 0;
  private waveTimer = 8;
  private inWave = false;
  private spawnQueue: string[] = [];
  private spawnTimer = 0;
  private dropTimer = 6;
  private speed = 1;
  private state: 'playing' | 'won' | 'lost' = 'playing';
  private selected?: UnitArchetype;
  private cooldownEnd = new Map<string, number>();
  private now = 0;
  private banner?: Phaser.GameObjects.Text;
  private cardLayer?: Phaser.GameObjects.Container;
  private speedText?: Phaser.GameObjects.Text;

  constructor() {
    super('Battle');
    this.level = this.fallbackLevel();
  }

  create(): void {
    const injected = this.registry.get('level') as LevelDef | undefined;
    if (injected) this.level = injected;
    this.lightdew = this.level.startingLight;
    ensurePixelTextures(this);

    this.add.image(960, 540, 'bg_meadow').setDisplaySize(1920, 1080);
    this.drawLaneGuides();
    this.drawGate();
    this.drawHud();
    this.drawCards();

    this.bannerText('准备布防…', 1.2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.input.keyboard?.on('keydown-SPACE', () => this.toggleSpeed());
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
      unlockUnits: [],
      starCondition: 'none',
      startingLight: 75,
      plantFood: true,
    };
  }

  // —— 网格几何 ——
  private cellX(col: number): number {
    return GRID_X0 + col * COL_W + COL_W / 2;
  }
  private cellY(row: number): number {
    return GRID_Y0 + row * ROW_H + ROW_H / 2;
  }

  private drawLaneGuides(): void {
    const g = this.add.graphics();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        g.lineStyle(1, 0xffffff, 0.05);
        g.strokeRect(GRID_X0 + c * COL_W, GRID_Y0 + r * ROW_H, COL_W, ROW_H);
      }
    }
  }

  private drawGate(): void {
    for (let r = 0; r < ROWS; r++) {
      this.add.image(GATE_X - 40, this.cellY(r), 'icon_lightdew').setScale(2).setAlpha(0.85).setTint(0x8a8578);
    }
  }

  // —— HUD ——
  private drawHud(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0f2e27, 0.85);
    g.fillRect(0, 0, 1920, 132);
    g.lineStyle(2, 0x5e8b7e, 1);
    g.lineBetween(0, 132, 1920, 132);

    this.add.image(70, 66, 'icon_lightdew').setScale(2);
    this.add
      .text(104, 66, String(this.lightdew), {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#F2C14E',
      })
      .setOrigin(0, 0.5)
      .setData('dew', true);

    this.add
      .text(960, 60, `波次 ${this.wave}/${this.level.waves}`, { ...typography.heading, color: '#DCE8DF' })
      .setOrigin(0.5)
      .setData('wave', true);

    this.speedText = this.add
      .text(1750, 66, `${this.speed}× 速度`, { ...typography.body, color: '#F2C14E' })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.speedText.on('pointerup', () => this.toggleSpeed());

    this.add
      .text(1850, 66, '左键种植 · 右键铲除', { ...typography.caption, color: '#9DBFA9' })
      .setOrigin(1, 0.5)
      .setAlpha(0.7);
  }

  private refreshHudTexts(): void {
    const dew = this.children.list.find((c) => c.getData('dew')) as Phaser.GameObjects.Text | undefined;
    if (dew) dew.setText(String(this.lightdew));
    const wave = this.children.list.find((c) => c.getData('wave')) as Phaser.GameObjects.Text | undefined;
    if (wave) wave.setText(`波次 ${this.wave}/${this.level.waves}`);
    this.speedText?.setText(`${this.speed}× 速度`);
  }

  private drawCards(): void {
    const deckIds = ['firefly_reed', 'thorn_pea', 'frost_pea', 'ember_fluff', 'wood_core', 'tether_moss'];
    const deck = deckIds.map((id) => this.archetypes.unitById.get(id)).filter((u): u is UnitArchetype => !!u);
    this.cardLayer = this.add.container(0, 0);
    deck.forEach((u, i) => {
      const card = this.add.container(24, 160 + i * 130);
      const g = this.add.graphics();
      g.fillStyle(0x0f2e27, 0.9);
      g.fillRoundedRect(0, 0, 104, 118, 4);
      g.lineStyle(2, 0x5e8b7e, 1);
      g.strokeRoundedRect(0, 0, 104, 118, 4);
      card.add(g);
      card.add(this.add.image(52, 46, `unit_${u.id}`).setScale(0.8));
      card.add(
        this.add
          .text(52, 92, String(u.cost), {
            fontFamily: 'system-ui, "PingFang SC", sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#F2C14E',
          })
          .setOrigin(0.5),
      );
      const mask = this.add.graphics();
      card.add(mask);

      card.setSize(104, 118);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerup', () => {
        this.selected = this.selected?.id === u.id ? undefined : u;
        this.flashBanner(this.selected ? `已选「${u.name}」，点击草地种下` : '取消选择', 0.9);
      });
      card.setData('mask', mask);
      card.setData('def', u);
      this.cardLayer?.add(card);
    });
  }

  private toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    this.tweens.timeScale = this.speed;
    this.speedText?.setText(`${this.speed}× 速度`);
  }

  // —— 主循环 ——
  update(_time: number, delta: number): void {
    if (this.state !== 'playing') return;
    const dt = (delta / 1000) * this.speed;
    this.now += delta; // 冷却/计时按真实毫秒（不受倍速影响的卡片冷却手感更稳）

    this.updateDrops(dt);
    this.updateWaves(dt);
    this.updateUnits();
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.refreshHudTexts();
  }

  private updateDrops(dt: number): void {
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = 9 + this.rng.next() * 5;
      const col = 1 + this.rng.int(0, COLS - 1);
      const row = this.rng.int(0, ROWS);
      const img = this.add.image(this.cellX(col), this.cellY(row), 'icon_lightdew').setScale(1.2);
      this.drops.push({ x: img.x, y: img.y, img, life: 12 });
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (!d) continue;
      d.life -= dt;
      d.img.y = d.y + Math.sin(this.now / 300 + i) * 4;
      if (d.life <= 0) {
        d.img.destroy();
        this.drops.splice(i, 1);
      }
    }
  }

  private updateWaves(dt: number): void {
    if (!this.inWave) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0 && this.wave < this.level.waves) this.startWave();
      return;
    }
    this.spawnTimer -= dt;
    if (this.spawnQueue.length > 0 && this.spawnTimer <= 0) {
      const id = this.spawnQueue.shift();
      if (id) this.spawnEnemy(id);
      this.spawnTimer = 1.4;
    }
    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.inWave = false;
      if (this.wave >= this.level.waves) {
        this.winLevel();
        return;
      }
      this.waveTimer = 11;
    }
  }

  private startWave(): void {
    this.wave += 1;
    this.inWave = true;
    const scale = this.level.template === 'teach' ? 0.35 : 1;
    const budget = Math.max(1, Math.round(6 * (1 + this.wave * 0.3) * scale));
    const pool = this.level.pool.map((id) => this.archetypes.enemyById.get(id)).filter((e): e is EnemyArchetype => !!e);
    this.spawnQueue = [];
    let left = budget;
    let guard = 0;
    while (left > 0 && guard++ < 60) {
      const pick = pool[this.rng.int(0, pool.length)];
      if (!pick || pick.points > left) break;
      this.spawnQueue.push(pick.id);
      left -= pick.points;
    }
    this.spawnTimer = 0.5;
    const isFlag = this.wave % 10 === 0;
    this.bannerText(`第 ${this.wave} 波${isFlag ? ' · 大旗波！' : ''}`, isFlag ? 1.5 : 1);
    if (isFlag) this.cameras.main.shake(200, 0.004);
  }

  private spawnEnemy(id: string): void {
    const def = this.archetypes.enemyById.get(id);
    if (!def) return;
    const row = this.rng.int(0, ROWS);
    const img = this.add.image(1900, this.cellY(row), `enemy_${id}`);
    this.enemies.push({ def, row, hp: def.hp, x: 1900, img, slowUntil: 0, burnUntil: 0, flashUntil: 0 });
  }

  private updateUnits(): void {
    for (const u of this.units) {
      const def = u.def;
      if (def.produce && this.now - u.lastShot >= def.produce.intervalMs) {
        u.lastShot = this.now;
        this.lightdew += def.produce.amount;
        this.floatText(u.img.x, u.img.y - 40, `+${def.produce.amount}`, '#F2C14E');
        this.squash(u.img);
        continue;
      }
      const a = def.attack;
      if (!a) continue;
      const interval = a.intervalMs ?? 1400;
      if (this.now - u.lastShot < interval) continue;
      const target = this.nearestEnemyInRow(u.row, u.img.x);
      if (!target) continue;
      u.lastShot = this.now;
      this.squash(u.img);
      const el = a.element ?? 'none';
      const key = ELEMENT_BULLET[el] ?? 'bullet_pea';
      const img = this.add.image(u.img.x + 30, u.img.y - 10, key);
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

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e) continue;
      if (e.burnUntil > this.now) {
        e.hp -= 15 * dt;
        if (this.rng.next() < dt * 6) this.debris(e.x, e.img.y, 'R', 1);
      }
      if (e.flashUntil && e.flashUntil < this.now) {
        e.img.clearTint();
        e.flashUntil = 0;
      }
      if (!e.biteTarget) {
        const target = this.units.find(
          (u) => u.row === e.row && u.hp > 0 && Math.abs(u.img.x - (e.x - 12)) < COL_W * 0.6,
        );
        if (target) e.biteTarget = target;
      }
      if (e.biteTarget) {
        e.biteTarget.hp -= e.def.biteDps * dt;
        e.img.x = e.biteTarget.img.x + 12;
        if (e.biteTarget.hp <= 0) {
          const dead = e.biteTarget;
          e.biteTarget = undefined;
          this.removeUnit(dead, true);
        }
      } else {
        const slow = e.slowUntil > this.now ? 0.5 : 1;
        e.x -= e.def.speed * COL_W * slow * dt;
        e.img.x = e.x;
      }
      if (e.x < GATE_X) {
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
      if (hit && Math.abs(hit.x - p.x) < 26) {
        hit.hp -= p.damage;
        hit.img.setTintFill(0xffffff);
        hit.flashUntil = this.now + 80;
        if (p.element === 'ice') hit.slowUntil = this.now + 2000;
        if (p.element === 'fire') hit.burnUntil = this.now + 5000;
        this.debris(p.x, p.y, 'h', 2);
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
    if (this.state !== 'playing') return;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (!d) continue;
      if (Phaser.Math.Distance.Between(p.x, p.y, d.x, d.img.y) < 46) {
        this.lightdew += 25;
        this.floatText(d.x, d.img.y - 20, '+25', '#F2C14E');
        d.img.destroy();
        this.drops.splice(i, 1);
      }
    }
    if (p.rightButtonDown()) {
      const hit = this.units.find((u) => Phaser.Math.Distance.Between(p.x, p.y, u.img.x, u.img.y) < 60);
      if (hit) this.removeUnit(hit, false);
      return;
    }
    if (!this.selected) return;
    const col = Math.floor((p.x - GRID_X0) / COL_W);
    const row = Math.floor((p.y - GRID_Y0) / ROW_H);
    if (p.x < GRID_X0 || col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    if (this.units.some((u) => u.row === row && u.col === col)) return;
    const def = this.selected;
    if (this.lightdew < def.cost) {
      this.flashBanner('光露不足', 0.8);
      return;
    }
    this.plant(def, row, col);
  }

  private plant(def: UnitArchetype, row: number, col: number): void {
    this.lightdew -= def.cost;
    const img = this.add.image(this.cellX(col), this.cellY(row), `unit_${def.id}`);
    this.units.push({ def, row, col, hp: def.hp, img, lastShot: this.now });
    this.cooldownEnd.set(def.id, this.now + def.cooldownMs);
    this.squash(img, 1.15);
    this.selected = undefined;
  }

  private removeUnit(u: UnitInst, byDeath: boolean): void {
    const idx = this.units.indexOf(u);
    if (idx >= 0) this.units.splice(idx, 1);
    if (byDeath) this.debris(u.img.x, u.img.y, 'M', 8);
    u.img.destroy();
  }

  private killEnemy(index: number): void {
    const e = this.enemies[index];
    if (!e) return;
    this.debris(e.x, e.img.y, 'E', 8);
    e.img.destroy();
    this.enemies.splice(index, 1);
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
    const hex = (palette as Record<string, string>)[colorKey] ?? '#FFFFFF';
    const color = Phaser.Display.Color.HexStringToColor(hex).color;
    for (let i = 0; i < n; i++) {
      const r = this.add.rectangle(x, y, 5, 5, color);
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

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private bannerText(text: string, hold: number): void {
    this.banner?.destroy();
    this.banner = this.add
      .text(960, 420, text, {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#F2C14E',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({
      targets: this.banner,
      alpha: 1,
      duration: 140,
      yoyo: true,
      hold,
      onComplete: () => this.banner?.destroy(),
    });
  }

  private flashBanner(text: string, hold: number): void {
    this.banner?.destroy();
    this.banner = this.add
      .text(960, 320, text, {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#DCE8DF',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
    this.tweens.add({ targets: this.banner, alpha: 0, duration: hold * 1000, onComplete: () => this.banner?.destroy() });
  }

  private winLevel(): void {
    this.state = 'won';
    this.bannerText('胜利！晨雾草原守住了', 2);
    this.time.delayedCall(2200, () => this.scene.start('Menu'));
  }

  private loseLevel(): void {
    if (this.state === 'lost') return;
    this.state = 'lost';
    this.cameras.main.shake(420, 0.012);
    this.cameras.main.flash(300, 120, 20, 20);
    this.bannerText('防线失守…', 2);
    this.time.delayedCall(2200, () => this.scene.start('Menu'));
  }
}
