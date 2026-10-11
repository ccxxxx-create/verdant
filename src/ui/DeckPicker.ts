import Phaser from 'phaser';
import type { LevelDef } from '../core/schema/level.ts';
import type { UnitArchetype } from '../core/schema/unit.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { registryFrom } from '../core/registry.ts';
import { allUnits } from '../data/archetypes/index.ts';
import { ensurePixelTextures } from '../scenes/BattleScene.ts';
import { pixelPanel } from './components/kit.ts';
import { palette, worldPalette, typography, radius, hexToInt } from './tokens.ts';

/**
 * 局前选卡面板（W6 建，W7-1 抽取共享）：Menu/MapScene 共用。
 * owned 中勾选 ≤8，默认全选截前 8；传送带关跳过选卡直接开战（M3-D2）。
 * 纪律：交互 zone 场景级；部件统一 parts 数组管理（场景重启自清）。
 */

const DECK_CAP = 8;

let deckPickerOpen = false;

export function openDeckPicker(scene: Phaser.Scene, level: LevelDef, save: SaveGame | undefined): void {
  if (deckPickerOpen) return; // 防重入（P2-4）
  // 传送带关无选卡（手牌全来自传送带）
  if (level.template === 'conveyor') {
    scene.registry.set('level', level);
    scene.scene.start('Battle');
    return;
  }
  deckPickerOpen = true;

  ensurePixelTextures(scene); // unit_ 纹理（幂等）
  const unitById = registryFrom(allUnits, []).unitById;
  const owned = save?.progress.unlockedUnits.length ? save.progress.unlockedUnits : ['firefly_reed', 'thorn_pea'];
  const ownedDefs = owned
    .map((id) => unitById.get(id))
    .filter((u): u is UnitArchetype => !!u);
  const picked: string[] = ownedDefs.map((u) => u.id).slice(0, DECK_CAP); // 默认全选截前 8（M3-D1）

  const parts: Phaser.GameObjects.GameObject[] = [];
  const { width } = scene.scale.gameSize;
  const add = <T extends Phaser.GameObjects.GameObject>(go: T): T => {
    parts.push(go);
    return go;
  };

  add(scene.add.rectangle(width / 2, 540, width, 1080, 0x26402f, 0.55).setDepth(50).setInteractive());
  const pw = 1080;
  const ph = 720; // 3 行卡 + 计数 + 按钮（防第三行与按钮重叠）
  const px = (width - pw) / 2;
  const py = 200;
  add(pixelPanel(scene, px, py, pw, ph, { depth: 51, stroke: hexToInt(worldPalette.meadow) }));
  add(
    scene.add
      .text(width / 2, py + 42, '选择出战卡组', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '30px', fontStyle: 'bold', color: palette.bgDeep })
      .setOrigin(0.5)
      .setDepth(52),
  );
  add(
    scene.add
      .text(width / 2, py + 76, `${level.id} · ${level.waves} 波 · 点击卡片勾选，最多 ${DECK_CAP} 张`, { ...typography.caption, color: palette.bgDeep })
      .setOrigin(0.5)
      .setDepth(52)
      .setAlpha(0.7),
  );

  const pickedFrame = add(scene.add.graphics().setDepth(53));

  const cw = 118;
  const ch = 150;
  const gap = 18;
  const cols = 5;
  const gridW = cols * cw + (cols - 1) * gap;
  const startX = width / 2 - gridW / 2;
  const gridY = py + 104;
  const countText = add(
    scene.add
      .text(width / 2, py + ph - 128, '', { ...typography.body, color: palette.bgDeep })
      .setOrigin(0.5)
      .setDepth(52),
  );

  const redrawFrames = (): void => {
    pickedFrame.clear();
    ownedDefs.forEach((u, i) => {
      if (!picked.includes(u.id)) return;
      const cx = startX + (i % cols) * (cw + gap);
      const cy = gridY + Math.floor(i / cols) * (ch + 14);
      pickedFrame.lineStyle(4, 0xf2c14e, 1);
      pickedFrame.strokeRoundedRect(cx - 2, cy - 2, cw + 4, ch + 4, 10);
    });
    countText.setText(`已选 ${picked.length} / ${DECK_CAP}`);
  };

  ownedDefs.forEach((u, i) => {
    const cx = startX + (i % cols) * (cw + gap);
    const cy = gridY + Math.floor(i / cols) * (ch + 14);
    const card = add(scene.add.container(cx, cy).setDepth(52));
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, cw, ch, radius.md);
    g.lineStyle(2, hexToInt(palette.bgDeep), 0.25);
    g.strokeRoundedRect(0, 0, cw, ch, radius.md);
    card.add(g);
    card.add(scene.add.image(cw / 2, 56, `unit_${u.id}`).setScale(1.3));
    card.add(scene.add.text(cw / 2, ch - 26, String(u.cost), { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '16px', fontStyle: 'bold', color: palette.bgDeep }).setOrigin(0.5));
    const hit = add(scene.add.zone(cx, cy, cw, ch).setOrigin(0, 0).setDepth(54).setInteractive({ useHandCursor: true }));
    hit.on('pointerup', () => {
      const idx = picked.indexOf(u.id);
      if (idx >= 0) {
        picked.splice(idx, 1);
      } else if (picked.length >= DECK_CAP) {
        showTip();
        return;
      } else {
        picked.push(u.id);
      }
      redrawFrames();
    });
  });
  redrawFrames();

  // 出战按钮（至少 1 张）
  const bw = 300;
  const bx = width / 2 - bw / 2;
  const by = py + ph - 92;
  const btnG = add(scene.add.graphics().setDepth(52));
  btnG.fillStyle(Phaser.Display.Color.HexStringToColor(palette.primary).color, 1);
  btnG.fillRoundedRect(bx, by, bw, 64, radius.md);
  add(
    scene.add
      .text(width / 2, by + 32, '出 战', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF' })
      .setOrigin(0.5)
      .setDepth(52),
  );
  const btnHit = add(scene.add.zone(bx, by, bw, 64).setOrigin(0, 0).setDepth(54).setInteractive({ useHandCursor: true }));
  btnHit.on('pointerup', () => {
    if (picked.length === 0) {
      showTip();
      return;
    }
    scene.registry.set('level', level);
    scene.registry.set('deck', [...picked]);
    close();
    scene.scene.start('Battle');
  });

  // 关闭按钮
  const closeX = px + pw - 40;
  const closeY = py + 40;
  const cg = add(scene.add.graphics().setDepth(52));
  cg.fillStyle(hexToInt(palette.bgDeep), 0.12);
  cg.fillCircle(closeX, closeY, 22);
  add(scene.add.text(closeX, closeY, '✕', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '24px', fontStyle: 'bold', color: palette.bgDeep }).setOrigin(0.5).setDepth(52));
  const closeHit = add(scene.add.zone(closeX - 24, closeY - 24, 48, 48).setOrigin(0, 0).setDepth(54).setInteractive({ useHandCursor: true }));
  closeHit.on('pointerup', () => close());

  const hint = add(scene.add.text(width / 2, py + ph + 40, '', { ...typography.caption, color: palette.bgDeep }).setOrigin(0.5).setAlpha(0).setDepth(55));
  let hintTimer: Phaser.Time.TimerEvent | undefined;
  function showTip(): void {
    hintTimer?.remove();
    hint.setText(picked.length >= DECK_CAP ? `最多携带 ${DECK_CAP} 张卡（PvZ 种子槽口径）` : '至少选择 1 张卡再出战').setAlpha(0);
    scene.tweens.add({ targets: hint, alpha: 0.7, duration: 200 });
    hintTimer = scene.time.delayedCall(2400, () => {
      scene.tweens.add({ targets: hint, alpha: 0, duration: 200 });
    });
  }

  function close(): void {
    deckPickerOpen = false;
    hintTimer?.remove();
    for (const go of parts) go.destroy();
    parts.length = 0;
  }
}
