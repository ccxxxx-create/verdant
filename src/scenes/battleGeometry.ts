/**
 * 战斗几何唯一事实源已内迁内核 `core/battle/layout.ts`（M3A：内核与场景同源，防漂移）。
 * 本文件保留为场景侧 re-export：BattleScene 与 tests/battleGeometry.test.ts 经此引用。
 * 布局纪律：任何 UI 矩形不得与 LAWN_RECT 重叠（用户第 12 轮反馈#5：槽位遮挡草坪）。
 */

export * from '../core/battle/layout.ts';
