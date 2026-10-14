import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
import { CodexScene } from './scenes/CodexScene';
import { BattleScene } from './scenes/BattleScene';
import { ShopScene } from './scenes/ShopScene';
import { DrawScene } from './scenes/DrawScene';
import { InventoryScene } from './scenes/InventoryScene';

// 设计基准分辨率 1920×1080（GDD §10.4）：FIT + AUTO_CENTER。
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#A5DFF7', // 晨天蓝（明亮草原基调，M1C 提亮）。与 PALETTE.S / drawPixelBackdrop 天空首带同色，
  // 保证 Scale.FIT 在平板视口（1280×800）下画布顶边与信箱条无色差接缝。
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // 像素风硬边三件套：pixelArt=nearest 放大、roundPixels=坐标吸附整数像素（修位移呼吸的糊边）、
  // antialias:false=关闭图形抗锯齿（保证 lineStyle 落在整数像素上，不放宽到 1.5px 的模糊描边）
  render: { pixelArt: true, roundPixels: true, antialias: false },
  scene: [BootScene, PreloadScene, MenuScene, MapScene, CodexScene, BattleScene, ShopScene, DrawScene, InventoryScene],
};
