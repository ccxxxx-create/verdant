# Verdant（游戏名待定）

自研 2D 车道式塔防——指挥各个世界原生的生灵，守住身后正在熄灭的家园。
**当前阶段：M1B 已交付**（全像素美术体系 + 可玩的草原第一关 + 图鉴）。

- 🎮 在线试玩（GitHub Pages）：<https://ccxxxx-create.github.io/verdant/>
- 📦 仓库：<https://github.com/ccxxxx-create/verdant>（Public，MIT）

## 本地运行

```bash
npm install --registry=https://registry.npmmirror.com
npm run dev       # 开发服务器 → http://localhost:5173/verdant/
npm test          # 38 个测试：像素数据完整性/zod schema/存档迁移/注册表闸/关卡 RNG/事件总线
npm run build     # 类型检查 + 构建（输出 dist/）
```

## 美术体系（全像素，纯代码）

- 全部资产是数据：`src/data/pixels/`（13 单位 32×32 + 11 敌人 24×24 + 4 子弹 8×8 + 17 图标 16×16 + 代码生成的战斗背景 320×180）
- 运行时烘焙为 Phaser 纹理；调色板单一事实源；新增内容=加矩阵行
- 归一化工具：`node scripts/normalize-pixels.mjs`

## 文档

| 文件 | 内容 |
|---|---|
| `docs/GDD.md` | 游戏设计 15 章：核心循环/四世界/51 单位/44 敌人/地形连锁/波次公式/UI token/像素规范 |
| `docs/DEV-PLAN.md` | 架构 + M0-M6 里程碑路线 |
| `docs/PLAN.md` / `docs/PLAN-M1B.md` | 规划任务与 M1B 执行计划（含留痕裁决表与进度区） |
| `docs/BACKLOG.md` | 首发后候选机制与世界 |

## 里程碑

M0 脚手架 ✅ → M1B 像素体系+首关可玩+图鉴 ✅ → M1 草原前 5 关（进行中）→ M2 对局闭环 UI → M3 草原量产 → M4 深海+编辑器 → M5 浮岛+冰原 → M6 打磨发布。

## 声明

玩法结构（车道格子/资源经济/波次）为塔防品类公共范式；命名、角色、美术、文案全部原创（见 GDD §3.4 避嫌声明）。
