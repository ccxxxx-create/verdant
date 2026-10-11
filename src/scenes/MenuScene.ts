import Phaser from 'phaser';
import { palette, worldPalette, typography, radius, motion, withAlpha, hexToInt } from '../ui/tokens.ts';
import { readSave, writeSave, type SaveStorage } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { LevelDef } from '../core/schema/level.ts';
import type { UnitArchetype } from '../core/schema/unit.ts';
import { registryFrom } from '../core/registry.ts';
import { allUnits } from '../data/archetypes/index.ts';
import { pixelIcons } from '../data/pixels/icons.ts';
import { bakePixelTexture } from '../render/pixelTexture.ts';
import { ensurePixelTextures } from './BattleScene.ts';
import { drawPixelBackdrop, pixelPanel, pixelButton, sceneEnter, breathe, pressable, KIT } from '../ui/components/kit.ts';
import level11 from '../data/levels/meadow-1-1.json';
import level12 from '../data/levels/meadow-1-2.json';
import level13 from '../data/levels/meadow-1-3.json';
import level14 from '../data/levels/meadow-1-4.json';
import level15 from '../data/levels/meadow-1-5.json';

/** 冒险模式关卡表（M1C：草原前 5 关，渐进解锁）。 */
const ADVENTURE_LEVELS = [level11, level12, level13, level14, level15];

/** 总单位数（图鉴完成度分母；M1B 仅草原 13，分母取 GDD 首发 51）。 */
const TOTAL_UNITS = 51;

/**
 * 主界面 Hub（M1B C6，PvZ2 式常驻导航壳）：
 * 顶部资源条（玩家档卡+星星+图鉴完成度）→ 中央巡野图入口卡 → 模式入口行 → 底部功能条。
 * 层级纪律：hub 不做关卡节点（巡野图本体 M2）；对局逻辑 M1。
 */
export class MenuScene extends Phaser.Scene {
  private hint?: Phaser.GameObjects.Text;
  private hintTimer?: Phaser.Time.TimerEvent;
  private save?: SaveGame;
  private pickerParts: Phaser.GameObjects.GameObject[] = [];
  private unitById: ReadonlyMap<string, UnitArchetype> = new Map();
  private deckParts: Phaser.GameObjects.GameObject[] = [];
  private pendingLevel?: LevelDef;
  private pickedDeck: string[] = [];
  private pickedFrame?: Phaser.GameObjects.Graphics;
  private deckCountText?: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.save = (this.registry.get('save') as SaveGame | undefined) ?? readSave(window.localStorage);
    // 场景重启清理：选关层部件已被 shutdown 销毁，残留引用会挡住二次打开（防二次进入冻结，同 M1B P0 教训）
    this.pickerParts = [];
    this.deckParts = [];
    this.pendingLevel = undefined;
    this.pickedDeck = [];
    this.pickedFrame = undefined;
    this.deckCountText = undefined;
    this.hint = undefined;
    this.hintTimer?.remove();
    this.hintTimer = undefined;

    this.unitById = registryFrom(allUnits, []).unitById;
    for (const [name, sprite] of Object.entries(pixelIcons)) bakePixelTexture(this, `icon_${name}`, sprite, 4);
    ensurePixelTextures(this); // 选卡面板需 unit_ 纹理（幂等）
    drawPixelBackdrop(this);
    this.drawTopBar(width);
    this.drawAdventureCard(width);
    this.drawModeRow(width);
    this.drawBottomBar(width, height);
    sceneEnter(this);
  }

  // —— 顶部：玩家档卡 + 资源 ——
  private drawTopBar(width: number): void {
    const save = this.save;
    const stars = save ? Object.values(save.progress.stars).reduce((a, b) => a + b, 0) : 0;
    const unlocked = save ? save.progress.unlockedUnits.length : 0;
    const completion = Math.round((unlocked / TOTAL_UNITS) * 100);
    const level = 1 + Math.floor(stars / 10);
    const xpInLevel = (stars % 10) / 10;

    const bar = pixelPanel(this, 60, 44, width - 120, 96, { depth: 2 });

    // 头像（露珠徽记复用）
    bar.add(this.add.image(56, 48, 'icon_sprout').setDisplaySize(56, 56));
    bar.add(this.add.text(100, 30, '看火人', { ...typography.heading, color: palette.bgDeep }));
    // 等级胶囊 + 经验条
    const lvG = this.add.graphics();
    lvG.fillStyle(Phaser.Display.Color.HexStringToColor(palette.primaryDeep).color, 1);
    lvG.fillRoundedRect(216, 22, 64, 28, radius.sm);
    bar.add(lvG);
    bar.add(this.add.text(248, 37, `Lv.${level}`, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#FFFFFF' }).setOrigin(0.5));
    const xpBg = this.add.graphics();
    xpBg.fillStyle(hexToInt(palette.bgDeep), 0.15);
    xpBg.fillRoundedRect(296, 32, 200, 10, radius.sm);
    bar.add(xpBg);
    const xpFg = this.add.graphics();
    xpFg.fillStyle(Phaser.Display.Color.HexStringToColor(palette.accent).color, 1);
    xpFg.fillRoundedRect(296, 32, Math.max(10, 200 * xpInLevel), 10, radius.sm);
    bar.add(xpFg);
    bar.add(this.add.text(296, 60, `还需 ${10 - (stars % 10)} 星升级`, { ...typography.caption, color: palette.bgDeep }).setAlpha(0.55));

    // 资源：星星 + 图鉴完成度
    bar.add(this.add.text(width - 380, 30, `★ 星星 ${stars}`, { ...typography.body, color: palette.bgDeep }));
    bar.add(this.add.text(width - 380, 60, `📖 图鉴 ${unlocked}/${TOTAL_UNITS}（${completion}%）`, { ...typography.caption, color: palette.bgDeep }).setAlpha(0.7));
    // M2 钱包（金币/钻石/种子/能量豆）
    if (save) {
      const w = save.wallet;
      bar.add(this.add.image(width - 352, 80, 'icon_coin').setDisplaySize(22, 22));
      bar.add(this.add.text(width - 334, 80, `×${w.coins}`, { ...typography.caption, color: palette.bgDeep }).setOrigin(0, 0.5));
      bar.add(this.add.image(width - 262, 80, 'icon_diamond').setDisplaySize(22, 22));
      bar.add(this.add.text(width - 244, 80, `×${w.diamonds}`, { ...typography.caption, color: palette.bgDeep }).setOrigin(0, 0.5));
      bar.add(this.add.image(width - 172, 80, 'icon_seed').setDisplaySize(22, 22));
      bar.add(this.add.text(width - 154, 80, `×${w.seeds}`, { ...typography.caption, color: palette.bgDeep }).setOrigin(0, 0.5));
      bar.add(this.add.image(width - 82, 80, 'icon_energy').setDisplaySize(22, 22));
      bar.add(this.add.text(width - 64, 80, `×${w.plantFood}`, { ...typography.caption, color: palette.bgDeep }).setOrigin(0, 0.5));
    }
  }

  // —— 中央：巡野图入口大卡 ——
  private drawAdventureCard(width: number): void {
    const save = this.save;
    const cleared = save ? save.progress.clearedLevels.length : 0;
    const totalLevels = 131;
    const progress = Math.min(1, cleared / totalLevels);

    const cw = 1100;
    const ch = 400;
    const cx = (width - cw) / 2;
    const cy = 180;
    const card = pixelPanel(this, cx, cy, cw, ch, { depth: 2, stroke: hexToInt(worldPalette.meadow) });
    breathe(this, card);
    card.add(this.add.image(cw / 2, 150, 'icon_mountain').setDisplaySize(128, 128));
    card.add(
      this.add.text(cw / 2, 250, '巡 野 图', {
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: palette.primaryDeep,
      }).setOrigin(0.5),
    );
    card.add(
      this.add
        .text(cw / 2, 306, `晨雾草原 · 第 1 世界 · 进度 ${cleared}/${totalLevels}`, { ...typography.body, color: palette.bgDeep })
        .setOrigin(0.5)
        .setAlpha(0.75),
    );
    // 进度条
    const bw = 520;
    const pb = this.add.graphics();
    pb.fillStyle(hexToInt(palette.bgDeep), 0.12);
    pb.fillRoundedRect(cw / 2 - bw / 2, 340, bw, 12, radius.sm);
    pb.fillStyle(Phaser.Display.Color.HexStringToColor(worldPalette.meadow).color, 1);
    pb.fillRoundedRect(cw / 2 - bw / 2, 340, Math.max(12, bw * progress), 12, radius.sm);
    card.add(pb);

    const hit = this.add.zone(0, 0, cw, ch).setOrigin(0, 0);
    card.add(hit);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => card.setScale(1.01));
    hit.on('pointerout', () => card.setScale(1));
    hit.on('pointerup', () => this.showHint(cx + cw / 2, cy + ch + 34, '巡野图（关卡地图）在 M2 开放 · DEV-PLAN §5'));
  }

  // —— 模式入口行 ——
  private drawModeRow(width: number): void {
    const modes: { label: string; sub: string; color: string; ready: boolean; icon: string; action: 'battle' | 'codex' | 'shop' | 'draw' | 'hint' }[] = [
      { label: '冒险', sub: '晨雾草原 · 前 5 关', color: palette.primary, ready: true, icon: 'sprout', action: 'battle' },
      { label: '图鉴', sub: '51 生灵 / 44 怪兽', color: palette.accent, ready: true, icon: 'book', action: 'codex' },
      { label: '商店', sub: '金币 / 钻石购买角色', color: palette.reef, ready: true, icon: 'coin', action: 'shop' },
      { label: '抽奖', sub: '种子券单抽 · 钻石十连', color: palette.sky, ready: true, icon: 'seed', action: 'draw' },
    ];
    const bw = 360;
    const bh = 150;
    const gap = 32;
    const startX = (width - (bw * 4 + gap * 3)) / 2;
    const y = 640;
    modes.forEach((m, i) => {
      const btn = pixelPanel(this, startX + i * (bw + gap), y, bw, bh, { depth: 2, stroke: hexToInt(m.ready ? m.color : KIT.outlineCss), shadow: m.ready });
      if (!m.ready) btn.setAlpha(0.55);
      const hit = this.add.zone(startX + i * (bw + gap), y, bw, Math.max(bh, 48)).setOrigin(0, 0).setDepth(3).setInteractive({ useHandCursor: m.ready });
      this.pickerParts.push(hit);
      pressable(this, hit, btn, m.ready);
      btn.add(this.add.image(bw / 2, 46, `icon_${(m.icon ?? 'sprout')}`).setDisplaySize(48, 48));
      btn.add(
        this.add
          .text(bw / 2, 88, m.label, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '26px', fontStyle: 'bold', color: m.ready ? palette.bgDeep : withAlpha(palette.bgDeep, 0.45) })
          .setOrigin(0.5),
      );
      btn.add(
        this.add
          .text(bw / 2, 120, m.sub, { ...typography.caption, color: palette.bgDeep })
          .setOrigin(0.5)
          .setAlpha(m.ready ? 0.6 : 0.35),
      );
      hit.on('pointerup', () => {
        if (m.action === 'codex') {
          this.scene.start('Codex');
          return;
        }
        if (m.action === 'shop') {
          this.scene.start('Shop');
          return;
        }
        if (m.action === 'draw') {
          this.scene.start('Draw');
          return;
        }
        if (m.action === 'battle') {
          this.openLevelPicker();
          return;
        }
        this.showHint(width / 2, y + bh + 34, `${m.label}在后续里程碑开放（docs/BACKLOG.md）`);
      });
    });
  }

  // —— 底部功能条 ——
  private drawBottomBar(width: number, height: number): void {
    const y = height - 88;
    const items: { label: string; icon: string; ready: boolean; msg: string }[] = [
      { label: '设置', icon: 'settings', ready: false, msg: '设置场景（音量/画质/触控布局）在 M2 开放' },
      { label: '音效', icon: 'sound', ready: false, msg: 'WebAudio 程序化音效在 M6 落地' },
      { label: '关于', icon: 'info', ready: false, msg: 'Verdant · M1B · 文档见 docs/GDD.md' },
    ];
    const bw = 220;
    const gap = 24;
    const startX = (width - (bw * 3 + gap * 2)) / 2;
    items.forEach((it, i) => {
      pixelPanel(this, startX + i * (bw + gap), y, bw, 56, { depth: 2, radius: 4 });
      this.add.image(startX + i * (bw + gap) + bw / 2 - 52, y + 28, `icon_${(it.icon ?? 'settings')}`).setDisplaySize(28, 28).setDepth(3);
      this.add
        .text(startX + i * (bw + gap) + bw / 2 + 12, y + 28, it.label, { ...typography.body, color: KIT.textDark })
        .setOrigin(0.5)
        .setAlpha(0.85)
        .setDepth(3);
      const hit = this.add.zone(startX + i * (bw + gap), y, bw, 56).setOrigin(0, 0).setDepth(4).setInteractive({ useHandCursor: true });
      this.pickerParts.push(hit);
      hit.on('pointerup', () => this.showHint(width / 2, y - 28, it.msg));
    });

  }

  // —— 选关层（M1C：草原 1-1~1-5，渐进解锁）——
  // 纪律：交互 zone 必须是场景级对象（容器子 zone 挂在 depth>0 容器时命中不可靠，实测选关卡无响应）。
  private openLevelPicker(): void {
    if (this.pickerParts.length > 0) return;
    const { width } = this.scale.gameSize;
    const add = <T extends Phaser.GameObjects.GameObject>(go: T): T => {
      this.pickerParts.push(go);
      return go;
    };

    add(this.add.rectangle(width / 2, 540, width, 1080, 0x26402f, 0.55).setDepth(50).setInteractive());
    const pw = 1080;
    const ph = 470;
    const px = (width - pw) / 2;
    const py = 300;
    const panel = pixelPanel(this, px, py, pw, ph, { depth: 51, stroke: hexToInt(worldPalette.meadow) });
    add(panel);
    add(
      this.add
        .text(width / 2, py + 46, '晨雾草原 · 选择关卡', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '30px', fontStyle: 'bold', color: palette.bgDeep })
        .setOrigin(0.5)
        .setDepth(52),
    );

    const cleared: string[] = this.save ? this.save.progress.clearedLevels : [];
    const bw = 172;
    const bh = 250;
    const gap = 28;
    const startX = width / 2 - (bw * ADVENTURE_LEVELS.length + gap * (ADVENTURE_LEVELS.length - 1)) / 2;
    const by = py + 110;
    ADVENTURE_LEVELS.forEach((lv, i) => {
      const prev = ADVENTURE_LEVELS[i - 1];
      const unlocked = i === 0 || (prev !== undefined && cleared.includes(prev.id));
      const done = cleared.includes(lv.id);
      const bx = startX + i * (bw + gap);
      const card = add(this.add.container(bx, by).setDepth(52));
      const g = this.add.graphics();
      g.fillStyle(KIT.shadow, 0.3);
      g.fillRoundedRect(0, 5, bw, bh, 6);
      g.fillStyle(KIT.paper, 0.97);
      g.fillRoundedRect(0, 0, bw, bh, 6);
      g.lineStyle(3, unlocked ? hexToInt(worldPalette.meadow) : KIT.outline, unlocked ? 1 : 0.5);
      g.strokeRoundedRect(0, 0, bw, bh, 6);
      card.add(g);
      card.add(
        this.add
          .text(bw / 2, 40, `1-${i + 1}`, { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '30px', fontStyle: 'bold', color: unlocked ? palette.bgDeep : withAlpha(palette.bgDeep, 0.4) })
          .setOrigin(0.5),
      );
      card.add(this.add.image(bw / 2, 108, `icon_${done ? 'trophy' : unlocked ? 'sprout' : 'skull'}`).setDisplaySize(unlocked ? 56 : 48, unlocked ? 56 : 48).setAlpha(unlocked ? 1 : 0.4));
      card.add(
        this.add
          .text(bw / 2, 168, unlocked ? (done ? '已通关 · 再战' : '新关卡') : '通过上一关解锁', { ...typography.caption, color: palette.bgDeep })
          .setOrigin(0.5)
          .setAlpha(unlocked ? 0.65 : 0.4),
      );
      const stars = this.save?.progress.stars[lv.id] ?? 0;
      if (stars > 0) card.add(this.add.text(bw / 2, 205, '★'.repeat(stars), { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '20px', color: '#F2C14E' }).setOrigin(0.5));
      // 命中区：场景级 zone（不进容器），与卡片同矩形
      const hit = add(this.add.zone(bx, by, bw, bh).setOrigin(0, 0).setDepth(53).setInteractive({ useHandCursor: unlocked }));
      hit.on('pointerover', () => unlocked && card.setScale(1.03));
      hit.on('pointerout', () => card.setScale(1));
      hit.on('pointerup', () => {
        if (!unlocked) {
          this.showHint(width / 2, by + bh + 40, '先通过上一关解锁（通关后自动解锁下一关）');
          return;
        }
        const parsed = LevelDef.safeParse(lv);
        if (!parsed.success) {
          this.showHint(width / 2, by + bh + 40, '关卡数据校验失败（见控制台）');
          console.error('[level] invalid', lv.id, parsed.error.issues);
          return;
        }
        this.closeLevelPicker();
        // 传送带关无选卡（M3-D2：手牌全来自传送带）；普通关先进选卡面板（W6）
        if (parsed.data.template === 'conveyor') {
          this.registry.set('level', parsed.data);
          this.scene.start('Battle');
          return;
        }
        this.openDeckPicker(parsed.data);
      });
    });

    const closeX = px + pw - 40;
    const closeY = py + 40;
    const cg = add(this.add.graphics().setDepth(52));
    cg.fillStyle(hexToInt(palette.bgDeep), 0.12);
    cg.fillCircle(closeX, closeY, 22);
    add(this.add.text(closeX, closeY, '✕', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '24px', fontStyle: 'bold', color: palette.bgDeep }).setOrigin(0.5).setDepth(52));
    const closeHit = add(this.add.zone(closeX - 24, closeY - 24, 48, 48).setOrigin(0, 0).setDepth(53).setInteractive({ useHandCursor: true }));
    closeHit.on('pointerup', () => this.closeLevelPicker());
  }

  private closeLevelPicker(): void {
    for (const go of this.pickerParts) go.destroy();
    this.pickerParts = [];
  }

  // —— 局前选卡面板（W6 简化版）：owned 中勾选 ≤8，默认全选截前 8（M3-D1）——
  // 纪律：交互 zone 场景级；部件统一 deckParts 管理（场景重启清理，同选关层）。
  private openDeckPicker(level: LevelDef): void {
    if (this.deckParts.length > 0) return;
    const { width } = this.scale.gameSize;
    this.pendingLevel = level;
    const add = <T extends Phaser.GameObjects.GameObject>(go: T): T => {
      this.deckParts.push(go);
      return go;
    };

    const owned = this.save?.progress.unlockedUnits.length ? this.save.progress.unlockedUnits : ['firefly_reed', 'thorn_pea'];
    const ownedDefs = owned
      .map((id) => this.unitById.get(id))
      .filter((u): u is UnitArchetype => !!u);
    this.pickedDeck = ownedDefs.map((u) => u.id).slice(0, 8); // 默认全选截前 8

    add(this.add.rectangle(width / 2, 540, width, 1080, 0x26402f, 0.55).setDepth(50).setInteractive());
    const pw = 1080;
    const ph = 720; // 3 行卡 + 计数 + 按钮（防第三行与按钮重叠）
    const px = (width - pw) / 2;
    const py = 200;
    const panel = pixelPanel(this, px, py, pw, ph, { depth: 51, stroke: hexToInt(worldPalette.meadow) });
    add(panel);
    add(
      this.add
        .text(width / 2, py + 42, '选择出战卡组', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '30px', fontStyle: 'bold', color: palette.bgDeep })
        .setOrigin(0.5)
        .setDepth(52),
    );
    add(
      this.add
        .text(width / 2, py + 76, `${level.id} · ${level.waves} 波 · 点击卡片勾选，最多 8 张`, { ...typography.caption, color: palette.bgDeep })
        .setOrigin(0.5)
        .setDepth(52)
        .setAlpha(0.7),
    );

    this.pickedFrame = add(this.add.graphics().setDepth(53));

    const cw = 118;
    const ch = 150;
    const gap = 18;
    const cols = 5;
    const gridW = cols * cw + (cols - 1) * gap;
    const startX = width / 2 - gridW / 2;
    const gridY = py + 104;
    this.deckCountText = add(
      this.add
        .text(width / 2, py + ph - 128, '', { ...typography.body, color: palette.bgDeep })
        .setOrigin(0.5)
        .setDepth(52),
    );

    ownedDefs.forEach((u, i) => {
      const cx = startX + (i % cols) * (cw + gap);
      const cy = gridY + Math.floor(i / cols) * (ch + 14);
      const card = add(this.add.container(cx, cy).setDepth(52));
      const g = this.add.graphics();
      g.fillStyle(KIT.shadow, 0.3);
      g.fillRoundedRect(0, 5, cw, ch, 6);
      g.fillStyle(KIT.paper, 0.97);
      g.fillRoundedRect(0, 0, cw, ch, 6);
      g.lineStyle(2, KIT.outline, 0.6);
      g.strokeRoundedRect(0, 0, cw, ch, 6);
      card.add(g);
      card.add(this.add.image(cw / 2, 56, `unit_${u.id}`).setScale(1.3));
      card.add(this.add.text(cw / 2, ch - 26, String(u.cost), { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '16px', fontStyle: 'bold', color: palette.bgDeep }).setOrigin(0.5));
      const hit = add(this.add.zone(cx, cy, cw, ch).setOrigin(0, 0).setDepth(54).setInteractive({ useHandCursor: true }));
      hit.on('pointerup', () => {
        const idx = this.pickedDeck.indexOf(u.id);
        if (idx >= 0) {
          this.pickedDeck.splice(idx, 1);
        } else if (this.pickedDeck.length >= 8) {
          this.showHint(width / 2, py + ph + 40, '最多携带 8 张卡（PvZ 种子槽口径）');
          return;
        } else {
          this.pickedDeck.push(u.id);
        }
        this.redrawPickedFrames(startX, gridY, cw, ch, gap, ownedDefs);
      });
    });
    this.redrawPickedFrames(startX, gridY, cw, ch, gap, ownedDefs);

    // 出战按钮（至少 1 张）
    const bw = 300;
    const bx = width / 2 - bw / 2;
    const by = py + ph - 92;
    const btnG = add(this.add.graphics().setDepth(52));
    btnG.fillStyle(Phaser.Display.Color.HexStringToColor(palette.primary).color, 1);
    btnG.fillRoundedRect(bx, by, bw, 64, radius.md);
    add(
      this.add
        .text(width / 2, by + 32, '出 战', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF' })
        .setOrigin(0.5)
        .setDepth(52),
    );
    const btnHit = add(this.add.zone(bx, by, bw, 64).setOrigin(0, 0).setDepth(54).setInteractive({ useHandCursor: true }));
    btnHit.on('pointerup', () => {
      if (!this.pendingLevel) return;
      if (this.pickedDeck.length === 0) {
        this.showHint(width / 2, py + ph + 40, '至少选择 1 张卡再出战');
        return;
      }
      this.registry.set('level', this.pendingLevel);
      this.registry.set('deck', [...this.pickedDeck]);
      this.closeDeckPicker();
      this.scene.start('Battle');
    });

    const closeX = px + pw - 40;
    const closeY = py + 40;
    const cg = add(this.add.graphics().setDepth(52));
    cg.fillStyle(hexToInt(palette.bgDeep), 0.12);
    cg.fillCircle(closeX, closeY, 22);
    add(this.add.text(closeX, closeY, '✕', { fontFamily: 'system-ui, "PingFang SC", sans-serif', fontSize: '24px', fontStyle: 'bold', color: palette.bgDeep }).setOrigin(0.5).setDepth(52));
    const closeHit = add(this.add.zone(closeX - 24, closeY - 24, 48, 48).setOrigin(0, 0).setDepth(54).setInteractive({ useHandCursor: true }));
    closeHit.on('pointerup', () => this.closeDeckPicker());
  }

  private redrawPickedFrames(startX: number, gridY: number, cw: number, ch: number, gap: number, ownedDefs: UnitArchetype[]): void {
    this.pickedFrame?.clear();
    if (!this.pickedFrame) return;
    ownedDefs.forEach((u, i) => {
      if (!this.pickedDeck.includes(u.id)) return;
      const cx = startX + (i % 5) * (cw + gap);
      const cy = gridY + Math.floor(i / 5) * (ch + 14);
      this.pickedFrame?.lineStyle(4, 0xf2c14e, 1);
      this.pickedFrame?.strokeRoundedRect(cx - 2, cy - 2, cw + 4, ch + 4, 10);
    });
    this.deckCountText?.setText(`已选 ${this.pickedDeck.length} / 8`);
  }

  private closeDeckPicker(): void {
    for (const go of this.deckParts) go.destroy();
    this.deckParts = [];
    this.pendingLevel = undefined;
    this.pickedDeck = [];
    this.pickedFrame = undefined;
    this.deckCountText = undefined;
  }

  private showHint(x: number, y: number, msg: string): void {
    this.hintTimer?.remove();
    if (!this.hint) {
      this.hint = this.add.text(x, y, '', { ...typography.caption, color: palette.bgDeep }).setOrigin(0.5).setAlpha(0);
    }
    this.hint.setPosition(x, y).setText(msg).setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 0.7, duration: motion.transition });
    this.hintTimer = this.time.delayedCall(2600, () => {
      if (this.hint) this.tweens.add({ targets: this.hint, alpha: 0, duration: motion.transition });
    });
  }
}

/** 供设置场景占位引用（避免未用告警的类型导出）。 */
export type { SaveStorage };
