/**
 * 巡野图节点表（W7-1）：草原 32 关的静态坐标与分段（唯一布局事实源）。
 * 节点可用性不在本表：MapScene 以 levels/index.ts 实际加载到的关卡 id 为准
 * （未量产 id = "量产中"占位锁），量产落盘自动点亮。
 * 三段小地名依 GDD §4.0：雾岬(10) → 草海(10) → 萤原(10) → 集运道(2 传送带)。
 */

export interface MapNode {
  /** 关卡 id（= LevelDef.id）。 */
  id: string;
  /** 节点显示号（如 1-1）。 */
  label: string;
  /** 巡野图画布坐标（1920×1080 设计分辨率）。 */
  x: number;
  y: number;
  /** 分段（段牌标题用）。 */
  seg: 1 | 2 | 3 | 4;
}

export interface MapSegment {
  seg: 1 | 2 | 3 | 4;
  name: string;
  /** 段牌中心 x。 */
  x: number;
}

const COL_X = [220, 430] as const;
const SEG2_X = [730, 940] as const;
const SEG3_X = [1240, 1450] as const;
const ROW_Y = [330, 445, 560, 675, 790] as const;

/** 双列之字：双列同向自上而下，相邻关左右交替（1-1 左上 → 1-2 右上 → 1-3 左二行…）。 */
function snakePairs(seg: 1 | 2 | 3 | 4, xs: readonly [number, number], count: number): MapNode[] {
  const nodes: MapNode[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % 2 === 0 ? 0 : 1;
    const row = Math.floor(i / 2);
    nodes.push({
      id: `meadow-${seg}-${i + 1}`,
      label: `${seg}-${i + 1}`,
      x: xs[col],
      y: ROW_Y[Math.min(row, ROW_Y.length - 1)] ?? 330,
      seg,
    });
  }
  return nodes;
}

export const MAP_NODES: MapNode[] = [
  ...snakePairs(1, COL_X, 10),
  ...snakePairs(2, SEG2_X, 10),
  ...snakePairs(3, SEG3_X, 10),
  { id: 'meadow-4-1', label: '4-1', x: 1690, y: 445, seg: 4 },
  { id: 'meadow-4-2', label: '4-2', x: 1690, y: 560, seg: 4 },
];

export const MAP_SEGMENTS: MapSegment[] = [
  { seg: 1, name: '雾岬', x: 325 },
  { seg: 2, name: '草海', x: 835 },
  { seg: 3, name: '萤原', x: 1345 },
  { seg: 4, name: '集运道', x: 1690 },
];

/** 节点渲染半径（pixelPanel 小方 84×84 的半宽）。 */
export const NODE_R = 42;
