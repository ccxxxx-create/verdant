/**
 * 游戏版本号（用户拍板 2026-10-15：日期版本制）。
 * 单一来源：发版时改为当天日期，且必须与 PATCH_NOTES 最新条目 version 一致
 * （tests/save.test.ts 有一致性断言兜底）。package.json 的 version 与此无关。
 */
export const GAME_VERSION = '2026.10.15';
