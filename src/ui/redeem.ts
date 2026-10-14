import Phaser from 'phaser';
import { typography, zIndex, motion } from './tokens.ts';
import { KIT, pixelPanel, pixelButton, closeButton, MOTION_ENABLED } from './components/kit.ts';
import { writeSave } from '../core/save.ts';
import type { SaveGame } from '../core/schema/save.ts';
import { findRedeemCode, type RedeemReward } from '../data/redeem.ts';
import { itemById } from '../data/items.ts';

/**
 * 兑换码面板（M-INV）。
 *
 * 口径：**可重复兑换**（同一码可无限次使用，调试用途）；因此不记录已用码集合，
 * 仅在 `stats.redeemCount` 累计次数。
 *
 * 交互纪律（本仓硬约束）：
 * - 命中区一律**场景级** zone（容器内 setInteractive 在 depth > 0 不可靠）。
 * - 物理键盘监听**必须在关闭时 off**（弹层可在场景存活期间反复开关，不像场景级 ESC 可依赖自动回收）。
 * - 部件统一 parts 数组销毁；重复打开用 redeemOpen 标志防重入。
 * - 全部动效受 MOTION_ENABLED 门控。
 */

let redeemOpen = false;

/** 把奖励落到存档（唯一发放路径；场景侧不得再写数值）。 */
export function applyRedeemReward(save: SaveGame, r: RedeemReward): void {
  save.wallet.coins += r.coins ?? 0;
  save.wallet.diamonds += r.diamonds ?? 0;
  save.wallet.seeds += r.seeds ?? 0;
  save.wallet.plantFood += r.plantFood ?? 0;
  for (const [id, n] of Object.entries(r.items ?? {})) {
    if (n > 0) save.inventory[id] = (save.inventory[id] ?? 0) + n;
  }
}

/** 奖励 → 展示行（飘字用；道具显示真实名称）。 */
function rewardLines(r: RedeemReward): string[] {
  const out: string[] = [];
  if (r.coins) out.push(`+${r.coins} 金币`);
  if (r.diamonds) out.push(`+${r.diamonds} 钻石`);
  if (r.seeds) out.push(`+${r.seeds} 种子券`);
  if (r.plantFood) out.push(`+${r.plantFood} 能量豆`);
  for (const [id, n] of Object.entries(r.items ?? {})) {
    out.push(`+${n} ${itemById(id)?.name ?? id}`);
  }
  return out;
}

const MAX_CODE_LEN = 12;

export function openRedeemDialog(
  scene: Phaser.Scene,
  save: SaveGame,
  opts: { onGranted?: () => void } = {},
): void {
  if (redeemOpen) return; // 防重入
  redeemOpen = true;

  const { width, height } = scene.scale.gameSize;
  const depth = zIndex.overlay + 10; // 压在设置弹层（overlay..dialog+2）之上
  const parts: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(go: T): T => {
    parts.push(go);
    return go;
  };

  const pw = 720;
  const ph = 700;
  const px = Math.round((width - pw) / 2);
  const py = Math.round((height - ph) / 2);

  const dim = add(scene.add.rectangle(width / 2, height / 2, width, height, KIT.outline, 0.62).setDepth(depth).setInteractive());
  const panel = add(pixelPanel(scene, px, py, pw, ph, { depth: depth + 1, radius: 12 }));

  add(
    scene.add
      .text(width / 2, py + 54, '兑换码', { ...typography.title, color: KIT.textDark })
      .setOrigin(0.5)
      .setDepth(depth + 2),
  );
  add(
    scene.add
      .text(width / 2, py + 92, '输入兑换码领取奖励 · 调试期可重复兑换', { ...typography.caption, color: KIT.textSub })
      .setOrigin(0.5)
      .setDepth(depth + 2),
  );

  // —— 输入框（容器承载，便于抖动）——
  const iw = 520;
  const ih = 84;
  const ix = width / 2 - iw / 2;
  const iy = py + 118;
  const inputC = add(scene.add.container(ix, iy).setDepth(depth + 2));
  const inputG = scene.add.graphics();
  inputC.add(inputG);
  const codeText = scene.add.text(iw / 2, ih / 2, '', { ...typography.input, color: KIT.textDark }).setOrigin(0.5);
  inputC.add(codeText);
  const cursor = scene.add.text(iw / 2, ih / 2 - 4, '|', { ...typography.input, color: KIT.goldDeepCss }).setOrigin(0.5);
  inputC.add(cursor);

  const paintInput = (state: 'idle' | 'ok' | 'bad'): void => {
    inputG.clear();
    inputG.fillStyle(KIT.paperDeep, 1);
    inputG.fillRoundedRect(0, 0, iw, ih, 8);
    const stroke = state === 'ok' ? KIT.success : state === 'bad' ? KIT.danger : KIT.outline;
    inputG.lineStyle(state === 'idle' ? 3 : 4, stroke, 1);
    inputG.strokeRoundedRect(0, 0, iw, ih, 8);
  };
  paintInput('idle');

  // —— 结果行 ——
  const resultText = add(
    scene.add
      .text(width / 2, py + 232, '', { ...typography.body, fontStyle: 'bold', color: KIT.textSub })
      .setOrigin(0.5)
      .setDepth(depth + 3),
  );

  // —— 输入状态 ——
  let code = '';
  const refresh = (): void => {
    codeText.setText(code);
    cursor.x = iw / 2 + codeText.displayWidth / 2 + 8;
    cursor.setVisible(true);
  };
  refresh();

  // 光标闪烁（门控）
  if (MOTION_ENABLED) {
    scene.tweens.add({ targets: cursor, alpha: { from: 0.15, to: 1 }, duration: 520, yoyo: true, repeat: -1 });
  }

  const push = (ch: string): void => {
    if (code.length >= MAX_CODE_LEN) return;
    code += ch;
    paintInput('idle');
    resultText.setText('');
    refresh();
  };
  const backspace = (): void => {
    code = code.slice(0, -1);
    paintInput('idle');
    resultText.setText('');
    refresh();
  };

  let resetTimer: Phaser.Time.TimerEvent | undefined;

  /** 成功：奖励飘字 + 落盘 + 通知宿主刷新。 */
  const showGain = (r: RedeemReward): void => {
    const lines = rewardLines(r).slice(0, 6);
    if (!MOTION_ENABLED) return;
    lines.forEach((line, i) => {
      const t = add(
        scene.add
          .text(width / 2, py - 12, line, { ...typography.heading, color: KIT.goldDeepCss })
          .setOrigin(0.5)
          .setDepth(depth + 4)
          .setStroke(KIT.outlineCss, 5),
      );
      scene.tweens.add({
        targets: t,
        y: py - 66 - i * 34,
        alpha: { from: 1, to: 0 },
        duration: motion.slow + 600,
        delay: i * 110,
        ease: 'Quad.easeOut',
        onComplete: () => t.destroy(),
      });
    });
  };

  const submit = (): void => {
    const hit = findRedeemCode(code);
    if (!hit) {
      paintInput('bad');
      resultText.setText('兑换码无效，请检查后重试').setColor(KIT.dangerCss);
      if (MOTION_ENABLED) {
        scene.tweens.add({
          targets: inputC,
          x: ix - 8,
          duration: 50,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.easeInOut',
          onComplete: () => inputC.setX(ix),
        });
      }
      return;
    }
    applyRedeemReward(save, hit.reward);
    save.stats.redeemCount += 1;
    try {
      writeSave(window.localStorage, save);
    } catch {
      /* 存储不可用：表现已即时生效，仅未持久化 */
    }
    scene.registry.set('save', save);
    paintInput('ok');
    resultText.setText(`兑换成功 · ${hit.reward.label}`).setColor(KIT.successCss);
    showGain(hit.reward);
    opts.onGranted?.();
    // 便于连续兑换：清空输入，稍后复位描边
    code = '';
    refresh();
    resetTimer?.remove();
    resetTimer = scene.time.delayedCall(1200, () => paintInput('idle'));
  };

  // —— 屏幕键盘（3×4：1-9 / 删除 0 确认）——
  const KEY_ROWS: string[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['del', '0', 'ok'],
  ];
  const kw = 140;
  const kh = 72;
  const gx = 16;
  const gy = 16;
  const gridW = 3 * kw + 2 * gx;
  const kx0 = width / 2 - gridW / 2;
  const ky0 = py + 272;
  KEY_ROWS.forEach((row, r) => {
    row.forEach((k, c) => {
      const x = kx0 + c * (kw + gx);
      const y = ky0 + r * (kh + gy);
      const label = k === 'del' ? '删除' : k === 'ok' ? '确认' : k;
      const accent = k === 'ok' ? KIT.gold : k === 'del' ? KIT.woodLight : KIT.paperDeep;
      const btn = pixelButton(scene, x, y, kw, kh, label, {
        accent,
        depth: depth + 2,
        onClick: () => {
          if (k === 'del') backspace();
          else if (k === 'ok') submit();
          else push(k);
        },
      });
      parts.push(btn.container, btn.hit);
    });
  });

  add(
    scene.add
      .text(width / 2, py + ph - 38, '调试期可用码：6666（可重复兑换）· ESC 关闭 · 回车确认', {
        ...typography.caption,
        color: KIT.textSub,
      })
      .setOrigin(0.5)
      .setDepth(depth + 2),
  );

  // —— 关闭（统一走 kit.closeButton） ——
  const closeX = px + pw - 56;
  const closeY = py + 40;
  const closeHit = closeButton(scene, closeX, closeY, { depth: depth + 2, onClick: () => close() });
  add(closeHit);

  // 场景被销毁时兜底复位防重入标志（正常路径由 close() 复位）
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    redeemOpen = false;
  });

  function close(): void {
    redeemOpen = false;
    scene.input.keyboard?.off('keydown', onKey); // 必须显式移除：弹层可在场景存活期反复开关
    resetTimer?.remove();
    resetTimer = undefined;
    scene.tweens.killTweensOf(cursor);
    for (const p of parts) p.destroy();
    parts.length = 0;
  }

  // —— 物理键盘 ——
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      close();
      return;
    }
    if (ev.key === 'Enter') {
      submit();
      return;
    }
    if (ev.key === 'Backspace') {
      backspace();
      return;
    }
    if (/^[0-9a-zA-Z]$/.test(ev.key)) push(ev.key.toUpperCase());
  };
  scene.input.keyboard?.on('keydown', onKey);

  // —— 进场 ——
  if (MOTION_ENABLED) {
    dim.setAlpha(0);
    scene.tweens.add({ targets: dim, alpha: 0.62, duration: motion.transition });
    panel.setAlpha(0).setScale(0.94);
    scene.tweens.add({ targets: panel, alpha: 1, scale: 1, duration: motion.transition, ease: 'Back.easeOut' });
  }
}
