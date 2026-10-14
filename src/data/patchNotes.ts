import { GAME_VERSION } from '../core/version.ts';

/**
 * 更新公告（用户拍板 2026-10-15：仅升级玩家弹一次、无历史回看入口、日期版本制）。
 * 发版纪律：每次更新（推 main）必须 ① 新增条目置顶 ② 同步 src/core/version.ts 的 GAME_VERSION=当天日期；
 * 漏改会导致玩家看不到公告（版本没变不弹）。
 */
export interface PatchNote {
  /** 版本号（日期制），须等于当轮 GAME_VERSION。 */
  version: string;
  /** 发布日期（YYYY-MM-DD）。 */
  date: string;
  /** 公告条目（面向玩家的变化摘要，每条一句）。 */
  lines: readonly string[];
}

/** 降序排列，最新在前；CURRENT_NOTE 恒取首条。 */
export const PATCH_NOTES: readonly PatchNote[] = [
  {
    version: '2026.10.15',
    date: '2026-10-15',
    lines: [
      '背包系统上线：道具可持有、查看，出战携带 1 个开局生效',
      '道具接入抽奖奖池与商店（金币 / 钻石双渠道）',
      '兑换码上线：设置内输入 6666 领取资源（可重复）',
      '抽卡揭示动画按 普通 / 稀有 / 传说 三档品质呈现',
      '设置入口移至右上角齿轮',
    ],
  },
];

/** 当前应展示的公告（= 最新版本）；空数组在启动期显式炸出而非 undefined 流出。 */
const FIRST_NOTE = PATCH_NOTES[0];
if (!FIRST_NOTE) throw new Error('patchNotes: PATCH_NOTES must not be empty');
export const CURRENT_NOTE: PatchNote = FIRST_NOTE;
