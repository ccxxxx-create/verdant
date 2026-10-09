/** 图鉴·世界百科数据（GDD §14.4）。unit/enemy 计数来自注册表，测试里核对。 */
export interface CodexWorld {
  id: 'meadow' | 'reef' | 'sky' | 'frost';
  name: string;
  themeKey: 'meadow' | 'reef' | 'sky' | 'frost';
  tagline: string;
  terrainSummary: string;
  levelCount: number;
  bossId: string;
  rhythm: string;
}

export const codexWorlds: readonly CodexWorld[] = [
  {
    id: 'meadow',
    name: '晨雾草原',
    themeKey: 'meadow',
    tagline: '一切开始的地方，低饱和的草绿与贴地晨雾',
    terrainSummary: '标准 6×9 陆地格；高处草丛遮挡投掷系视线',
    levelCount: 32,
    bossId: 'stone_hide_giant',
    rhythm: '前 5 关教学 → 双怪混波 → 大旗波 2.5 倍量',
  },
  {
    id: 'reef',
    name: '珊瑚深海',
    themeKey: 'reef',
    tagline: '沉在暖流里的城市废墟，灯芯珊瑚是仅剩的光',
    terrainSummary: '每行「陆2-水3-陆2」；水格带电，暖流井推送光露',
    levelCount: 32,
    bossId: 'shipwreck_mother',
    rhythm: '陆行→水行混波→铁甲检验钝击配置',
  },
  {
    id: 'sky',
    name: '天空浮岛',
    themeKey: 'sky',
    tagline: '云上的破碎群岛，风是这里的规则',
    terrainSummary: '每行 1-2 断格；顺风增速逆风减速，每 60s 换向',
    levelCount: 32,
    bossId: 'kite_leader',
    rhythm: '地面→飞行波→撞壳牛冲撞检验肉盾',
  },
  {
    id: 'frost',
    name: '冰原霜境',
    themeKey: 'frost',
    tagline: '冰封的旧河湾，光是暖的，冰是滑的',
    terrainSummary: '右 3 列冰面（敌速×1.35、定身无效）；地热裂谷喷发光露',
    levelCount: 32,
    bossId: 'frost_boar_king',
    rhythm: '狼群速压→铁甲与冰镜眼→寒潮+冲锋混编',
  },
];
