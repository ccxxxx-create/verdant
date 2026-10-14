import Phaser from 'phaser';
import { readSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { ALL_LEVELS, levelById } from '../data/levels/index.ts';
import { MAP_NODES, MAP_SEGMENTS, NODE_R, type MapNode } from '../data/map/meadow.ts';
import { drawPixelBackdrop, pixelPanel, sceneHeader, sceneEnter, drawAmbient, breathe, KIT } from '../ui/components/kit.ts';
import { openDeckPicker } from '../ui/DeckPicker.ts';
import { typography } from '../ui/tokens.ts';

/**
 * 巡野图场景（W7-1）：草原 32 关节点长卷（DEV-PLAN §1.1 的 MapScene 落地）。
 * 节点三态：已通关（星）/ 可挑战（亮）/ 锁定（灰）；未量产 id 显示"量产中"占位锁。
 * 解锁链 = levels/index.ts 顺序的前驱（clearedLevels 判定），首关恒解锁。
 */
export class MapScene extends Phaser.Scene {
  private save?: SaveGame;

  constructor() {
    super('Map');
  }

  create(): void {
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    const { width } = this.scale.gameSize;
    drawPixelBackdrop(this);
    drawAmbient(this, { motes: 5 });
    sceneHeader(this, '巡野图 · 晨雾草原', { subtitle: `VERDANT MAP · 已通关 ${this.clearedCount()}/${ALL_LEVELS.length} 量产关` });
    this.drawSegments();
    this.drawPaths();
    this.drawNodes(width);
    sceneEnter(this);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  private clearedCount(): number {
    const cleared = this.save?.progress.clearedLevels ?? [];
    return ALL_LEVELS.filter((l) => cleared.includes(l.id)).length;
  }

  private drawSegments(): void {
    for (const seg of MAP_SEGMENTS) {
      const panel = pixelPanel(this, seg.x - 110, 232, 220, 56, { depth: 2, radius: 4 });
      void panel;
      this.add
        .text(seg.x, 260, `${seg.name}`, { ...typography.heading, color: KIT.textDark })
        .setOrigin(0.5)
        .setDepth(3);
    }
  }

  /** 像素点划线（8px 实 + 8px 空）：像素风里"路"应是点划而非实线；已通段用金色承载进度。 */
  private dashLine(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, color: number, alpha: number): void {
    const horizontal = y0 === y1;
    const from = horizontal ? Math.min(x0, x1) : Math.min(y0, y1);
    const to = horizontal ? Math.max(x0, x1) : Math.max(y0, y1);
    g.fillStyle(color, alpha);
    for (let d = from; d < to; d += 16) {
      const seg = Math.min(8, to - d);
      if (horizontal) g.fillRect(Math.round(d), Math.round(y0) - 1, Math.round(seg), 3);
      else g.fillRect(Math.round(x0) - 1, Math.round(d), 3, Math.round(seg));
    }
  }

  /** 相邻节点点划线路径（量产与否都画：路径是地图结构，节点态才是内容态）。 */
  private drawPaths(): void {
    const g = this.add.graphics().setDepth(1);
    const cleared = this.save?.progress.clearedLevels ?? [];
    for (let i = 0; i < MAP_NODES.length - 1; i++) {
      const a = MAP_NODES[i];
      const b = MAP_NODES[i + 1];
      if (!a || !b) continue;
      if (a.seg !== b.seg) continue; // 跨段不连线（段间由段牌分界）
      const done = cleared.includes(a.id);
      const color = done ? KIT.goldMid : KIT.outline;
      const alpha = done ? 0.55 : 0.22;
      const midX = (a.x + b.x) / 2;
      this.dashLine(g, a.x, a.y, midX, a.y, color, alpha);
      this.dashLine(g, midX, a.y, midX, b.y, color, alpha);
      this.dashLine(g, midX, b.y, b.x, b.y, color, alpha);
    }
  }

  /** 节点右上角的像素锁（锁定态语义可视化：此前仅靠灰色 caption，状态不可扫读）。 */
  private drawLockIcon(x: number, y: number): void {
    const g = this.add.graphics().setDepth(4);
    g.lineStyle(3, KIT.outline, 0.8);
    g.strokeRoundedRect(x - 7, y - 15, 14, 13, 6);
    g.fillStyle(KIT.outline, 0.8);
    g.fillRoundedRect(x - 10, y - 5, 20, 16, 3);
    g.fillStyle(KIT.paper, 1);
    g.fillRect(x - 2, y, 4, 7);
  }

  private drawNodes(width: number): void {
    const cleared = this.save?.progress.clearedLevels ?? [];
    const producedIds = new Set(ALL_LEVELS.map((l) => l.id));
    MAP_NODES.forEach((node, i) => {
      const prev: MapNode | undefined = MAP_NODES[i - 1];
      const state = this.nodeState(node, prev, cleared, producedIds);
      this.drawNode(node, state, width);
    });
  }

  private nodeState(
    node: MapNode,
    prev: MapNode | undefined,
    cleared: string[],
    producedIds: Set<string>,
  ): 'cleared' | 'open' | 'locked' {
    if (!producedIds.has(node.id)) return 'locked'; // 未量产占位
    if (cleared.includes(node.id)) return 'cleared';
    // 前驱未量产（非连续量产容错）或已通关 → 解锁；首关恒解锁
    const prevCleared = !prev || !producedIds.has(prev.id) || cleared.includes(prev.id);
    return prevCleared ? 'open' : 'locked';
  }

  private drawNode(node: MapNode, state: 'cleared' | 'open' | 'locked', width: number): void {
    const level = levelById(node.id);
    const x = Math.min(node.x, width - NODE_R - 24);
    const size = NODE_R * 2;
    const produced = state !== 'locked' || !!level;

    const stroke = state === 'cleared' ? KIT.goldMid : state === 'open' ? KIT.success : KIT.outline;
    const panel = pixelPanel(this, x - NODE_R, node.y - NODE_R, size, size, {
      depth: 3,
      stroke,
      shadow: state !== 'locked',
    });
    if (state === 'locked') panel.setAlpha(0.55);
    // 呼吸幅度 1.02 在 84px 方块上仅 1.7px（肉眼不可察）→ 提到 1.035
    if (state === 'open') breathe(this, panel, 2400, 1.035);

    this.add
      .text(x, node.y - 6, node.label, {
        ...typography.subheading,
        color: state === 'locked' ? KIT.textSub : KIT.textDark,
      })
      .setOrigin(0.5)
      .setDepth(4);

    if (state === 'cleared') {
      const stars = this.save?.progress.stars[node.id] ?? 0;
      this.add
        .text(x, node.y + 20, stars > 0 ? '★'.repeat(stars) : '已通关', {
          ...typography.caption,
          color: KIT.goldDeepCss,
        })
        .setOrigin(0.5)
        .setDepth(4);
    } else if (state === 'locked') {
      // 两种"锁"语义分开：未解锁（前置关未通）vs 量产中（关卡数据未落盘）
      this.add
        .text(x, node.y + 20, produced ? '未解锁' : '量产中', {
          ...typography.caption,
          color: produced ? KIT.textSub : KIT.infoCss,
        })
        .setOrigin(0.5)
        .setDepth(4);
      this.drawLockIcon(x + NODE_R - 14, node.y - NODE_R + 16);
    }

    if ((state === 'open' || state === 'cleared') && level) {
      // open=首战；cleared=再战（刷星/重玩，P1-3）
      const hit = this.add
        .zone(x - NODE_R, node.y - NODE_R, size, size)
        .setOrigin(0, 0)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => openDeckPicker(this, level, this.save));
    }
  }
}
