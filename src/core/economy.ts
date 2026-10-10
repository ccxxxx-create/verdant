import type { UnitArchetype } from './schema/unit.ts';

type ProducerLike = Pick<UnitArchetype, 'produce'>;

/**
 * 产出单位每周期的收益语义（用户反馈#7：阳光是"掉落收集"的，不是直接到账）。
 * M1C 曾双倍到账（立即 +amount 且掉落可再收 +amount），本模块是回归防线：
 * produce 存在时 immediateGain 必须为 0，收益只经 spawnDrop → collectSun 路径。
 */
export function producerTick(def: ProducerLike): { immediateGain: number; spawnsDrop: boolean } {
  if (!def.produce) return { immediateGain: 0, spawnsDrop: false };
  return { immediateGain: 0, spawnsDrop: true };
}
