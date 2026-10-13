import { enemyPoints, type EnemyInput } from '../../../core/schema/unit.ts';
import { BOSS_BITE_DPS, ENEMY_BITE_DPS } from '../../../core/balance.ts';

/**
 * 晨雾草原首发敌人 10 + Boss（GDD §6.2 + §14.3 flavor）。
 *
 * PvZ2 对齐（2026-10-14，见 src/data/pvz2/）：
 * - **啃食 dps 统一 = ENEMY_BITE_DPS（100）**：PvZ2 的设计是所有僵尸啃食速度一致，
 *   威胁差异靠血量 / 护甲 / 特性，而不是各自写不同的啃食速度。
 * - **血量按 PvZ2 强度分档重锚**（Fragile ~100 / Average 190 / Solid ~270 /
 *   Protected ~350~560 / Hardened ~1290 / Great 3600），见 `src/data/pvz2/mechanics.ts` 的 TOUGHNESS_TIERS。
 * - `points` 仍由 `enemyPoints(hp, traits)` 派生，随血量自动更新（防漂移）。
 */
export const meadowEnemies: readonly EnemyInput[] = [
  {
    id: 'march_ant',
    world: 'meadow',
    name: '行蚁',
    flavor: '最基础的先锋，数量就是它的威胁',
    hp: 190, // PvZ2 普通僵尸（Average 档，国际版现行 190）
    speed: 0.21, // 4.76 s/格 ≈ PvZ2 Basic(5.0 s/格)
    biteDps: ENEMY_BITE_DPS,
    armor: 'cloth',
    traits: [],
    points: enemyPoints(190, []),
  },
  {
    id: 'iron_beak_sparrow',
    world: 'meadow',
    name: '铁喙雀',
    flavor: '掠过植株直扑篱门，火力覆盖够密才能拦下它',
    hp: 270, // PvZ2 Solid 档（≈ 海鸥僵尸 270）
    speed: 0.3,
    biteDps: ENEMY_BITE_DPS,
    armor: 'cloth',
    traits: ['flying'],
    flying: true,
    points: enemyPoints(270, ['flying']),
  },
  {
    id: 'gnaw_back_rat',
    world: 'meadow',
    name: '啮背鼠',
    flavor: '路过生产位会停下来啃一口再走',
    hp: 190, // Average
    speed: 0.23,
    biteDps: ENEMY_BITE_DPS,
    armor: 'hide',
    traits: ['gnaw_pause'],
    points: enemyPoints(190, []),
  },
  {
    id: 'grey_tide_swarm',
    world: 'meadow',
    name: '灰潮群',
    flavor: '一波四五只结伴而来，用爆炸款待它们',
    hp: 100, // PvZ2 Fragile 档（群怪单体便宜：≈ 小鸡僵尸/小鬼）
    speed: 0.26,
    biteDps: ENEMY_BITE_DPS,
    armor: 'cloth',
    traits: ['swarm'],
    points: enemyPoints(100, ['swarm']),
  },
  {
    id: 'vine_boa',
    world: 'meadow',
    name: '藤蟒',
    flavor: '无视减速缓慢推进，硬控拦不住它',
    hp: 560, // PvZ2 Protected 档（≈ 路障僵尸 560）
    speed: 0.14,
    biteDps: ENEMY_BITE_DPS,
    armor: 'cloth',
    traits: ['slow_immune'],
    points: enemyPoints(560, ['slow_immune']),
  },
  {
    id: 'web_spider',
    world: 'meadow',
    name: '织网蛛',
    flavor: '吐网定住最近的防守单位，先手很烦',
    hp: 350, // Protected 档下沿
    speed: 0.18,
    biteDps: ENEMY_BITE_DPS,
    armor: 'cloth',
    traits: ['web_stun'],
    points: enemyPoints(350, []),
  },
  {
    id: 'shell_raiser',
    world: 'meadow',
    name: '举壳兵',
    flavor: '壳挡正面弹道，绕后或抛投才能破',
    hp: 560, // Protected（≈ 路障 370 + 本体 190）
    speed: 0.18,
    biteDps: ENEMY_BITE_DPS,
    armor: 'shell',
    traits: ['shell_block_front'],
    points: enemyPoints(560, []),
  },
  {
    id: 'vine_gnawer',
    world: 'meadow',
    name: '啃藤兽',
    flavor: '专挑攻击单位啃，不清完不停口',
    hp: 490, // Protected 档下沿
    speed: 0.23,
    biteDps: ENEMY_BITE_DPS,
    armor: 'hide',
    traits: ['targets_attackers'],
    points: enemyPoints(490, []),
  },
  {
    id: 'lightdew_moth',
    world: 'meadow',
    name: '吮光蛾',
    flavor: '飞过掉落物时一口吞掉，手慢无',
    hp: 270, // Solid
    speed: 0.26,
    biteDps: ENEMY_BITE_DPS,
    armor: 'cloth',
    traits: ['eats_drops'],
    points: enemyPoints(270, []),
  },
  {
    id: 'stone_hide_beast',
    world: 'meadow',
    name: '石皮兽',
    flavor: '铁甲慢步还带火抗，钝击系的活靶子',
    hp: 1290, // PvZ2 Hardened 档（≈ 铁桶 1100 + 本体 190）
    speed: 0.11,
    biteDps: ENEMY_BITE_DPS,
    armor: 'iron',
    traits: ['fire_resist'],
    points: enemyPoints(1290, []),
  },
  {
    id: 'stone_hide_giant',
    world: 'meadow',
    name: '石皮巨兽',
    flavor: '草原之主：高甲低速，召唤蚁群补线',
    hp: 3600, // PvZ2 Great 档（Gargantuar 3600）；真 Zombot（18500+）留后续世界
    speed: 0.09,
    biteDps: BOSS_BITE_DPS, // 原创加压：PvZ2 Zombot 不啃食
    armor: 'shell',
    traits: ['summon', 'fire_resist'],
    isBoss: true,
    points: 0,
  },
];
