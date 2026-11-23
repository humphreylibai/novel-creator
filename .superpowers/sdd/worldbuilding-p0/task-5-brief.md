# Task 5 简报（已按"三阶段工作台"修订）

> 本文件取代计划里 Task 5 的原文。控制器裁决：界面从"单独工作台"改为**三阶段壳**，一次定死骨架，后续六个系统往里填。

## 目标

让插件把 `/novel/*` 全部转给 `handlers`，并把工作台渲染成三阶段外壳；**只有"设定阶段 → 世界观"可用**，其余入口一律灰显并写明原因。

## 文件

- 改：`src/host/plugin.ts`（新增前缀路由，保留 `/novel/ping` 作健康检查）
- 建：`src/ui/api.ts`、`src/ui/App.tsx`、`src/ui/views/NodeEditor.tsx`、`src/ui/views/StagePlaceholder.tsx`
- 改：`src/ui/client.tsx`（浮层里渲染 `<App />`，保留开/关）
- 建：`tests/host/plugin-route-prefix.test.ts`
- 提交：`lib/host/plugin.js`、`client.js`

## Host 侧

在 `apply` 里，除现有 `path: '/novel/ping'`（exact）之外，再注册一条：

```ts
ctx.effect(() => web.register({
  path: '/novel',
  kind: 'prefix',
  handler: async (req: any, res: any) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/^\/novel/, '') || '/';
    const query = Object.fromEntries(url.searchParams.entries());

    let body: unknown = null;
    if (req.method === 'PUT' || req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : null;
    }

    const out = await handle({ method: req.method ?? 'GET', path, query, body });
    res.writeHead(out.status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(out.json === undefined ? '' : JSON.stringify(out.json));
  }
}));
```

`handle` 是 `createHandlers(dataRoot)` 的返回值，在 `apply` 顶部创建一次（不要每次请求重建）。

JSON 解析失败要返回 `{ status: 400, json: { error: '请求体不是合法 JSON' } }`，不能抛到 500。

## Client 侧

### `src/ui/api.ts`

```ts
export async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/novel${path}`, { headers: { 'content-type': 'application/json' }, ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

export const listWorlds = () => j<string[]>('/worlds');
export const listNodes = (w: string) => j<unknown[]>(`/worlds/${encodeURIComponent(w)}/nodes`);
export const readNode = (w: string, id: string) => j<Record<string, unknown>>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}`);
export const saveNode = (w: string, n: Record<string, unknown>) =>
  j<unknown>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(String(n['id']))}`, { method: 'PUT', body: JSON.stringify(n) });
```

### `src/ui/App.tsx` —— 三阶段壳

结构（用 inline style，不引 UI 库）：

```
┌────────────────────────────────────────────────────────────┐
│ 小说工作台 │ ① 设定  ② 规划  ③ 创作                    关闭 │
├──────────┬─────────────────────────────────┬───────────────┤
│ 设定系统  │  主区（按阶段/系统变化）          │ （本任务留空） │
│ 世界观 ●  │                                 │               │
│ 地理     ○ │                                 │               │
│ 人物     ○ │                                 │               │
│ 势力     ○ │                                 │               │
│ 编年史   ○ │                                 │               │
│ 事件     ○ │                                 │               │
└──────────┴─────────────────────────────────┴───────────────┘
```

规则：
- 顶部三个阶段按钮，`① 设定` 为当前态（accent 背景）；`② 规划`、`③ 创作` 点击不切换，鼠标悬停 `title` 分别写：`需要编年史与事件（尚未实现）`、`需要卷/集/章（尚未实现）`
- 左侧六个系统：`世界观` 可点且为当前项；其余灰显（`color:#a8a29a`、`cursor:not-allowed`），`title` 写 `尚未实现`
- 系统列表下方一行小字：`诊断：尚未接入`（M2 会换成真实计数）
- 主区在「世界观」下：世界选择器（`<select>`，来自 `listWorlds()`，无世界时显示 `还没有世界`）+ `＋ 新建条目` 按钮 + 条目列表（左窄列）+ 右侧 `NodeEditor`
- 没有任何世界时，主区显示一行提示：`在 data/worlds/ 下还没有世界。先用编辑器创建 world.yaml 与 nodes/ 目录。`

### `src/ui/views/NodeEditor.tsx`

照计划原文实现（标题 + 正文 + 保存 + 错误提示），但：
- `node` 的类型用 `Record<string, unknown>`
- 保存失败时把服务端的 `error` 文案显示出来（422 的"公理必须付出代价"要能看见）

### `src/ui/views/StagePlaceholder.tsx`

一个极简组件：`({ title, reason }: { title: string; reason: string })` → 渲染标题 + 灰字原因。供规划/创作阶段使用（本任务它们不会真的被切换进去，但组件先建好）。

### `src/ui/client.tsx`

浮层里渲染 `<App onClose={...} />`；保留现有的浮层显隐与 `inject = ['slots']`。

## 测试（Host 侧）

`tests/host/plugin-route-prefix.test.ts`：
1. 用假 ctx（`{ webServer: { register: (r) => { captured.push(r); return () => {} } }, effect: (fn) => fn() }`）调 `apply(fakeCtx, { dataRoot: tmpDir })`
2. 断言注册了两条路由：一条 `path: '/novel/ping'`（exact）、一条 `path: '/novel'`（prefix）
3. 取 prefix 那条，用假 req（`{ url: '/novel/worlds', method: 'GET' }`）与假 res 调用，断言 `status 200` 且 body 是数组
4. 再发一次 `POST /novel/worlds`（假 req 需提供 `[Symbol.asyncIterator]` 产出 body 分片），断言 201
5. 发送非法 JSON 的 PUT，断言 400 且 body 只有 `error`

## 验收（人工）

`npm run verify` → `plugin_manager` 重装或 `set_bundle` 关开 → 刷新页面：
1. 右下角出现「工作台」按钮，点开是全屏面板
2. 顶部三个阶段，②③ 点不动且有灰字原因
3. 左侧六个系统，只有「世界观」亮着
4. 打开编辑器在 `data/worlds/记忆之世/` 建 `world.yaml` 与 `nodes/还脉礼.md`，刷新工作台 → 世界下拉出现「记忆之世」，条目列出现「还脉礼」，点开能读能存
5. 保存一条无 `cost` 的公理 → 界面显示「公理必须付出代价（铁律一）」

## 约束

- DSH API 只出现在 `src/host/plugin.ts` 与 `src/ui/client.tsx`
- 不引任何 UI 库（只用 React + inline style）
- 不碰 `src/engine/**`、`src/host/{store,handlers}.ts`、`docs/`
- 提交前缀 `feat:`；`npm run verify` 必须通过
