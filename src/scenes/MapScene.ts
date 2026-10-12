import Phaser from 'phaser';
import { readSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { ALL_LEVELS, levelById } from '../data/levels/index.ts';
import { MAP_NODES, MAP_SEGMENTS, NODE_R, type MapNode } from '../data/map/meadow.ts';
import { drawPixelBackdrop, pixelPanel, sceneHeader, sceneEnter, drawAmbient, breathe, KIT } from '../ui/components/kit.ts';
import { openDeckPicker } from '../ui/DeckPicker.ts';
import { typography, hexToInt } from '../ui/tokens.ts';

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
        .text(seg.x, 260, `${seg.name}`, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '24px', fontStyle: 'bold', color: KIT.textDark })
        .setOrigin(0.5)
        .setDepth(3);
    }
  }

  /** 相邻节点虚线路径（量产与否都画：路径是地图结构，节点态才是内容态）。 */
  private drawPaths(): void {
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(3, KIT.outline, 0.25);
    for (let i = 0; i < MAP_NODES.length - 1; i++) {
      const a = MAP_NODES[i];
      const b = MAP_NODES[i + 1];
      if (!a || !b) continue;
      if (a.seg !== b.seg) continue; // 跨段不连线（段间由段牌分界）
      const midX = (a.x + b.x) / 2;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(midX, a.y);
      g.lineTo(midX, b.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
    }
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

    const stroke = state === 'cleared' ? 0xd9a53a : state === 'open' ? hexToInt('#6FA86B') : KIT.outline;
    const panel = pixelPanel(this, x - NODE_R, node.y - NODE_R, size, size, {
      depth: 3,
      stroke,
      shadow: state !== 'locked',
    });
    if (state === 'locked') panel.setAlpha(0.55);
    if (state === 'open') breathe(this, panel, 2400, 1.02);

    this.add
      .text(x, node.y - 6, node.label, {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '19px',
        fontStyle: 'bold',
        color: state === 'locked' ? KIT.textSub : KIT.textDark,
      })
      .setOrigin(0.5)
      .setDepth(4);

    if (state === 'cleared') {
      const stars = this.save?.progress.stars[node.id] ?? 0;
      this.add
        .text(x, node.y + 20, stars > 0 ? '★'.repeat(stars) : '已通关', {
          fontFamily: 'system-ui, "PingFang SC", sans-serif',
          fontSize: '13px',
          color: '#B8860B',
        })
        .setOrigin(0.5)
        .setDepth(4);
    } else if (state === 'locked') {
      this.add
        .text(x, node.y + 20, produced ? '未解锁' : '量产中', {
          fontFamily: 'system-ui, "PingFang SC", sans-serif',
          fontSize: '12px',
          color: KIT.textSub,
        })
        .setOrigin(0.5)
        .setDepth(4);
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
