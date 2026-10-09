/** 确定性随机（mulberry32）：播种可复现，供波次导演与模拟测试共用。 */
export class Rng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) 整数。 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty list');
    const item = items[this.int(0, items.length)];
    if (item === undefined) throw new Error('Rng.pick: unreachable');
    return item;
  }
}
