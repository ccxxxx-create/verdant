import Phaser from 'phaser';
import { allUnits, allEnemies } from '../data/archetypes';
import { validateRegistry } from '../core/registry';
import { readSave } from '../core/save';
import { applySettings } from '../ui/settings.ts';
import { bus, Events } from '../core/bus';

/** 预载场景：注册表校验（纯逻辑冒烟）+ 存档读取迁移，然后进主菜单。 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    const issues = validateRegistry(allUnits, allEnemies);
    if (issues.length > 0) {
      console.error('[registry] issues:', issues);
      bus.emit(Events.registryInvalid, issues);
    } else {
      console.info(`[registry] ok: ${allUnits.length} units / ${allEnemies.length} enemies`);
    }

    const save = readSave(window.localStorage, (err) => bus.emit(Events.saveWriteFailed, err));
    applySettings(save); // 载档即应用"减弱动态"（settings.motion）
    this.registry.set('save', save);
    bus.emit(Events.saveLoaded, save);

    this.scene.start('Menu');
  }
}
