/**
 * UI 设计 Token（GDD §10.2 的代码镜像，唯一事实源）。
 * 菜单/界面实现只允许引用本文件，不允许散落 hex。
 */

export const palette = {
  primary: '#5E8B7E', // 雾青：主按钮
  primaryDeep: '#3E6156', // 雾青深：按下态/标题描边
  accent: '#F2C14E', // 晨金：资源/高亮
  bgBase: '#F4F1EA', // 雾白：界面底
  bgDeep: '#23272B', // 墨：文字/深色面板
  moss: '#6FA86B', // 草绿：草原世界
  reef: '#3E7C8C', // 水青：深海世界
  sky: '#7FA8D8', // 云蓝：浮岛世界
  frost: '#A8D8E8', // 冰蓝：冰原世界
} as const;

export const worldPalette = {
  meadow: palette.moss,
  reef: palette.reef,
  sky: palette.sky,
  frost: palette.frost,
} as const;

export const typography = {
  display: '700 40px system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
  heading: '700 20px system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
  body: '400 16px system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
  caption: '400 12px system-ui, "PingFang SC", "Noto Sans SC", sans-serif',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 4, md: 8, lg: 16 } as const;

/** 动效时长（ms，GDD §10.2）：微反馈 120 / 转场 200-320。 */
export const motion = { feedback: 120, transition: 240, elastic: 400 } as const;

/** 平板触控热区下限（px，GDD §10.2）。 */
export const TOUCH_TARGET_MIN = 48;

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
