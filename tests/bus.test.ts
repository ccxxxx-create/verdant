import { describe, expect, it } from 'vitest';
import { bus, Events } from '../src/core/bus';

describe('TypedEventBus', () => {
  it('on/emit delivers payload', () => {
    let seen: unknown = null;
    const fn = (v: unknown) => {
      seen = v;
    };
    bus.on('t:ping', fn as never);
    bus.emit('t:ping', { ok: 1 });
    bus.off('t:ping', fn as never);
    expect(seen).toEqual({ ok: 1 });
  });

  it('off stops delivery', () => {
    let count = 0;
    const fn = () => {
      count++;
    };
    bus.on('t:count', fn as never);
    bus.emit('t:count');
    bus.off('t:count', fn as never);
    bus.emit('t:count');
    expect(count).toBe(1);
  });

  it('once fires exactly one time', () => {
    let count = 0;
    bus.once('t:once', (() => {
      count++;
    }) as never);
    bus.emit('t:once');
    bus.emit('t:once');
    expect(count).toBe(1);
  });

  it('Events constants are unique', () => {
    const values = Object.values(Events);
    expect(new Set(values).size).toBe(values.length);
  });
});
