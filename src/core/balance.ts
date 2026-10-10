/**
 * 战斗与经济平衡数值的唯一事实源（M2：图鉴静态页与 BattleScene 共用，防调参漂移）。
 * 所有"可调数值"集中在此；改这里同时影响游戏与 docs/almanac.html。
 * PvZ1 对标口径见 docs/RESEARCH-PVZ.md（标注：开源移植参考，未经官方验证）。
 */

/** 护甲减伤系数（布 0/皮 15%/壳 30%/铁 45%）。 */
export const ARMOR_MULT: Record<string, number> = { cloth: 1, hide: 0.85, shell: 0.7, iron: 0.55 };

/** 波导演节奏（秒；key 覆盖全部 LevelDef.template 枚举，未列模板走 default）。 */
export const WAVE_PACING = {
  firstWave: { teach: 20, normal: 14, default: 14 } as Record<string, number>,
  betweenWaves: { teach: 16, normal: 12, default: 12 } as Record<string, number>,
  spawnInterval: { teach: 2.2, normal: 1.8, default: 1.8 } as Record<string, number>,
  /** 波预算基数（teach 缩放 0.35，其余 1.0；终波 ×2.5 大旗波） */
  base: 6,
  growth: 0.3,
  scale: { teach: 0.35, normal: 1, default: 1 } as Record<string, number>,
  finalWaveMult: 2.5,
};

/** 天空阳光（PvZ1 公开常识：约 10s 一枚）。 */
export const SKY_SUN = {
  firstS: 5,
  intervalMinS: 9.5,
  intervalMaxS: 11.5,
  value: 25,
  /** 落地停留秒数（末 3s 闪烁） */
  restS: 14,
};

/** 关卡内光露（阳光）的统一定价语义注释：卡片 cost 单位为光露。 */
export const SUN_NOTE = '局内货币=光露（阳光）；局外成长货币见 src/data/economy.ts。';

/** 倍速档位。 */
export const SPEED_TOGGLE = 2;
