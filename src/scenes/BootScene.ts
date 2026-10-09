import Phaser from 'phaser';

/**
 * 启动场景：装载程序化 SVG 资产（2× 光栅化，GDD §11.1）。
 * 相对路径解析：页面挂 base 子路径（/verdant/），dev 与 Pages 双端均解析成功。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const px = { width: 200, height: 200 };
    this.load.svg('world_meadow', 'assets/svg/world_meadow.svg', px);
    this.load.svg('world_reef', 'assets/svg/world_reef.svg', px);
    this.load.svg('world_sky', 'assets/svg/world_sky.svg', px);
    this.load.svg('world_frost', 'assets/svg/world_frost.svg', px);
    this.load.svg('icon_lightdew', 'assets/svg/icon_lightdew.svg', { width: 64, height: 64 });
    this.load.svg('band_fog', 'assets/svg/band_fog.svg', { width: 1920, height: 260 });
  }

  create(): void {
    this.scene.start('Preload');
  }
}
