# Task 5 报告：接入 `/novel/*` + 三阶段工作台外壳

> **已被 Task 5b 取代**：控制器修订需求，界面不再放进 DSH 页面，改为由插件启动的本地 HTTP 服务提供。以 `task-5b-report.md` 与提交 `db2d29d` 为准。

## 状态

**完成**（提交 `bfc9d10`，分支 `feat/p0-worldbuilding`）。
按边界要求**未安装 bundle、未做浏览器验证**，界面真机验收留给控制器。

## 做了什么

### Host：`src/host/plugin.ts`

- 在 `apply` 顶部 `const handle = createHandlers(dataRoot)` **只创建一次**，请求处理中复用。
- 保留 `/novel/ping`（exact），新增 `/novel`（prefix）：
  - 从 `req.url` 取 pathname，剥掉 `/novel`，空路径回落为 `/`；
  - `query` 用 `Object.fromEntries(url.searchParams.entries())`；
  - `PUT` / `POST` 用 `for await ... of req` 拼接 `Buffer` 分片，再 `JSON.parse`；
  - 空请求体 → `body = null`；
  - 非法 JSON → `400 { error: '请求体不是合法 JSON' }`，不会冒到 500；
  - `handle` 的 `{ status, json }` 原样写回；`json === undefined`（204）时 `end('')`。
- `plugin.ts` 内没有任何 404/400/422 业务判断；这些全部由 `handlers` 决定。
- ping 的 handler 抽成 `respondPing`，exact 路由与 prefix 的 `/ping` 兜底共用同一份逻辑。

### Client

- 新建 `src/ui/api.ts`：`j()` 统一处理 `/novel` 前缀、`204`、非 2xx 错误体；导出
  `listWorlds` / `listNodes` / `readNode` / `saveNode`。
- 新建 `src/ui/App.tsx`：三阶段壳。
  - 顶部 `① 设定`（accent 当前态）、`② 规划`、`③ 创作`（灰显 + `title` 写明原因）。
  - 左栏六个系统：仅 `世界观` 可点/当前；其余 `#a8a29a` + `cursor:not-allowed` + `title="尚未实现"`。
  - 左栏下方小字 `诊断：尚未接入`。
  - 主区：`<select>` 世界选择器（`listWorlds()`，空时显示 `还没有世界`）、`＋ 新建条目`、左侧条目窄列、右侧 `NodeEditor`；无世界时显示 brief 指定的提示行。
  - 按 brief 的结构保留了一列**空白右栏**（本任务刻意留空，后续放检查器）。
- 新建 `src/ui/views/NodeEditor.tsx`：标题 + 正文 + 保存；保存中用 disabled；失败时把服务端 `error` 文案原样显示在 `role="alert"` 的红框里（422「公理必须付出代价（铁律一）」可见）。
- 新建 `src/ui/views/StagePlaceholder.tsx`：`{ title, reason }` → 标题 + 灰字原因；已接在非「设定/世界观」分支上，本任务不会真的切进去。
- 改 `src/ui/client.tsx`：浮层里渲染 `<App onClose={...} />`；保留 `toggleWorkbench`、Launcher 显隐与 `inject = ['slots']`。

## RED → GREEN

**RED（实现前，新测试 5 个用例）**：

```
× 注册 exact 健康检查与 prefix 路由
  → expected [ { path: '/novel/ping', …(2) } ] to have a length of 2 but got 1
× GET /novel/worlds 返回 JSON 数组      → route not registered
× POST /novel/worlds 会拼接异步分片请求体 → route not registered
× PUT 的非法 JSON 返回 400 且 body 只有 error → route not registered
× handlers 的 422 校验结果原样透传       → route not registered

Test Files  1 failed (1)
     Tests  5 failed (5)
```

失败原因是 prefix 路由尚不存在（功能缺失），不是拼写错误。

**GREEN（实现后）**：

```
✓ tests/host/plugin-route.test.ts (2 tests)
✓ tests/host/plugin.test.ts (2 tests)
✓ tests/host/plugin-route-prefix.test.ts (5 tests)
Test Files  3 passed (3)
     Tests  9 passed (9)
```

随后补了第 6 个用例：prefix 先匹配时 `/novel/ping` 仍返回健康检查（防御 DSH 路由优先级不确定）。
该用例与既有 `plugin-route.test.ts` 一起稳定通过；**未修改任何既有测试文件**。

## `npm run verify`（最终一次，fresh）

```
> tsc -p tsconfig.build.json && node scripts/build-client.mjs
client.js written: 20239 chars

 ✓ tests/host/ping.test.ts (1 test)
 ✓ tests/host/dataRoot.test.ts (2 tests)
 ✓ tests/engine/worldConfig.test.ts (7 tests)
 ✓ tests/host/plugin-route.test.ts (2 tests)
 ✓ tests/host/plugin.test.ts (2 tests)
 ✓ tests/engine/frontmatter.test.ts (12 tests)
 ✓ tests/host/plugin-route-prefix.test.ts (6 tests)
 ✓ tests/host/store.test.ts (5 tests)
 ✓ tests/host/handlers.test.ts (9 tests)

 Test Files  9 passed (9)
      Tests  46 passed (46)
```

额外执行 `npx tsc -p tsconfig.json --noEmit`（覆盖 `src/ui/**`，因为 `tsconfig.build.json` 只编译 engine/host）→ 退出码 0、无输出。

### 额外产物冒烟（`.superpowers/`，不提交）

`node .superpowers/sdd/worldbuilding-p0/task-5-smoke.mjs`（直接加载构建后的 `index.js` / `lib/host/plugin.js`，真实临时目录）：

```
client smoke OK: Launcher,apply,inject,toggleWorkbench window.__ModuleLoader__.load({ 20239
routes OK: /novel:prefix,/novel/ping:exact
ping exact OK: 200 {"ok":true,...}
ping via prefix fallback OK: 200
GET /novel/worlds OK: 200 []
POST /novel/worlds OK: 201 ["记忆之世"]
PUT/GET node OK: 200 还脉礼 nodes/还脉礼.md
422 passthrough OK: 422 {"error":"公理必须付出代价（铁律一）"}
400 bad JSON OK: 400 {"error":"请求体不是合法 JSON"}
SMOKE OK
```

`npx tsx .superpowers/sdd/worldbuilding-p0/task-5-api-smoke.ts`（假 fetch 验证 UI 数据层）：
URL 编码、PUT body、`content-type`、422 文案、204 → undefined 全部符合预期。

## 产物

- `client.js`：首行 `window.__ModuleLoader__.load({`，**20239 字符 / 20239 字节**。
  bundle 只 `require("react")` 与 `require("react/jsx-runtime")`；中文在产物里是 esbuild 的 `\uXXXX` 转义，运行时正常。
- `lib/host/plugin.js`：3637 字节，含 `createHandlers` 调用。
- 提交 `bfc9d10`（9 files，+1040 / −72），含 `lib/host/plugin.js`、`client.js`。

## 与 brief 的偏差

1. **路由注册顺序：prefix 先、exact ping 后，且 prefix 内部对 `/ping` 兜底。**
   brief 的代码顺序是把 prefix 加在现有 ping 后面。那样会打破既有 `tests/host/plugin-route.test.ts`——它把「最后注册的路由」当作 ping 路由，而本次边界不允许改既有测试。改为先注册 prefix 后，既有测试保持原样通过；同时在 prefix 里对 `/ping` 返回同样的健康检查，使健康检查不依赖 DSH 的 exact/prefix 优先级。业务判断仍只在 `handlers`。
2. **新增测试用例数 6 > brief 列的 5 步**：多出的两个是「422 原样透传」和「prefix 先匹配时 ping 仍可用」；前者直接保护界面必须显示的 422 文案。
3. **`api.ts` 的类型比 brief 更具体**：`listNodes` 返回 `NodeRecord[]`、`saveNode` 返回 `NodeRecord`，并导出 `type NodeRecord = Record<string, unknown>`；运行时行为与 brief 完全一致。
4. **右栏是空的 `aside`**（220px）：按 brief 图保留结构但不放内容；没有放任何占位文字，避免把图注误当 UI 文案。
5. **额外更新了 git-ignored 的旧 smoke**：`task-0-smoke.mjs` 原先断言「只注册 1 条路由」，现改为寻找 exact/prefix 两条；否则它会因本任务的正常变更误报。该文件不提交。
6. **没有为 React 组件写单测**：项目没有 `react` / `react-dom` / jsdom 依赖，`npm run verify` 也不跑 DOM；为遵守「不装依赖、不碰 package.json」和文件边界，UI 只做了全量 `tsc` 类型检查 + 数据层/产物冒烟，真实渲染由控制器浏览器验收。

## 担心的地方

- **DSH 的 prefix 匹配规则未在真机验证**：目前假设 `path: '/novel'` 能匹配 `/novel/worlds`。若 DSH 只认 `/novel/` 带斜杠，或 prefix 匹配是字符串 `startsWith` 导致 `/novelxxx` 也被吞，需要只改 `plugin.ts`。`/novel/ping` 已做兜底，其余路由没有第二层兜底。
- **界面未经过浏览器渲染**：`shell.overlay` 的容器定位决定 `position:absolute; inset:0` 是否真是全屏；沿用旧浮层的做法，风险与 Task 0 相同。三阶段/灰显/title/布局都只经过类型检查与人工读码。
- **422 验收依赖数据**：NodeEditor 只有标题与正文，没有 kind/cost 编辑控件；要看到「公理必须付出代价」必须加载一个 `kind: axiom` 且 `cost` 为空的已有节点再保存。新建条目固定是 `entry`，不会触发 422。
- **标题直接当文件名**（`store.writeNode` 的既有语义）：标题含 `/`、`\` 或 Windows 非法字符时保存会 500，错误文案会显示在编辑器里，但 P0 未做清洗/预校验。
- **每次保存后整目录重扫**（`listNodes`）用于刷新列表；P0 数据量没问题，世界变大后需要索引。
- `/novel/*` 仍未鉴权（Task 0 已记录的已知限制），本次未改变。
