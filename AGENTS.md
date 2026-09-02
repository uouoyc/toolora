# AGENTS.md

## 这个仓库是什么

Toolora:中文界面的独立在线工具平台。无账号、无服务端用户状态,数据源密钥由访客自带(BYOK)。当前两个工具——关键词排名查询(`/keyword-ranking`)与关键词聚类(`/keyword-clustering`)——均走访客自己的 SerpAPI Key。

## 核心模块

- `apps/web` — Next.js App Router(端口 3001)。路由、页面外壳、SEO 与全部浏览器 UI;工具的功能模块在 `src/features/<slug>/`,客户端算法(聚类)在 Web Worker 中运行。
- `apps/server` — Hono(端口 3000)。唯一工具业务 API;SerpAPI 适配层在 `src/integrations/serpapi/`,Provider 载荷不出适配层。
- `packages/api` — 浏览器安全的 Zod 契约(`src/contracts/`)与共享 oRPC procedure(`src/procedures/`),web/server 共用。
- `packages/ui` — 共享 shadcn/ui 原语与设计 token(`src/styles/globals.css`)。
- `packages/env` — t3-oss 环境变量校验(server `CORS_ORIGIN`,web `NEXT_PUBLIC_SERVER_URL`)。
- `packages/config` — 共享 tsconfig。

## 必须遵守的架构约束

1. 工具业务请求只走 Hono 上的 oRPC procedure;不把业务逻辑写进 Server Action 或 Next Route Handler。
2. 访客状态只在浏览器:Workspace 用 IndexedDB(idb-keyval),SerpAPI 设置用 localStorage;服务端保持无状态,不持久化任何访客数据或密钥。
3. 传输契约(`packages/api/src/contracts/`)必须浏览器安全、与数据源快照解耦:只校验传输形状,不校验国家/语言成员资格。
4. 聚类在浏览器 Web Worker 中做确定性的完全链接合并(上限 1000 关键词);同输入必须同结果。

## 开发与验证命令

```bash
pnpm dev            # web(:3001)+ server(:3000)
pnpm check          # biome lint/format;pnpm fix 自动修复
pnpm check-types    # 全仓库 tsc --noEmit
pnpm test           # vitest 单元测试
pnpm build          # 全量构建
```

修改代码后的验收基线:`pnpm check && pnpm check-types && pnpm test` 全绿。

## 修改规则

- UI 文案一律中文;用户可见术语使用 `docs/domain.md` 的词汇表,不要自造同义词。
- 新增工具的路径:静态 Manifest(`apps/web/src/lib/tools.ts`)→ 显式路由 `apps/web/src/app/<slug>/page.tsx` → feature 目录 `apps/web/src/features/<slug>/` → 仅当需要服务端工作时补 contracts/procedures/integration。先打通一条竖切片再扩展。详见 `docs/architecture.md` 的落位规则。
- 在约定 seam 上写测试:纯函数(normalization/clustering/CSV)、契约校验、Provider 适配层。
- 不要提交开发过程文件与本地 agent 目录(`.scratch/`、`.agents/` 等,用完即删);`apps/web/AGENTS.md` 由 `next dev` 自动生成,不要手工编辑。
