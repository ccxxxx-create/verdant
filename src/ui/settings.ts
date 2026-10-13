import type { SaveGame } from '../core/schema/save.ts';
import { writeSave } from '../core/save.ts';
import { setMotionEnabled } from './components/kit.ts';

/**
 * 设置读写薄封装：把存档 settings 映射到运行期表现开关。
 * 当前只承载"减弱动态"（可访问性）；后续音量/画质沿用同一入口。
 */

/** 载档时应用设置（PreloadScene 调用）。 */
export function applySettings(save: SaveGame): void {
  setMotionEnabled(save.settings.motion !== false);
}

/** 切换"减弱动态"并落盘（写失败静默，不阻塞交互）。 */
export function setMotionPreference(save: SaveGame, enabled: boolean): void {
  save.settings.motion = enabled;
  setMotionEnabled(enabled);
  try {
    writeSave(window.localStorage, save);
  } catch {
    /* 存储不可用：表现已即时生效，仅未持久化 */
  }
}
