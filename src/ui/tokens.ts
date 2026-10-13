import tokensJson from './tokens.json';

/**
 * UI 设计 Token（GDD §10.2 的代码镜像，唯一事实源）。
 * 调色板与 gen-assets.mjs 共享同一份 tokens.json（防资产/UI 色差）。
 * 场景/组件实现只允许引用本文件，不允许散落 hex 与字号字面量。
 *
 * 注意：Phaser 的 TextStyle 必须吃分离字段（fontFamily/fontSize/fontStyle），
 * 不能把 "700 40px ..." 简写塞进 fontFamily——Phaser 会与默认 fontSize 拼出
 * 非法 CSS font 串，导致 canvas 回退 10px sans-serif（M0 审查 P0，勿回退）。
 */

export const palette = tokensJson.palette;
export const worldPalette = tokensJson.worldPalette;
/** 语义色角色（kit/cards/hud 引用；禁止场景内再散落等价 hex）。 */
export const semantic = tokensJson.semantic;

const FONT_STACK = 'system-ui, "PingFang SC", "Noto Sans SC", sans-serif';

/** 全仓唯一字体栈（场景与组件禁止再写字面量，统一引用本常量）。 */
export const FONT = FONT_STACK;

/**
 * 字阶（M-UI 统一）：display 48 / title 34 / heading 24 / subheading 20 / body 16 / caption 13。
 * 新增字号必须先登记本表，再由场景引用（消除散落 fontSize 字面量）。
 */
export const typography = {
  display: { fontFamily: FONT_STACK, fontSize: '48px', fontStyle: 'bold' },
  title: { fontFamily: FONT_STACK, fontSize: '34px', fontStyle: 'bold' },
  heading: { fontFamily: FONT_STACK, fontSize: '24px', fontStyle: 'bold' },
  subheading: { fontFamily: FONT_STACK, fontSize: '20px', fontStyle: 'bold' },
  body: { fontFamily: FONT_STACK, fontSize: '16px', fontStyle: '' },
  caption: { fontFamily: FONT_STACK, fontSize: '13px', fontStyle: '' },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 4, md: 8, lg: 16 } as const;

/** 层级（z-index）单一事实源：背景 → 氛围 → 面板 → 内容 → HUD → 弹层 → 对话框。 */
export const zIndex = { bg: 0, ambient: 1, panel: 2, content: 3, hud: 10, overlay: 30, dialog: 31 } as const;

/** 动效时长（ms，GDD §10.2）：按压 90 / 微反馈 120 / 转场 240 / 弹性 400 / 慢 600。 */
export const motion = { press: 90, feedback: 120, transition: 240, elastic: 400, slow: 600 } as const;

/** 平板触控热区下限（px，GDD §10.2）。 */
export const TOUCH_TARGET_MIN = 48;

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/**
 * 6 位 hex → Phaser Graphics 颜色整数。
 * 注意：Phaser 的 Graphics.fillStyle/lineStyle 必须用具名 alpha 参数，
 * 不能传 8 位 hex（Phaser 只解析 #RRGGBB，alpha 会丢失成不透明）。
 * withAlpha 只用于 Text/Canvas fillStyle（CSS 色，支持 8 位）。
 */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
