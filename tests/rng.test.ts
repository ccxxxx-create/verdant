import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('Rng determinism (DEV-PLAN 回放基础)', () => {
  it('same seed yields identical sequences', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() stays in [0,1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() respects bounds', () => {
    const r = new Rng(9);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(7);
    }
  });

  it('pick() returns members of the list', () => {
    const r = new Rng(11);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(r.pick(items));
    }
  });

  it('pick() on empty list throws', () => {
    expect(() => new Rng(0).pick([])).toThrow();
  });
});
