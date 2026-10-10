/** 图鉴·地形机制百科数据（GDD §14.4，规则正文在 §7）。 */
export interface CodexTerrainRule {
  id: 'conduct' | 'fire' | 'ice' | 'sky';
  name: string;
  element: string;
  summary: string;
  trigger: string;
  counter: string;
}

export const codexTerrainRules: readonly CodexTerrainRule[] = [
  {
    id: 'conduct',
    name: '导电连锁',
    element: '电',
    summary: '电属性命中水格即通电，向相邻水格最多传导 3 跳',
    trigger: '电属性攻击命中 Water 格 → Electrified 8 秒（每 0.5s 20 点真实伤害）',
    counter: '水生友军也会短暂停攻；铁甲燃烧减半；沉底敌人免疫',
  },
  {
    id: 'fire',
    name: '火与蔓延',
    element: '火',
    summary: '火弹点燃灼烧敌人；草格会蔓延，水格被蒸干，冰面被融化',
    trigger: '火属性命中 → 灼烧 4s（15 点/秒，火抗减半）；草格 60% 概率蔓延 1 次',
    counter: '火抗敌人伤害 ×0.7；寒潮期间蔓延概率减半',
  },
  {
    id: 'ice',
    name: '冰面滑行',
    element: '冰',
    summary: '冰面让敌人加速，也免疫定身；火可以烧融它',
    trigger: '陆行敌人冰面速度 ×1.35；冰面不可被缠绕定身',
    counter: '火系攻击融出 20 秒水格（水格可导电，化害为利）',
  },
  {
    id: 'sky',
    name: '断格与风向',
    element: '风',
    summary: '浮岛缺口阻断地面行径，风向改变全场节奏',
    trigger: '陆行敌人遇断格停 1.5s 绕行；每 60s 换向（顺风 ×1.2 / 逆风 ×0.8）',
    counter: '蔓生系单位可种断格；浮空菇让落单敌人浮空挨打',
  },
];

/** 克制速查表（GDD §7.5 镜像，图鉴展示用）。 */
export const codexCounters: readonly { attack: string; cloth: string; hide: string; shell: string; iron: string; air: string }[] = [
  { attack: '单发直射', cloth: '1.0', hide: '0.85', shell: '0.7', iron: '0.55', air: '可打飞行' },
  { attack: '多段散射', cloth: '1.0', hide: '0.85×段', shell: '0.7×段', iron: '0.55×段', air: '可打飞行' },
  { attack: '钝击', cloth: '1.0', hide: '1.0', shell: '1.5', iron: '1.5', air: '否' },
  { attack: '埋地爆炸', cloth: '1.0', hide: '1.0', shell: '1.0', iron: '1.0', air: '否' },
  { attack: '死亡爆炸', cloth: '1.0', hide: '1.0', shell: '1.0', iron: '1.0', air: '否' },
  { attack: '电击', cloth: '1.0', hide: '1.0', shell: '1.0', iron: '0.5', air: '通用' },
];
