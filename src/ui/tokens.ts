import tokensJson from './tokens.json';

/**
 * UI 设计 Token（GDD §10.2 的代码镜像，唯一事实源）。
 * 调色板与 gen-assets.mjs 共享同一份 tokens.json（防资产/UI 色差）。
 * Menu/界面实现只允许引用本文件，不允许散落 hex。
 *
 * 注意：Phaser 的 TextStyle 必须吃分离字段（fontFamily/fontSize/fontStyle），
 * 不能把 "700 40px ..." 简写塞进 fontFamily——Phaser 会与默认 fontSize 拼出
 * 非法 CSS font 串，导致 canvas 回退 10px sans-serif（M0 审查 P0，勿回退）。
 */

export const palette = tokensJson.palette;
export const worldPalette = tokensJson.worldPalette;

const FONT_STACK = 'system-ui, "PingFang SC", "Noto Sans SC", sans-serif';

export const typography = {
  display: { fontFamily: FONT_STACK, fontSize: '40px', fontStyle: 'bold' },
  heading: { fontFamily: FONT_STACK, fontSize: '20px', fontStyle: 'bold' },
  body: { fontFamily: FONT_STACK, fontSize: '16px', fontStyle: '' },
  caption: { fontFamily: FONT_STACK, fontSize: '12px', fontStyle: '' },
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
