# Verdant（游戏名待定）

自研 2D 车道式塔防——指挥各个世界原生的生灵，守住身后正在熄灭的家园。
**当前阶段：M0 脚手架完成**（可部署空壳+主菜单+数据骨架）。

- 🎮 在线试玩（GitHub Pages）：<https://ccxxxx-create.github.io/verdant/>
- 📦 仓库：<https://github.com/ccxxxx-create/verdant>（Public，MIT）

## 本地运行

```bash
npm install --registry=https://registry.npmmirror.com   # 依赖安装（npmmirror 源）
npm run assets    # 程序化生成 SVG 资产（6 个占位资产）
npm run dev       # 开发服务器 → http://localhost:5173/verdant/
npm test          # 32 个测试：zod schema / 存档迁移 / 注册表闸 / RNG / 事件总线
npm run build     # 类型检查 + 构建（输出 dist/）
```

## 技术栈

Phaser 3.90 + TypeScript 5.9 + Vite 8 + Zod 4 + Vitest 5；程序化 SVG 矢量美术（运行时 2× 光栅化）；WebAudio 合成音频（M6）；GitHub Actions → Pages 部署。

## 文档

| 文件 | 内容 |
|---|---|
| `docs/GDD.md` | 游戏设计（12 章）：核心循环/四世界/51 单位/44 敌人/地形连锁/波次公式/UI token |
| `docs/DEV-PLAN.md` | 架构规范 + M0-M6 里程碑路线 |
| `docs/PLAN.md` / `docs/PLAN-M0.md` | 规划任务与 M0 执行计划（含留痕裁决表与进度区） |
| `docs/BACKLOG.md` | 首发后候选机制与世界 |

## 里程碑

M0 脚手架 ✅ → M1 核心手感垂直切片（进行规划）→ M2 对局闭环+UI 系统 → M3 草原内容量产 → M4 深海+编辑器 → M5 浮岛+冰原 → M6 打磨发布。详见 `docs/DEV-PLAN.md` §5。

## 声明

玩法结构（车道格子/资源经济/波次）为塔防品类公共范式；命名、角色、美术、文案全部原创（见 GDD §3.4 避嫌声明）。
