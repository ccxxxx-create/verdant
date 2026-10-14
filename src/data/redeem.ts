/**
 * 兑换码表（M-INV 兑换码系统）。
 *
 * 口径（用户拍板）：**可重复兑换**（同一码可无限次使用），当前为调试用途。
 * 因此不记录"已兑换码集合"（会无界增长），仅在存档 `stats.redeemCount` 累计次数，
 * 为日后切换为"一次性兑换"预留接口。
 *
 * 纪律：奖励一律走既有钱包字段 + inventory，禁止在场景里写散落数值。
 */

export interface RedeemReward {
  coins?: number;
  diamonds?: number;
  seeds?: number;
  plantFood?: number;
  /** 道具发放：itemId → 数量。 */
  items?: Record<string, number>;
  /** 兑换成功后的说明文案（展示在飘字/结果区）。 */
  label: string;
}

/** 兑换码表（键为规范化后的码：trim + 大写）。 */
export const REDEEM_CODES: Readonly<Record<string, RedeemReward>> = {
  '6666': {
    coins: 50000,
    diamonds: 3000,
    seeds: 50,
    plantFood: 30,
    items: { lightdew_jar: 5, energy_core: 3, thorn_ward: 3, lucky_clover: 1 },
    label: '开发者福利码',
  },
};

/** 规范化输入（去空白 + 大写），保证 6666 / " 6666 " / 6666 等价。 */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

/** 查码：命中返回 { code, reward }，否则 null。 */
export function findRedeemCode(input: string): { code: string; reward: RedeemReward } | null {
  const code = normalizeCode(input);
  if (code.length === 0) return null;
  const reward = REDEEM_CODES[code];
  return reward ? { code, reward } : null;
}
