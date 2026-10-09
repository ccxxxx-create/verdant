import Phaser from 'phaser';
import type { UnitArchetype, EnemyArchetype } from '../../core/schema/unit.ts';
import { palette, typography, radius, motion, withAlpha, hexToInt, TOUCH_TARGET_MIN } from '../tokens.ts';

/** 图鉴/编成共用的卡片底板：白卡+主题色描边，无卡片套卡片（检查项）。 */
export function cardFrame(
  scene: Phaser.Scene,
  w: number,
  h: number,
  color: string,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.78);
  g.fillRoundedRect(0, 0, w, h, radius.lg);
  g.lineStyle(3, Phaser.Display.Color.HexStringToColor(color).color, 1);
  g.strokeRoundedRect(0, 0, w, h, radius.lg);
  return g;
}

export const CARD_W = 264;
export const CARD_H = 300;

export const ROLE_LABEL: Record<UnitArchetype['role'], string> = {
  producer: '生产',
  attacker: '攻击',
  defender: '防御',
  support: '功能',
};

export const ROLE_COLOR: Record<UnitArchetype['role'], string> = {
  producer: palette.accent,
  attacker: palette.primary,
  defender: palette.reef,
  support: palette.sky,
};

export const ARMOR_LABEL: Record<EnemyArchetype['armor'], string> = {
  cloth: '布甲',
  hide: '皮甲',
  shell: '壳甲',
  iron: '铁甲',
};

export const ARMOR_COLOR: Record<EnemyArchetype['armor'], string> = {
  cloth: '#8A8578',
  hide: '#A9805A',
  shell: palette.moss,
  iron: palette.primaryDeep,
};

/** 光露小徽记（单位造价展示）。 */
export function lightdewChip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cost: number,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  c.add(scene.add.image(0, 0, 'icon_lightdew').setScale(0.34));
  c.add(
    scene.add
      .text(16, 0, String(cost), { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '18px', fontStyle: 'bold', color: palette.bgDeep })
      .setOrigin(0, 0.5),
  );
  return c;
}

/** 角色卡（图鉴网格用）。选中回调在 pointerup 时触发（防误触：down/up 需同卡）。 */
export function createUnitCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  unit: UnitArchetype,
  onSelect: (u: UnitArchetype) => void,
): Phaser.GameObjects.Container {
  const card = scene.add.container(x, y);
  card.add(cardFrame(scene, CARD_W, CARD_H, ROLE_COLOR[unit.role]));

  card.add(scene.add.image(CARD_W / 2, 96, `unit_${unit.id}`).setScale(0.78));
  card.add(
    scene.add
      .text(CARD_W / 2, 172, unit.name, { ...typography.heading, color: palette.bgDeep })
      .setOrigin(0.5),
  );

  // 职能胶囊
  const chipW = 64;
  const chip = scene.add.graphics();
  chip.fillStyle(Phaser.Display.Color.HexStringToColor(ROLE_COLOR[unit.role]).color, 1);
  chip.fillRoundedRect(CARD_W / 2 - chipW / 2, 196, chipW, 26, radius.sm);
  card.add(chip);
  card.add(
    scene.add
      .text(CARD_W / 2, 210, ROLE_LABEL[unit.role], {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#FFFFFF',
      })
      .setOrigin(0.5),
  );

  card.add(lightdewChip(scene, CARD_W / 2, 248, unit.cost));

  // 选中态（hover）
  const hover = scene.add.graphics();
  hover.lineStyle(4, Phaser.Display.Color.HexStringToColor(palette.accent).color, 1);
  hover.strokeRoundedRect(0, 0, CARD_W, CARD_H, radius.lg);
  hover.setVisible(false);
  card.add(hover);

  const hit = scene.add.zone(0, 0, CARD_W, Math.max(CARD_H, TOUCH_TARGET_MIN)).setOrigin(0, 0);
  card.add(hit);
  hit.setInteractive({ useHandCursor: true });
  let downOnCard = false;
  hit.on('pointerover', () => hover.setVisible(true));
  hit.on('pointerout', () => {
    hover.setVisible(false);
    downOnCard = false;
  });
  hit.on('pointerdown', () => {
    downOnCard = true;
  });
  hit.on('pointerup', () => {
    if (!downOnCard) return;
    downOnCard = false;
    scene.tweens.add({ targets: card, scale: 1.03, duration: motion.feedback, yoyo: true });
    onSelect(unit);
  });

  return card;
}

/** 敌人卡（图鉴网格用）。 */
export function createEnemyCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  enemy: EnemyArchetype,
  onSelect: (e: EnemyArchetype) => void,
): Phaser.GameObjects.Container {
  const card = scene.add.container(x, y);
  card.add(cardFrame(scene, CARD_W, CARD_H, ARMOR_COLOR[enemy.armor]));

  card.add(scene.add.image(CARD_W / 2, 96, `enemy_${enemy.id}`).setScale(0.78));
  const name = enemy.isBoss ? `${enemy.name} · BOSS` : enemy.name;
  card.add(
    scene.add
      .text(CARD_W / 2, 172, name, { ...typography.heading, color: palette.bgDeep })
      .setOrigin(0.5),
  );

  const chipW = 72;
  const chip = scene.add.graphics();
  chip.fillStyle(Phaser.Display.Color.HexStringToColor(ARMOR_COLOR[enemy.armor]).color, 1);
  chip.fillRoundedRect(CARD_W / 2 - chipW / 2, 196, chipW, 26, radius.sm);
  card.add(chip);
  card.add(
    scene.add
      .text(CARD_W / 2, 210, ARMOR_LABEL[enemy.armor], {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#FFFFFF',
      })
      .setOrigin(0.5),
  );

  // HP 短条
  const barW = 120;
  const bar = scene.add.graphics();
  bar.fillStyle(hexToInt(palette.bgDeep), 0.15);
  bar.fillRoundedRect(CARD_W / 2 - barW / 2, 232, barW, 10, radius.sm);
  const ratio = Math.min(1, enemy.hp / 600);
  bar.fillStyle(Phaser.Display.Color.HexStringToColor(ARMOR_COLOR[enemy.armor]).color, 1);
  bar.fillRoundedRect(CARD_W / 2 - barW / 2, 232, Math.max(10, barW * ratio), 10, radius.sm);
  card.add(bar);
  card.add(
    scene.add
      .text(CARD_W / 2, 258, `HP ${enemy.hp}`, { ...typography.caption, color: palette.bgDeep })
      .setOrigin(0.5)
      .setAlpha(0.7),
  );

  const hover = scene.add.graphics();
  hover.lineStyle(4, Phaser.Display.Color.HexStringToColor(palette.accent).color, 1);
  hover.strokeRoundedRect(0, 0, CARD_W, CARD_H, radius.lg);
  hover.setVisible(false);
  card.add(hover);

  const hit = scene.add.zone(0, 0, CARD_W, Math.max(CARD_H, TOUCH_TARGET_MIN)).setOrigin(0, 0);
  card.add(hit);
  hit.setInteractive({ useHandCursor: true });
  let downOnCard = false;
  hit.on('pointerover', () => hover.setVisible(true));
  hit.on('pointerout', () => {
    hover.setVisible(false);
    downOnCard = false;
  });
  hit.on('pointerdown', () => {
    downOnCard = true;
  });
  hit.on('pointerup', () => {
    if (!downOnCard) return;
    downOnCard = false;
    scene.tweens.add({ targets: card, scale: 1.03, duration: motion.feedback, yoyo: true });
    onSelect(enemy);
  });

  return card;
}
