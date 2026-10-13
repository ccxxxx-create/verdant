/**
 * Traits（M3A）：敌人与单位的行为实现，全部为内核纯函数。
 * 敌人：gnaw_pause / web_stun / eats_drops / shell_block_front / targets_attackers / swarm(在 director) / summon(在 director)
 * 单位：control / reveal / aura
 */
import type { BattleState, EnemyInst, UnitInst } from './types.ts';
import { BITE_OFFSET, COL_W, cellY } from './layout.ts';
import { GNAW_PAUSE_S, MOTH_EAT_R, WEB_STUN_S, enemyBiteDps } from '../balance.ts';

/** 同排前方最近的啃食目标；targets_attackers 优先咬攻击植物。 */
export function findBiteTarget(state: BattleState, e: EnemyInst): UnitInst | undefined {
  let best: UnitInst | undefined;
  let bestScore = -1;
  for (const u of state.units) {
    if (u.row !== e.row || u.hp <= 0) continue;
    const dx = e.x - BITE_OFFSET - u.x;
    if (dx < -10 || dx >= COL_W * 0.7) continue;
    const score = e.def.traits.includes('targets_attackers') && u.def.attack ? 1 : 0;
    if (score > bestScore || (score === bestScore && (!best || u.x > best.x))) {
      best = u;
      bestScore = score;
    }
  }
  return best;
}

/** gnaw_pause：路过生产单位时停下啃一口再走（每个单位只啃一次）。 */
export function gnawPauseStep(state: BattleState, e: EnemyInst, dtMs: number): boolean {
  void dtMs;
  if (e.biteTarget || e.def.flying) return false;
  if (!e.def.traits.includes('gnaw_pause')) return false;
  const target = state.units.find(
    (u) => u.row === e.row && u.hp > 0 && u.def.role === 'producer' && Math.abs(e.x - BITE_OFFSET - u.x) < COL_W * 0.4,
  );
  if (!target) return false;
  e.gnawed ??= new Set<number>();
  if (e.gnawed.has(target.uid)) return false;
  e.gnawed.add(target.uid);
  const dmg = enemyBiteDps(e.def) * GNAW_PAUSE_S; // 与主啃食同口径（审查 P2：此前直读基准常量，Boss/特化敌人会脱节）
  target.hp -= dmg;
  state.events.push({ t: 'hit', x: target.x, y: target.y, damage: dmg, element: 'none', target: 'unit', tid: target.uid });
  if (target.hp <= 0) state.events.push({ t: 'unitDeath', unit: target, x: target.x, y: target.y });
  return true;
}

/** web_stun：获得啃食目标时蛛网定身该单位 3s。 */
export function applyWebStun(state: BattleState, e: EnemyInst, target: UnitInst): void {
  if (!e.def.traits.includes('web_stun')) return;
  target.stunUntil = Math.max(target.stunUntil, state.now + WEB_STUN_S * 1000);
  state.events.push({ t: 'web', x: target.x, y: target.y });
}

/** eats_drops：露珠蛾飞过时偷走静置的露珠。 */
export function mothEatStep(state: BattleState, e: EnemyInst): void {
  if (!e.def.traits.includes('eats_drops')) return;
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const d = state.drops[i];
    if (!d || d.kind !== 'light' || d.falling) continue;
    if (Math.abs(d.x - e.x) < MOTH_EAT_R) {
      state.events.push({ t: 'sunCollect', did: d.did, x: d.x, y: d.y, amount: 0 });
      state.drops.splice(i, 1);
    }
  }
}

/** control：钘绳定身进入相邻范围的地面敌人 4s。 */
export function controlStep(state: BattleState, u: UnitInst): void {
  const c = u.def.control;
  if (!c) return;
  for (const e of state.enemies) {
    if (e.def.flying || e.hp <= 0 || e.row !== u.row) continue;
    if (e.x < u.x - COL_W * 0.5 || e.x > u.x + COL_W * 1.6) continue;
    if (u.controlled.has(e.eid)) continue;
    e.stunUntil = state.now + c.stunMs;
    u.controlled.add(e.eid);
    state.events.push({ t: 'stun', x: e.x, y: cellY(e.row) });
  }
}

/** reveal：薄雾灯将 3 格内敌人标记为显形（M4 潜行敌接入前为展示位）。 */
export function revealStep(state: BattleState, u: UnitInst): void {
  if (!u.def.reveal) return;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    if (Math.abs(e.row - u.row) > 1) continue;
    if (Math.abs(e.x - u.x) > COL_W * 3) continue;
    e.revealed = true;
  }
}

/** aura：花蜜光环使范围内同伴攻速 +pct（返回该单位的攻击间隔系数）。 */
export function auraIntervalFactor(state: BattleState, u: UnitInst): number {
  let factor = 1;
  for (const a of state.units) {
    const aura = a.def.aura;
    if (!aura || a.hp <= 0 || a.uid === u.uid) continue;
    const rowOk = Math.abs(a.row - u.row) <= aura.radiusCells;
    const colOk = Math.abs(a.x - u.x) <= COL_W * (aura.radiusCells + 0.5);
    if (rowOk && colOk) factor *= 1 - aura.attackSpeedPct / 100;
  }
  return factor;
}

export function isUnitStunned(state: BattleState, u: UnitInst): boolean {
  return u.stunUntil > state.now;
}

export function isEnemyStunned(state: BattleState, e: EnemyInst): boolean {
  return e.stunUntil > state.now;
}

export function isEnemySlowed(e: EnemyInst, now: number): boolean {
  return e.slowUntil > now;
}

