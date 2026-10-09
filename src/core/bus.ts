/**
 * 全局事件总线（DEV-PLAN §1.5）：跨场景/跨系统解耦的唯一通道。
 * 自实现 typed emitter、零引擎依赖——核心逻辑在 node 测试环境可跑（DEV-PLAN §4）。
 * Phaser 的 EventEmitter 薄包装在 M1 评估是否保留。
 */

type Handler = (...args: never[]) => void;

class TypedEventBus {
  private readonly handlers = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): this {
    const set = this.handlers.get(event) ?? new Set<Handler>();
    set.add(fn);
    this.handlers.set(event, set);
    return this;
  }

  once(event: string, fn: Handler): this {
    const wrapper: Handler = (...args: never[]) => {
      this.off(event, wrapper);
      fn(...args);
    };
    return this.on(event, wrapper);
  }

  off(event: string, fn: Handler): this {
    this.handlers.get(event)?.delete(fn);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return false;
    for (const fn of [...set]) {
      (fn as (...a: unknown[]) => void)(...args);
    }
    return true;
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  removeAllListeners(): void {
    this.handlers.clear();
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
