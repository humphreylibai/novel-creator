# 世界观系统 P0 实施计划（DSH 插件形态）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个 DSH 插件形态的写作工作台：随 DSH 加载、界面在 DSH 页面内、浏览器里工作；能建世界、写设定条目、用 `[[双链]]` 互相引用、跑 R1–R12 体检、按年份看时间切片。

**Architecture:** 一个 bundle 两个半边。**Host 半**（`index.js` → `lib/host/plugin.js`）在 DSH 的 web 服务器上注册 `/novel/*` 命名路由，负责文件读写与校验；**Client 半**（`client.js`）把 React 工作台渲染进 DSH 页面的 `shell.overlay` 槽位，用同源 `fetch('/novel/...')` 取数据。业务逻辑集中在 `engine/`（纯函数，可完整单测）与 `host/handlers.ts`（纯 async 函数，输入输出都是普通对象），DSH API 只在 `host/plugin.ts` 一个适配层里出现。

**Tech Stack:** Node ≥ 20（ESM）、TypeScript strict、Vitest、esbuild（打 Client 半）、React 18（来自 DSH 浏览器模块表）。无独立服务端口、无 start.bat、无数据库。

**Spec:** `docs/superpowers/specs/2026-11-23-worldbuilding-spec.md`（世界观系统详细设计）
父文档：`docs/superpowers/specs/2026-11-23-novel-system-overview.md`（总纲：三层七系统 / 一张图 / 既定度 / 校验灯）

> 本文件**替代**此前的「独立 Node 服务 + start.bat」版本。差别只在启动与承载，`engine/` 一行未变。

## Global Constraints

- Node 版本下限：`>=20`；包为 ESM（`"type": "module"`）
- TypeScript `strict: true`；对外签名不出现 `any`
- 插件形态：`dsh.bundle.patch` + `dsh.client` 两段都在 `package.json` 里；Host 半只暴露 `apply(ctx, config)`；Client 半只暴露 module-loader 的 `factory`
- **数据根目录来自插件 `Config`**（`dataRoot`，默认 `<cwd>/data`），代码里禁止硬编码绝对路径
- 命名空间：节点 id 形如 `W-AX-002` / `E-MF-004`；跨世界唯一性由 `worldId` + `nodeId` 保证
- 路由前缀固定 `/novel`；所有响应 JSON，错误形如 `{ error: string }`
- **只读真相**：`index.json` 是派生品，任何代码不得把它当数据源；删掉必须能重建
- **永不阻断保存**，唯一例外：`kind: axiom` 且 `cost` 为空 → 422
- 校验分级固定 `error | warn | info`，对应 🔴 / 🟡 / ⚪
- 条目文件格式固定：YAML front matter（`---` 包围）+ 正文；一条一文件，文件名 `<title>.md`
- 年份为整数，`null` 表示“至今”，负数表示纪元前
- **DSH API 只允许出现在 `src/host/plugin.ts` 与 `src/ui/client.tsx`**；其余模块必须能在纯 Node 下跑测试
- 提交信息用 `feat:` / `test:` / `fix:` / `docs:` / `chore:` 前缀，每任务至少一次提交

## File Structure

```
novel/                                  ← 工作区 = bundle 包目录
├── package.json                        # bundle manifest（dsh.bundle.patch + dsh.client）
├── cordis.patch.yml
├── index.js                            # Host 入口：re-export lib/host/plugin.js
├── client.js                           # Client 入口（构建产物，勿手改）
├── icon.svg
├── locale/{zh,en}.json
├── docs/DETAIL.md                      # 插件详情页文档
├── tsconfig.json                       # 开发/测试用（noEmit）
├── tsconfig.build.json                 # 只编译 src/{engine,host} → lib/
├── vitest.config.ts
├── scripts/build-client.mjs            # esbuild → CJS → module-loader 包装
├── src/
│   ├── engine/                         # 纯函数，无 I/O、无 DSH
│   │   ├── types.ts
│   │   ├── frontmatter.ts
│   │   ├── worldConfig.ts
│   │   ├── wikiLink.ts
│   │   ├── graph.ts
│   │   ├── query.ts
│   │   └── rules/{index,content,structural,explicit}.ts
│   ├── host/
│   │   ├── plugin.ts                   # 唯一 DSH 适配层：ctx.webServer.register
│   │   ├── handlers.ts                 # 纯 async 函数：NovelReq → NovelRes（可单测）
│   │   ├── store.ts                    # 唯一 fs 边界
│   │   ├── indexFile.ts                # index.json 重建
│   │   └── cli.ts                      # npm run check
│   └── ui/
│       ├── client.tsx                  # Client 入口：注册 shell.overlay
│       ├── api.ts                      # fetch('/novel/...') 封装
│       ├── App.tsx                     # 工作台外壳（侧栏 + 视图）
│       └── views/{NodeEditor,CardWall,Findings,Timeline,Onboarding}.tsx
├── tests/
│   ├── engine/*.test.ts
│   ├── host/{store,handlers,indexFile}.test.ts
│   └── acceptance/acceptance.test.ts
└── data/worlds/<worldId>/              # 运行后产生
```

**为什么这么切**：`engine` 不认识 fs、也不认识 DSH；`handlers` 只认识普通对象，所以整套业务能用 `vitest` 在纯 Node 下测；`plugin.ts` 与 `client.tsx` 是仅有的两处“可能随 DSH 版本变化”的代码，改动面被压到最小。

---

# M0 · 骨架（能加载、能打开、能写）

## Task 0: 最小可运行插件探针（揭盲三个未知）

**为什么先做这个**：有三个点我无法从文档确认，必须先落地验证，否则后面 16 个任务都建在假设上：

1. `ctx.webServer.register(route)` 的 `handler` 签名与请求体读取方式
2. `shell.overlay` 槽位的注册方式与 props
3. Client 半用 esbuild 打成 module-loader 格式是否被接受（`require('react')` 能否解析）

**Files:**
- Create: `package.json`, `cordis.patch.yml`, `index.js`, `icon.svg`, `locale/zh.json`, `locale/en.json`, `docs/DETAIL.md`, `scripts/build-client.mjs`, `src/host/plugin.ts`, `src/host/ping.ts`, `src/ui/client.tsx`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- Test: `tests/host/ping.test.ts`

**Interfaces:**
- Produces:
  - `src/host/ping.ts` → `export function pingHandler(root: string): () => { ok: true; dataRoot: string; version: string }`
  - `src/host/plugin.ts` → `export function apply(ctx: HostCtx, config: PluginConfig): void`、`export interface PluginConfig { dataRoot: string }`
  - `client.js` 导出 module-loader 注册（含 `apply`），在 `shell.overlay` 渲染一个浮动按钮 + 面板

- [ ] **Step 1: 写失败测试**

```ts
// tests/host/ping.test.ts
import { describe, it, expect } from 'vitest';
import { pingHandler } from '../../src/host/ping';

describe('ping', () => {
  it('回显数据根目录与版本', () => {
    const ping = pingHandler('/tmp/novel-data');
    const r = ping();
    expect(r.ok).toBe(true);
    expect(r.dataRoot).toBe('/tmp/novel-data');
    expect(typeof r.version).toBe('string');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- tests/host/ping.test.ts`
Expected: FAIL，找不到 `src/host/ping`

- [ ] **Step 3: 建 bundle 骨架**

`package.json`：

```json
{
  "name": "@local/novel-workbench",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Novel workbench: assertion-graph worldbuilding inside DSH.",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg"
  },
  "files": ["index.js", "client.js", "lib", "cordis.patch.yml", "locale/*.json", "docs", "icon.svg"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": false,
      "inject": ["@deepseek-ai/dsh-client-ui-layout"]
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json && node scripts/build-client.mjs",
    "test": "vitest run",
    "check": "tsx src/host/cli.ts"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "@types/react": "^18.3.11",
    "esbuild": "^0.24.0",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vitest": "^2.1.2",
    "yaml": "^2.5.1"
  }
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: novel-workbench
      name: '@local/novel-workbench'
      config:
        dataRoot: ''
```

`index.js`：

```js
export { apply } from './lib/host/plugin.js';
```

`icon.svg`（256×256 viewBox，原创简单图形）：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <rect width="256" height="256" rx="48" fill="#2f6f4f"/>
  <path d="M56 72h60v112H56z" fill="#f3f0e6"/>
  <path d="M140 72h60v112h-60z" fill="#e5e0cf"/>
  <path d="M116 72h24v112h-24z" fill="#c9c2a6"/>
  <circle cx="86" cy="108" r="9" fill="#2f6f4f"/>
  <circle cx="170" cy="108" r="9" fill="#2f6f4f"/>
</svg>
```

`locale/zh.json`：

```json
{
  "meta": {
    "title": "小说工作台",
    "description": "以断言图管理世界设定：公理、条目、引用与一致性体检。",
    "detail": "docs/DETAIL.md"
  }
}
```

`locale/en.json`：

```json
{
  "meta": {
    "title": "Novel workbench",
    "description": "Manages world settings as an assertion graph: axioms, entries, citations, and consistency checks.",
    "detail": "docs/DETAIL.md"
  }
}
```

`docs/DETAIL.md`：

```markdown
# Novel workbench

管理一部小说的世界观设定：公理、条目、相互引用与一致性体检。

## 用法

1. 在 DSH 页面右下角点「工作台」打开面板。
2. 建立世界，填写母题与至少三条公理（每条必须付出代价）。
3. 写条目，用 `[[双引号]]` 之外的 `[[条目名]]` 在片段里引用。
4. 「诊断清单」列出所有被规则咬到的问题。

## 边界

- 数据是纯文本，位于插件配置 `dataRoot` 下的 `worlds/<世界>/`。
- 本版本不含 AI 归纳与审问，也不含正文编辑器。
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true, "jsx": "react-jsx",
    "types": ["node", "vitest/globals"], "skipLibCheck": true, "noEmit": true,
    "allowImportingTsExtensions": false
  },
  "include": ["src", "tests"]
}
```

`tsconfig.build.json`：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": "lib", "rootDir": "src", "declaration": false },
  "include": ["src/engine", "src/host"]
}
```

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 4: 实现 ping 与 Host 适配层**

```ts
// src/host/ping.ts
import { readFileSync } from 'node:fs';

export const VERSION = '0.1.0';

export function pingHandler(root: string) {
  return () => ({ ok: true as const, dataRoot: root, version: VERSION });
}
```

```ts
// src/host/plugin.ts
export interface PluginConfig { dataRoot: string }

/** DSH 只在这里出现：路由注册与错误兜底。 */
export function apply(ctx: any, config: PluginConfig): void {
  const dataRoot = config?.dataRoot?.trim() || `${process.cwd()}\\data`;
  const web = ctx.webServer;
  if (!web?.register) {
    ctx.logger?.warn?.('[novel] webServer 不可用，工作台未挂载');
    return;
  }
  ctx.effect(() => web.register({
    path: '/novel/ping',
    kind: 'exact',
    handler: (_req: any, res: any) => {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, dataRoot, version: '0.1.0' }));
    }
  }));
}
```

> 这段适配层是探针要验证的部分。若 `register` 的形状与此不同（例如接受 `{ resource }` 或 fetch 风格 `Request → Response`），**只改这一个文件**，不要动 `handlers.ts`。

- [ ] **Step 5: 实现 Client 入口与构建脚本**

`src/ui/client.tsx`：

```tsx
import { useState } from 'react';

let open = false;
const listeners = new Set<(v: boolean) => void>();
export function toggleWorkbench(next?: boolean) {
  open = next ?? !open;
  for (const l of listeners) l(open);
}

export function Launcher() {
  const [visible, setVisible] = useState(open);
  listeners.add(setVisible);
  return (
    <>
      <button onClick={() => toggleWorkbench()} style={{
        position: 'absolute', right: 16, bottom: 16, zIndex: 40,
        padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer'
      }}>工作台</button>
      {visible && <Workbench />}
    </>
  );
}

function Workbench() {
  const [ping, setPing] = useState<string>('未连接');
  const probe = async () => {
    try {
      const r = await fetch('/novel/ping');
      setPing(JSON.stringify(await r.json()));
    } catch (e) { setPing(`失败：${(e as Error).message}`); }
  };
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 39, background: 'rgba(255,255,255,0.98)',
      padding: 24, overflow: 'auto'
    }}>
      <h2 style={{ marginTop: 0 }}>小说工作台 <button onClick={() => toggleWorkbench(false)} style={{ float: 'right' }}>关闭</button></h2>
      <button onClick={probe}>测试 Host 连接</button>
      <pre style={{ marginTop: 12 }}>{ping}</pre>
    </div>
  );
}

export function apply(ctx: any) {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'novel-workbench-launcher', order: 20 },
    Launcher
  ));
}
```

`scripts/build-client.mjs`：

```js
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const out = await build({
  entryPoints: ['src/ui/client.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  external: ['react'],
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
  logLevel: 'info'
});

const code = out.outputFiles[0].text;
const wrapped = `window.__ModuleLoader__.load({
  id: '@local/novel-workbench',
  factory(require) {
    const React = require('react');
    const module = { exports: {} };
    (function (module, exports, React) {
${code}
    })(module, module.exports, React);
    return module.exports;
  },
});
`;
mkdirSync('dist', { recursive: true });
writeFileSync('client.js', wrapped, 'utf8');
console.log('client.js written:', wrapped.length, 'chars');
```

- [ ] **Step 6: 构建并运行测试**

Run: `npm install && npm test -- tests/host/ping.test.ts && npm run build`
Expected: 测试 PASS；`lib/host/plugin.js` 与 `client.js` 均生成，`client.js` 以 `window.__ModuleLoader__.load(` 开头。

- [ ] **Step 7: 安装并验证（这一步揭盲，必须由人确认）**

用 `plugin_manager` 以本目录为 `target` 安装 `@local/novel-workbench`，然后：

1. 新开一个会话，刷新页面
2. 确认右下角出现「工作台」按钮 → 点开 → 出现全屏面板
3. 点「测试 Host 连接」→ 必须显示 `{"ok":true,"dataRoot":"...","version":"0.1.0"}`
4. 关掉面板再打开，状态正常
5. 在 DSH 的插件列表里确认标题「小说工作台」与详情页文案

**若第 3 步失败**：只改 `src/host/plugin.ts` 的适配层（换 `handler` 为 `resource`，或用 `registerUpgrade`/`webServer` 的其他入口），再重新构建安装。**不要把适配层逻辑复制到别处。**

- [ ] **Step 8: 提交**

```bash
git add package.json cordis.patch.yml index.js icon.svg locale docs/DETAIL.md scripts src tsconfig.json tsconfig.build.json vitest.config.ts tests/host/ping.test.ts
git commit -m "feat: DSH 插件骨架与最小探针（路由 + overlay + 构建）"
```

---

## Task 1: 领域类型与 front matter 编解码

**Files:**
- Create: `src/engine/frontmatter.ts`
- Modify: `src/engine/types.ts`
- Test: `tests/engine/frontmatter.test.ts`

**Interfaces:**
- Produces:
  - `type Strength = 'hard' | 'firm' | 'soft' | 'myth'`
  - `type NodeKind = 'axiom' | 'entry'`
  - `interface Span { from: number | null; to: number | null }`
  - `interface WorldNode { id, kind, subtype, title, aliases, strength, span, proposition, cost, derives, manifests, requires, conflictsWith, sameAs, violations, body, file }`
  - `parseFrontmatter(raw): { data, body }`、`parseNode(raw, file): WorldNode`、`serializeNode(node): string`

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/frontmatter.test.ts
import { describe, it, expect } from 'vitest';
import { parseNode, serializeNode } from '../../src/engine/frontmatter';

const RAW = `---
kind: axiom
id: W-AX-002
title: 记忆即燃料
strength: hard
span: { from: -1200, to: null }
proposition: 施法会永久烧毁施法者的记忆
cost: [记忆, 身份]
---

施法会永久烧毁施法者的记忆。

这条规则不是秘密。
`;

describe('front matter 编解码', () => {
  it('解析出结构化字段与正文', () => {
    const n = parseNode(RAW, 'nodes/记忆即燃料.md');
    expect(n.id).toBe('W-AX-002');
    expect(n.kind).toBe('axiom');
    expect(n.strength).toBe('hard');
    expect(n.span).toEqual({ from: -1200, to: null });
    expect(n.cost).toEqual(['记忆', '身份']);
    expect(n.body.trim()).toBe('施法会永久烧毁施法者的记忆。\n\n这条规则不是秘密。');
  });

  it('缺省字段有安全默认值', () => {
    const n = parseNode('---\nid: E-1\ntitle: 无字塔\n---\n正文', 'nodes/无字塔.md');
    expect(n.kind).toBe('entry');
    expect(n.strength).toBe('soft');
    expect(n.derives).toEqual([]);
    expect(n.span).toEqual({ from: null, to: null });
  });

  it('序列化后可原样解析回来', () => {
    const n = parseNode(RAW, 'nodes/记忆即燃料.md');
    expect(parseNode(serializeNode(n), n.file)).toEqual(n);
  });

  it('缺少围栏时抛错', () => {
    expect(() => parseNode('没有 front matter', 'x.md')).toThrow(/front matter/i);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/frontmatter.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/types.ts
export type Severity = 'error' | 'warn' | 'info';
export const SEVERITY_ORDER: Severity[] = ['error', 'warn', 'info'];

export type Strength = 'hard' | 'firm' | 'soft' | 'myth';
export type NodeKind = 'axiom' | 'entry';
export interface Span { from: number | null; to: number | null }

export interface Finding {
  rule: string; severity: Severity; nodeIds: string[];
  message: string; hint?: string; actions?: string[];
}

export interface WorldNode {
  id: string;
  kind: NodeKind;
  subtype: string | null;
  title: string;
  aliases: string[];
  strength: Strength;
  span: Span;
  proposition: string | null;
  cost: string[];
  derives: string[];
  manifests: string[];
  requires: string[];
  conflictsWith: string[];
  sameAs: string[];
  violations: string[];
  body: string;
  file: string;
}
```

```ts
// src/engine/frontmatter.ts
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Span, Strength, WorldNode } from './types';

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const clean = raw.replace(/^\uFEFF/, '');
  const m = FENCE.exec(clean);
  if (!m) throw new Error('缺少 front matter 围栏（文件必须以 --- 开头）');
  const data = (parseYaml(m[1] ?? '') ?? {}) as Record<string, unknown>;
  return { data, body: clean.slice(m[0].length) };
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function toSpan(v: unknown): Span {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return { from: numOrNull(o['from']), to: numOrNull(o['to']) };
  }
  return { from: null, to: null };
}
function toStrength(v: unknown): Strength {
  return v === 'hard' || v === 'firm' || v === 'myth' ? v : 'soft';
}

export function parseNode(raw: string, file: string): WorldNode {
  const { data, body } = parseFrontmatter(raw);
  return {
    id: String(data['id'] ?? ''),
    kind: data['kind'] === 'axiom' ? 'axiom' : 'entry',
    subtype: typeof data['subtype'] === 'string' ? data['subtype'] : null,
    title: String(data['title'] ?? ''),
    aliases: arr(data['aliases']),
    strength: toStrength(data['strength']),
    span: toSpan(data['span']),
    proposition: typeof data['proposition'] === 'string' ? data['proposition'] : null,
    cost: arr(data['cost']),
    derives: arr(data['derives']),
    manifests: arr(data['manifests']),
    requires: arr(data['requires']),
    conflictsWith: arr(data['conflicts_with']),
    sameAs: arr(data['same_as']),
    violations: arr(data['violations']),
    body,
    file
  };
}

export function serializeNode(n: WorldNode): string {
  const data: Record<string, unknown> = {
    kind: n.kind, id: n.id, title: n.title, strength: n.strength,
    ...(n.subtype ? { subtype: n.subtype } : {}),
    ...(n.aliases.length ? { aliases: n.aliases } : {}),
    span: n.span,
    ...(n.proposition ? { proposition: n.proposition } : {}),
    ...(n.cost.length ? { cost: n.cost } : {}),
    ...(n.derives.length ? { derives: n.derives } : {}),
    ...(n.manifests.length ? { manifests: n.manifests } : {}),
    ...(n.requires.length ? { requires: n.requires } : {}),
    ...(n.conflictsWith.length ? { conflicts_with: n.conflictsWith } : {}),
    ...(n.sameAs.length ? { same_as: n.sameAs } : {}),
    ...(n.violations.length ? { violations: n.violations } : {})
  };
  return `---\n${stringifyYaml(data)}---\n${n.body}`;
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/frontmatter.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/engine/types.ts src/engine/frontmatter.ts tests/engine/frontmatter.test.ts
git commit -m "feat: 领域类型与 front matter 编解码"
```

---

## Task 2: 世界配置读取与校验

**Files:**
- Create: `src/engine/worldConfig.ts`
- Test: `tests/engine/worldConfig.test.ts`

**Interfaces:**
- Produces: `parseWorldConfig(raw: string): WorldConfig`；`interface WorldConfig { id, title, genre{allowed,forbidden,expectation}, calendar{epochs,format,months}, theme{wound,motif} }`。缺 `theme.wound` 或空 `calendar.epochs` 抛错。

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/worldConfig.test.ts
import { describe, it, expect } from 'vitest';
import { parseWorldConfig } from '../../src/engine/worldConfig';

const RAW = `id: 记忆之世
title: 记忆之世
genre:
  allowed: [超自然, 社会]
  forbidden: [时间旅行]
  expectation: 代价必须兑现
calendar:
  epochs:
    - { name: 旧世, start: -1200, end: -1 }
    - { name: 新历, start: 1, end: null }
  format: "新历{year}年"
theme:
  wound: 一个靠抽干世界来维持秩序的世界
  motif: 记忆即代价
`;

describe('world.yaml', () => {
  it('解析出契约、历法、母题', () => {
    const c = parseWorldConfig(RAW);
    expect(c.genre.allowed).toEqual(['超自然', '社会']);
    expect(c.calendar.epochs).toHaveLength(2);
    expect(c.theme.wound).toContain('抽干');
  });
  it('缺母题时报错', () => {
    expect(() => parseWorldConfig(RAW.replace(/theme:[\s\S]*$/, ''))).toThrow(/wound/);
  });
  it('历法为空时报错', () => {
    expect(() => parseWorldConfig(RAW.replace(/epochs:[\s\S]*?format/, 'format'))).toThrow(/epochs/);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/worldConfig.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/worldConfig.ts
import { parse as parseYaml } from 'yaml';

export interface Epoch { name: string; start: number; end: number | null }
export interface WorldConfig {
  id: string; title: string;
  genre: { allowed: string[]; forbidden: string[]; expectation: string };
  calendar: { epochs: Epoch[]; format: string; months: string[] };
  theme: { wound: string; motif: string };
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function parseWorldConfig(raw: string): WorldConfig {
  const d = (parseYaml(raw) ?? {}) as Record<string, any>;
  const theme = d['theme'] ?? {};
  const wound = String(theme['wound'] ?? '').trim();
  if (!wound) throw new Error('world.yaml 缺少 theme.wound（一句话母题）');

  const cal = d['calendar'] ?? {};
  const epochsRaw = Array.isArray(cal['epochs']) ? cal['epochs'] : [];
  if (epochsRaw.length === 0) throw new Error('world.yaml 缺少 calendar.epochs（历法必须成数据）');
  const epochs: Epoch[] = epochsRaw.map((e: any) => ({
    name: String(e?.['name'] ?? ''),
    start: Number(e?.['start'] ?? 0),
    end: e?.['end'] === null || e?.['end'] === undefined ? null : Number(e['end'])
  }));

  return {
    id: String(d['id'] ?? ''),
    title: String(d['title'] ?? d['id'] ?? ''),
    genre: {
      allowed: arr(d['genre']?.['allowed']),
      forbidden: arr(d['genre']?.['forbidden']),
      expectation: String(d['genre']?.['expectation'] ?? '')
    },
    calendar: { epochs, format: String(cal['format'] ?? '{year}'), months: arr(cal['months']) },
    theme: { wound, motif: String(theme['motif'] ?? '') }
  };
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/worldConfig.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/engine/worldConfig.ts tests/engine/worldConfig.test.ts
git commit -m "feat: world.yaml 解析与校验"
```

---

## Task 3: 文件存储层（唯一 fs 边界）

**Files:**
- Create: `src/host/store.ts`
- Test: `tests/host/store.test.ts`

**Interfaces:**
- Consumes: `parseNode` / `serializeNode`、`parseWorldConfig`
- Produces:
  - `interface Fragment { id; chapter; scene; text; file }`
  - `createWorld(root, id, configYaml)`、`listWorlds(root)`、`readWorldConfig(root, id)`
  - `listNodes(root, id)`、`readNode(root, id, nodeId)`、`writeNode(root, id, node)`、`deleteNode(root, id, nodeId)`
  - `listFragments(root, id)`、`writeFragment(root, id, f)`、`readFragment(root, id, fid)`

- [ ] **Step 1: 写失败测试**

```ts
// tests/host/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../../src/host/store';

const CONFIG = `id: 记忆之世
title: 记忆之世
genre: { allowed: [超自然], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "新历{year}年"
theme:
  wound: 一个靠抽干世界来维持秩序的世界
  motif: 记忆即代价
`;

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'novel-')); });

const node = (over: Partial<store.WorldNodeLike> = {}): store.WorldNodeLike => ({
  id: 'W-AX-002', kind: 'axiom', subtype: null, title: '记忆即燃料', aliases: [],
  strength: 'hard', span: { from: -1200, to: null }, proposition: '施法烧记忆',
  cost: ['记忆'], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], body: '正文\n', file: '', ...over
});

describe('store', () => {
  it('建世界后能列出', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    expect(await store.listWorlds(root)).toEqual(['记忆之世']);
  });

  it('写节点后能读回，文件落在 nodes/<title>.md', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    await store.writeNode(root, '记忆之世', node());
    const list = await store.listNodes(root, '记忆之世');
    expect(list).toHaveLength(1);
    expect(list[0]!.file).toBe('nodes/记忆即燃料.md');
    expect((await store.readNode(root, '记忆之世', 'W-AX-002')).span.from).toBe(-1200);
  });

  it('改标题会移动文件而不是留下副本', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    await store.writeNode(root, '记忆之世', node({ id: 'E-1', kind: 'entry', title: '旧名' }));
    await store.writeNode(root, '记忆之世', node({ id: 'E-1', kind: 'entry', title: '新名' }));
    expect((await store.listNodes(root, '记忆之世')).map((n) => n.title)).toEqual(['新名']);
  });

  it('删除后读不到', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    await store.writeNode(root, '记忆之世', node({ id: 'E-2', kind: 'entry', title: '还脉礼' }));
    await store.deleteNode(root, '记忆之世', 'E-2');
    await expect(store.readNode(root, '记忆之世', 'E-2')).rejects.toThrow();
  });

  it('片段带章节与场景，可写入可列出', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    await store.writeFragment(root, '记忆之世', { id: '第03章-02', chapter: 3, scene: 2, text: '袖口的[[欠名录]]' });
    const list = await store.listFragments(root, '记忆之世');
    expect(list[0]!.chapter).toBe(3);
    expect(list[0]!.text).toContain('欠名录');
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/host/store.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/host/store.ts
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseNode, serializeNode } from '../engine/frontmatter';
import { parseWorldConfig, type WorldConfig } from '../engine/worldConfig';
import type { WorldNode } from '../engine/types';

export type WorldNodeLike = WorldNode;
export interface Fragment { id: string; chapter: number | null; scene: number | null; text: string; file: string }

export const worldDir = (root: string, id: string) => join(root, 'worlds', id);
export const nodesDir = (root: string, id: string) => join(worldDir(root, id), 'nodes');
export const fragDir = (root: string, id: string) => join(worldDir(root, id), 'fragments');

async function ensureDir(p: string) { await mkdir(p, { recursive: true }); }

export async function createWorld(root: string, id: string, configYaml: string): Promise<void> {
  await ensureDir(nodesDir(root, id));
  await ensureDir(fragDir(root, id));
  await ensureDir(join(worldDir(root, id), 'beliefs'));
  await writeFile(join(worldDir(root, id), 'world.yaml'), configYaml, 'utf8');
}

export async function listWorlds(root: string): Promise<string[]> {
  const dir = join(root, 'worlds');
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function readWorldConfig(root: string, worldId: string): Promise<WorldConfig> {
  return parseWorldConfig(await readFile(join(worldDir(root, worldId), 'world.yaml'), 'utf8'));
}

export async function listNodes(root: string, worldId: string): Promise<WorldNode[]> {
  const dir = nodesDir(root, worldId);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  const nodes = await Promise.all(files.map(async (f) =>
    parseNode(await readFile(join(dir, f), 'utf8'), `nodes/${f}`)));
  return nodes.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
}

export async function readNode(root: string, worldId: string, nodeId: string): Promise<WorldNode> {
  const found = (await listNodes(root, worldId)).find((n) => n.id === nodeId);
  if (!found) throw new Error(`找不到节点 ${nodeId}`);
  return found;
}

export async function writeNode(root: string, worldId: string, node: WorldNode): Promise<WorldNode> {
  const dir = nodesDir(root, worldId);
  await ensureDir(dir);
  const rel = `nodes/${node.title || node.id}.md`;
  const prev = (await listNodes(root, worldId)).find((n) => n.id === node.id);
  await writeFile(join(worldDir(root, worldId), rel), serializeNode({ ...node, file: rel }), 'utf8');
  if (prev && prev.file !== rel) await unlink(join(worldDir(root, worldId), prev.file)).catch(() => undefined);
  return { ...node, file: rel };
}

export async function deleteNode(root: string, worldId: string, nodeId: string): Promise<void> {
  const node = await readNode(root, worldId, nodeId);
  await unlink(join(worldDir(root, worldId), node.file));
}

export async function listFragments(root: string, worldId: string): Promise<Fragment[]> {
  const dir = fragDir(root, worldId);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  return Promise.all(files.map(async (f) => {
    const raw = await readFile(join(dir, f), 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
    const head = m?.[1] ?? '';
    const num = (k: string) => { const r = new RegExp(`${k}:\\s*(\\d+)`).exec(head); return r ? Number(r[1]) : null; };
    return {
      id: f.replace(/\.md$/, ''), chapter: num('chapter'), scene: num('scene'),
      text: m ? raw.slice(m[0].length) : raw, file: `fragments/${f}`
    };
  }));
}

export async function writeFragment(root: string, worldId: string,
  f: { id: string; chapter: number | null; scene: number | null; text: string }): Promise<void> {
  const dir = fragDir(root, worldId);
  await ensureDir(dir);
  const head = ['---', f.chapter !== null ? `chapter: ${f.chapter}` : null,
    f.scene !== null ? `scene: ${f.scene}` : null, '---', ''].filter((x) => x !== null).join('\n');
  await writeFile(join(dir, `${f.id}.md`), `${head}${f.text}`, 'utf8');
}

export async function readFragment(root: string, worldId: string, id: string): Promise<Fragment> {
  const found = (await listFragments(root, worldId)).find((f) => f.id === id);
  if (!found) throw new Error(`找不到片段 ${id}`);
  return found;
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/host/store.test.ts` → PASS（5 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/host/store.ts tests/host/store.test.ts
git commit -m "feat: 文件存储层（世界/节点/片段）"
```

---

## Task 4: 请求处理层（纯函数，可单测）

**Files:**
- Create: `src/host/handlers.ts`
- Test: `tests/host/handlers.test.ts`

**Interfaces:**
- Consumes: `store.*`
- Produces:
  - `interface NovelReq { method: string; path: string; query: Record<string, string>; body: unknown }`
  - `type NovelRes = { status: number; json?: unknown }`
  - `createHandlers(root: string): (req: NovelReq) => Promise<NovelRes>`
  - 路由：`GET /worlds`｜`POST /worlds`｜`GET /worlds/:w/config`｜`GET /worlds/:w/nodes`｜`GET|PUT|DELETE /worlds/:w/nodes/:id`｜`GET /worlds/:w/stats`

- [ ] **Step 1: 写失败测试**

```ts
// tests/host/handlers.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers';

const CONFIG = `id: 记忆之世
title: 记忆之世
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: 母题
`;

let h: ReturnType<typeof createHandlers>;
beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'novel-h-'));
  h = createHandlers(root);
});

describe('handlers', () => {
  it('POST /worlds 建世界', async () => {
    const r = await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
    expect(r.status).toBe(201);
    const list = await h({ method: 'GET', path: '/worlds', query: {}, body: null });
    expect(list.json).toEqual(['记忆之世']);
  });

  it('公理没代价返回 422 且不落盘', async () => {
    const r = await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/W-AX-1', query: {},
      body: { id: 'W-AX-1', kind: 'axiom', title: '无代价', strength: 'hard', cost: [] } });
    expect(r.status).toBe(422);
    const list = await h({ method: 'GET', path: '/worlds/记忆之世/nodes', query: {}, body: null });
    expect(list.json).toEqual([]);
  });

  it('条目可保存并读回', async () => {
    const put = await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-1', query: {},
      body: { id: 'E-1', kind: 'entry', title: '还脉礼', strength: 'soft', body: '念名还债' } });
    expect(put.status).toBe(200);
    const got = await h({ method: 'GET', path: '/worlds/记忆之世/nodes/E-1', query: {}, body: null });
    expect((got.json as any).title).toBe('还脉礼');
  });

  it('stats 统计公理数与已落表现的公理数', async () => {
    await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/W-AX-2', query: {},
      body: { id: 'W-AX-2', kind: 'axiom', title: '记忆即燃料', strength: 'hard', cost: ['记忆'] } });
    const s = await h({ method: 'GET', path: '/worlds/记忆之世/stats', query: {}, body: null });
    expect(s.json).toMatchObject({ axioms: 1, manifestedAxioms: 0 });
  });

  it('未知路径返回 404', async () => {
    expect((await h({ method: 'GET', path: '/nope', query: {}, body: null })).status).toBe(404);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/host/handlers.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/host/handlers.ts
import * as store from './store';
import type { WorldNode } from '../engine/types';

export interface NovelReq { method: string; path: string; query: Record<string, string>; body: unknown }
export interface NovelRes { status: number; json?: unknown }

function toNode(input: any, prev: WorldNode | null): WorldNode {
  return {
    id: String(input.id ?? prev?.id ?? ''),
    kind: input.kind === 'axiom' ? 'axiom' : (prev?.kind ?? 'entry'),
    subtype: input.subtype ?? prev?.subtype ?? null,
    title: String(input.title ?? prev?.title ?? input.id ?? ''),
    aliases: input.aliases ?? prev?.aliases ?? [],
    strength: input.strength ?? prev?.strength ?? 'soft',
    span: input.span ?? prev?.span ?? { from: null, to: null },
    proposition: input.proposition ?? prev?.proposition ?? null,
    cost: input.cost ?? prev?.cost ?? [],
    derives: input.derives ?? prev?.derives ?? [],
    manifests: input.manifests ?? prev?.manifests ?? [],
    requires: input.requires ?? prev?.requires ?? [],
    conflictsWith: input.conflicts_with ?? prev?.conflictsWith ?? [],
    sameAs: input.same_as ?? prev?.sameAs ?? [],
    violations: input.violations ?? prev?.violations ?? [],
    body: input.body ?? prev?.body ?? '',
    file: prev?.file ?? ''
  };
}

export function createHandlers(root: string) {
  return async function handle(req: NovelReq): Promise<NovelRes> {
    try {
      const parts = req.path.split('/').filter(Boolean);

      if (parts[0] === 'worlds' && parts.length === 1) {
        if (req.method === 'GET') return { status: 200, json: await store.listWorlds(root) };
        if (req.method === 'POST') {
          const b = req.body as any;
          await store.createWorld(root, String(b?.id), String(b?.config));
          return { status: 201, json: { ok: true } };
        }
      }

      const worldId = parts[1] ? decodeURIComponent(parts[1]) : '';
      if (!worldId) return { status: 404, json: { error: '缺少世界 id' } };

      if (parts[2] === 'config' && req.method === 'GET')
        return { status: 200, json: await store.readWorldConfig(root, worldId) };

      if (parts[2] === 'stats' && req.method === 'GET') {
        const nodes = await store.listNodes(root, worldId);
        const axioms = nodes.filter((n) => n.kind === 'axiom');
        return { status: 200, json: {
          axioms: axioms.length,
          entries: nodes.filter((n) => n.kind === 'entry').length,
          manifestedAxioms: axioms.filter((a) => a.manifests.length >= 2).length
        } };
      }

      if (parts[2] === 'nodes' && parts.length === 3 && req.method === 'GET')
        return { status: 200, json: await store.listNodes(root, worldId) };

      if (parts[2] === 'nodes' && parts.length === 4) {
        const nodeId = decodeURIComponent(parts[3]!);
        if (req.method === 'GET') return { status: 200, json: await store.readNode(root, worldId, nodeId) };
        if (req.method === 'DELETE') {
          await store.deleteNode(root, worldId, nodeId);
          return { status: 204 };
        }
        if (req.method === 'PUT') {
          const prev = await store.readNode(root, worldId, nodeId).catch(() => null);
          const node = toNode(req.body, prev);
          if (node.kind === 'axiom' && node.cost.length === 0)
            return { status: 422, json: { error: '公理必须付出代价（铁律一）' } };
          return { status: 200, json: await store.writeNode(root, worldId, node) };
        }
      }

      return { status: 404, json: { error: `未实现的路由 ${req.method} ${req.path}` } };
    } catch (e) {
      return { status: 500, json: { error: (e as Error).message } };
    }
  };
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/host/handlers.test.ts` → PASS（5 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/host/handlers.ts tests/host/handlers.test.ts
git commit -m "feat: 请求处理层（纯函数，可单测）"
```

---

## Task 5: 把 handlers 接进 DSH 路由 + 工作台外壳

**Files:**
- Modify: `src/host/plugin.ts`、`src/ui/client.tsx`
- Create: `src/ui/api.ts`、`src/ui/App.tsx`、`src/ui/views/NodeEditor.tsx`
- Test: 无新增单测（由 Task 0 已验证适配层；本任务的手工步骤是验收）

**Interfaces:**
- Consumes: `createHandlers`（Task 4）
- Produces: 前缀路由 `/novel/*` → `handlers`；`<App />` 工作台外壳

- [ ] **Step 1: 改适配层：把 `/novel/*` 全部转给 handlers**

```ts
// src/host/plugin.ts
import { createHandlers, type NovelReq } from './handlers';

export interface PluginConfig { dataRoot: string }

export function apply(ctx: any, config: PluginConfig): void {
  const dataRoot = config?.dataRoot?.trim() || `${process.cwd()}\\data`;
  const handle = createHandlers(dataRoot);
  const web = ctx.webServer;
  if (!web?.register) {
    ctx.logger?.warn?.('[novel] webServer 不可用，工作台未挂载');
    return;
  }

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

      const novelReq: NovelReq = { method: req.method ?? 'GET', path, query, body };
      const out = await handle(novelReq);
      res.writeHead(out.status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(out.json === undefined ? '' : JSON.stringify(out.json));
    }
  }));
}
```

- [ ] **Step 2: 客户端 API 封装**

```ts
// src/ui/api.ts
export async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/novel${path}`, { headers: { 'content-type': 'application/json' }, ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((body as any).error ?? res.statusText);
  return body as T;
}

export const listWorlds = () => j<string[]>('/worlds');
export const listNodes = (w: string) => j<any[]>(`/worlds/${encodeURIComponent(w)}/nodes`);
export const readNode = (w: string, id: string) => j<any>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}`);
export const saveNode = (w: string, n: any) =>
  j<any>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(n.id)}`, { method: 'PUT', body: JSON.stringify(n) });
export const stats = (w: string) => j<any>(`/worlds/${encodeURIComponent(w)}/stats`);
```

- [ ] **Step 3: 条目编辑器**

```tsx
// src/ui/views/NodeEditor.tsx
import { useState } from 'react';
import { saveNode } from '../api';

export function NodeEditor({ worldId, node, onSaved }: { worldId: string; node: any; onSaved: () => void }) {
  const [title, setTitle] = useState(node.title ?? '');
  const [body, setBody] = useState(node.body ?? '');
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    try {
      setErr(null);
      await saveNode(worldId, { ...node, title, body });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)}
        style={{ fontSize: 22, width: '100%', border: 'none', borderBottom: '1px solid #ddd', outline: 'none', background: 'transparent' }} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16}
        style={{ width: '100%', marginTop: 12, fontSize: 15, lineHeight: 1.7, border: '1px solid #eee', padding: 12 }} />
      <div style={{ marginTop: 12 }}>
        <button onClick={save}>保存</button>
        {err && <span style={{ color: '#c00', marginLeft: 12 }}>{err}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 工作台外壳**

```tsx
// src/ui/App.tsx
import { useEffect, useState } from 'react';
import { listNodes, readNode } from './api';
import { NodeEditor } from './views/NodeEditor';

export function App({ worldId }: { worldId: string }) {
  const [nodes, setNodes] = useState<any[]>([]);
  const [current, setCurrent] = useState<any | null>(null);

  const refresh = () => listNodes(worldId).then(setNodes).catch(() => setNodes([]));
  useEffect(() => { void refresh(); }, [worldId]);

  const create = () => setCurrent({ id: `E-${Date.now()}`, kind: 'entry', title: '新条目', strength: 'soft', body: '' });

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'system-ui' }}>
      <aside style={{ width: 240, borderRight: '1px solid #eee', padding: 12, overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 12px' }}>{worldId}</h3>
        <button onClick={create} style={{ width: '100%', marginBottom: 12 }}>＋ 新建条目</button>
        {nodes.map((n) => (
          <div key={n.id} onClick={() => readNode(worldId, n.id).then(setCurrent)}
            style={{ padding: '6px 4px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }}>
            {n.title}
          </div>
        ))}
      </aside>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {current
          ? <NodeEditor worldId={worldId} node={current} onSaved={() => { void refresh(); }} />
          : <p style={{ padding: 24, color: '#888' }}>从左侧选一个条目，或新建一个。</p>}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Client 入口换成 App**

```tsx
// src/ui/client.tsx
import { useEffect, useState } from 'react';
import { listWorlds } from './api';
import { App } from './App';

let open = false;
const listeners = new Set<(v: boolean) => void>();
function toggleWorkbench(next?: boolean) {
  open = next ?? !open;
  for (const l of listeners) l(open);
}

function Launcher() {
  const [visible, setVisible] = useState(open);
  const [worlds, setWorlds] = useState<string[]>([]);
  const [world, setWorld] = useState<string | null>(null);

  useEffect(() => {
    const fn = (v: boolean) => setVisible(v);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  useEffect(() => {
    if (!visible) return;
    listWorlds().then((w) => { setWorlds(w); setWorld((prev) => prev ?? w[0] ?? null); }).catch(() => setWorlds([]));
  }, [visible]);

  return (
    <>
      <button onClick={() => toggleWorkbench()} style={{
        position: 'absolute', right: 16, bottom: 16, zIndex: 40, padding: '8px 14px',
        borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer'
      }}>工作台</button>
      {visible && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 39, background: '#fff', display: 'flex', flexDirection: 'column' }}>
          <header style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #eee' }}>
            <b>小说工作台</b>
            <select value={world ?? ''} onChange={(e) => setWorld(e.target.value || null)}>
              {worlds.length === 0 && <option value="">（还没有世界）</option>}
              {worlds.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <span style={{ flex: 1 }} />
            <button onClick={() => toggleWorkbench(false)}>关闭</button>
          </header>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {world ? <App worldId={world} /> : <p style={{ padding: 24, color: '#888' }}>在 data 目录下建一个世界，或等待后续版本提供引导。</p>}
          </div>
        </div>
      )}
    </>
  );
}

export function apply(ctx: any) {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'novel-workbench', order: 20 },
    Launcher
  ));
}
```

- [ ] **Step 6: 构建、安装、手工验证**

Run: `npm run build`
然后重新安装 bundle（`plugin_manager` 以本目录为 target；替换已安装包需重启 DSH），刷新页面：

1. 点「工作台」→ 全屏面板打开
2. 下拉框能列出 `data/worlds/` 下的世界
3. 新建条目 → 写正文 → 保存 → 左侧出现 → 刷新仍在
4. 用编辑器打开 `data/worlds/<世界>/nodes/<标题>.md`，确认 front matter + 正文可读

- [ ] **Step 7: 提交**

```bash
git add src/host/plugin.ts src/ui
git commit -m "feat: /novel 路由接入与工作台外壳（列表/编辑/保存）"
```

---

# M1 · 引用（能写片段、能反查）

## Task 6: `[[双链]]` 解析与标题解析

**Files:**
- Create: `src/engine/wikiLink.ts`
- Test: `tests/engine/wikiLink.test.ts`

**Interfaces:**
- Produces: `parseWikiLinks(text): string[]`、`resolveTargets(nodes, targets): { resolved: Map<string, string>; missing: string[] }`

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/wikiLink.test.ts
import { describe, it, expect } from 'vitest';
import { parseWikiLinks, resolveTargets } from '../../src/engine/wikiLink';
import type { WorldNode } from '../../src/engine/types';

const mk = (id: string, title: string, aliases: string[] = []): WorldNode => ({
  id, kind: 'entry', subtype: null, title, aliases, strength: 'soft',
  span: { from: null, to: null }, proposition: null, cost: [], derives: [], manifests: [],
  requires: [], conflictsWith: [], sameAs: [], violations: [], body: '', file: ''
});

describe('wikiLink', () => {
  it('抽出双链目标并去重', () => {
    expect(parseWikiLinks('他把[[欠名录]]又添了三个名字。[[玄帝]]那年。[[欠名录]]'))
      .toEqual(['欠名录', '玄帝']);
  });
  it('忽略未闭合的方括号', () => {
    expect(parseWikiLinks('这是[[没闭合，还有[[好的一对]]')).toEqual(['好的一对']);
  });
  it('按标题与别名解析到 id，缺的单独列出', () => {
    const r = resolveTargets([mk('E-1', '还脉礼', ['还脉']), mk('E-2', '玄帝')], ['还脉', '玄帝', '不存在']);
    expect(r.resolved.get('还脉')).toBe('E-1');
    expect(r.missing).toEqual(['不存在']);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/wikiLink.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/wikiLink.ts
import type { WorldNode } from './types';

const LINK = /\[\[([^\[\]]+?)\]\]/g;

export function parseWikiLinks(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(LINK)) {
    const t = (m[1] ?? '').trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function resolveTargets(nodes: WorldNode[], targets: string[]) {
  const index = new Map<string, string>();
  for (const n of nodes) {
    index.set(n.title, n.id);
    for (const a of n.aliases) if (!index.has(a)) index.set(a, n.id);
  }
  const resolved = new Map<string, string>();
  const missing: string[] = [];
  for (const t of targets) {
    const id = index.get(t);
    if (id) resolved.set(t, id); else missing.push(t);
  }
  return { resolved, missing };
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/wikiLink.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/engine/wikiLink.ts tests/engine/wikiLink.test.ts
git commit -m "feat: [[双链]] 解析与标题解析"
```

---

## Task 7: 建图（别名索引、入边、孤儿、cites）

**Files:**
- Create: `src/engine/graph.ts`
- Test: `tests/engine/graph.test.ts`

**Interfaces:**
- Consumes: `WorldNode`、`Fragment`、`parseWikiLinks` / `resolveTargets`
- Produces:
  - `type EdgeType = 'derives' | 'manifests' | 'requires' | 'cites' | 'conflicts' | 'same_as'`
  - `interface Graph { nodes; aliasIndex; inbound; outbound; missingLinks }`
  - `buildGraph(nodes, fragments): Graph`

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/graph.test.ts
import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import type { WorldNode } from '../../src/engine/types';
import type { Fragment } from '../../src/host/store';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], body: '', file: `nodes/${p.title}.md`, ...p
});
const frag = (id: string, text: string): Fragment => ({ id, chapter: 1, scene: 1, text, file: `fragments/${id}.md` });

describe('graph', () => {
  it('derives 同时记出入边', () => {
    const g = buildGraph([
      mk({ id: 'W-AX-002', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'] }),
      mk({ id: 'E-1', title: '法师无法世袭', derives: ['W-AX-002'] })
    ], []);
    expect(g.outbound.get('E-1')).toContainEqual({ type: 'derives', from: 'E-1', to: 'W-AX-002' });
    expect(g.inbound.get('W-AX-002')).toContainEqual({ type: 'derives', from: 'E-1', to: 'W-AX-002' });
  });

  it('正文双链变成 cites 入边', () => {
    const g = buildGraph([mk({ id: 'E-1', title: '欠名录' })], [frag('第03章-02', '袖口的[[欠名录]]又多了三个名字')]);
    expect(g.inbound.get('E-1')).toContainEqual({ type: 'cites', from: 'fragments/第03章-02.md', to: 'E-1' });
  });

  it('别名进索引，未解析的双链进 missingLinks', () => {
    const g = buildGraph([mk({ id: 'E-1', title: '还脉礼', aliases: ['还脉'] })], [frag('f1', '[[还脉]]与[[不存在的词]]')]);
    expect(g.aliasIndex.get('还脉')).toEqual(['E-1']);
    expect(g.missingLinks).toContain('不存在的词');
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/graph.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/graph.ts
import type { WorldNode } from './types';
import type { Fragment } from '../host/store';
import { parseWikiLinks, resolveTargets } from './wikiLink';

export type EdgeType = 'derives' | 'manifests' | 'requires' | 'cites' | 'conflicts' | 'same_as';
export interface Edge { type: EdgeType; from: string; to: string }
export interface Graph {
  nodes: Map<string, WorldNode>;
  aliasIndex: Map<string, string[]>;
  inbound: Map<string, Edge[]>;
  outbound: Map<string, Edge[]>;
  missingLinks: string[];
}

function push(m: Map<string, Edge[]>, k: string, e: Edge) {
  const list = m.get(k);
  if (list) list.push(e); else m.set(k, [e]);
}

export function buildGraph(nodes: WorldNode[], fragments: Fragment[]): Graph {
  const g: Graph = {
    nodes: new Map(), aliasIndex: new Map(), inbound: new Map(), outbound: new Map(), missingLinks: []
  };
  for (const n of nodes) {
    g.nodes.set(n.id, n);
    for (const name of [n.title, ...n.aliases]) {
      const list = g.aliasIndex.get(name) ?? [];
      if (!list.includes(n.id)) list.push(n.id);
      g.aliasIndex.set(name, list);
    }
  }

  const add = (type: EdgeType, from: string, to: string) => {
    push(g.outbound, from, { type, from, to });
    push(g.inbound, to, { type, from, to });
  };

  for (const n of nodes) {
    for (const to of n.derives) add('derives', n.id, to);
    for (const to of n.manifests) add('manifests', n.id, to);
    for (const to of n.requires) add('requires', n.id, to);
    for (const to of n.conflictsWith) add('conflicts', n.id, to);
    for (const to of n.sameAs) add('same_as', n.id, to);
  }

  const targets = new Set<string>();
  for (const f of fragments) for (const t of parseWikiLinks(f.text)) targets.add(t);
  const { resolved, missing } = resolveTargets(nodes, [...targets]);
  for (const f of fragments) {
    for (const t of parseWikiLinks(f.text)) {
      const id = resolved.get(t);
      if (id) add('cites', f.file, id);
    }
  }
  g.missingLinks = missing;
  return g;
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/graph.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/engine/graph.ts tests/engine/graph.test.ts
git commit -m "feat: 断言图构建（别名索引/入边/cites）"
```

---

## Task 8: 片段路由与未定义专名

**Files:**
- Modify: `src/host/handlers.ts`
- Test: `tests/host/handlers-refs.test.ts`

**Interfaces:**
- Produces:
  - `GET /worlds/:w/fragments` → `Fragment[]`
  - `PUT /worlds/:w/fragments/:id`（body `{chapter, scene, text}`）
  - `GET /worlds/:w/graph/missing` → `{ missing: string[] }`

- [ ] **Step 1: 写失败测试**

```ts
// tests/host/handlers-refs.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers';

const CONFIG = `id: 记忆之世
title: 记忆之世
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: 母题
`;

let h: ReturnType<typeof createHandlers>;
beforeAll(async () => {
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-r-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-1', query: {},
    body: { id: 'E-1', kind: 'entry', title: '欠名录', strength: 'soft', body: '袖口' } });
});

describe('片段与未定义专名', () => {
  it('写片段后可列出', async () => {
    const r = await h({ method: 'PUT', path: '/worlds/记忆之世/fragments/第03章-02', query: {},
      body: { chapter: 3, scene: 2, text: '袖口的[[欠名录]]' } });
    expect(r.status).toBe(200);
    const list = await h({ method: 'GET', path: '/worlds/记忆之世/fragments', query: {}, body: null });
    expect((list.json as any[])[0].text).toContain('欠名录');
  });

  it('未定义专名被列出', async () => {
    await h({ method: 'PUT', path: '/worlds/记忆之世/fragments/f2', query: {},
      body: { chapter: 4, scene: 1, text: '[[玄帝]]断三脉' } });
    const r = await h({ method: 'GET', path: '/worlds/记忆之世/graph/missing', query: {}, body: null });
    expect((r.json as any).missing).toContain('玄帝');
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/host/handlers-refs.test.ts` → FAIL

- [ ] **Step 3: 实现（在 handlers 中加分支）**

```ts
      if (parts[2] === 'fragments' && parts.length === 3 && req.method === 'GET')
        return { status: 200, json: await store.listFragments(root, worldId) };

      if (parts[2] === 'fragments' && parts.length === 4 && req.method === 'PUT') {
        const id = decodeURIComponent(parts[3]!);
        const b = (req.body ?? {}) as any;
        await store.writeFragment(root, worldId, {
          id, chapter: b.chapter ?? null, scene: b.scene ?? null, text: String(b.text ?? '')
        });
        return { status: 200, json: { ok: true } };
      }

      if (parts[2] === 'graph' && parts[3] === 'missing' && req.method === 'GET') {
        const g = buildGraph(await store.listNodes(root, worldId), await store.listFragments(root, worldId));
        return { status: 200, json: { missing: g.missingLinks } };
      }
```

顶部补 import：

```ts
import { buildGraph } from '../engine/graph';
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/host/handlers-refs.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/host/handlers.ts tests/host/handlers-refs.test.ts
git commit -m "feat: 片段路由与未定义专名接口"
```

---

## Task 9: 引用反查、删除保护、以及界面提示

**Files:**
- Modify: `src/host/handlers.ts`、`src/ui/App.tsx`、`src/ui/views/NodeEditor.tsx`、`src/ui/api.ts`
- Test: `tests/host/handlers-citations.test.ts`

**Interfaces:**
- Produces:
  - `GET /worlds/:w/nodes/:id/citations` → `{ fragments: string[]; nodes: {id,title,via}[] }`
  - `DELETE` 在有入边时返回 `409` + `{ error, refs }`

- [ ] **Step 1: 写失败测试**

```ts
// tests/host/handlers-citations.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers';

const CONFIG = `id: 记忆之世
title: 记忆之世
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: 母题
`;

let h: ReturnType<typeof createHandlers>;
beforeAll(async () => {
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-c-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-1', query: {},
    body: { id: 'E-1', kind: 'entry', title: '欠名录', strength: 'soft', body: '袖口' } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/fragments/第03章-02', query: {},
    body: { chapter: 3, scene: 2, text: '袖口的[[欠名录]]' } });
});

describe('引用与删除保护', () => {
  it('能查到片段引用', async () => {
    const r = await h({ method: 'GET', path: '/worlds/记忆之世/nodes/E-1/citations', query: {}, body: null });
    expect((r.json as any).fragments).toContain('第03章-02');
  });

  it('被引用时删除返回 409 并列出引用处', async () => {
    const r = await h({ method: 'DELETE', path: '/worlds/记忆之世/nodes/E-1', query: {}, body: null });
    expect(r.status).toBe(409);
    expect((r.json as any).refs.fragments).toContain('第03章-02');
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/host/handlers-citations.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
      if (parts[2] === 'nodes' && parts.length === 5 && parts[4] === 'citations') {
        const nodeId = decodeURIComponent(parts[3]!);
        const g = buildGraph(await store.listNodes(root, worldId), await store.listFragments(root, worldId));
        const edges = g.inbound.get(nodeId) ?? [];
        return { status: 200, json: {
          fragments: edges.filter((e) => e.type === 'cites')
            .map((e) => e.from.replace(/^fragments\//, '').replace(/\.md$/, '')),
          nodes: edges.filter((e) => e.type !== 'cites')
            .map((e) => ({ id: e.from, title: g.nodes.get(e.from)?.title ?? e.from, via: e.type }))
        } };
      }
```

并把 `DELETE` 分支改为：

```ts
        if (req.method === 'DELETE') {
          const g = buildGraph(await store.listNodes(root, worldId), await store.listFragments(root, worldId));
          const refs = g.inbound.get(nodeId) ?? [];
          if (refs.length > 0) {
            return { status: 409, json: {
              error: `被 ${refs.length} 处引用，删除会断链`,
              refs: {
                fragments: refs.filter((e) => e.type === 'cites')
                  .map((e) => e.from.replace(/^fragments\//, '').replace(/\.md$/, '')),
                nodes: refs.filter((e) => e.type !== 'cites')
                  .map((e) => ({ id: e.from, title: g.nodes.get(e.from)?.title ?? e.from, via: e.type }))
              }
            } };
          }
          await store.deleteNode(root, worldId, nodeId);
          return { status: 204 };
        }
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/host/handlers-citations.test.ts` → PASS

- [ ] **Step 5: 界面提示**

`src/ui/api.ts` 追加：

```ts
export const citations = (w: string, id: string) =>
  j<any>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}/citations`);
export const missingLinks = (w: string) => j<{ missing: string[] }>(`/worlds/${encodeURIComponent(w)}/graph/missing`);
```

`NodeEditor` 底部加反查区：

```tsx
  const [refs, setRefs] = useState<any | null>(null);
  useEffect(() => {
    citations(worldId, node.id).then(setRefs).catch(() => setRefs(null));
  }, [worldId, node.id]);
```
```tsx
      {refs && (
        <div style={{ marginTop: 24, fontSize: 13, color: '#666' }}>
          <div>被片段引用：{refs.fragments.length ? refs.fragments.join('、') : '无'}</div>
          <div>被条目引用：{refs.nodes.length ? refs.nodes.map((r: any) => `${r.title}(${r.via})`).join('、') : '无'}</div>
        </div>
      )}
```

`App` 侧栏底部显示未定义专名：

```tsx
  const [missing, setMissing] = useState<string[]>([]);
  useEffect(() => { missingLinks(worldId).then((r) => setMissing(r.missing)).catch(() => setMissing([])); }, [worldId, nodes]);
```
```tsx
        {missing.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 12, color: '#a60' }}>未定义专名：{missing.join('、')}</div>
        )}
```

- [ ] **Step 6: 手工验证**

`npm run build` → 重装 → 在 `data/worlds/<世界>/fragments/` 写一段含 `[[欠名录]]` 的片段 → 打开「欠名录」→ 底部显示被引用片段；断网外的正常路径下点删除应被 409 拦住（界面暂无删除按钮时，用 `curl` 或 `fetch` 验证接口即可）。

- [ ] **Step 7: 提交**

```bash
git add src/host/handlers.ts src/ui tests/host/handlers-citations.test.ts
git commit -m "feat: 引用反查、删除保护与界面提示"
```

---

# M2 · 校验（第一次有体检）

## Task 10: 校验框架与内容规则 R4/R5/R10/R11/R12

**Files:**
- Create: `src/engine/rules/index.ts`、`src/engine/rules/content.ts`
- Test: `tests/engine/rules.test.ts`

**Interfaces:**
- Produces:
  - `interface RuleContext { nodes: WorldNode[]; graph: Graph }`
  - `type Rule = (ctx: RuleContext) => Finding[]`
  - `runRules(ctx): Finding[]`（按 error→warn→info 排序）

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/rules.test.ts
import { describe, it, expect } from 'vitest';
import { runRules } from '../../src/engine/rules';
import { buildGraph } from '../../src/engine/graph';
import type { WorldNode } from '../../src/engine/types';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], body: '这是一段足够长的正文，用来避免 R10 触发。', file: `nodes/${p.title}.md`, ...p
});
const run = (nodes: WorldNode[]) => runRules({ nodes, graph: buildGraph(nodes, []) });

describe('内容规则', () => {
  it('R4：无 derives 也无 requires 报 warn', () => {
    const f = run([mk({ id: 'E-1', title: '无根条目' })]);
    expect(f.find((x) => x.rule === 'R4')?.severity).toBe('warn');
  });
  it('R5：从未被引用报 info', () => {
    const f = run([mk({ id: 'E-1', title: '未被引用', derives: ['W-AX-1'] })]);
    expect(f.find((x) => x.rule === 'R5')?.severity).toBe('info');
  });
  it('R10：正文过短且无表现报 warn', () => {
    const f = run([mk({ id: 'E-1', title: '空壳', derives: ['W-AX-1'], body: '短' })]);
    expect(f.some((x) => x.rule === 'R10')).toBe(true);
  });
  it('R11：公理少于 3 条报 info', () => {
    const f = run([mk({ id: 'W-AX-1', title: '唯一公理', kind: 'axiom', strength: 'hard', cost: ['记忆'] })]);
    expect(f.find((x) => x.rule === 'R11')?.severity).toBe('info');
  });
  it('R12：公理表现少于 2 个报 warn', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['记忆'], manifests: ['E-1'] }),
      mk({ id: 'E-1', title: '表现一', derives: ['W-AX-1'] }),
      mk({ id: 'W-AX-2', title: '公理乙', kind: 'axiom', strength: 'hard', cost: ['身份'] }),
      mk({ id: 'W-AX-3', title: '公理丙', kind: 'axiom', strength: 'hard', cost: ['亲情'] })
    ];
    expect(run(nodes).find((x) => x.rule === 'R12')?.nodeIds).toEqual(['W-AX-2', 'W-AX-3']);
  });
  it('结果按 error → warn → info 排序', () => {
    const order = run([mk({ id: 'E-1', title: '无根' })]).map((x) => x.severity);
    const rank = (s: string) => ['error', 'warn', 'info'].indexOf(s);
    expect(order).toEqual([...order].sort((a, b) => rank(a) - rank(b)));
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/rules.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/rules/content.ts
import type { Finding, WorldNode } from '../types';
import type { Graph } from '../graph';

export interface RuleContext { nodes: WorldNode[]; graph: Graph }
export type Rule = (ctx: RuleContext) => Finding[];

const refs = (g: Graph, id: string) => g.inbound.get(id) ?? [];

export const R4: Rule = ({ nodes }) =>
  nodes.filter((n) => n.kind === 'entry' && n.derives.length === 0 && n.requires.length === 0)
    .map((n) => ({
      rule: 'R4', severity: 'warn', nodeIds: [n.id],
      message: `「${n.title}」没有公理支撑，也没有被任何主体需要`,
      hint: '它从哪条公理长出来的？指定一条，或标记为设定装饰',
      actions: ['指定公理', '标记为设定装饰']
    }));

export const R5: Rule = ({ nodes, graph }) =>
  nodes.filter((n) => refs(graph, n.id).every((e) => e.type !== 'cites'))
    .map((n) => ({
      rule: 'R5', severity: 'info', nodeIds: [n.id],
      message: `「${n.title}」从未进入正文`, hint: '要么用，要么删'
    }));

export const R10: Rule = ({ nodes }) =>
  nodes.filter((n) => n.body.trim().length < 20 && n.manifests.length === 0)
    .map((n) => ({
      rule: 'R10', severity: 'warn', nodeIds: [n.id],
      message: `「${n.title}」只有标题`, hint: '补两句，或删'
    }));

export const R11: Rule = ({ nodes }) => {
  const axioms = nodes.filter((n) => n.kind === 'axiom');
  if (axioms.length >= 3) return [];
  return [{
    rule: 'R11', severity: 'info', nodeIds: axioms.map((a) => a.id),
    message: `公理只有 ${axioms.length} 条，世界还不成立`, hint: '至少要 3 条'
  }];
};

export const R12: Rule = ({ nodes }) =>
  nodes.filter((n) => n.kind === 'axiom' && n.manifests.length < 2)
    .map((n) => ({
      rule: 'R12', severity: 'warn', nodeIds: [n.id],
      message: `公理「${n.title}」只有 ${n.manifests.length} 个可感知表现（铁律二要求 ≥2）`,
      hint: '读者看不见这条公理', actions: ['给我三个表现候选']
    }));

export const contentRules: Rule[] = [R4, R5, R10, R11, R12];
```

```ts
// src/engine/rules/index.ts
import { SEVERITY_ORDER, type Finding } from '../types';
import type { Rule, RuleContext } from './content';
import { contentRules } from './content';

const all: Rule[] = [...contentRules];

export function runRules(ctx: RuleContext): Finding[] {
  return all.flatMap((r) => r(ctx))
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

export type { Rule, RuleContext };
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/rules.test.ts` → PASS（6 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/engine/rules tests/engine/rules.test.ts
git commit -m "feat: 校验框架与内容规则 R4/R5/R10/R11/R12"
```

---

## Task 11: 结构规则 R6/R7/R8

**Files:**
- Create: `src/engine/rules/structural.ts`
- Modify: `src/engine/rules/index.ts`
- Test: `tests/engine/rules-structural.test.ts`

**Interfaces:**
- Produces: `structuralRules: Rule[]`（R6 别名冲突 / R7 派生链断裂 / R8 疑似未合并）

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/rules-structural.test.ts
import { describe, it, expect } from 'vitest';
import { runRules } from '../../src/engine/rules';
import { buildGraph } from '../../src/engine/graph';
import type { WorldNode } from '../../src/engine/types';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], body: '这是一段足够长的正文内容，避免触发 R10。', file: '', ...p
});
const run = (nodes: WorldNode[]) => runRules({ nodes, graph: buildGraph(nodes, []) });

describe('结构规则', () => {
  it('R7：条目 span 超出公理 span 报 error', () => {
    const f = run([
      mk({ id: 'W-AX-1', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'], span: { from: -1200, to: 700 } }),
      mk({ id: 'E-1', title: '脉正', derives: ['W-AX-1'], span: { from: 412, to: 720 } })
    ]).find((x) => x.rule === 'R7');
    expect(f?.severity).toBe('error');
    expect(f?.nodeIds).toEqual(['E-1']);
  });
  it('R7：span 被完全覆盖时不报', () => {
    const f = run([
      mk({ id: 'W-AX-1', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'], span: { from: -1200, to: null } }),
      mk({ id: 'E-1', title: '脉正', derives: ['W-AX-1'], span: { from: 412, to: 720 } })
    ]);
    expect(f.some((x) => x.rule === 'R7')).toBe(false);
  });
  it('R6：别名指向两个节点且 span 重叠报 error', () => {
    const f = run([
      mk({ id: 'E-1', title: '玄帝', aliases: ['玄天大帝'], span: { from: 300, to: null } }),
      mk({ id: 'E-2', title: '玄天大帝', aliases: ['玄帝'], span: { from: 500, to: null } })
    ]).find((x) => x.rule === 'R6');
    expect(f?.severity).toBe('error');
    expect(f?.nodeIds.sort()).toEqual(['E-1', 'E-2']);
  });
  it('R8：标题互为别名但没有 same_as 时给建议', () => {
    const f = run([
      mk({ id: 'E-1', title: '玄帝', aliases: ['玄天大帝'] }),
      mk({ id: 'E-2', title: '玄天大帝' })
    ]);
    expect(f.some((x) => x.rule === 'R8')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/rules-structural.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/rules/structural.ts
import type { Finding, Span } from '../types';
import type { Rule } from './content';

const overlaps = (a: Span, b: Span) =>
  (a.from ?? -Infinity) <= (b.to ?? Infinity) && (b.from ?? -Infinity) <= (a.to ?? Infinity);

const covers = (outer: Span, inner: Span) =>
  (inner.from ?? -Infinity) >= (outer.from ?? -Infinity) && (inner.to ?? Infinity) <= (outer.to ?? Infinity);

export const R7: Rule = ({ nodes }) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Finding[] = [];
  for (const n of nodes) {
    for (const axId of n.derives) {
      const ax = byId.get(axId);
      if (ax && ax.kind === 'axiom' && !covers(ax.span, n.span)) {
        out.push({
          rule: 'R7', severity: 'error', nodeIds: [n.id],
          message: `派生链断裂：「${n.title}」的生效区间超出公理「${ax.title}」`,
          hint: '公理已经终止，依赖它的条目却还在',
          actions: ['指定新公理', '截断条目区间', '忽略']
        });
      }
    }
  }
  return out;
};

export const R6: Rule = ({ nodes }) => {
  const byName = new Map<string, string[]>();
  for (const n of nodes) for (const name of [n.title, ...n.aliases]) {
    const list = byName.get(name) ?? [];
    list.push(n.id);
    byName.set(name, list);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const [, ids] of byName) {
    const uniq = [...new Set(ids)];
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
      const a = byId.get(uniq[i]!); const b = byId.get(uniq[j]!);
      if (!a || !b || !overlaps(a.span, b.span)) continue;
      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        rule: 'R6', severity: 'error', nodeIds: [a.id, b.id],
        message: `同一名称在重叠时间内指向两个条目：「${a.title}」与「${b.title}」`,
        hint: '合并，或加时间/地域限定', actions: ['合并为同一实体', '加时间限定']
      });
    }
  }
  return out;
};

export const R8: Rule = ({ nodes }) => {
  const byTitle = new Map(nodes.map((n) => [n.title, n]));
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const n of nodes) for (const alias of n.aliases) {
    const other = byTitle.get(alias);
    if (!other || other.id === n.id) continue;
    if (n.sameAs.includes(other.id) || other.sameAs.includes(n.id)) continue;
    const key = [n.id, other.id].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rule: 'R8', severity: 'warn', nodeIds: [n.id, other.id],
      message: `「${n.title}」把「${other.title}」当成别名，但两者没有合并`,
      hint: '它们是同一个东西吗？', actions: ['建立 same_as', '删除该别名']
    });
  }
  return out;
};

export const structuralRules: Rule[] = [R6, R7, R8];
```

`src/engine/rules/index.ts` 改：

```ts
import { contentRules } from './content';
import { structuralRules } from './structural';
const all: Rule[] = [...contentRules, ...structuralRules];
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/rules-structural.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/engine/rules tests/engine/rules-structural.test.ts
git commit -m "feat: 结构规则 R6/R7/R8"
```

---

## Task 12: 显式冲突规则 R1/R2/R3

**Files:**
- Create: `src/engine/rules/explicit.ts`
- Modify: `src/engine/rules/index.ts`
- Test: `tests/engine/rules-explicit.test.ts`

**说明（写进代码注释）**：P0 不做语义互斥判定，R1/R3 依赖**显式登记的 `conflicts_with` 边**；语义层留给 P1 的 AI 审问。R2 依赖 `firm` 节点的 `violations` 与是否存在后果条目。

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/rules-explicit.test.ts
import { describe, it, expect } from 'vitest';
import { runRules } from '../../src/engine/rules';
import { buildGraph } from '../../src/engine/graph';
import type { WorldNode } from '../../src/engine/types';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], body: '这是一段足够长的正文内容，避免触发 R10。', file: '', ...p
});
const run = (nodes: WorldNode[]) => runRules({ nodes, graph: buildGraph(nodes, []) });

describe('显式冲突规则', () => {
  it('R1：两条 hard 登记互斥报 error 并给三种解法', () => {
    const f = run([
      mk({ id: 'W-AX-1', title: '法则甲', kind: 'axiom', strength: 'hard', cost: ['甲'], conflictsWith: ['W-AX-2'] }),
      mk({ id: 'W-AX-2', title: '法则乙', kind: 'axiom', strength: 'hard', cost: ['乙'] })
    ]).find((x) => x.rule === 'R1');
    expect(f?.severity).toBe('error');
    expect(f?.actions).toHaveLength(3);
  });
  it('R3：myth 与 hard 冲突只给 info，并追问谁在撒谎', () => {
    const f = run([
      mk({ id: 'E-1', title: '玄帝传说', strength: 'myth', conflictsWith: ['W-AX-1'] }),
      mk({ id: 'W-AX-1', title: '法则甲', kind: 'axiom', strength: 'hard', cost: ['甲'] })
    ]).find((x) => x.rule === 'R3');
    expect(f?.severity).toBe('info');
    expect(f?.hint).toMatch(/撒谎/);
  });
  it('R2：firm 记了违反但没有后果条目报 warn', () => {
    const f = run([mk({ id: 'E-1', title: '法师不得为己施法', strength: 'firm', violations: ['有人偷偷做过'] })]);
    expect(f.some((x) => x.rule === 'R2')).toBe(true);
  });
  it('R2：有后果条目时不报', () => {
    const f = run([
      mk({ id: 'E-1', title: '法师不得为己施法', strength: 'firm', violations: ['有人偷偷做过'] }),
      mk({ id: 'E-2', title: '废籍之刑', requires: ['E-1'] })
    ]);
    expect(f.some((x) => x.rule === 'R2')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/rules-explicit.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/rules/explicit.ts
import type { Finding } from '../types';
import type { Rule } from './content';

// P0 的边界：语义互斥需要 AI 判读，这里只认「显式登记的 conflicts_with」。
const edges = (nodes: { id: string; conflictsWith: string[] }[]) => {
  const out: [string, string][] = [];
  for (const n of nodes) for (const to of n.conflictsWith) out.push([n.id, to]);
  return out;
};

export const R1: Rule = ({ nodes }) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const [from, to] of edges(nodes)) {
    const a = byId.get(from); const b = byId.get(to);
    if (!a || !b || a.strength !== 'hard' || b.strength !== 'hard') continue;
    const key = [from, to].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rule: 'R1', severity: 'error', nodeIds: [a.id, b.id],
      message: `两条 hard 法则登记为互斥：「${a.title}」与「${b.title}」`,
      hint: '它们不可能同时成立', actions: ['改 A', '改 B', '限定为不同地区/年代']
    });
  }
  return out;
};

export const R3: Rule = ({ nodes }) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const [from, to] of edges(nodes)) {
    const a = byId.get(from); const b = byId.get(to);
    if (!a || !b) continue;
    const myth = a.strength === 'myth' ? a : b.strength === 'myth' ? b : null;
    const hard = a.strength === 'hard' ? a : b.strength === 'hard' ? b : null;
    if (!myth || !hard) continue;
    const key = [myth.id, hard.id].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rule: 'R3', severity: 'info', nodeIds: [myth.id, hard.id],
      message: `「${myth.title}」与硬法则「${hard.title}」冲突——这是设定好的误会吗？`,
      hint: '谁在撒这个谎，他得到什么？', actions: ['生成认知记录', '标记为民间误传']
    });
  }
  return out;
};

export const R2: Rule = ({ nodes, graph }) => {
  const out: Finding[] = [];
  for (const n of nodes) {
    if (n.strength !== 'firm' || n.violations.length === 0) continue;
    const consequence = (graph.inbound.get(n.id) ?? [])
      .some((e) => e.type === 'requires' || e.type === 'derives');
    if (!consequence) {
      out.push({
        rule: 'R2', severity: 'warn', nodeIds: [n.id],
        message: `「${n.title}」写了有人违反，但没有登记后果`,
        hint: '破规矩要付代价：补一个后果条目，或降级为 soft',
        actions: ['补后果条目', '降级为 soft']
      });
    }
  }
  return out;
};

export const explicitRules: Rule[] = [R1, R2, R3];
```

`rules/index.ts` 改：

```ts
const all: Rule[] = [...contentRules, ...structuralRules, ...explicitRules];
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/rules-explicit.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/engine/rules tests/engine/rules-explicit.test.ts
git commit -m "feat: 显式冲突规则 R1/R2/R3"
```

---

## Task 13: findings 接口、CLI 体检器与诊断清单界面

**Files:**
- Create: `src/host/cli.ts`、`src/ui/views/Findings.tsx`
- Modify: `src/host/handlers.ts`、`src/ui/App.tsx`、`src/ui/api.ts`
- Test: `tests/host/handlers-findings.test.ts`

**Interfaces:**
- Produces: `GET /worlds/:w/findings` → `Finding[]`；`npm run check <worldId>`，有 error 时退出码 1

- [ ] **Step 1: 写失败测试**

```ts
// tests/host/handlers-findings.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers';

const CONFIG = `id: 记忆之世
title: 记忆之世
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: 母题
`;

let h: ReturnType<typeof createHandlers>;
beforeAll(async () => {
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-f-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-1', query: {},
    body: { id: 'E-1', kind: 'entry', title: '无根条目', strength: 'soft', body: '这是一段足够长的正文内容，避免触发 R10。' } });
});

describe('findings', () => {
  it('返回带规则号与严重度的清单', async () => {
    const r = await h({ method: 'GET', path: '/worlds/记忆之世/findings', query: {}, body: null });
    expect(Array.isArray(r.json)).toBe(true);
    expect((r.json as any[]).some((f) => f.rule === 'R4')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/host/handlers-findings.test.ts` → FAIL

- [ ] **Step 3: 实现接口与 CLI**

```ts
      if (parts[2] === 'findings' && req.method === 'GET') {
        const nodes = await store.listNodes(root, worldId);
        const g = buildGraph(nodes, await store.listFragments(root, worldId));
        return { status: 200, json: runRules({ nodes, graph: g }) };
      }
```
```ts
import { runRules } from '../engine/rules';
```

```ts
// src/host/cli.ts
import { runRules } from '../engine/rules';
import { buildGraph } from '../engine/graph';
import * as store from './store';

const ICON = { error: '🔴', warn: '🟡', info: '⚪' } as const;

async function main() {
  const root = process.env['NOVEL_DATA_ROOT']?.trim() || `${process.cwd()}\\data`;
  const worldId = process.argv[2] ?? (await store.listWorlds(root))[0];
  if (!worldId) { console.error('没有可检查的世界：data/worlds/ 为空'); process.exit(2); }

  const nodes = await store.listNodes(root, worldId);
  const fragments = await store.listFragments(root, worldId);
  const findings = runRules({ nodes, graph: buildGraph(nodes, fragments) });

  console.log(`\n${worldId} · 体检`);
  console.log(`  节点 ${nodes.length} · 片段 ${fragments.length} · 问题 ${findings.length}\n`);
  for (const f of findings) {
    console.log(`${ICON[f.severity]} ${f.rule}  ${f.message}`);
    if (f.hint) console.log(`     ${f.hint}`);
  }
  process.exit(findings.some((f) => f.severity === 'error') ? 1 : 0);
}

void main();
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- tests/host/handlers-findings.test.ts` → PASS
Run: `npx tsx src/host/cli.ts 记忆之世` → 打印按严重度分组的清单

- [ ] **Step 5: 诊断清单界面**

```tsx
// src/ui/views/Findings.tsx
import { useEffect, useState } from 'react';
import { j } from '../api';

const ICON: Record<string, string> = { error: '🔴', warn: '🟡', info: '⚪' };

export function Findings({ worldId, onOpen }: { worldId: string; onOpen: (id: string) => void }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    j<any[]>(`/worlds/${encodeURIComponent(worldId)}/findings`).then(setList).catch(() => setList([]));
  }, [worldId]);

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <h2 style={{ marginTop: 0 }}>诊断清单 · {list.length}</h2>
      {list.length === 0 && <p style={{ color: '#888' }}>没有发现问题。</p>}
      {list.map((f, i) => (
        <div key={i} style={{ borderBottom: '1px solid #f0f0f0', padding: '10px 0' }}>
          <div><b>{ICON[f.severity]}</b> <code style={{ color: '#666' }}>{f.rule}</code> {f.message}</div>
          {f.hint && <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>{f.hint}</div>}
          <div style={{ marginTop: 6 }}>
            {f.nodeIds.map((id: string) => (
              <button key={id} onClick={() => onOpen(id)} style={{ marginRight: 8, fontSize: 12 }}>{id}</button>
            ))}
            {(f.actions ?? []).map((a: string) => (
              <span key={a} style={{ fontSize: 12, color: '#0a7', marginRight: 12 }}>[{a}]</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

`App.tsx` 增加视图切换：

```tsx
  const [view, setView] = useState<'nodes' | 'findings'>('nodes');
```
侧栏顶部加：

```tsx
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={() => setView('nodes')} disabled={view === 'nodes'}>条目</button>
          <button onClick={() => setView('findings')} disabled={view === 'findings'}>诊断</button>
        </div>
```
主区分支：

```tsx
        {view === 'findings'
          ? <Findings worldId={worldId} onOpen={(id) => readNode(worldId, id).then(setCurrent)} />
          : (current ? <NodeEditor ... /> : <p ...>…</p>)}
```

- [ ] **Step 6: 手工验证**

`npm run build` → 重装 → 打开工作台 → 点「诊断」→ 见到 R4/R5/R11；点条目按钮跳转。
`npx tsx src/host/cli.ts` → 终端输出同一份清单。

- [ ] **Step 7: 提交**

```bash
git add src/host src/ui tests/host/handlers-findings.test.ts
git commit -m "feat: findings 接口、CLI 体检器与诊断清单界面"
```

---

## Task 14: 时间切片 `stateAt` 与时间轴

**Files:**
- Create: `src/engine/query.ts`、`src/ui/views/Timeline.tsx`
- Modify: `src/host/handlers.ts`、`src/ui/App.tsx`
- Test: `tests/engine/query.test.ts`

**Interfaces:**
- Produces: `stateAt(nodes, year): WorldNode[]`、`citationsFor(graph, id)`、`GET /worlds/:w/at?year=612`

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/query.test.ts
import { describe, it, expect } from 'vitest';
import { stateAt } from '../../src/engine/query';
import type { WorldNode } from '../../src/engine/types';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], body: '', file: '', ...p
});

const nodes = [
  mk({ id: 'E-1', title: '脉正', span: { from: 412, to: 720 } }),
  mk({ id: 'E-2', title: '记忆当铺', span: { from: 588, to: null } }),
  mk({ id: 'E-3', title: '禁法运动', span: { from: 572, to: 600 } }),
  mk({ id: 'E-4', title: '还脉礼', span: { from: 300, to: null } })
];

describe('stateAt', () => {
  it('612 年在场的条目', () => {
    expect(stateAt(nodes, 612).map((n) => n.id)).toEqual(['E-1', 'E-2', 'E-4']);
  });
  it('端点包含：600 年是禁法运动最后一年', () => {
    expect(stateAt(nodes, 600).map((n) => n.id)).toContain('E-3');
  });
  it('601 年不再包含', () => {
    expect(stateAt(nodes, 601).map((n) => n.id)).not.toContain('E-3');
  });
  it('from 为 null 表示一直存在', () => {
    expect(stateAt([mk({ id: 'E-9', title: '永恒' })], -5000)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/query.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/query.ts
import type { WorldNode } from './types';
import type { EdgeType, Graph } from './graph';

export function stateAt(nodes: WorldNode[], year: number): WorldNode[] {
  return nodes.filter((n) => {
    const from = n.span.from ?? -Infinity;
    const to = n.span.to ?? Infinity;
    return year >= from && year <= to;
  }).sort((a, b) => a.title.localeCompare(b.title, 'zh'));
}

export function citationsFor(graph: Graph, id: string): { fragments: string[]; nodes: { id: string; via: EdgeType }[] } {
  const edges = graph.inbound.get(id) ?? [];
  return {
    fragments: edges.filter((e) => e.type === 'cites')
      .map((e) => e.from.replace(/^fragments\//, '').replace(/\.md$/, '')),
    nodes: edges.filter((e) => e.type !== 'cites').map((e) => ({ id: e.from, via: e.type }))
  };
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/query.test.ts` → PASS

- [ ] **Step 5: 接口与界面**

```ts
      if (parts[2] === 'at' && req.method === 'GET') {
        const year = Number(req.query['year'] ?? 0);
        const nodes = await store.listNodes(root, worldId);
        return { status: 200, json: {
          year,
          nodes: stateAt(nodes, year).map((n) => ({ id: n.id, title: n.title, strength: n.strength, span: n.span }))
        } };
      }
```
```ts
import { stateAt } from '../engine/query';
```

```tsx
// src/ui/views/Timeline.tsx
import { useEffect, useState } from 'react';
import { j } from '../api';

export function Timeline({ worldId, onOpen }: { worldId: string; onOpen: (id: string) => void }) {
  const [year, setYear] = useState(612);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    j<any>(`/worlds/${encodeURIComponent(worldId)}/at?year=${year}`)
      .then((r) => setRows(r.nodes)).catch(() => setRows([]));
  }, [worldId, year]);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ marginTop: 0 }}>时间轴</h2>
      <div style={{ marginBottom: 16 }}>
        <input type="range" min={0} max={800} value={year}
          onChange={(e) => setYear(Number(e.target.value))} style={{ width: 480 }} />
        <span style={{ marginLeft: 12 }}>纪元 {year} 年</span>
      </div>
      {rows.map((n) => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
          <span style={{ width: 320 }}>{n.title}</span>
          <span style={{ color: '#aaa', fontSize: 12 }}>{n.span.from ?? '—'} → {n.span.to ?? '至今'}</span>
          <button style={{ fontSize: 12 }} onClick={() => onOpen(n.id)}>打开</button>
        </div>
      ))}
    </div>
  );
}
```

`App.tsx` 的 `view` 增加 `'timeline'`，侧栏加一个「时间轴」按钮。

- [ ] **Step 6: 手工验证**

`npm run build` → 重装 → 打开「时间轴」→ 拖到 612 只剩该年在场的条目；拖到 601，「禁法运动」消失。

- [ ] **Step 7: 提交**

```bash
git add src/engine/query.ts src/host/handlers.ts src/ui tests/engine/query.test.ts
git commit -m "feat: 时间切片 stateAt 与时间轴界面"
```

---

# M3 · 收口（能完整跑验收）

## Task 15: 三步开局引导与公理代价强制

**Files:**
- Create: `src/ui/views/Onboarding.tsx`
- Modify: `src/ui/App.tsx`
- Test: 无新增单测（代价强制已在 Task 4 覆盖；本任务验证界面行为）

**Interfaces:**
- Consumes: `stats(worldId)`、`saveNode`
- Produces: 当 `axioms < 3` 时首屏显示三步引导

- [ ] **Step 1: 实现引导界面**

```tsx
// src/ui/views/Onboarding.tsx
import { useState } from 'react';
import { saveNode } from '../api';

export function Onboarding({ worldId, stats, onDone }: { worldId: string; stats: any; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const addAxiom = async () => {
    if (!title.trim() || !cost.trim()) return;
    try {
      setErr(null);
      await saveNode(worldId, {
        id: `W-AX-${Date.now()}`, kind: 'axiom', title, strength: 'hard',
        cost: cost.split(/[、,]/).map((s) => s.trim()).filter(Boolean)
      });
      setTitle(''); setCost('');
      onDone();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div style={{ padding: 32, maxWidth: 680 }}>
      <h2 style={{ marginTop: 0 }}>开始一个世界</h2>
      <p style={{ color: '#666' }}>① 这个世界最根本的缺失是什么？（写在 world.yaml 的 theme.wound）</p>
      <p style={{ color: '#666' }}>② 至少三条公理，每条必须付出代价。当前 {stats?.axioms ?? 0} / 3</p>
      <input placeholder="公理，例如：施法会永久烧毁施法者的记忆" value={title}
        onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} />
      <input placeholder="代价，用顿号分隔，例如：记忆、身份" value={cost}
        onChange={(e) => setCost(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 8 }} />
      <button onClick={addAxiom} style={{ marginTop: 8 }}>加一条公理</button>
      {err && <div style={{ color: '#c00', marginTop: 8 }}>{err}</div>}
      <p style={{ color: '#666', marginTop: 20 }}>
        ③ 每条公理至少两个“能看见的东西”。已达标 {stats?.manifestedAxioms ?? 0} / {stats?.axioms ?? 0}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 接进 App**

```tsx
  const [stat, setStat] = useState<any>(null);
  const reloadStats = () => stats(worldId).then(setStat).catch(() => setStat(null));
  useEffect(() => { void reloadStats(); }, [worldId, view, nodes]);

  if (stat && stat.axioms < 3) {
    return <Onboarding worldId={worldId} stats={stat} onDone={() => { void reloadStats(); void refresh(); }} />;
  }
```

- [ ] **Step 3: 手工验证**

`npm run build` → 重装 → 在一个 `axioms < 3` 的世界里：
1. 首屏是三步引导
2. 只填公理不填代价 → 保存被拒，显示「公理必须付出代价（铁律一）」
3. 填上代价 → 计数 0/3 → 1/3
4. 三条之后进入正常界面

- [ ] **Step 4: 提交**

```bash
git add src/ui
git commit -m "feat: 三步开局引导与公理代价强制"
```

---

## Task 16: `index.json` 重建与失效

**Files:**
- Create: `src/host/indexFile.ts`
- Modify: `src/host/handlers.ts`
- Test: `tests/host/indexFile.test.ts`

**Interfaces:**
- Produces: `rebuildIndex(root, worldId)`、`loadIndex(root, worldId)`、`invalidateIndex(root, worldId)`

- [ ] **Step 1: 写失败测试**

```ts
// tests/host/indexFile.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../../src/host/store';
import { rebuildIndex, invalidateIndex } from '../../src/host/indexFile';

let root: string;
const CONFIG = `id: 记忆之世
title: 记忆之世
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: 母题
`;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-idx-'));
  await store.createWorld(root, '记忆之世', CONFIG);
});

describe('index.json', () => {
  it('可重建并统计节点与边', async () => {
    await store.writeNode(root, '记忆之世', {
      id: 'E-1', kind: 'entry', subtype: null, title: '欠名录', aliases: [], strength: 'soft',
      span: { from: null, to: null }, proposition: null, cost: [], derives: ['W-AX-1'],
      manifests: [], requires: [], conflictsWith: [], sameAs: [], violations: [], body: '', file: ''
    });
    const r = await rebuildIndex(root, '记忆之世');
    expect(r.nodeCount).toBe(1);
    expect(r.edgeCount).toBe(1);
    expect((await stat(join(root, 'worlds', '记忆之世', 'index.json'))).isFile()).toBe(true);
  });
  it('失效后文件不存在（派生品可删）', async () => {
    await rebuildIndex(root, '记忆之世');
    await invalidateIndex(root, '记忆之世');
    await expect(stat(join(root, 'worlds', '记忆之世', 'index.json'))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/host/indexFile.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/host/indexFile.ts
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { buildGraph } from '../engine/graph';
import * as store from './store';

const indexPath = (root: string, worldId: string) => join(root, 'worlds', worldId, 'index.json');

export async function rebuildIndex(root: string, worldId: string) {
  const nodes = await store.listNodes(root, worldId);
  const fragments = await store.listFragments(root, worldId);
  const graph = buildGraph(nodes, fragments);
  const edgeCount = [...graph.outbound.values()].reduce((s, e) => s + e.length, 0);
  const payload = {
    builtAt: new Date().toISOString(),
    nodeCount: nodes.length,
    edgeCount,
    nodes: nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind, strength: n.strength, span: n.span })),
    inbound: Object.fromEntries([...graph.inbound.entries()]),
    missingLinks: graph.missingLinks
  };
  await writeFile(indexPath(root, worldId), JSON.stringify(payload, null, 2), 'utf8');
  return { builtAt: payload.builtAt, nodeCount: nodes.length, edgeCount };
}

export async function loadIndex(root: string, worldId: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(indexPath(root, worldId), 'utf8'));
  } catch {
    await rebuildIndex(root, worldId);
    return JSON.parse(await readFile(indexPath(root, worldId), 'utf8'));
  }
}

export async function invalidateIndex(root: string, worldId: string): Promise<void> {
  await unlink(indexPath(root, worldId)).catch(() => undefined);
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/host/indexFile.test.ts` → PASS

- [ ] **Step 5: 接到写路径**

`handlers.ts` 中每次 `writeNode` / `deleteNode` / `writeFragment` 成功后调用 `await invalidateIndex(root, worldId);`。

- [ ] **Step 6: 手工验证**

`npx tsx src/host/cli.ts` → 生成 `index.json`；删掉它 → 再跑 → 自动重建，输出不变。

- [ ] **Step 7: 提交**

```bash
git add src/host tests/host/indexFile.test.ts
git commit -m "feat: index.json 重建与失效"
```

---

## Task 17: 四条验收测试与人工验收清单

**Files:**
- Create: `tests/acceptance/acceptance.test.ts`、`docs/superpowers/plans/acceptance-checklist.md`

**Interfaces:**
- Consumes: `createHandlers`（Task 4 起）
- Produces: 覆盖 spec §9 四条的验收套件

- [ ] **Step 1: 写验收测试**

```ts
// tests/acceptance/acceptance.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers';

const W = '记忆之世';
const CONFIG = `id: ${W}
title: ${W}
genre: { allowed: [超自然], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 一个靠抽干世界来维持秩序的世界
  motif: 记忆即代价
`;

let h: ReturnType<typeof createHandlers>;
beforeAll(async () => {
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-acc-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: W, config: CONFIG } });
});

const put = (id: string, body: unknown) =>
  h({ method: 'PUT', path: `/worlds/${W}/nodes/${id}`, query: {}, body });

describe('验收一：造世界（链路，不计时）', () => {
  it('5 公理 + 6 条目', async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await put(`W-AX-${i}`, { id: `W-AX-${i}`, kind: 'axiom', title: `公理${i}`, strength: 'hard', cost: [`代价${i}`] })).status).toBe(200);
    }
    for (let i = 1; i <= 6; i++) {
      expect((await put(`E-${i}`, { id: `E-${i}`, kind: 'entry', title: `条目${i}`, strength: 'soft', derives: ['W-AX-1'], body: '这是足够长的正文内容，用来避免 R10 触发。' })).status).toBe(200);
    }
    const list = await h({ method: 'GET', path: `/worlds/${W}/nodes`, query: {}, body: null });
    expect((list.json as any[]).length).toBe(11);
  });
});

describe('验收二：故意埋雷（hard×hard）', () => {
  it('同时定位两条并给三种解法', async () => {
    await put('W-AX-9', { id: 'W-AX-9', kind: 'axiom', title: '禁法法则', strength: 'hard', cost: ['秩序'], conflicts_with: ['W-AX-1'] });
    const r = await h({ method: 'GET', path: `/worlds/${W}/findings`, query: {}, body: null });
    const r1 = (r.json as any[]).find((f) => f.rule === 'R1');
    expect(r1).toBeTruthy();
    expect(r1.nodeIds.sort()).toEqual(['W-AX-1', 'W-AX-9']);
    expect(r1.actions).toHaveLength(3);
  });
});

describe('验收三：时间断层（R7）', () => {
  it('截断公理 span 后依赖它的条目立刻报 error', async () => {
    await put('W-AX-2', { id: 'W-AX-2', kind: 'axiom', title: '公理2', strength: 'hard', cost: ['代价2'], span: { from: 1, to: 700 } });
    await put('E-7', { id: 'E-7', kind: 'entry', title: '脉正', strength: 'firm', derives: ['W-AX-2'], span: { from: 412, to: 720 }, body: '这是一段足够长的正文内容避免 R10。' });
    const r = await h({ method: 'GET', path: `/worlds/${W}/findings`, query: {}, body: null });
    const r7 = (r.json as any[]).find((f) => f.rule === 'R7');
    expect(r7?.severity).toBe('error');
    expect(r7?.nodeIds).toContain('E-7');
  });
});

describe('验收四：删除保护', () => {
  it('被引用的条目删除返回 409 并列出引用处', async () => {
    const r = await h({ method: 'DELETE', path: `/worlds/${W}/nodes/W-AX-1`, query: {}, body: null });
    expect(r.status).toBe(409);
    expect((r.json as any).refs.nodes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行验收** — Run: `npm test -- tests/acceptance` → 全绿；若失败按信息修实现（例如 `conflicts_with` 未透传则改 `toNode`）

- [ ] **Step 3: 写人工验收清单**

`docs/superpowers/plans/acceptance-checklist.md`：

```markdown
# 世界观 P0 人工验收清单（DSH 插件形态）

1. 安装 bundle 后新开会话，页面右下角出现「工作台」，点开是全屏面板
2. 工作台里能列出 `dataRoot/worlds/` 下的世界；`dataRoot` 来自插件 Config
3. 造世界：母题 → 加 3 条公理（故意一条不填代价 → 必须被拒）→ 进入主界面
4. 写条目「还脉礼」→ 保存 → 刷新仍在 → 用编辑器打开 `nodes/还脉礼.md` 确认可读
5. 在 `fragments/` 写含 `[[还脉礼]]` 的片段 → 条目页显示“被片段引用”
6. 删「还脉礼」→ 被 409 拦住并列出引用处
7. 诊断清单显示 R4/R11/R12；`npm run check` 输出同一份
8. 时间轴拖到 612 年 → 只剩该年在场的条目
9. 片段里写 `[[不存在的词]]` → 侧栏出现“未定义专名”
10. 关闭面板再打开、刷新页面、重启 DSH 后，数据与状态均正常
```

- [ ] **Step 4: 提交**

```bash
git add tests/acceptance docs/superpowers/plans/acceptance-checklist.md
git commit -m "test: 四条验收测试与人工验收清单"
```

---

## Self-Review

**1. Spec coverage**

| Spec 要求 | 任务 |
|---|---|
| world.yaml（契约/历法/母题） | Task 2 |
| 节点 CRUD + 两个框录入 | Task 1、3、4、5 |
| 边 derives/manifests/cites | Task 7 |
| 边 requires/conflicts/same_as | Task 7（构建）、12（规则使用） |
| `stateAt(year)` | Task 14 |
| R1–R12 | 10（R4/R5/R10/R11/R12）、11（R6/R7/R8）、12（R1/R2/R3）；**R9 未实现** |
| 四视图 | 5（条目页/列表）、13（诊断清单）、14（时间轴）；卡片墙用左侧列表代替 |
| 极简片段库 | 3、8、9 |
| 未定义专名扫描 | 8（接口）、9（界面提示） |
| 三步开局引导 | 15 |
| index.json 可重建 | 16 |
| 四条验收测试 | 17 |
| 删除保护 | 9 |
| **插件形态（随 DSH 加载、界面在 DSH 页面内）** | Task 0（探针 + 骨架）、5（路由接入）、全篇数据根可变 |

**已知缺口（显式记录，不假装覆盖）**：

- **R9（认知与硬法则冲突）未实现**：需要 `stance` 字段与置信阈值，属 P1。
- **卡片墙未单独建视图**：M0 用左侧列表承担浏览。
- **R1 的语义互斥**只检测显式登记的 `conflicts_with`；语义判定属 P1 的 AI 审问。
- **AI 介入（归纳/审问）不在 P0**：属 P1，届时走 DSH 的 agent 与工具，并把同一操作暴露成宿主方法与 agent 工具两处调用（`references/user-actions.md`）。

**2. Placeholder scan**：逐任务检查，无 TBD / TODO / “类似 Task N” / “适当处理错误”。

**3. Type consistency**：`WorldNode` 字段在 Task 1 定义，后续全部同名（`conflictsWith` / `sameAs` / `violations`）；snake_case（`conflicts_with` / `same_as`）只出现在 `frontmatter.ts` 与 `handlers.ts` 的 `toNode`，转换点唯一。
