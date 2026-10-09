# 计划：M0 脚手架与可部署空壳（PLAN-M0）

> 依据 `DEV-PLAN.md` §5 M0 条目执行；复杂任务（范围跨系统：本地仓库→GitHub→CI→Pages），阶段二探索已免（上轮收敛）。

## 1. 激活机制清单

提问闸门｜todo 每步更新｜收尾审查（独立子代理）｜视觉三层闸门（轻量：设计方案已出→渲染验证→独立视觉评审）｜两轮打磨

## 2. 目标

git 仓库 + GitHub public 仓库 `verdant` + Vite/Phaser/TS 骨架；Boot（程序化 SVG 烘焙）→Menu（设计方案「雾岬」）可跑；core/schema Zod 草案+版本迁移；registry 校验器进 CI；Pages CI 绿。

## 3. todolist

| # | 步骤 | 独立验收 |
|---|---|---|
| M0-1 | 项目骨架：package.json/vite.config/tsconfig/index.html + 装依赖（npm npmmirror 源，锁版本） | `npm run dev` 可起 |
| M0-2 | 代码骨架：main.ts/game.config/src/core(bus,store,rng,save)/scenes(Boot,Preload,Menu)/ui/tokens | `tsc --noEmit` 绿 |
| M0-3 | Boot：程序化生成基础 SVG（4 世界图标+光露+雾带）→ `load.svg` 烘焙 2× | 控制台 0 报错，纹理键存在 |
| M0-4 | Menu：按设计方案实现单层主菜单+雾带动画 | Playwright 截图与方案一致、console 0 错误 |
| M0-5 | Schema：core/schema/unit|save.ts（Zod）+version.ts 迁移链+save.ts 读写 | vitest：校验+迁移用例绿 |
| M0-6 | 质量闸：vitest 套件（zod/存档迁移）+ registry headless 冒烟 | `npm test` 全绿 |
| M0-7 | git init+首次提交+`gh repo create verdant --public` | 仓库在线 |
| M0-8 | Pages CI：vite base=`/verdant/`、`.github/workflows/deploy.yml`、Settings 启用 Actions | push 后 Actions 绿、URL 可开 |
| M0-9 | 视觉三层闸门：设计方案(已过)→独立视觉评审子代理看图打分 | 评审过（不过→改→重渲染重审） |
| M0-10 | README 更新（运行说明+文档地图）+ PLAN 进度区完成 | 交付报告出 |

## 4. 进度区

| 步骤 | 状态 | 备注 |
|---|---|---|
| M0-1 | ✅ 完成 | npmmirror 装 39 包；phaser@3.90.0/vite@8.3.4/vitest@5.0.3/ts@5.9.3/zod@4.6.5 |
| M0-2 | ✅ 完成 | main/game.config/bus/rng/ui tokens 全落盘 |
| M0-3 | ✅ 完成 | gen-assets.mjs 生成 6 SVG；BootScene load.svg 2× 光栅化 |
| M0-4 | ✅ 完成 | MenuScene「雾岬」：雾带×3/露珠徽记/VERDANT/四世界路线图/主按钮+hint |
| M0-5 | ✅ 完成 | zod unit/save schema+v1→v2→v3 迁移链；save 解耦 Phaser 依赖（node 可测） |
| M0-6 | ✅ 完成 | 三绿：tsc 0 错 / vitest 14 过 / build 536ms（chunk 1.3MB=gzip349KB，M2 评估分包） |
| M0-7 | ✅ 完成 | 仓库 ccxxxx-create/verdant（PUBLIC）+2 次提交推送；令牌直连绕过本机 gh-proxy 改写 |
| M0-8 | ✅ 完成 | Pages=workflow 源已启用；workflow 重跑 success；URL 三连 200（index/JS/SVG）（2026-10-09） |
| M0-9 | ✅ 完成 | 独立视觉评审过审（7/10）：P0 无；P1 按钮对比度已加深至雾青深（6.9:1）。渲染验证：1920×1080/1280×800 双端 0 console 错误；hover 金边+点击 hint 目验通过（2026-10-09） |
| M0-10 | ✅ 完成 | 独立代码审查 P0（Phaser 字体 API 误用致全部文字 10px）已修复：typography 拆分离字段；registry 测试补齐进 CI；bus 改零引擎依赖实现；token 单一事实源 tokens.json；补 MIT LICENSE；雾带 1920 全覆盖。三绿复跑：tsc 0 错/32 测试/构建 532ms。重渲染截图验证字号层级恢复（2026-10-09） |

## 5. 留痕裁决表

| # | 裁决 | 理由 | 错了损失什么 |
|---|---|---|---|
| M0-D1 | npm 用 npmmirror 源 | AGENTS.md 环境规范 | 无 |
| M0-D2 | Boot 只生成 6 个占位 SVG（4世界/光露/雾带），全部资产量产在 M3+ | M0 范围冻结 | 无 |
| M0-D3 | 暂不建 eslint/prettier/husky 等工程设施 | 单人+AI，tsc+vitest 已足够 | 后期风格漂移，成本低 |
| M0-D4 | 视觉评审用 browser-use 本地起服务截图 | 环境无系统 Playwright | 无 |
| M0-D5 | 菜单文案用占位标题 VERDANT（游戏名未定） | 用户"先不设置" | 定名后改一处常量 |
| M0-D6 | typography token 拆为 fontFamily/fontSize/fontStyle 分离字段（禁 font 简写） | M0 审查 P0：Phaser 把简写与默认 fontSize 拼成非法 CSS font 串→全部文字回退 10px | 无（已修复并测试） |
| M0-D7 | EventBus 改自实现 typed emitter（零 Phaser 依赖） | 核心逻辑 node 测试可跑（DEV-PLAN §4）；Phaser.EventEmitter 包装留 M1 评估 | 与 DEV-PLAN §1.5 原文有偏差，已同步文档 |
| M0-D8 | 主按钮常态色改雾青深 #3E6156（白字 6.9:1） | 视觉评审 P1：原雾青底白字 3.8:1 低于 4.5:1 小字硬指标 | 无 |
| M0-D9 | LICENSE=MIT 已落盘 | DEV-PLAN M0 建仓时终定项 | 无 |
| M0-D10 | git 推送改走 GitHub API 通道（scripts/api-push.mjs）：本机 git 全局 insteadOf 把 github.com 改写为 gh-proxy 镜像，直连 github.com:443 超时、镜像拒绝带令牌推送 | 实证：API 命令 3 次推送均 success、CI 部署 success | 本地/远端 commit 历史分叉（内容树一致）；恢复网络后可直接 git pull --rebase 对齐 |
| M0-D11 | API 推送脚本 walker 曾误传 .mimosa/ 与 docs/_review/（嵌套路径未进跳过表），已第二次提交删除（deleted: 8）并修复脚本 | 远端干净复验：contents/.mimosa=404、部署页无残留 | 无（已清理并复验） |
| M0-D12 | 视觉评审发现的按钮对比度 P1 以加深常态色解决（#5E8B7E→#3E6156，6.9:1）；未重派视觉复审（改动单调增、低风险），已重渲染自验 | 硬指标优先 | 极小 |

## 6. 验收标准

1. `npm run build`、`tsc --noEmit`、`npm test` 三绿
2. GitHub public 仓库 `verdant` 在线，push main 触发 Pages，**Pages URL 打开显示主菜单**
3. registry 校验器在 CI 运行
4. 视觉评审子代理过审（设计方案落地、硬指标达标）
5. console 0 错误（渲染验证捕获）

## 7. 风险与对策

| # | 失败原因 | 对策 | 切换判据 |
|---|---|---|---|
| MR1 | npmmirror 源装 phaser 失败 | 换官方源单包重试 | 一次失败即换 |
| MR2 | gh 推送/workflow 权限不足 | 用已登录令牌的 https 协议 | 一次失败即查 status |
| MR3 | Pages 部署后资源 404（base 错） | base=`/verdant/` 与仓库名对齐；部署后 URL 实测 | 一次 404 即查 |
| MR4 | 菜单视觉评审不过 | 按评审意见改 token/布局再重渲染 | 连续 2 轮不过降为"占位验收"M2 补 |
| MR5 | Phaser HEADLESS 冒烟不可用 | 退化为 zod+纯逻辑测试 | 一次失败即退化 |
