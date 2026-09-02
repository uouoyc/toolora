# Toolora

Toolora 是一个中文界面的独立在线工具平台：每个工具打开即用、无需注册，数据源密钥由访客自带(BYOK)。平台没有账号体系，服务器不保存任何用户数据。

当前提供两个 SEO 工具，均基于访客自己的 [SerpAPI](https://serpapi.com) Key：

| 工具           | 路由                  | 功能                                                                                             |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| 关键词排名查询 | `/keyword-ranking`    | 批量查询目标域名在一组关键词的 Google 自然结果中的最高排名，支持暂停/恢复、失败重试、CSV 导出    |
| 关键词聚类     | `/keyword-clustering` | 按 SERP 结果重叠度把适合共用一个页面的关键词聚成类，支持可选的目标域名分析，算法在浏览器本地运行 |

两个工具共享同一套 SerpAPI 设置(密钥池、国家/语言)，存储在访客浏览器中。

## 技术栈

- **Monorepo**：pnpm workspace + Turborepo 任务编排，Biome 负责 lint/format，vitest 负责单元测试
- **Web**：Next.js(App Router)+ React + Tailwind CSS + shadcn/ui
- **Server**：Hono + oRPC，是所有工具业务的唯一 API
- **共享包**：Zod 传输契约与 oRPC procedure(`packages/api`)、UI 原语(`packages/ui`)、环境变量校验(`packages/env`)、共享 tsconfig(`packages/config`)

## 目录结构

```text
toolora/
├── apps/
│   ├── web/                              # Next.js 前端(端口 3001)
│   │   └── src/
│   │       ├── app/                      # 路由与页面：首页、/keyword-ranking、/keyword-clustering
│   │       ├── components/               # 页面级共享组件(区块卡、表格头、分页、状态胶囊等)
│   │       ├── features/                 # 按工具划分的功能模块
│   │       │   ├── keyword-ranking/      # 排名查询工作区、Run 调度、结果表
│   │       │   ├── keyword-clustering/   # 聚类工作区、Web Worker 聚类算法、结果视图
│   │       │   └── serpapi-settings/     # 共享 SerpAPI 设置、国家/语言快照
│   │       ├── lib/                      # 纯逻辑：工具 Manifest、CSV 导出、共享 Run 调度、Workspace 存储
│   │       └── utils/orpc.ts             # oRPC 客户端
│   └── server/                           # Hono API 服务(端口 3000)
│       └── src/integrations/serpapi/     # SerpAPI 适配层(Provider 载荷不出此层)
├── packages/
│   ├── api/                              # Zod 契约(src/contracts/)+ 共享 oRPC procedure(src/procedures/)
│   ├── ui/                               # 共享 shadcn/ui 原语与全局样式 token
│   ├── env/                              # t3-oss 环境变量校验
│   └── config/                           # 共享 tsconfig
├── docker-compose.yml                    # web + server 容器编排
└── turbo.json / biome.json               # 任务编排与 lint 配置
```

## 本地开发

前置：Node.js 与 pnpm(仓库锁定 `pnpm@11.22.0`，可用 `corepack enable` 启用)。

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
pnpm dev
```

- Web:http://localhost:3001
- API:http://localhost:3000

SerpAPI Key 不需要配置在任何环境变量里：访客在页面右上角「设置」中填写自己的 Key，只保存在其浏览器 localStorage。

### 环境变量

| 变量                     | 应用   | 作用                                                                                           |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| `CORS_ORIGIN`            | server | 允许跨域访问 API 的来源，本地为 `http://localhost:3001`                                        |
| `NEXT_PUBLIC_SERVER_URL` | web    | Hono API 地址，本地为 `http://localhost:3000`                                                  |
| `NEXT_PUBLIC_SITE_URL`   | web    | 站点绝对地址，用于 canonical URL / sitemap / robots;不设置则按本地运行处理，部署时设为线上域名 |

## 常用命令

| 命令                                                              | 作用                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `pnpm dev`                                                        | 同时启动 web 与 server(`pnpm dev:web` / `pnpm dev:server` 可单独启动) |
| `pnpm build`                                                      | 构建全部应用                                                          |
| `pnpm check`                                                      | Biome lint + format 检查(`pnpm fix` 自动修复)                         |
| `pnpm check-types`                                                | 全仓库 TypeScript 类型检查                                            |
| `pnpm test`                                                       | 运行全部单元测试                                                      |
| `pnpm docker:build` / `docker:up` / `docker:down` / `docker:logs` | Docker Compose 构建 / 启动 / 停止 / 日志                              |

## 部署

### Docker Compose

部署前可选配置站点地址：复制环境变量文件并填入线上域名，只在本地访问则保持默认即可。

```bash
cp apps/web/.env.example apps/web/.env
```

```text
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

首次部署或代码有变更时，带 `--build` 重新构建并启动：

```bash
docker compose up -d --build
```

镜像已是最新时，直接启动：

```bash
docker compose up -d
```

然后访问 `http://ip:3001`。

## 数据与 Workspace

- 每个工具至多一个「工作区」，保存在访客浏览器的 IndexedDB，刷新页面自动恢复;关闭页面会停止进行中的查询。
- SerpAPI 设置支持多个 Key(轮询或顺序使用)，开始查询前自动做健康检查，Key 级错误会自动换 Key 重试。
- 服务器不持久化任何访客数据;Key 仅作为单次请求参数经过服务端转发给 SerpAPI。
- 清除浏览器存储会丢失工作区与密钥设置——平台侧没有备份，这是刻意设计。

## 架构原则

详细决策与代码落位规则见 [docs/architecture.md](docs/architecture.md)：

1. Next.js 只负责路由、SEO 与浏览器 UI;所有工具业务请求走 Hono 上的 oRPC procedure。
2. 访客状态全部在浏览器(工作区在 IndexedDB、设置在 localStorage)，服务端无状态。
3. 客户端算法(如聚类)在 Web Worker 中确定性运行，同一输入永远得到同一结果。

## 注意事项

- 排名查询与聚类单次最多处理 1000 个关键词;聚类证据固定为 Top 10 结果，合并精度 1–10(默认 4)。
- Docker 构建使用 BuildKit cache mounts，需要 Docker Engine 安装 buildx 插件;`NEXT_PUBLIC_*` 公共变量在镜像构建时固化，改变量需重新构建 web 镜像。

## 更多文档

- [架构决策与落位规则](docs/architecture.md)
- [领域词汇表](docs/domain.md) —— 代码与 UI 文案使用的统一术语
