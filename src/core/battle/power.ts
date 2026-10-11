/**
 * World Energy Ultimate (GDD 搂13.1, M3A): drag a world energy onto a unit to trigger the 8s enhancement;
 * effects are configured per unit by the power table; drag to a blank cell = knockback + fire damage.
 */

import type { BattleState, UnitInst } from './types.ts';

import { damageEnemy } from './sim.ts';
import {
  POWER_DURATION_MS,
  POWER_KNOCKBACK_CELLS,
  POWER_KNOCKBACK_DAMAGE,
  POWER_KNOCKBACK_RADIUS,
  COL_W,
} from './layout.ts';

import { cellX, cellY } from './layout.ts';

/** Generic enhanced damage multiplier (PvZ2 plant food generic boost: damage 脳2). */

export const POWER_GENERIC_DAMAGE_MULT = 2;

export function isPowered(u: UnitInst, now: number): boolean {
  return u.powerUntil > now;
}

/** Whether the ultimate can be used in the current battle. */

export function canUsePlantFood(state: BattleState): boolean {
  return state.plantFood > 0 && state.status === 'playing';
}

/**
 * Drag the world energy onto a unit: consume 1 energy, apply effects by the power table,
 * emit powerStart (and powerEnd handled by step timing out).
 */

export function usePlantFoodOnUnit(state: BattleState, uid: number): boolean {
  if (!canUsePlantFood(state)) return false;
  const u = state.units.find((x) => x.uid === uid && x.hp > 0);
  if (!u) return false;
  state.plantFood -= 1;
  const kind = u.def.power?.kind ?? 'generic';
  const params = u.def.power?.params ?? {};
  switch (kind) {
    case 'produce_burst': {
      const mult = params['mult'] ?? 4;
      const amount = (u.def.produce?.amount ?? 25) * mult;
      state.lightdew += amount;
      u.powerUntil = state.now + 1200; // Brief highlight
      state.events.push({ t: 'sunCollect', did: 0, x: u.x, y: u.y, amount });
      break;
    }
    case 'multi_shot': {
      const shots = params['shots'] ?? 3;
      const dmg = u.def.attack?.damage ?? 20;
      const el = u.def.attack?.element ?? 'none';
      for (let i = 0; i < shots; i++) {
        u.pendingShots.push({ at: state.now + i * 80, damage: dmg, element: el });
      }
      u.powerUntil = state.now + POWER_DURATION_MS;
      break;
    }
    case 'instant_trigger': {
      // Immediate trigger (drum cap detonation / chestnut mushroom firing)
      const a = u.def.attack;
      if (a) {
        const radius = a.radius ?? 1;
        const reach = COL_W * (radius + 0.2);
        for (const e of [...state.enemies]) {
          if (e.def.isBoss) continue;
          if (Math.abs(e.x - u.x) > reach) continue;
          damageEnemy(state, e, a.damage, a.element ?? 'none', false); // 统一伤害入口（护甲/死亡事件，审查 P1）
        }
        state.events.push({ t: 'blast', x: u.x, y: u.y });
      }
      u.powerUntil = state.now + POWER_DURATION_MS;
      break;
    }
    case 'stun_lane': {
      const durationMs = params['durationMs'] ?? 5000;
      for (const e of state.enemies) {
        if (e.row !== u.row || e.hp <= 0) continue;
        e.stunUntil = Math.max(e.stunUntil, state.now + durationMs);
        state.events.push({ t: 'stun', x: e.x, y: cellY(e.row) });
      }
      u.powerUntil = state.now + POWER_DURATION_MS;
      break;
    }
    default: {
      u.powerUntil = state.now + POWER_DURATION_MS;
      break;
    }
  }
  state.events.push({ t: 'powerStart', unit: u });
  return true;
}

/** Drag the world energy onto a blank grid: knock back enemies within the radius + fire damage. */

export function usePlantFoodAtCell(state: BattleState, row: number, col: number): boolean {
  if (!canUsePlantFood(state)) return false;
  state.plantFood -= 1;
  const cx = cellX(col);
  const cy = cellY(row);
  const radius = POWER_KNOCKBACK_RADIUS * COL_W;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    if (Math.abs(e.row - row) > 1) continue;
    const dx = Math.abs(e.x - cx);
    if (dx > radius) continue;
    const resist = e.def.traits.includes('fire_resist') ?? false;
    const dmg = resist ? POWER_KNOCKBACK_DAMAGE / 2 : POWER_KNOCKBACK_DAMAGE;
    damageEnemy(state, e, dmg, 'fire', false); // 统一伤害入口（burn 由 fire 元素规则，审查 P1）
    e.x += POWER_KNOCKBACK_CELLS * COL_W;
    e.biteTarget = undefined;
  }
  state.events.push({ t: 'knockback', x: cx, y: cy });
  return true;
}

/** Clearing of expired enhancement status (called by step each frame). */

export function tickPowerUps(state: BattleState): void {
  for (const u of state.units) {
    if (u.powerUntil > 0 && u.powerUntil <= state.now) {
      u.powerUntil = 0;
      state.events.push({ t: 'powerEnd', unit: u });
    }
  }
}

