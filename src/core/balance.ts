/**
 * 战斗与经济平衡数值的唯一事实源（M2 建立，M3A 重锚）。
 * PvZ1 对齐口径来自原版反编译实测（docs/_review/research-notes.md 待誊清）：
 * - 啃食：DAMAGE_PER_EAT=4，每 4 tick 一口 @100Hz 鈫?100 dps 鈫?300 血植物 3s、木芯 4000=40s
 * - 波点：points = wave/3 + 1；大波 脳2.5 并强灌普通僵尸；清场加速（剩 鈮?55% 血 鈫?计时压 2s）
 * - 天空阳光 4.25~7s（本仓有意放宽为 7~11s，见 GDD 楼8.2 放宽记录）
 * 图鉴静态页 docs/almanac.html 与本文件同源：改完运行 node scripts/gen-almanac.mjs。
 */

/** 抗击退/护甲系数（布 0 / 皮 15% / 壳 30% / 铁 45% 减伤）。 */
export const ARMOR_MULT: Record<string, number> = { cloth: 1, hide: 0.85, shell: 0.7, iron: 0.55 };

/** 敌人啃食 dps（PvZ1 实测 100；Boss 140 更有压迫感）。 */
export const ENEMY_BITE_DPS = 100;
export const BOSS_BITE_DPS = 140;

/** 铁门正面格挡盾量（shell_block_front；越顶/绕后/元素破）。 */
export const SHIELD_HP = 250;

/** 波次节奏（秒）。key 覆盖全部 LevelDef.template，未覆盖走 default。 */
export const WAVE_PACING = {
  /** 首波延迟。 */
  firstWave: { teach: 12, normal: 10, flag: 8, survive: 8, boss: 8, chal: 10, conveyor: 6, default: 10 } as Record<string, number>,
  /** 常规波间隔基数（+ rand(0, range)）。 */
  betweenWaves: { base: 18, range: 4 },
  /** 波内出怪间隔。 */
  spawnInterval: { teach: 2.0, normal: 1.6, flag: 1.5, survive: 1.6, boss: 1.6, chal: 1.6, conveyor: 1.6, default: 1.6 } as Record<string, number>,
  /** 波次预算公式 base鈥?(1+w鈥硋rowth)鈥硋scale鈥硋inalMult 的系数。 */
  base: 6,
  growth: 0.3,
  scale: { teach: 0.35, normal: 1, flag: 1, survive: 1, boss: 0.8, chal: 1, conveyor: 1, default: 1 } as Record<string, number>,
  finalWaveMult: 2.5,
  /** 清场加速（PvZ1 Board.cpp:5494）：上一波剩余血量 鈮?hpFrac 且计时已过 afterS 鈫?计时压到 fastS。 */
  accelerate: { afterS: 4, hpFrac: 0.55, fastS: 2 },
  /** 大波频率（每 N 波一个大波；末波恒为大波）。 */
  flagEvery: 10,
  /** 大波强灌的普通僵尸数上限（PvZ1：min(points, 8)）。 */
  hugeWavePlain: 8,
  /** 大波前警示时长。 */
  warningS: 7.5,
} as const;

/** 天空露珠（PvZ1 公开常识：约 10s 一滴；本仓 7~11s 为有意放宽）。 */
export const SKY_SUN = {
  firstS: 4.5,
  intervalMinS: 7,
  intervalMaxS: 11,
  value: 25,
  /** 落地停留 s（超 3s 时进入闪烁倒计时）。 */
  restS: 14,
};

/** 局内货币"露珠"的统一含义注释（卡面 cost 单位为露珠）。 */
export const SUN_NOTE = '局内货币=露珠（阳光）；局外成长货币见 src/data/economy.ts。';

/** 倍速挡位。 */
export const SPEED_TOGGLE = 2;

/** Boss 召唤参数（stone_hide_giant）。 */
export const BOSS_SUMMON = {
  intervalS: 8,
  minPerCast: 1,
  maxPerCast: 2,
  maxAlive: 4,
  pool: ['grey_tide_swarm'],
} as const;

/** gnaw_pause：路过生产单位停下啃咬的时长 s。 */
export const GNAW_PAUSE_S = 1.5;

/** web_stun：蛛网定身单位时长 s。 */
export const WEB_STUN_S = 3;

/** eats_drops：露珠蛾偷吃露珠的判定半径 px。 */
export const MOTH_EAT_R = 44;

/** 无头模拟器固定步长 ms（校准用，见 tests/sim.test.ts）。 */
export const SIM_DT_MS = 50;

