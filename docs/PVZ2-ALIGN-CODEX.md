# PvZ2 数值对齐 · 溯源快照（CODEX 抽取）

> 抓取日：2026-10-15。来源：`F:/game-codex/` 两代图鉴数据集。
> **口径纪律：PvZ2 解包为唯一主锚；PvZ1 仅当 PvZ2 完全无该数据时补缺并标注；codex 两代皆无的项维持本仓自拟并挂账，不装对。**

## 来源分级

| 分级 | 文件 | 可信度 |
|---|---|---|
| PvZ1 反编译（双工程交叉一致：ResoddedFramework + Patoke） | `dataset-pvz1-plants.json` / `dataset-pvz1-zombies.json` | 高 |
| PvZ2 Gardendless 解包（Gzh0821/pvzg_site，国际版 13.x + 中国版合并口径） | `ds-pvz2-plants.json` / `ds-pvz2-zombies.json` | 中高（第三方镜藏，README 已声明合并口径） |
| PvZ2 中国版·硬数值未验证 | 上述文件中 `game` 含 `pvz2cn` 的条目 | 低（仅文案级） |

## 角色对齐表（14 单位）

| 本仓单位 | PvZ2 对应 | codex 数值（阳光/充能s/HP/伤害/间隔s） | 采用策略 |
|---|---|---|---|
| thorn_pea 豆射手 | peashooter 豌豆射手 | 100/5/300/20/1.35 | 间隔 1425→1350（对齐） |
| frost_pea 冰豆 | snowPea 寒冰射手 | 150/5/300/20/1.35（**codex 唯一条目为 pvz2cn 中国版代际；成本 150 与 wiki 国际版一致**） | 间隔 1430→1350；代际标注 |
| trifold_arrow 三叶箭 | threepeater 三线射手 | 300/5/300/20/1.35 | 间隔 1430→1350 |
| ember_fluff 火豆 | **firePeashooter 火焰豌豆**（mapping 原标 no-counterpart，过时） | 175/5/300/**40**/1.35 | 伤害 35→40、间隔 1600→1350 |
| lob_shroom 雾菇 | cabbagePult 卷心菜投手 | 100/5/300/**40**/间隔无（null） | 伤害 25→40；射速 PvZ2 缺→补缺 PvZ1「2.86~3s/发」取 2900ms（标 PvZ1） |
| drum_cap 炸弹菇 | potatoMine 土豆地雷 | 25/20/300/1800/armingTime **14s** | prepMs 12000→14000 |
| wood_core 木墩 | wallNut 坚果墙 | 50/20/4000 | 已全对齐，不动 |
| firefly_reed 灯心草 | sunflower 向日葵 | 50/5/300（产出间隔/面值 codex 无数字；PvZ1：25/次、23.5~25s、首产 3~12.5s） | 成本/充能已对齐；产出 50/24s 维持（试玩裁定）+挂账 |
| twin_glow 双灯草 | twinSunflower 双胞向日葵 | 125/10/300（产出无数字；PvZ1：2×25/23.5~25s） | 同上 |
| **dandelion 蒲公英** | **dandelion 蒲公英（精确同名）** | **275/15/300/50/1.9** | **全数值硬对齐**（伤 50/隔 1900/阳光 275/充能 15000） |
| storm_cap 闪电菇 | lightningReed 闪电芦苇（**非 AOE，机制不同**） | 125/5/300/10/多目标电弧 | AOE 定位保持；45 伤/2500ms 自拟登记「参照闪电芦苇强度」 |
| tether_moss 藤蔓 | tangleKelp 缠绕水草（水体秒杀 400）/ Stunion 眩晕洋葱（一次性） | 25/20/300 | 4s 定身/175 阳光自拟登记（两代均无「定身时长」数字） |
| nectar_moss 蜜草 | 无（两代均无攻速光环植物） | — | 20%/100 阳光自拟登记 |
| mist_lamp 雾灯 | plantern 路灯花（驱雾显形 75/10s，机制不同） | 75/10/300 | 反 cover 机制保持 25/15s 自拟登记 |

## 敌人对齐表（11 僵尸）

| 本仓敌人 | PvZ2 对应 | toughness/speed(格/s)/eatDPS | 采用策略 |
|---|---|---|---|
| march_ant 行蚁 | tutorial 普通僵尸 | 190/**0.185**（约5.41s/格）/100 | HP/DPS 已齐；speed 0.21→0.185 |
| iron_beak_sparrow 铁喙雀 | seagull 海鸥 | 270/**0.355**（2.82s/格）/100 | speed 0.30→0.355 |
| grey_tide_swarm 灰潮群 | chicken 僵尸鸡（类比） | 1/2.0/50 | HP/DPS 机制不同不改；speed 0.26→**0.6 折中**（codex 2.0 过速，注释声明） |
| vine_boa 藤蟒 | conehead 档 560（190+路障370） | 0.185/100 | speed 0.14→0.185（免减速特性两代均无，自拟保留） |
| web_spider 织网蛛 | 无对应（原创吐网定植物） | 350 档参照 | HP 350 保留；speed 自拟 0.18 |
| shell_raiser 举壳兵 | tutorial_armor1 路障 | 190+370/0.185/100 | 盾 250 自拟保留（PvZ2 层叠 vs 本仓减伤档，结构不同）；speed 0.18→0.185 |
| vine_gnawer 啃藤兽 | 无对应（专啃攻击单位） | 490 档 Protected | speed 0.23→0.185 档内 |
| lightdew_moth 吮光蛾 | 无对应（吞掉落物） | 270 档 | speed 0.26→0.22 自拟 |
| stone_hide_beast 石皮兽 | tutorial_armor2 铁桶（190+1100=1290） | 0.185/100 | speed 0.11→0.185（对齐铁桶档速） |
| stone_hide_giant 石皮巨兽 | gargantuar 巨尸 | 3600/**0.24**（4.17s/格）/100 | speed 0.09→0.24 |
| gnaw_back_rat 啮背鼠 | 无对应（路过啃生产位） | Average 190/0.185 | speed 0.23→0.185 |

## 节奏（用户点名四要素）

| 项 | 本仓 | codex | 策略 |
|---|---|---|---|
| 首波时间 | 2s | 2s（wiki 关卡页） | 已对齐，不动 |
| 波数/旗 | 5 波 | 5 波/1 旗 | 已对齐，不动 |
| 僵尸速度 | 见上表 | 0.185~0.355 | 对齐 |
| 波间隔 | 18+0~5s（反推） | **codex 无** | 维持+挂账；PvZ1 原值 25+0~6s 记录为「未启用候选」 |
| 每波僵尸数 | budget=round(10×(1+w×0.3)×scale) | **codex 无 points 体系** | 公式维持+挂账；sweep 复核难度 |

## 机制缺口（两代皆无，维持+挂账）

天空阳光刷新间隔/面值（PvZ1 反编译有 4.25s+cap 9.5s；本仓 4.25+7s 为 2026-10-12 试玩裁定版）、减速百分比/冰冻时长（PvZ1 寒冰减速 10s 候选）、火焰点燃持续、Plant Food 掉落概率/时长、护甲减伤系数、僵尸击杀得分。

## 已知取舍

- codex 无 Boss 真实 HP（Zombot 为占位 190）——本仓 3600 引用 wiki，保留。
- PvZ1 本体 HP 270 vs PvZ2 国际版现行 190（Update 6.3.1 下调）——本仓已取 PvZ2，符合主锚口径。
- PvZ2 中国版条目仅 snowPea 一条被引用，已在表内标注。
