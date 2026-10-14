import Phaser from 'phaser';
import { FONT, motion } from '../tokens.ts';
import { KIT, MOTION_ENABLED } from './kit.ts';
import type { PrizeTier } from '../../core/gacha.ts';

/**
 * 抽卡品质动效库（M-INV，表现层，不依赖任何玩法逻辑）。
 *
 * 设计口径（frontend-dev 动效原则迁移到 Phaser）：
 * - **强度分级**：普通=纯几何反馈；稀有=光晕+扫光+少量粒子；传说=蓄势+放射光条+全屏闪白+粒子爆发+大幅回弹。
 * - **只动 GPU 友好属性**：Phaser 侧对应 alpha / scale / position / rotation；不逐帧重绘 Graphics。
 * - **性能硬上限**：传说爆发 粒子 ≤28 / 光条 ≤14；跳过后全部 kill，避免触达「活跃 Tween ≤300、粒子 ≤2000」预算。
 * - **reduced-motion**：全部受 MOTION_ENABLED 门控；关闭时退化为「直接显示」，且不留任何 repeat:-1。
 * - **闪白单次**：不使用高频闪烁（避免 >3 次/秒的闪烁风险）。
 */

/** 三档品质的揭示配方（数值即设计意图，集中在此便于调参）。 */
export interface TierRecipe {
  /** 卡片揭示时长 ms。 */
  revealMs: number;
  /** 揭示前的蓄势（仅传说）。 */
  chargeMs: number;
  /** 回弹过冲倍率。 */
  overshoot: number;
  /** 是否加品质光晕。 */
  aura: boolean;
  /** 是否加斜向扫光带。 */
  sweep: boolean;
  /** 放射光条数（0=无）。 */
  rays: number;
  /** 爆发粒子数。 */
  particles: number;
  /** 是否全屏闪白。 */
  flash: boolean;
  /** 品质色。 */
  tint: number;
}

export const TIER_RECIPE: Record<PrizeTier, TierRecipe> = {
  common: { revealMs: 200, chargeMs: 0, overshoot: 1.06, aura: false, sweep: false, rays: 0, particles: 0, flash: false, tint: KIT.rarityCommon },
  rare: { revealMs: 320, chargeMs: 0, overshoot: 1.12, aura: true, sweep: true, rays: 0, particles: 8, flash: false, tint: KIT.rarityRare },
  legendary: { revealMs: 480, chargeMs: 260, overshoot: 1.18, aura: true, sweep: true, rays: 14, particles: 28, flash: true, tint: KIT.rarityLegendary },
};

/** 品质光晕（卡片背后的两层实色圆，缓慢呼吸）。 */
function rarityAura(scene: Phaser.Scene, x: number, y: number, w: number, h: number, tint: number, depth: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const r = Math.max(w, h) * 0.72;
  g.fillStyle(tint, 0.16);
  g.fillCircle(x, y, r);
  g.fillStyle(tint, 0.1);
  g.fillCircle(x, y, r * 1.35);
  g.setScale(0.6).setAlpha(0);
  scene.tweens.add({ targets: g, scale: 1, alpha: 1, duration: motion.transition, ease: 'Quad.easeOut' });
  if (MOTION_ENABLED) {
    scene.tweens.add({ targets: g, scale: 1.06, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: motion.transition });
  }
  return g;
}

/** 斜向扫光带（用几何遮罩裁到卡片内，避免溢出）。 */
function shineSweep(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  duration: number,
  depth: number,
): Phaser.GameObjects.Container {
  const holder = scene.add.container(0, 0).setDepth(depth);
  const maskShape = scene.add.graphics().setVisible(false);
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
  const band = scene.add.rectangle(x - w, y, 28, h * 1.6, 0xffffff, 0.42).setRotation(Phaser.Math.DegToRad(18));
  band.setMask(maskShape.createGeometryMask());
  holder.add(band);
  holder.setData('mask', maskShape);
  scene.tweens.add({
    targets: band,
    x: x + w,
    duration,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      maskShape.destroy();
      holder.destroy(true);
    },
  });
  return holder;
}

/** 放射光条（传说专属）。 */
function raysBurst(scene: Phaser.Scene, x: number, y: number, count: number, tint: number, depth: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setPosition(x, y).setDepth(depth);
  const n = Math.min(count, 14);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const spread = 0.045;
    g.fillStyle(tint, 0.85);
    g.fillTriangle(0, 0, Math.cos(a - spread) * 260, Math.sin(a - spread) * 260, Math.cos(a + spread) * 260, Math.sin(a + spread) * 260);
  }
  g.setScale(0.25).setAlpha(0.95);
  scene.tweens.add({ targets: g, scale: 1.15, alpha: 0, duration: motion.elastic + 160, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
  return g;
}

/** 粒子爆发（数量硬上限 28）。 */
function sparkBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number,
  tint: number,
  depth: number,
  sink: Phaser.GameObjects.GameObject[],
): void {
  const n = Math.min(count, 28);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
    const dist = Phaser.Math.Between(80, 210);
    const p = scene.add.circle(x, y, Phaser.Math.Between(2, 4), i % 3 === 0 ? KIT.white : tint, 1).setDepth(depth);
    sink.push(p);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(a) * dist,
      y: y + Math.sin(a) * dist,
      alpha: 0,
      scale: 0.35,
      duration: motion.elastic + 200,
      ease: 'Quad.easeOut',
      onComplete: () => p.destroy(),
    });
  }
}

/** NEW 徽记（首次获得）。 */
function newBadge(scene: Phaser.Scene, x: number, y: number, depth: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(depth);
  const g = scene.add.graphics();
  g.fillStyle(KIT.rarityLegendary, 1);
  g.fillRoundedRect(0, 0, 56, 26, 6);
  g.lineStyle(2, KIT.outline, 1);
  g.strokeRoundedRect(0, 0, 56, 26, 6);
  c.add(g);
  c.add(scene.add.text(28, 13, 'NEW', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: KIT.textDark }).setOrigin(0.5));
  if (MOTION_ENABLED) {
    c.setScale(0.4);
    scene.tweens.add({ targets: c, scale: 1, duration: motion.feedback + 80, ease: 'Back.easeOut' });
  }
  return c;
}

export interface RevealHandle {
  /** 立即置为终态（「跳过」用）：kill 掉全部在途 tween 与临时件。 */
  finalize(): void;
}

export interface RevealOpts {
  tier: PrizeTier;
  /** 入场延迟 ms（十连级联用）。 */
  delay: number;
  /** 首次获得（显示 NEW 徽记）。 */
  isNew?: boolean;
  /** 卡片尺寸与中心（场景坐标，用于光效定位）。 */
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * 统一揭示入口：按品质档播放不同配方。
 * 返回 handle 供「跳过」立即置终态。
 */
export function revealCard(scene: Phaser.Scene, card: Phaser.GameObjects.Container, opts: RevealOpts): RevealHandle {
  const { tier, delay, isNew, width, height, x, y } = opts;
  const recipe = TIER_RECIPE[tier];
  const depth = card.depth;
  const fx: Phaser.GameObjects.GameObject[] = [];
  let badge: Phaser.GameObjects.Container | undefined;
  let done = false;

  const clearFx = (): void => {
    for (const o of fx) o.destroy();
    fx.length = 0;
  };

  const showBadge = (): void => {
    if (!isNew || badge) return;
    badge = newBadge(scene, x - width / 2 + 6, y - height / 2 + 6, depth + 3);
    fx.push(badge);
  };

  const finalize = (): void => {
    if (done) return;
    done = true;
    scene.tweens.killTweensOf(card);
    for (const o of fx) {
      scene.tweens.killTweensOf(o);
      // 容器内的临时件（如扫光带）也有在途 tween，需一并 kill
      const list = (o as Phaser.GameObjects.Container).list;
      if (Array.isArray(list)) for (const child of list) scene.tweens.killTweensOf(child);
    }
    card.setAlpha(1).setScale(1);
    clearFx();
    showBadge();
  };

  if (!MOTION_ENABLED) {
    // 减弱动态：直接显示，不做任何揭示演出
    card.setAlpha(1).setScale(1);
    finalize();
    return { finalize };
  }

  const startReveal = (): void => {
    if (done) return;
    if (tier === 'legendary') {
      raysBurst(scene, x, y, recipe.rays, recipe.tint, depth - 1);
      sparkBurst(scene, x, y, recipe.particles, recipe.tint, depth - 1, fx);
      scene.cameras.main.flash(180, 255, 245, 210);
      card.setAlpha(1).setScale(0.25);
      scene.tweens.add({
        targets: card,
        scale: recipe.overshoot,
        duration: recipe.revealMs * 0.6,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (done) return;
          scene.tweens.add({ targets: card, scale: 1, duration: recipe.revealMs * 0.4, ease: 'Sine.easeOut' });
        },
      });
    } else {
      card.setAlpha(1).setScale(0, 1);
      scene.tweens.add({ targets: card, scaleX: 1, duration: recipe.revealMs, ease: 'Back.easeOut' });
    }
    if (recipe.aura) fx.push(rarityAura(scene, x, y, width, height, recipe.tint, depth - 1));
    if (recipe.sweep) fx.push(shineSweep(scene, x, y, width, height, recipe.revealMs + 140, depth + 1));
    if (recipe.particles > 0 && tier !== 'legendary') sparkBurst(scene, x, y, recipe.particles, recipe.tint, depth - 1, fx);
    scene.time.delayedCall(recipe.revealMs + 60, () => {
      if (!done) showBadge();
    });
  };

  // 传说：先蓄势（光晕聚拢），再揭示
  if (recipe.chargeMs > 0) {
    const charge = scene.add.graphics().setDepth(depth - 1);
    charge.fillStyle(recipe.tint, 0.22);
    charge.fillCircle(x, y, Math.max(width, height) * 0.5);
    charge.setScale(0.2).setAlpha(0);
    fx.push(charge);
    scene.tweens.add({ targets: charge, scale: 1.3, alpha: 1, duration: recipe.chargeMs, ease: 'Quad.easeIn' });
    scene.time.delayedCall(delay + recipe.chargeMs, startReveal);
  } else if (delay > 0) {
    scene.time.delayedCall(delay, startReveal);
  } else {
    startReveal();
  }

  return { finalize };
}

export interface MachineHandle {
  /** 抽卡时的脉冲反馈（无动效时为空操作）。 */
  pulse(): void;
  destroy(): void;
}

/** 抽奖机待机（纸底圆台 + 金色宝珠 + 环绕微光点 + 呼吸）。 */
export function gachaMachineIdle(scene: Phaser.Scene, x: number, y: number, opts: { depth?: number } = {}): MachineHandle {
  const depth = opts.depth ?? 2;
  const parts: Phaser.GameObjects.GameObject[] = [];

  // 圆台 + 底影（静态层）
  const base = scene.add.graphics().setDepth(depth);
  parts.push(base);
  base.fillStyle(KIT.shadow, 0.22);
  base.fillEllipse(x, y + 74, 250, 40);
  base.fillStyle(KIT.paperDeep, 1);
  base.fillRoundedRect(x - 120, y + 40, 240, 32, 10);
  base.lineStyle(3, KIT.outline, 1);
  base.strokeRoundedRect(x - 120, y + 40, 240, 32, 10);

  // 宝珠（可呼吸的容器）
  const orb = scene.add.container(x, y).setDepth(depth + 1);
  parts.push(orb);
  const og = scene.add.graphics();
  og.fillStyle(KIT.gold, 0.12);
  og.fillCircle(0, 0, 92);
  og.fillStyle(KIT.gold, 0.16);
  og.fillCircle(0, 0, 66);
  og.fillStyle(KIT.gold, 1);
  og.fillCircle(0, 0, 46);
  og.fillStyle(KIT.sunCore, 1);
  og.fillCircle(-13, -13, 16);
  og.lineStyle(3, KIT.outline, 1);
  og.strokeCircle(0, 0, 46);
  orb.add(og);

  // 环绕微光点（整圈缓慢自转）
  const ring = scene.add.container(x, y).setDepth(depth + 1);
  parts.push(ring);
  const rg = scene.add.graphics();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rg.fillStyle(i % 2 === 0 ? KIT.sunCore : KIT.moteWarm, 0.9);
    rg.fillCircle(Math.cos(a) * 74, Math.sin(a) * 74, 3 + (i % 2));
  }
  ring.add(rg);

  if (MOTION_ENABLED) {
    scene.tweens.add({ targets: orb, scale: { from: 1, to: 1.045 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: ring, rotation: Math.PI * 2, duration: 9000, repeat: -1, ease: 'Linear' });
  }

  return {
    pulse(): void {
      if (!MOTION_ENABLED) return;
      scene.tweens.add({ targets: orb, scale: 1.18, duration: motion.feedback, yoyo: true, ease: 'Quad.easeOut' });
    },
    destroy(): void {
      for (const p of parts) p.destroy();
      parts.length = 0;
    },
  };
}
