import Phaser from 'phaser';
import { allUnits, allEnemies } from '../data/archetypes/index.ts';
import { registryFrom } from '../core/registry.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { codexWorlds } from '../data/codex/worlds.ts';
import { codexTerrainRules, codexCounters } from '../data/codex/terrain.ts';
import type { UnitArchetype, EnemyArchetype } from '../core/schema/unit.ts';
import { palette, worldPalette, typography, radius, hexToInt, zIndex } from '../ui/tokens.ts';
import { CARD_W, CARD_H, createUnitCard, createEnemyCard, ARMOR_LABEL, ARMOR_COLOR, ROLE_LABEL, ROLE_COLOR } from '../ui/components/cards.ts';
import { drawPixelBackdrop, pixelPanel, sceneHeader, sceneEnter, drawAmbient, KIT, chip, MOTION_ENABLED } from '../ui/components/kit.ts';

type TabId = 'units' | 'enemies' | 'worlds' | 'terrain';

const TAB_LABEL: Record<TabId, string> = {
  units: '角色',
  enemies: '敌人',
  worlds: '世界',
  terrain: '地形',
};

const TAB_COUNT: Record<TabId, number> = {
  units: allUnits.length,
  enemies: allEnemies.length,
  worlds: codexWorlds.length,
  terrain: codexTerrainRules.length,
};

const ELEMENT_LABEL: Record<string, string> = {
  none: '无属性',
  fire: '火',
  water: '水',
  ice: '冰',
  electric: '电',
};

const POWER_LABEL: Record<string, string> = {
  generic: '通用强化：攻速×2，伤害×1.5（8 秒）',
  produce_burst: '产能爆发：8 秒内产出 ×4',
  multi_shot: '连发模式：8 秒内改为三连发',
  instant_trigger: '即刻生效：无需准备时间立即爆炸',
  stun_lane: '全线藤索：定身本行全部敌人 5 秒',
};

/**
 * 图鉴场景（GDD §14）：4 tab + 网格 + 详情弹层。
 * 立绘纹理由像素数据烘焙（ensurePixelTextures，无图片文件加载）。
 */
export class CodexScene extends Phaser.Scene {
  private tab: TabId = 'units';
  private scrollY = 0;
  private scrollMax = 0;
  private content?: Phaser.GameObjects.Container;
  private scrollMaskShape?: Phaser.GameObjects.Graphics;
  private tabChips: Phaser.GameObjects.Container[] = [];
  private tabHits: Phaser.GameObjects.Zone[] = [];

  constructor() {
    super('Codex');
  }

  preload(): void {
    ensurePixelTextures(this);
  }

  create(): void {
    const { width } = this.scale.gameSize;
    drawPixelBackdrop(this);
    drawAmbient(this, { motes: 4, dim: true });
    sceneHeader(this, '图鉴', { subtitle: 'VERDANT CODEX · 收录 51 生灵 / 44 怪兽' });
    this.drawTabs(width);
    this.renderTab(width);
    this.bindScroll();
    sceneEnter(this);
  }

  private drawTabs(width: number): void {
    for (const c of this.tabChips) c.destroy(true);
    for (const h of this.tabHits) h.destroy();
    this.tabHits = [];
    const ids: TabId[] = ['units', 'enemies', 'worlds', 'terrain'];
    const chipW = 240;
    const gap = 24;
    const startX = 60;
    this.tabChips = ids.map((id, i) => {
      const x = startX + i * (chipW + gap);
      const chip = this.add.container(x, 132).setDepth(10);
      const g = this.add.graphics();
      const active = this.tab === id;
      g.fillStyle(KIT.shadow, 0.3);
      g.fillRoundedRect(0, 5, chipW, 56, 6);
      g.fillStyle(active ? KIT.woodLight : KIT.paper, 1);
      g.fillRoundedRect(0, 0, chipW, 56, 6);
      g.lineStyle(3, KIT.outline, active ? 1 : 0.7);
      g.strokeRoundedRect(0, 0, chipW, 56, 6);
      chip.add(g);
      chip.add(this.add.text(chipW / 2, 28, `${TAB_LABEL[id]} · ${TAB_COUNT[id]}`, { ...typography.subheading, color: KIT.textDark }).setOrigin(0.5));
      // 命中区场景级（容器交互在 depth>0 不可靠）；随 tabHits 统一销毁
      const hit = this.add.zone(x, 132, chipW, 56).setOrigin(0, 0).setDepth(zIndex.hud + 1).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.tab === id) return;
        this.tab = id;
        this.drawTabs(width);
        this.renderTab(width);
      });
      this.tabHits.push(hit);
      return chip;
    });
  }

  // —— 内容渲染（按 tab） ——
  private renderTab(width: number): void {
    this.scrollMaskShape?.destroy();
    this.content?.destroy(true);
    this.scrollY = 0;
    const content = this.add.container(0, 0);
    this.content = content;
    this.setupScroll(content, 0); // 非滚动 tab 重置（P1：残留 scrollMax 会拖出空腔）
    switch (this.tab) {
      case 'units':
        this.renderGrid(content, width);
        break;
      case 'enemies':
        this.renderEnemyGrid(content, width);
        break;
      case 'worlds':
        this.renderWorlds(content, width);
        break;
      case 'terrain':
        this.renderTerrain(content, width);
        break;
    }
  }

  private maskShape(): Phaser.Display.Masks.GeometryMask {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillRect(0, 224, this.scale.gameSize.width, 800);
    this.scrollMaskShape = g;
    return g.createGeometryMask();
  }

  private renderGrid(content: Phaser.GameObjects.Container, width: number): void {
    const cols = 6;
    const gapX = 24;
    const gapY = 28;
    const registry = registryFrom(allUnits, allEnemies);
    const rows = Math.ceil(registry.units.length / cols);
    const lastRow = registry.units.length - cols * (rows - 1);
    registry.units.forEach((u, i) => {
      const row = Math.floor(i / cols);
      const inRow = row < rows - 1 ? cols : lastRow;
      const rowW = inRow * CARD_W + (inRow - 1) * gapX;
      const rowX = (width - rowW) / 2; // 末行居中（消除右侧空白）
      const col = i % cols;
      const card = createUnitCard(this, rowX + col * (CARD_W + gapX), 232 + row * (CARD_H + gapY), u, (sel) =>
        this.showUnitDetail(sel, width),
      );
      content.add(card);
    });
    this.setupScroll(content, Math.max(0, rows * (CARD_H + gapY) - gapY - 792));
    this.tweens.add({ targets: content, alpha: { from: 0, to: 1 }, duration: 200 });
  }

  private renderEnemyGrid(content: Phaser.GameObjects.Container, width: number): void {
    const cols = 6;
    const gapX = 24;
    const gapY = 28;
    const registry = registryFrom(allUnits, allEnemies);
    const rows = Math.ceil(registry.enemies.length / cols);
    const lastRow = registry.enemies.length - cols * (rows - 1);
    registry.enemies.forEach((e, i) => {
      const row = Math.floor(i / cols);
      const inRow = row < rows - 1 ? cols : lastRow;
      const rowW = inRow * CARD_W + (inRow - 1) * gapX;
      const rowX = (width - rowW) / 2;
      const col = i % cols;
      const card = createEnemyCard(this, rowX + col * (CARD_W + gapX), 232 + row * (CARD_H + gapY), e, (sel) =>
        this.showEnemyDetail(sel, width),
      );
      content.add(card);
    });
    this.setupScroll(content, Math.max(0, rows * (CARD_H + gapY) - gapY - 792));
    this.tweens.add({ targets: content, alpha: { from: 0, to: 1 }, duration: 200 });
  }

  private setupScroll(content: Phaser.GameObjects.Container, contentH: number): void {
    this.scrollMax = Math.max(0, contentH);
    if (this.scrollMax === 0) return;
    content.setMask(this.maskShape());
  }

  private bindScroll(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.content || this.scrollMax === 0) return;
      const dy = p.position.y - p.prevPosition.y;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + dy, -this.scrollMax, 0);
      this.content.y = this.scrollY;
    });
    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        if (!this.content || this.scrollMax === 0) return;
        this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.6, -this.scrollMax, 0);
        this.tweens.add({ targets: this.content, y: this.scrollY, duration: 120 });
      },
    );
  }

  // —— 世界 / 地形 tab ——
  private renderWorlds(content: Phaser.GameObjects.Container, width: number): void {
    const cardW = 880;
    const cardH = 360;
    const gap = 28;
    const startX = (width - (cardW * 2 + gap)) / 2;
    codexWorlds.forEach((w, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardW + gap);
      const y = 240 + row * (cardH + gap);
      const card = this.add.container(x, y);
      const col2 = worldPalette[w.themeKey];
      const g = this.add.graphics();
      g.fillStyle(KIT.shadow, 0.3);
      g.fillRoundedRect(0, 5, cardW, cardH, 6);
      g.fillStyle(KIT.paper, 0.97);
      g.fillRoundedRect(0, 0, cardW, cardH, 6);
      g.lineStyle(3, hexToInt(col2), 1);
      g.strokeRoundedRect(0, 0, cardW, cardH, 6);
      card.add(g);
      card.add(this.add.image(88, 92, `world_${w.id}`).setDisplaySize(96, 96));
      card.add(this.add.text(168, 60, w.name, { ...typography.heading, color: palette.bgDeep }));
      card.add(this.add.text(168, 96, w.tagline, { ...typography.caption, color: palette.bgDeep }).setAlpha(0.7));
      const lines = [
        `地形机制：${w.terrainSummary}`,
        `关卡节奏：${w.rhythm}`,
        `关卡数：${w.levelCount} 关 · BOSS：${codexBossName(w.bossId)}`,
      ];
      lines.forEach((line, li) => {
        card.add(this.add.text(40, 200 + li * 34, line, { ...typography.body, color: palette.bgDeep }).setAlpha(0.85));
      });
      content.add(card);
    });
  }

  private renderTerrain(content: Phaser.GameObjects.Container, width: number): void {
    const cardW = 880;
    const cardH = 190;
    const gap = 24;
    const startX = (width - (cardW * 2 + gap)) / 2;
    codexTerrainRules.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const card = this.add.container(startX + col * (cardW + gap), 240 + row * (cardH + gap));
      const g = this.add.graphics();
      g.fillStyle(KIT.shadow, 0.3);
      g.fillRoundedRect(0, 5, cardW, cardH, 6);
      g.fillStyle(KIT.paper, 0.97);
      g.fillRoundedRect(0, 0, cardW, cardH, 6);
      g.lineStyle(3, hexToInt(palette.primaryDeep), 1);
      g.strokeRoundedRect(0, 0, cardW, cardH, 6);
      card.add(g);
      card.add(
        this.add
          .text(28, 24, `${r.name}（${r.element}）`, { ...typography.subheading, color: palette.primaryDeep }),
      );
      card.add(this.add.text(28, 66, r.summary, { ...typography.body, color: palette.bgDeep }).setAlpha(0.9));
      card.add(this.add.text(28, 104, `触发：${r.trigger}`, { ...typography.caption, color: palette.bgDeep }).setAlpha(0.75));
      card.add(this.add.text(28, 132, `对策：${r.counter}`, { ...typography.caption, color: palette.bgDeep }).setAlpha(0.75));
      content.add(card);
    });

    // 克制速查表
    const tableY = 240 + 2 * (cardH + gap);
    const table = this.add.container(startX, tableY);
    const g = this.add.graphics();
    g.fillStyle(KIT.shadow, 0.3);
    g.fillRoundedRect(0, 5, cardW * 2 + gap, 240, 6);
    g.fillStyle(KIT.paper, 0.97);
    g.fillRoundedRect(0, 0, cardW * 2 + gap, 240, 6);
    g.lineStyle(3, KIT.outline, 0.8);
    g.strokeRoundedRect(0, 0, cardW * 2 + gap, 240, 6);
    table.add(g);
    table.add(this.add.text(28, 20, '克制速查（伤害系数）', { ...typography.heading, color: palette.bgDeep }));
    const headers = ['攻击类型', '布甲', '皮甲', '壳甲', '铁甲', '飞行'];
    headers.forEach((h, hi) => {
      table.add(this.add.text(28 + hi * (cardW * 2 + gap - 56) / 6, 64, h, { ...typography.caption, color: palette.primaryDeep }).setAlpha(0.9));
    });
    codexCounters.forEach((row, ri) => {
      const vals = [row.attack, row.cloth, row.hide, row.shell, row.iron, row.air];
      vals.forEach((v, vi) => {
        table.add(
          this.add
            .text(28 + vi * (cardW * 2 + gap - 56) / 6, 100 + ri * 24, v, { ...typography.caption, color: palette.bgDeep })
            .setAlpha(0.85),
        );
      });
    });
    content.add(table);
  }

  // —— 详情弹层 ——
  private openOverlay(): { dim: Phaser.GameObjects.Rectangle; panel: Phaser.GameObjects.Container } {
    const { width, height } = this.scale.gameSize;
    const dim = this.add.rectangle(0, 0, width, height, hexToInt(palette.bgDeep), 0.5).setOrigin(0, 0).setDepth(zIndex.overlay).setInteractive();
    const panel = this.add.container(0, 0).setDepth(zIndex.dialog);
    const pg = this.add.graphics();
    const pw = 1180;
    const ph = 780;
    const px = (width - pw) / 2;
    const py = (height - ph) / 2;
    pg.fillStyle(KIT.shadow, 0.4);
    pg.fillRoundedRect(px + 6, py + 8, pw, ph, 6);
    pg.fillStyle(KIT.paper, 0.98);
    pg.fillRoundedRect(px, py, pw, ph, 6);
    pg.lineStyle(3, KIT.outline, 1);
    pg.strokeRoundedRect(px, py, pw, ph, 6);
    panel.add(pg);
    // 关闭按钮（视觉）
    const closeBtn = this.add.container(px + pw - 96, py + 24);
    const cg = this.add.graphics();
    cg.fillStyle(hexToInt(palette.bgDeep), 0.1);
    cg.fillRoundedRect(0, 0, 64, 48, radius.md);
    closeBtn.add(cg);
    closeBtn.add(this.add.text(32, 24, '✕', { ...typography.heading, color: palette.bgDeep }).setOrigin(0.5));
    // 命中区场景级（容器交互在 depth>0 不可靠）
    const closeHit = this.add.zone(px + pw - 96, py + 24, 64, 48).setOrigin(0, 0).setDepth(zIndex.dialog + 1).setInteractive({ useHandCursor: true });
    // 统一关闭路径（✕ 与点遮罩共用；closeHit 为场景级，必须一并销毁防泄漏——审查 P1-1）
    const close = (): void => {
      this.tweens.killAll(); // 详情立绘 idleBreathe repeat:-1 随弹层终止（P2-9 泄漏修复）
      closeHit.destroy();
      dim.destroy();
      panel.destroy(true);
    };
    closeHit.on('pointerup', close);
    dim.on('pointerup', close);
    panel.add(closeBtn);
    return { dim, panel };
  }

  private showUnitDetail(u: UnitArchetype, width: number): void {
    const { height } = this.scale.gameSize;
    const { dim, panel } = this.openOverlay();
    const pw = 1180;
    const ph = 780;
    const px = (width - pw) / 2;
    const py = (height - ph) / 2;

    const portrait = this.add.image(px + 210, py + 300, `unit_${u.id}`).setDisplaySize(300, 300);
    panel.add(portrait);
    this.idleBreathe(portrait);

    const rx = px + 420;
    panel.add(this.add.text(rx, py + 56, u.name, { ...typography.title, color: palette.primaryDeep }));
    // 职能胶囊（统一走 kit.chip）
    panel.add(chip(this, rx, py + 118, ROLE_LABEL[u.role], { color: hexToInt(ROLE_COLOR[u.role]), width: 80, height: 32 }));
    panel.add(this.add.text(rx + 100, py + 135, `造价 ${u.cost} 光露`, { ...typography.body, color: palette.bgDeep }));

    // 特色介绍（wrap 手动换行）
    panel.add(this.add.text(rx, py + 176, wrapText(u.flavor, 30), { ...typography.body, color: palette.bgDeep }).setAlpha(0.9));

    // 数值表
    const a = u.attack;
    const attackDesc = !a
      ? '无攻击（职能单位）'
      : a.kind === 'trigger'
        ? `触发伤害 ${a.damage}｜准备 ${((a.prepMs ?? 0) / 1000).toFixed(1)}s｜半径 ${a.radius ?? 1} 格`
        : `伤害 ${a.damage}${a.shots ? ` ×${a.shots}` : ''}｜间隔 ${((a.intervalMs ?? 0) / 1000).toFixed(2)}s｜射程 ${a.kind === 'aoe' ? `3×3（半径${a.radius ?? 1}）` : '本行'}`;
    const rows: string[] = [
      `造价 ${u.cost}｜冷却 ${(u.cooldownMs / 1000).toFixed(1)}s｜HP ${u.hp}`,
      attackDesc,
      a ? `属性 ${ELEMENT_LABEL[a.element ?? 'none']}` : '',
      u.power ? `世界能量：${POWER_LABEL[u.power.kind] ?? '通用强化'}` : '世界能量：通用强化（攻速×2/伤害×1.5，8 秒）',
      `出现世界：${worldName(u.world)}`,
    ].filter(Boolean);
    rows.forEach((line, i) => {
      panel.add(this.add.text(rx, py + 232 + i * 40, line, { ...typography.body, color: palette.bgDeep }).setAlpha(0.85));
    });

    // 特性标签
    const tags = [...(u.traits ?? []), ...(u.waterOnly ? ['限水格'] : []), ...(u.breakSlots ? ['可种断格'] : [])];
    tags.forEach((t, i) => {
      const tx = rx + (i % 4) * 170;
      const ty = py + 500 + Math.floor(i / 4) * 44;
      const tg = this.add.graphics();
      tg.fillStyle(hexToInt(palette.primary), 0.14);
      tg.fillRoundedRect(tx, ty, 156, 34, radius.sm);
      panel.add(tg);
      panel.add(this.add.text(tx + 78, ty + 17, t, { ...typography.caption, color: palette.primaryDeep }).setOrigin(0.5));
    });
    panel.add(this.add.text(rx, py + 620, '克制关系见「地形」tab 的克制速查表（GDD §7.5）', { ...typography.caption, color: palette.bgDeep }).setAlpha(0.6));
    void dim; // 遮罩关闭已由 openOverlay 统一绑定
  }

  private showEnemyDetail(e: EnemyArchetype, width: number): void {
    const { height } = this.scale.gameSize;
    const { dim, panel } = this.openOverlay();
    const pw = 1180;
    const ph = 780;
    const px = (width - pw) / 2;
    const py = (height - ph) / 2;

    const portrait = this.add.image(px + 210, py + 300, `enemy_${e.id}`).setDisplaySize(280, 280);
    panel.add(portrait);
    this.idleBreathe(portrait);

    const rx = px + 420;
    panel.add(this.add.text(rx, py + 56, e.isBoss ? `${e.name} · BOSS` : e.name, { ...typography.title, color: palette.primaryDeep }));
    // 护甲胶囊（统一走 kit.chip）
    panel.add(chip(this, rx, py + 118, ARMOR_LABEL[e.armor], { color: hexToInt(ARMOR_COLOR[e.armor]), width: 96, height: 32 }));
    panel.add(this.add.text(rx + 116, py + 135, e.isBoss ? '不计入波次预算' : `波次点数 ${e.points}`, { ...typography.body, color: palette.bgDeep }));

    panel.add(this.add.text(rx, py + 176, wrapText(e.flavor, 30), { ...typography.body, color: palette.bgDeep }).setAlpha(0.9));

    const rows: string[] = [
      `HP ${e.hp}｜移动 ${e.speed.toFixed(1)} 格/秒｜啃食 ${e.biteDps} DPS`,
      `护甲 ${ARMOR_LABEL[e.armor]}${e.flying ? '｜飞行' : ''}${e.waterborne ? '｜水行' : ''}`,
      `特性：${(e.traits ?? []).join(' / ') || '无'}`,
      `出现世界：${worldName(e.world)}`,
    ];
    rows.forEach((line, i) => {
      panel.add(this.add.text(rx, py + 232 + i * 40, line, { ...typography.body, color: palette.bgDeep }).setAlpha(0.85));
    });
    void dim; // 遮罩关闭已由 openOverlay 统一绑定
  }

  /** 详情立绘待机微动（C7 的 PartAnimator 落地前的过渡实现）。 */
  private idleBreathe(target: Phaser.GameObjects.Image): void {
    if (!MOTION_ENABLED) return; // 减弱动态：不播放常驻循环
    this.tweens.add({
      targets: target,
      scaleY: target.scaleY * 1.03,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

// —— 小工具 ——

function wrapText(text: string, perLine: number): string {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += perLine) lines.push(text.slice(i, i + perLine));
  return lines.join('\n');
}

function worldName(w: string): string {
  return codexWorlds.find((x) => x.id === w)?.name ?? w;
}

function codexBossName(id: string): string {
  const found = allEnemies.find((e) => e.id === id);
  return found ? found.name : `${id}（M4 追加）`;
}
