import Phaser from 'phaser';

/**
 * 启动场景：全像素体系下无外部图片加载（资产全部代码烘焙），直接进 Preload。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const px = { width: 200, height: 200 };
  }

  create(): void {
    this.scene.start('Preload');
  }
}
