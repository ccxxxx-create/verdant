import Phaser from 'phaser';
import type { LevelDef } from '../core/schema/level.ts';
import type { UnitArchetype } from '../core/schema/unit.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { registryFrom } from '../core/registry.ts';
import { allUnits } from '../data/archetypes/index.ts';
import { ensurePixelTextures } from '../scenes/BattleScene.ts';
import { pixelPanel, KIT, closeButton } from './components/kit.ts';
import { DECK_CAP } from '../core/balance.ts';
import { palette, worldPalette, typography, radius, hexToInt } from './tokens.ts';
import { itemById, type ItemDef, type ItemRarity } from '../data/items.ts';
import { writeSave } from '../core/save.ts';

/** 道具品质 → 描边色（唯一源 = KIT）。 */
const RARITY_COLOR: Record<ItemRarity, number> = {
  common: KIT.rarityCommon,
  rare: KIT.rarityRare,
  legendary: KIT.rarityLegendary,
};

/**
 * 局前选卡面板（W6 建，W7-1 抽取共享）：Menu/MapScene 共用。
 * owned 中勾选 ≤8，默认全选截前 8；传送带关跳过选卡直接开战（M3-D2）。
 * 纪律：交互 zone 场景级；部件统一 parts 数组管理（场景重启自清）。
 */

let deckPickerOpen = false;

export function openDeckPicker(scene: Phaser.Scene, level: LevelDef, save: SaveGame | undefined): void {
  if (deckPickerOpen) return; // 防重入（P2-4）
  // 传送带关无选卡（手牌全来自传送带）
  if (level.template === 'conveyor') {
    scene.registry.set('level', level);
    scene.registry.set('carriedItem', null); // 不经选卡 → 明确不携带（哨兵语义，防沿用上局值）
    scene.scene.start('Battle');
    return;
  }
  deckPickerOpen = true;
  // 防重入标志的场景级兜底：ESC/返回离开 MapScene 时 SHUTDOWN 会销毁本面板子对象，
  // 但模块级标志不会自动复位 —— 不兜底会导致「地图里开过选卡后按 ESC，之后所有关卡都无法开始」（软锁）。
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    deckPickerOpen = false;
  });

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

  add(scene.add.rectangle(width / 2, 540, width, 1080, KIT.outline, 0.55).setDepth(50).setInteractive());
  const pw = 1080;
  const ph = 820; // 3 行卡 + 携带道具行 + 计数 + 按钮（M-INV 加入道具行后加高）
  const px = (width - pw) / 2;
  const py = 130;
  add(pixelPanel(scene, px, py, pw, ph, { depth: 51, stroke: hexToInt(worldPalette.meadow) }));
  add(
    scene.add
      .text(width / 2, py + 42, '选择出战卡组', { ...typography.title, color: palette.bgDeep })
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
      pickedFrame.lineStyle(4, hexToInt(palette.accent), 1);
      pickedFrame.strokeRoundedRect(cx - 2, cy - 2, cw + 4, ch + 4, 10);
    });
    countText.setText(`已选 ${picked.length} / ${DECK_CAP}`);
  };

  ownedDefs.forEach((u, i) => {
    const cx = startX + (i % cols) * (cw + gap);
    const cy = gridY + Math.floor(i / cols) * (ch + 14);
    // 统一走 kit.pixelPanel：此前是"白卡 + 淡描边"，与全站纸底/深描边语言不一致
    const card = add(pixelPanel(scene, cx, cy, cw, ch, { depth: 52, stroke: hexToInt(worldPalette.meadow) }));
    card.add(scene.add.image(cw / 2, 56, `unit_${u.id}`).setScale(1.3));
    card.add(scene.add.text(cw / 2, ch - 26, String(u.cost), { ...typography.body, fontStyle: 'bold', color: palette.bgDeep }).setOrigin(0.5));
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

  // —— 携带道具（M-INV：单选，可不携带；仅持有数 > 0 的可选） ——
  const ownedItems = Object.entries(save?.inventory ?? {})
    .filter(([, n]) => n > 0)
    .map(([id]) => itemById(id))
    .filter((d): d is ItemDef => !!d);
  let carried: string | null = null;

  const itemRowY = py + ph - 216;
  add(
    scene.add
      .text(px + 40, itemRowY + 32, '携带道具（可选）', { ...typography.body, color: palette.bgDeep })
      .setOrigin(0, 0.5)
      .setDepth(52),
  );
  const itemFrame = add(scene.add.graphics().setDepth(53));
  const slotSize = 64;
  const slotGap = 12;
  const slotX0 = px + 260;
  const redrawItemFrames = (): void => {
    itemFrame.clear();
    const idx = carried === null ? 0 : ownedItems.findIndex((d) => d.id === carried) + 1;
    if (idx < 0) return;
    const sx = slotX0 + idx * (slotSize + slotGap);
    itemFrame.lineStyle(4, hexToInt(palette.accent), 1);
    itemFrame.strokeRoundedRect(sx - 3, itemRowY - 3, slotSize + 6, slotSize + 6, 8);
  };

  // 「不携带」空槽
  {
    const p = add(pixelPanel(scene, slotX0, itemRowY, slotSize, slotSize, { depth: 52, radius: 6 }));
    p.add(scene.add.text(slotSize / 2, slotSize / 2, '无', { ...typography.body, color: palette.bgDeep }).setOrigin(0.5).setAlpha(0.7));
    const hit = add(scene.add.zone(slotX0, itemRowY, slotSize, slotSize).setOrigin(0, 0).setDepth(54).setInteractive({ useHandCursor: true }));
    hit.on('pointerup', () => {
      carried = null;
      redrawItemFrames();
    });
  }
  ownedItems.forEach((def, i) => {
    const sx = slotX0 + (i + 1) * (slotSize + slotGap);
    const p = add(pixelPanel(scene, sx, itemRowY, slotSize, slotSize, { depth: 52, radius: 6, stroke: RARITY_COLOR[def.rarity] }));
    p.add(scene.add.image(slotSize / 2, slotSize / 2 - 5, `icon_${def.icon}`).setDisplaySize(40, 40));
    p.add(
      scene.add
        .text(slotSize - 6, slotSize - 12, `×${save?.inventory[def.id] ?? 0}`, { ...typography.caption, color: palette.bgDeep })
        .setOrigin(1, 0.5),
    );
    const hit = add(scene.add.zone(sx, itemRowY, slotSize, slotSize).setOrigin(0, 0).setDepth(54).setInteractive({ useHandCursor: true }));
    hit.on('pointerup', () => {
      carried = def.id;
      redrawItemFrames();
    });
  });
  redrawItemFrames();

  // 出战按钮（至少 1 张）
  const bw = 300;
  const bx = width / 2 - bw / 2;
  const by = py + ph - 92;
  const btnG = add(scene.add.graphics().setDepth(52));
  btnG.fillStyle(hexToInt(palette.primary), 1);
  btnG.fillRoundedRect(bx, by, bw, 64, radius.md);
  add(
    scene.add
      .text(width / 2, by + 32, '出 战', { ...typography.heading, color: KIT.onAccent })
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
    // 携带道具：扣减持有并注入（null = 明确不携带；哨兵语义防沿用上局值）
    const chosen = carried ? itemById(carried) : undefined;
    if (chosen && save && (save.inventory[chosen.id] ?? 0) > 0) {
      const left = (save.inventory[chosen.id] ?? 0) - 1;
      // 归零即删键，避免存档里堆积 0 值项
      if (left > 0) save.inventory[chosen.id] = left;
      else delete save.inventory[chosen.id];
      try {
        writeSave(window.localStorage, save);
      } catch {
        /* 落盘失败不阻塞开战（本局效果仍生效） */
      }
      scene.registry.set('save', save);
      scene.registry.set('carriedItem', { id: chosen.id, effect: chosen.effect });
    } else {
      scene.registry.set('carriedItem', null);
    }
    close();
    scene.scene.start('Battle');
  });

  // 关闭按钮（统一走 kit.closeButton：命中区 56×56，触控热区达 TOUCH_TARGET_MIN）
  const closeHit = add(closeButton(scene, px + pw - 56, py + 40, { depth: 52, onClick: () => close() }));

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
