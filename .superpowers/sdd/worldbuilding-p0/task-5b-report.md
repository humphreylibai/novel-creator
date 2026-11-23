# Task 5b 报告：工作台改为独立本地服务

## 状态

**完成**。提交 `db2d29d`（`feat: 工作台改为独立本地服务（DSH 仅作启动器）`），分支 `feat/p0-worldbuilding`。
按边界**未安装 bundle、未做浏览器验证**，启动后地址由 DSH 日志给出，真机打开由控制器执行。

## 启动后应访问

默认：**http://127.0.0.1:8787**

- 端口来源：`config.port ?? 8787`（`cordis.patch.yml` 目前只配 `dataRoot`，所以默认 8787）。
- 若配置 `port: 0`，`server.address()` 拿到系统分配的随机端口，`RunningServer.url/port` 返回实际值；测试与冒烟都用这个机制。
- 启动日志格式：`[novel] 工作台已启动: http://127.0.0.1:<port>`（DSH 日志里搜 `[novel]`）。
- 启动失败（如端口占用）只打印 `[novel] 工作台启动失败（dataRoot=…）：…`，**不会抛穿插件层**；不会静默换端口。

## 改了哪些文件

### 新建

- **`src/host/server.ts`**（188 行）：`node:http` 手写服务，无 express。
  - `startServer({ dataRoot, port, publicDir })` → `{ url, port, close }`。
  - `/api/*` → `createHandlers(dataRoot)`（每次服务启动创建一次）：PUT/POST 异步分片拼 body 后 `JSON.parse`；非法 JSON → `400 { error: '请求体不是合法 JSON' }`；按 `{status, json}` 回写；`204` 无正文。
  - 静态：从 `publicDir` 读；`/` → `index.html`；任何找不到的文件都回落 `index.html`（前端路由）；content-type 按 `.html/.js/.css/.svg/.json`。
  - 路径安全：原始路径 `decodeURIComponent` 后按 `/` 与 `\` 分段，遇到 `..` 或 NUL 直接 404；之后还会校验 `resolve(publicDir, …)` 必须仍在 `publicDir` 内。
  - 监听 `127.0.0.1`；`EADDRINUSE` 转换为明确中文错误。
  - `close()`：`server.close()` + 等待回调，并 `closeIdleConnections()` / `closeAllConnections()` 防止 keep-alive 拖住端口；幂等。
- **`src/ui/main.tsx`**：`createRoot(document.getElementById('root')!).render(<App />)`。
- **`public/index.html`**：`<div id="root">` + `<script src="/app.js">`；含 `html,body,#root{height:100%;margin:0}` 与 system-ui 字体。
- **`tests/host/server.test.ts`**（6 用例）：随机端口 + `/api/worlds`、`GET /`、SPA 兜底、目录穿越、`close()` 后不可连、端口占用报错。
- **`public/app.js`**：esbuild 构建产物（见下）。

### 修改

- **`src/host/plugin.ts`**：完全移除 `webServer` / 路由注册 / `inject`；`apply` 改为 async，计算包根、`dataRoot`、`publicDir`（均为 `import.meta.url` 上两级），`startServer` 后打印 URL，`ctx.effect(() => () => srv.close())` 注册清理；启动失败 catch + `console.error` + return。
- **`scripts/build-client.mjs` → `scripts/build-ui.mjs`**：esbuild `format: 'iife'`、`bundle: true`、`platform: 'browser'`、`target: 'es2020'`、`jsx: 'automatic'`、`outfile: 'public/app.js'`，无 loader 包装，无 external。
- **`src/ui/api.ts`**：基址 `/novel` → `/api`。
- **`src/ui/App.tsx`**：去掉 `onClose` prop 与右上角「关闭」按钮；三阶段壳、NodeEditor、StagePlaceholder 结构未动。
- **`index.js`**：`export { apply }`，不再重导出 `inject`。
- **`package.json`**：
  - 删除 `exports["./client"]` 与整个 `dsh.client` 段；
  - `files` 移除 `client.js`、加入 `public`；
  - `build` 改为 `tsc -p tsconfig.build.json && node scripts/build-ui.mjs`；
  - `react`、`react-dom` 移到 `dependencies`；新增 `@types/react-dom` 到 `devDependencies`；
  - 描述改为“由 DSH 插件在本地提供服务的写作工作台”。
- **`locale/zh.json` / `locale/en.json`**：描述从“网页内浮层/probe”改为“随 DSH 启动本地服务，默认 8787”。
- **`package-lock.json`**：随 React/ReactDOM/类型包更新。

### 删除

- `client.js`（module-loader 产物）
- `src/ui/client.tsx`（浮层入口）
- `tests/host/plugin-route.test.ts`（旧的 DSH webServer 路由测试，架构已不存在）

### 改造的测试

- **`tests/host/plugin-route-prefix.test.ts`**：保留文件名，内容改为真实通过 `apply` 起服务，从启动日志解析 URL，再用真实 HTTP 验证 `/api/worlds`、POST 分片 body、非法 JSON、422 透传（4 用例）。
- **`tests/host/plugin.test.ts`**：改为断言不再导出 `inject`，以及端口占用时 `apply` resolve 且只 `console.error`（不抛穿）。

## RED → GREEN

**RED（实现前）**：

```
× plugin 启动工作台服务 > apply 启动后 /api/worlds 可访问… → 启动日志里没有 URL：
× POST /api/worlds 拼接异步分片请求体 → 启动日志里没有 URL：
× 非法的 JSON 请求体返回 400… → 启动日志里没有 URL：
× 422 校验结果原样透传 → 启动日志里没有 URL：
× host plugin > 不再依赖 webServer，也不导出 inject → expected true to be false
× host plugin > 启动失败只打印诊断… → You must provide a Promise to expect()…, not 'undefined'
server.test.ts → Failed to load url ../../src/host/server … Does the file exist?

Test Files  3 failed (3)
     Tests  6 failed (6)
```

失败原因：服务模块不存在、`apply` 仍同步且仍导出 `inject`——都是功能缺失，不是拼写错误。

**GREEN（实现后，同三个文件）**：

```
✓ tests/host/plugin.test.ts (2 tests)
✓ tests/host/plugin-route-prefix.test.ts (4 tests)
✓ tests/host/server.test.ts (6 tests)

Test Files  3 passed (3)
     Tests  12 passed (12)
```

## `npm run verify`（最终一次，fresh）

```
> tsc -p tsconfig.build.json && node scripts/build-ui.mjs
  public\app.js  270.7kb
Done in …

 ✓ tests/host/dataRoot.test.ts (2 tests)
 ✓ tests/host/ping.test.ts (1 test)
 ✓ tests/engine/worldConfig.test.ts (7 tests)
 ✓ tests/engine/frontmatter.test.ts (12 tests)
 ✓ tests/host/plugin.test.ts (2 tests)
 ✓ tests/host/store.test.ts (5 tests)
 ✓ tests/host/handlers.test.ts (9 tests)
 ✓ tests/host/plugin-route-prefix.test.ts (4 tests)
 ✓ tests/host/server.test.ts (6 tests)

 Test Files  9 passed (9)
      Tests  48 passed (48)
```

另外 `npx tsc -p tsconfig.json --noEmit`（覆盖 UI/tests）退出码 0。

## 产物

- **`public/app.js`：277188 字节**（esbuild 报告 270.7kb），IIFE、无 `__ModuleLoader__` 包装，已内联 React/ReactDOM，含 `/api` 基址。
- `lib/host/server.js`：5918 字节；`lib/host/plugin.js`：1129 字节，均已入库。
- `npm pack --dry-run --json`：17 个文件、解包 303672 字节；包含 `public/app.js`、`public/index.html`、`lib/host/server.js`，**不再包含 `client.js`**。
- 构建产物冒烟（`.superpowers/sdd/worldbuilding-p0/task-5b-smoke.mjs`，直接加载构建后的 `index.js`）：
  - apply 打印 `http://127.0.0.1:<随机端口>`
  - `GET /` 200（含 `id="root"`）、`GET /app.js` 200（`text/javascript`）
  - SPA 兜底 200、`GET /api/worlds` 200 `[]`、`POST /api/worlds` 201
  - cleanup 后端口已关闭

## 偏差与说明

1. **`react-dom` 也移入 `dependencies`**：brief 只点名 `react`，但 `main.tsx` 用 `react-dom/client`，构建期两者都必须存在；同时新增 `@types/react-dom`（否则全量 tsc 找不到类型）。
2. **更新了 locale 与 package description**：原文案写的是“DSH 网页内浮层/probe”，改成独立服务后已失真；只改文案，未动功能。
3. **删除了 `tests/host/plugin-route.test.ts`**：它测的是已删除的 `webServer.register` 架构。brief 允许删除/改造 prefix 测试；我保留了 `plugin-route-prefix.test.ts` 并改造，另外单独删掉这条旧路由测试。
4. **端口占用的额外测试**：brief 没列，但这是“不要静默换端口”的核心行为，补在 `server.test.ts` 与 `plugin.test.ts`。
5. **`src/host/ping.ts` 现在没有调用点**：边界要求不碰该文件，保留原样；`ping.test.ts` 仍绿。可在后续任务清理或改成 `/api/ping`。
6. **未安装 bundle、未打开浏览器**：`public/app.js` 的 React 渲染、字体/布局、独立页面在真实浏览器里的表现由控制器验收。

## 担心的地方

- **DSH/Cordis 是否 await async `apply` 与 disposer**：`apply` 现在是 `async`，`ctx.effect` 的 disposer 返回 `srv.close()` 的 Promise。若 Cordis 不等待 disposer，插件热重载时新旧服务可能短暂抢 8787；当前行为是启动失败打印诊断（不崩插件），但没有自动重试。建议控制器做一次“停用/重新启用 bundle”验证端口是否释放。
- **固定端口 8787**：若被其他进程占用，用户只会看到 DSH 日志里的错误，工作台不会启动；这符合“不静默换端口”，但需要控制器告知用户如何改 `port`（config）。
- **`close()` 强制断开所有连接**：插件卸载时若有正在保存的请求，会被中断；换取的是不残留端口。P0 可接受。
- **静态目录穿越防护**：做了路径段检查 + `publicDir` 包含性校验，但没有处理 public 内指向外部的符号链接；public 只放构建产物，风险低。
- **无鉴权**：服务只绑 `127.0.0.1`，但本机任意进程都能通过 `/api` 读写作品数据。这是 Task 0 已记录的已知限制，本次未改变。
- **UI 没进浏览器**：三阶段壳、灰显、NodeEditor 的 422 错误提示均只经过类型检查和构建，真实视觉/交互仍需控制器确认。
- **`public/app.js` 277KB 且未压缩**：P0 本机使用没问题；后续可开 esbuild `minify` 或按路由拆分。
