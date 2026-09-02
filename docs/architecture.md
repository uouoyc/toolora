# 架构

本文记录代码本身无法表达的长期架构决策与约束。词汇与业务语义见 [domain.md](./domain.md),开发命令见根目录 [README.md](../README.md)。

## 总体拓扑

```text
浏览器
  │  localStorage(SerpAPI 设置/密钥池)
  │  IndexedDB(各工具 Workspace)
  ▼
Next.js  apps/web  :3001        页面路由 / SEO / 浏览器 UI / 客户端算法
  │
  │ oRPC over HTTP(全部工具业务请求)
  ▼
Hono     apps/server :3000      唯一的工具业务 API,自身无状态
  │
  ▼
SerpAPI(外部 Provider,适配层在 apps/server/src/integrations/serpapi/)
```

- `apps/web`:Next.js App Router。拥有全部路由、页面外壳、SEO 内容和浏览器 UI;工具交互在客户端完成,聚类算法跑在 Web Worker。
- `apps/server`:Hono。承载所有工具业务的 oRPC procedure,不保存任何访客状态。
- `packages/api`:浏览器安全的 Zod 契约(`src/contracts/`)与共享 oRPC procedure(`src/procedures/`),web 与 server 共用。
- `packages/ui`:共享 shadcn/ui 原语与设计 token(`src/styles/globals.css`)。
- `packages/env`:t3-oss 环境变量校验(server 需要 `CORS_ORIGIN`,web 需要 `NEXT_PUBLIC_SERVER_URL`)。
- `packages/config`:共享 tsconfig。

## 核心决策

### 浏览器拥有的 Workspace 与 BYOK

没有账号、服务端数据库、历史记录或平台持有的 SerpAPI 配额。每个工具在访客浏览器里保留至多一个当前 Workspace,共享的 SerpAPI 密钥池也存在 `localStorage`;Hono 只接收单次请求所需的 Key,不落任何访客状态。

已知并接受的代价:关闭工具页面会停止进行中的查询;同源脚本可以读取浏览器中的 Key。换来匿名可用、零身份系统、平台不托管密钥、运维面大幅缩小。

### Hono 是唯一的工具 API

Next.js 只负责路由、布局、SEO 与浏览器 UI;每个工具的业务请求都经由 Hono 托管的类型化 oRPC procedure。工具逻辑不写在 Server Action 或 Next Route Handler 里。这样后端只有一条路径,且 Hono 可独立部署;代价是维护 web→Hono 传输与 CORS。

### 完全链接 SERP 聚类

关键词聚类使用每个关键词 Top 10 的归一化完整排名 URL、可配置的合并精度(默认 4)与确定性的完全链接凝聚合并:两个 Cluster 仅当所有跨 Cluster 关键词对都满足阈值时才合并。算法在浏览器 Web Worker 中运行,上限 1000 个关键词,重叠计数用紧凑的三角 Uint8Array 存储。相比 Centroid 分组、主题/NLP 聚类或服务端任务,优先更小更紧的页面级 Cluster 和可预测的本地重算。

## 落位规则

新增或修改功能时,代码落在哪一层:

| 关注点                                      | 位置                                                   |
| ------------------------------------------- | ------------------------------------------------------ |
| 路由、页面外壳、SEO、浏览器 UI              | `apps/web/src/app/`、`apps/web/src/components/`        |
| 工具的 Workspace、交互、客户端算法、结果 UI | `apps/web/src/features/<slug>/`                        |
| 浏览器持久化                                | IndexedDB(Workspace,经 idb-keyval)/ localStorage(设置) |
| 传输契约(Zod,浏览器安全)                    | `packages/api/src/contracts/`                          |
| 工具业务 procedure                          | `packages/api/src/procedures/`,由 `apps/server` 挂载   |
| 外部 Provider 适配(SerpAPI 载荷不出适配层)  | `apps/server/src/integrations/`                        |
| 共享 UI 原语                                | `packages/ui/src/components/`                          |

新增一个 Tool 的最小路径:在静态 Manifest(`apps/web/src/lib/tools.ts`)加一项 → 加显式路由 `apps/web/src/app/<slug>/page.tsx` → 建 feature 目录 `apps/web/src/features/<slug>/` → 仅当需要服务端工作时补 contracts / procedures / integration。先打通一条竖切片再扩展。

## 数据与存储

- 每个工具一条版本化 Workspace 记录,以工具 slug 为键存 IndexedDB;刷新页面后恢复,没有历史,开始新分析即整体替换。
- SerpAPI 设置(密钥池、选择策略)存 `localStorage`,Key 掩码保存;对 Key 的健康检查结果也缓存在浏览器。
- 国家(gl)/语言(hl)下拉来自 SerpAPI 官方列表的固化快照(`apps/web/src/features/serpapi-settings/data/*.json`),运行时不向 SerpAPI 拉取。
- 服务器无任何持久化;Key 仅作为单次请求参数经过服务端转发。
