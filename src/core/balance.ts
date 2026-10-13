/**
 * 战斗与经济平衡数值的唯一事实源（M2 建立，M3A 重锚）。
 * PvZ1 对齐口径来自原版反编译实测（docs/_review/research-notes.md 待誊清）：
 * - 啃食：DAMAGE_PER_EAT=4，每 4 tick 一口 @100Hz 鈫?100 dps 鈫?300 血植物 3s、木芯 4000=40s
 * - 波点：points = wave/3 + 1；大波 脳2.5 并强灌普通僵尸；清场加速（剩 鈮?55% 血 鈫?计时压 2s）
 * - 天空阳光 4.25s + rand(0~2.75s)，上限 7s（原 firstS 4.5 + 7~11s 偏慢，2026-10-12 用户试玩裁定废止）
 * 图鉴静态页 docs/almanac.html 与本文件同源：改完运行 node scripts/gen-almanac.mjs。
 */

/** 抗击退/护甲系数（布 0 / 皮 15% / 壳 30% / 铁 45% 减伤）。 */
export const ARMOR_MULT: Record<string, number> = { cloth: 1, hide: 0.85, shell: 0.7, iron: 0.55 };

/**
 * 敌人啃食 dps —— PvZ2 权威基准 **100**（与 PvZ1 同口径；见 `src/data/pvz2/mechanics.ts` 的 BITE_DPS）。
 * PvZ2 的设计是"所有僵尸啃食速度一致，威胁差异靠血量 / 护甲 / 特性"，
 * 因此 archetype 的 `biteDps` 必须引用本常量，不得各自写小数值
 * （历史事故：archetype 写 4~14 导致 100 dps 声明了却从未生效）。
 */
export const ENEMY_BITE_DPS = 100;
/** Boss 啃食：PvZ2 的 Zombot 不啃食；本仓 Boss 会啃食，140 为原创加压值（参考表已记录）。 */
export const BOSS_BITE_DPS = 140;

/** 啃食 dps 的唯一取值入口（禁止在 sim 内联三元表达式，防再次脱节）。 */
export function enemyBiteDps(def: { isBoss?: boolean; biteDps?: number }): number {
  if (def.isBoss) return BOSS_BITE_DPS;
  return def.biteDps ?? ENEMY_BITE_DPS;
}

/** 铁门正面格挡盾量（shell_block_front；越顶/绕后/元素破）。 */
export const SHIELD_HP = 250;

/** 波次节奏（秒）。key 覆盖全部 LevelDef.template，未覆盖走 default。 */
export const WAVE_PACING = {
  /**
   * 首波延迟 = **2 秒**（PvZ2 权威口径：wiki.gg 关卡页记载首波 "Begins 2 seconds after starting the level"）。
   * 说明：PvZ2 首波虽早，但僵尸要走 ~45s 才到防线（Basic 5.0s/格 × 9 格），有效缓冲 ≈ 47s；
   * 仓库 Basic 速度 4.76s/格 → 缓冲 ≈ 45s，两者相当，故 2s 不构成"首波太快"。
   */
  firstWave: { teach: 2, normal: 2, flag: 2, survive: 2, boss: 2, chal: 2, conveyor: 2, default: 2 } as Record<string, number>,
  /**
   * 常规波间隔（+ rand(0, range)）。
   * **由 PvZ2 已查证锚点反推**：1 面旗 = 5 波、单关 1~2 分钟 → 首波 2s + 4 个间隔 + 清场 ≈ 90~120s
   * → 间隔 ≈ 18s。PvZ2 的官方精确值待查证（见 `src/data/pvz2/mechanics.ts` 挂账），此为可追溯推导而非凭记忆。
   */
  betweenWaves: { base: 18, range: 5 },
  /** 波内出怪间隔。 */
  spawnInterval: { teach: 2.0, normal: 1.6, flag: 1.5, survive: 1.6, boss: 1.6, chal: 1.6, conveyor: 1.6, default: 1.6 } as Record<string, number>,
  /**
   * 波次预算公式 base × (1 + w × growth) × scale × huge 的系数。
   * **与 `enemyPoints` 的尺度强耦合**：`points = round(hp/50) + trait bonus`；
   * 僵尸 HP 按 PvZ2 重锚（行蚁 45→190）后 points 约 ×4，若 base 仍为 6，
   * teach 关首波预算 3 < 行蚁 4 点 → **该波 0 只怪**（2026-10-14 审查 P1）。
   * 现值 10 由无头扫荡校准（`npm run sweep`）：6 关全胜、单关 2.9~3.7 分钟、平均推车 1.0~2.5。
   * 下限由 tests/pvz2Align.test.ts 的"首波非空"闸守护。
   */
  base: 10,
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

/**
 * 天空露珠。
 * - 掉落间隔沿用 PvZ1 反编译口径（4.25s + rand(0~2.75s)）；**PvZ2 的精确刷新值待查证**（见 pvz2/mechanics.ts 挂账）。
 * - **面值 = 50**：PvZ2 普通阳光为 50（PvZ1 为 25），天空掉落与向日葵单次产出同值。
 */
export const SKY_SUN = {
  firstS: 4.25,
  intervalMinS: 4.25,
  intervalMaxS: 7,
  value: 50,
  /** 落地停留 s（超 3s 时进入闪烁倒计时）。 */
  restS: 14,
};

/** 局内货币"露珠"的统一含义注释（卡面 cost 单位为露珠）。 */
export const SUN_NOTE = '局内货币=露珠（阳光）；局外成长货币见 src/data/economy.ts。';

/**
 * 牌组（种子槽）上限——单一事实源，sim.ts 与 ui/DeckPicker.ts 均引用此处。
 * PvZ2 口径：基础 8 个槽（第 8 个需进度解锁 / 真钱购买 / 650 金币租一关）；
 * 见 `src/data/pvz2/mechanics.ts` 的 `SEED_SLOTS.base`，一致性由 tests/pvz2Align.test.ts 守护。
 */
export const DECK_CAP = 8;

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

