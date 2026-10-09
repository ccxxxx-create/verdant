import Phaser from 'phaser';

type Handler = (...args: never[]) => void;

/**
 * 全局事件总线：跨场景/跨系统解耦的唯一通道（DEV-PLAN §1.5）。
 * 实体间禁止直接引用，交互一律走事件或 GridQuery 查询。
 */
class TypedEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();

  on(event: string, fn: Handler, context?: unknown): this {
    this.emitter.on(event, fn, context);
    return this;
  }

  once(event: string, fn: Handler, context?: unknown): this {
    this.emitter.once(event, fn, context);
    return this;
  }

  off(event: string, fn?: Handler, context?: unknown): this {
    this.emitter.off(event, fn, context);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    return this.emitter.emit(event, ...args);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

export const bus = new TypedEventBus();

/** 对局与系统事件名集中登记，防止字符串漂移。 */
export const Events = {
  saveLoaded: 'save:loaded',
  saveWriteFailed: 'save:write-failed',
  menuStartPressed: 'menu:start-pressed',
  registryInvalid: 'registry:invalid',
} as const;
