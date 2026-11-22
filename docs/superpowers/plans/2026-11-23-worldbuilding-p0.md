# 世界观系统 P0 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个本地写作工作台的最小可用版本：能建世界、写设定条目、用 `[[双链]]` 互相引用、跑 R1–R12 体检、按年份看时间切片。

**Architecture:** 三层分离——`engine/` 是纯函数（类型、解析、建图、校验、查询），不碰文件与网络，因此可完整单测；`server/` 只做文件读写与 HTTP；`ui/` 是 React 单页应用，只消费 HTTP。数据真相是 `data/worlds/<worldId>/` 下的 md + yaml 文件，`index.json` 是可重建的派生品。

**Tech Stack:** Node ≥ 20（ESM）、TypeScript（strict）、Vitest、Vite + React 18、`yaml`、`tsx`、`concurrently`。无数据库、无框架级后端。

**Spec:** `docs/superpowers/specs/2026-11-23-worldbuilding-spec.md`（世界观系统详细设计）
父文档：`docs/superpowers/specs/2026-11-23-novel-system-overview.md`（总纲：一张图 / 既定度 / 校验灯）

## Global Constraints

- Node 版本下限：`>=20`
- TypeScript `strict: true`；禁止 `any` 出现在对外签名中（内部可用 `unknown` + 收窄）
- 数据目录固定为 `data/worlds/<worldId>/`，`worldId` 即目录名，禁止其它位置
- 命名空间：所有节点 id 形如 `W-AX-002` / `E-MF-004`，跨世界唯一性由 `worldId` + `nodeId` 保证
- **只读真相**：`index.json` 是派生品，任何代码不得把它当作数据源；删掉必须能自动重建
- **永不阻断保存**，唯一例外：`kind: axiom` 且 `cost` 为空 → 返回 422
- 校验分级固定为 `error | warn | info`，对应 🔴 / 🟡 / ⚪
- 条目文件格式固定：YAML front matter（`---` 包围） + 正文；一条一文件，文件名为 `<title>.md`
- 所有金额/年份单位为整数年，`null` 表示“至今”，负数表示纪元前
- 提交信息使用 `feat:` / `test:` / `fix:` / `docs:` 前缀，每个任务至少一次提交

## File Structure

```
novel/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── start.bat
├── src/
│   ├── engine/                    # 纯函数，无 I/O
│   │   ├── types.ts               # 领域类型（WorldNode / Graph / Finding …）
│   │   ├── frontmatter.ts         # front matter 编解码 + 节点序列化
│   │   ├── worldConfig.ts         # world.yaml 解析与校验
│   │   ├── wikiLink.ts            # [[双链]] 解析
│   │   ├── graph.ts               # 建图、别名索引、入边、cites 抽取
│   │   ├── query.ts               # stateAt / citations / orphans
│   │   └── rules/
│   │       ├── index.ts           # runRules 汇总
│   │       ├── content.ts         # R4 R5 R10 R11 R12
│   │       ├── structural.ts      # R6 R7 R8
│   │       └── explicit.ts        # R1 R2 R3
│   ├── server/
│   │   ├── store.ts               # 文件读写（唯一碰 fs 的地方）
│   │   ├── api.ts                 # 路由 → 调用 store + engine
│   │   ├── index.ts               # 启动 HTTP 服务
│   │   └── cli.ts                 # npm run check
│   └── ui/
│       ├── main.tsx
│       ├── api.ts                 # fetch 封装
│       ├── App.tsx                # 侧栏 + 视图切换
│       └── views/
│           ├── NodeEditor.tsx
│           ├── CardWall.tsx
│           ├── Findings.tsx
│           ├── Timeline.tsx
│           └── Onboarding.tsx
├── tests/
│   ├── engine/
│   │   ├── frontmatter.test.ts
│   │   ├── worldConfig.test.ts
│   │   ├── wikiLink.test.ts
│   │   ├── graph.test.ts
│   │   ├── query.test.ts
│   │   └── rules.test.ts
│   └── server/
│       ├── store.test.ts
│       └── api.test.ts
└── data/                          # 运行后产生，已在 .gitignore 之外（数据要进 git）
    └── worlds/
```

**为什么这么切**：`engine` 不认识 fs 也不认识 http，所以 R1–R12 每条规则都能用一个内存 fixture 单测；`store` 是唯一 I/O 边界，换存储只需改它；`ui` 只认 HTTP。

---

# M0 · 骨架（能打开、能写、能看）

## Task 1: 项目脚手架与测试基线

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `vite.config.ts`, `start.bat`, `.gitignore`（已存在，追加）
- Test: `tests/engine/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` 可跑；`npm run dev` 可起；后续任务全部依赖此基线

- [ ] **Step 1: 写第一个失败测试**

```ts
// tests/engine/smoke.test.ts
import { describe, it, expect } from 'vitest';
import { SEVERITY_ORDER } from '../../src/engine/types';

describe('骨架', () => {
  it('严重度有固定顺序', () => {
    expect(SEVERITY_ORDER).toEqual(['error', 'warn', 'info']);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- tests/engine/smoke.test.ts`
Expected: FAIL，提示找不到 `src/engine/types`

- [ ] **Step 3: 建配置与最小类型**

`package.json`：

```json
{
  "name": "novel-workbench",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "concurrently -k -n api,web -c blue,green \"npm:dev:api\" \"npm:dev:web\"",
    "dev:api": "tsx watch src/server/index.ts",
    "dev:web": "vite",
    "build": "vite build",
    "test": "vitest run",
    "check": "tsx src/server/cli.ts"
  },
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1", "yaml": "^2.5.1" },
  "devDependencies": {
    "@types/node": "^22.7.4", "@types/react": "^18.3.11", "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2", "concurrently": "^9.0.1", "tsx": "^4.19.1",
    "typescript": "^5.6.2", "vite": "^5.4.8", "vitest": "^2.1.2"
  }
}
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true, "jsx": "react-jsx",
    "types": ["node", "vitest/globals"], "skipLibCheck": true, "noEmit": true
  },
  "include": ["src", "tests"]
}
```

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } });
```

`vite.config.ts`：

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8787' } }
});
```

`start.bat`：

```bat
@echo off
cd /d %~dp0
start "" http://localhost:5173
call npm run dev
```

`src/engine/types.ts`（本任务只放严重度，其余任务逐步补）：

```ts
export type Severity = 'error' | 'warn' | 'info';
export const SEVERITY_ORDER: Severity[] = ['error', 'warn', 'info'];
```

- [ ] **Step 4: 安装并运行**

Run: `npm install && npm test -- tests/engine/smoke.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add package.json tsconfig.json vitest.config.ts vite.config.ts start.bat src/engine/types.ts tests/engine/smoke.test.ts
git commit -m "feat: 项目脚手架与测试基线"
```

---

## Task 2: 领域类型与 front matter 编解码

**Files:**
- Create: `src/engine/frontmatter.ts`
- Modify: `src/engine/types.ts`
- Test: `tests/engine/frontmatter.test.ts`

**Interfaces:**
- Consumes: `Severity`（Task 1）
- Produces:
  - `type Strength = 'hard' | 'firm' | 'soft' | 'myth'`
  - `type NodeKind = 'axiom' | 'entry'`
  - `interface Span { from: number | null; to: number | null }`
  - `interface WorldNode { id, kind, subtype, title, aliases, strength, span, proposition, cost, derives, manifests, requires, conflictsWith, sameAs, violations, body, file }`
  - `parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string }`
  - `parseNode(raw: string, file: string): WorldNode`
  - `serializeNode(node: WorldNode): string`

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
    expect(n.aliases).toEqual([]);
    expect(n.derives).toEqual([]);
    expect(n.span).toEqual({ from: null, to: null });
  });

  it('序列化后可被原样解析回来', () => {
    const n = parseNode(RAW, 'nodes/记忆即燃料.md');
    const back = parseNode(serializeNode(n), n.file);
    expect(back).toEqual(n);
  });

  it('缺少 --- 包围时抛错', () => {
    expect(() => parseNode('没有 front matter', 'x.md')).toThrow(/front matter/i);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- tests/engine/frontmatter.test.ts`
Expected: FAIL，`parseNode is not a function`

- [ ] **Step 3: 实现**

`src/engine/types.ts` 追加：

```ts
export type Strength = 'hard' | 'firm' | 'soft' | 'myth';
export type NodeKind = 'axiom' | 'entry';
export interface Span { from: number | null; to: number | null }

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

`src/engine/frontmatter.ts`：

```ts
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Span, Strength, WorldNode } from './types';

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const m = FENCE.exec(raw.replace(/^\uFEFF/, ''));
  if (!m) throw new Error('缺少 front matter 围栏（文件必须以 --- 开头）');
  const data = (parseYaml(m[1] ?? '') ?? {}) as Record<string, unknown>;
  return { data, body: raw.replace(/^\uFEFF/, '').slice(m[0].length) };
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}
function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
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
  const kind = data['kind'] === 'axiom' ? 'axiom' : 'entry';
  return {
    id: String(data['id'] ?? ''),
    kind,
    subtype: typeof data['subtype'] === 'string' ? data['subtype'] : null,
    title: String(data['title'] ?? ''),
    aliases: strArr(data['aliases']),
    strength: toStrength(data['strength']),
    span: toSpan(data['span']),
    proposition: typeof data['proposition'] === 'string' ? data['proposition'] : null,
    cost: strArr(data['cost']),
    derives: strArr(data['derives']),
    manifests: strArr(data['manifests']),
    requires: strArr(data['requires']),
    conflictsWith: strArr(data['conflicts_with']),
    sameAs: strArr(data['same_as']),
    violations: strArr(data['violations']),
    body,
    file
  };
}

export function serializeNode(n: WorldNode): string {
  const data: Record<string, unknown> = {
    kind: n.kind,
    id: n.id,
    title: n.title,
    strength: n.strength,
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

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- tests/engine/frontmatter.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/engine/types.ts src/engine/frontmatter.ts tests/engine/frontmatter.test.ts
git commit -m "feat: 领域类型与 front matter 编解码"
```

---

## Task 3: 世界配置读取与校验

**Files:**
- Create: `src/engine/worldConfig.ts`
- Test: `tests/engine/worldConfig.test.ts`

**Interfaces:**
- Produces:
  - `interface WorldConfig { id, title, genre: { allowed, forbidden, expectation }, calendar: { epochs, format, months }, theme: { wound, motif } }`
  - `parseWorldConfig(raw: string): WorldConfig`（缺 `theme.wound` 或 `calendar.epochs` 抛错）

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

## Task 4: 文件存储层

**Files:**
- Create: `src/server/store.ts`
- Test: `tests/server/store.test.ts`

**Interfaces:**
- Consumes: `parseNode` / `serializeNode`（Task 2）、`parseWorldConfig`（Task 3）
- Produces:
  - `type RootPath = string`
  - `createWorld(root, id, configYaml: string): Promise<void>`
  - `listWorlds(root): Promise<string[]>`
  - `readWorldConfig(root, worldId): Promise<WorldConfig>`
  - `listNodes(root, worldId): Promise<WorldNode[]>`（按 title 排序）
  - `readNode(root, worldId, nodeId): Promise<WorldNode>`
  - `writeNode(root, worldId, node: WorldNode): Promise<void>`（文件名 `<title>.md`，改标题会移动文件）
  - `deleteNode(root, worldId, nodeId): Promise<void>`
  - `listFragments(root, worldId): Promise<Fragment[]>`，`interface Fragment { id, chapter, scene, text, file }`

- [ ] **Step 1: 写失败测试**（用 `node:fs/promises` 的临时目录）

```ts
// tests/server/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../../src/server/store';

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
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-'));
  return async () => { await rm(root, { recursive: true, force: true }); };
});

describe('store', () => {
  it('建世界后能列出', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    expect(await store.listWorlds(root)).toEqual(['记忆之世']);
  });

  it('写节点后能读回，且文件落在 nodes/<title>.md', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    const node = {
      id: 'W-AX-002', kind: 'axiom' as const, subtype: null, title: '记忆即燃料',
      aliases: [], strength: 'hard' as const, span: { from: -1200, to: null },
      proposition: '施法烧记忆', cost: ['记忆'], derives: [], manifests: [],
      requires: [], conflictsWith: [], sameAs: [], violations: [], body: '正文\n', file: ''
    };
    await store.writeNode(root, '记忆之世', node);
    const list = await store.listNodes(root, '记忆之世');
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe('记忆即燃料');
    expect(list[0]!.file).toBe('nodes/记忆即燃料.md');
    expect((await store.readNode(root, '记忆之世', 'W-AX-002')).id).toBe('W-AX-002');
  });

  it('改标题会移动文件而不是留下副本', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    const node = {
      id: 'E-1', kind: 'entry' as const, subtype: null, title: '旧名', aliases: [],
      strength: 'soft' as const, span: { from: null, to: null }, proposition: null,
      cost: [], derives: [], manifests: [], requires: [], conflictsWith: [], sameAs: [],
      violations: [], body: '', file: ''
    };
    await store.writeNode(root, '记忆之世', node);
    await store.writeNode(root, '记忆之世', { ...node, title: '新名' });
    const list = await store.listNodes(root, '记忆之世');
    expect(list.map((n) => n.title)).toEqual(['新名']);
  });

  it('删除后读不到', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    const node = {
      id: 'E-2', kind: 'entry' as const, subtype: null, title: '还脉礼', aliases: [],
      strength: 'soft' as const, span: { from: null, to: null }, proposition: null,
      cost: [], derives: [], manifests: [], requires: [], conflictsWith: [], sameAs: [],
      violations: [], body: '', file: ''
    };
    await store.writeNode(root, '记忆之世', node);
    await store.deleteNode(root, '记忆之世', 'E-2');
    await expect(store.readNode(root, '记忆之世', 'E-2')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/server/store.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/server/store.ts
import { mkdir, readdir, readFile, writeFile, unlink, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseNode, serializeNode } from '../engine/frontmatter';
import { parseWorldConfig, type WorldConfig } from '../engine/worldConfig';
import type { WorldNode } from '../engine/types';

export interface Fragment { id: string; chapter: number | null; scene: number | null; text: string; file: string }

const worldDir = (root: string, id: string) => join(root, 'data', 'worlds', id);
const nodesDir = (root: string, id: string) => join(worldDir(root, id), 'nodes');
const fragDir = (root: string, id: string) => join(worldDir(root, id), 'fragments');

async function ensureDir(p: string) { await mkdir(p, { recursive: true }); }

export async function createWorld(root: string, id: string, configYaml: string): Promise<void> {
  const dir = worldDir(root, id);
  await ensureDir(nodesDir(root, id));
  await ensureDir(fragDir(root, id));
  await ensureDir(join(dir, 'beliefs'));
  await writeFile(join(dir, 'world.yaml'), configYaml, 'utf8');
}

export async function listWorlds(root: string): Promise<string[]> {
  const dir = join(root, 'data', 'worlds');
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
  const nodes = await Promise.all(
    files.map(async (f) => parseNode(await readFile(join(dir, f), 'utf8'), `nodes/${f}`))
  );
  return nodes.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
}

export async function readNode(root: string, worldId: string, nodeId: string): Promise<WorldNode> {
  const found = (await listNodes(root, worldId)).find((n) => n.id === nodeId);
  if (!found) throw new Error(`找不到节点 ${nodeId}`);
  return found;
}

export async function writeNode(root: string, worldId: string, node: WorldNode): Promise<void> {
  const dir = nodesDir(root, worldId);
  await ensureDir(dir);
  const target = join(dir, `${node.title || node.id}.md`);
  const existing = (await listNodes(root, worldId)).find((n) => n.id === node.id);
  await writeFile(target, serializeNode({ ...node, file: `nodes/${node.title || node.id}.md` }), 'utf8');
  if (existing && existing.file !== `nodes/${node.title || node.id}.md`) {
    await unlink(join(worldDir(root, worldId), existing.file)).catch(() => undefined);
  }
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
    return { id: f.replace(/\.md$/, ''), chapter: num('chapter'), scene: num('scene'),
             text: m ? raw.slice(m[0].length) : raw, file: `fragments/${f}` };
  }));
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/server/store.test.ts` → PASS（4 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/server/store.ts tests/server/store.test.ts
git commit -m "feat: 文件存储层（世界/节点/片段）"
```

---

## Task 5: HTTP API 骨架 + M0 界面

**Files:**
- Create: `src/server/api.ts`, `src/server/index.ts`, `src/ui/main.tsx`, `src/ui/api.ts`, `src/ui/App.tsx`, `src/ui/views/NodeEditor.tsx`, `index.html`
- Test: `tests/server/api.test.ts`

**Interfaces:**
- Consumes: `store.*`（Task 4）
- Produces:
  - `createServer(root: string): http.Server`（供测试直接监听随机端口）
  - 路由：`GET /api/worlds`｜`POST /api/worlds`｜`GET /api/worlds/:w/config`｜`GET /api/worlds/:w/nodes`｜`GET|PUT /api/worlds/:w/nodes/:id`｜`DELETE /api/worlds/:w/nodes/:id`
  - UI 组件：`<App />` 侧栏 + 视图切换

- [ ] **Step 1: 写失败测试**

```ts
// tests/server/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer } from '../../src/server/api';

let root: string; let base: string; let close: () => Promise<void>;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-api-'));
  const server = createServer(root);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
  close = () => new Promise((r) => server.close(() => r()));
});
afterAll(async () => { await close(); await rm(root, { recursive: true, force: true }); });

describe('api', () => {
  it('建世界并列出来', async () => {
    const res = await fetch(`${base}/api/worlds`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '记忆之世', config: 'id: 记忆之世\ntitle: 记忆之世\ngenre: { allowed: [], forbidden: [], expectation: "" }\ncalendar:\n  epochs: [{ name: 新历, start: 1, end: null }]\n  format: "{year}"\ntheme:\n  wound: 伤口\n  motif: 母题\n' })
    });
    expect(res.status).toBe(201);
    expect(await (await fetch(`${base}/api/worlds`)).json()).toEqual(['记忆之世']);
  });

  it('公理没代价时返回 422 且不落盘', async () => {
    const res = await fetch(`${base}/api/worlds/记忆之世/nodes/W-AX-001`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'W-AX-001', kind: 'axiom', title: '无代价公理', strength: 'hard', cost: [] })
    });
    expect(res.status).toBe(422);
    const list = await (await fetch(`${base}/api/worlds/记忆之世/nodes`)).json();
    expect(list).toEqual([]);
  });

  it('普通条目可以保存并读回', async () => {
    const body = { id: 'E-1', kind: 'entry', title: '还脉礼', strength: 'soft', body: '念名还债' };
    const put = await fetch(`${base}/api/worlds/记忆之世/nodes/E-1`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    expect(put.status).toBe(200);
    const got = await (await fetch(`${base}/api/worlds/记忆之世/nodes/E-1`)).json();
    expect(got.title).toBe('还脉礼');
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/server/api.test.ts` → FAIL

- [ ] **Step 3: 实现 API**

```ts
// src/server/api.ts
import { createServer as createHttpServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as store from './store';
import type { WorldNode } from '../engine/types';

const send = (res: any, code: number, payload?: unknown) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
};
const readBody = async (req: any): Promise<any> => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

function toNode(input: any, prev?: WorldNode | null): WorldNode {
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

export function createServer(root: string): Server {
  return createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const parts = url.pathname.split('/').filter(Boolean); // ['api','worlds',...]
      if (parts[0] !== 'api') return send(res, 404, { error: 'not found' });

      if (parts[1] === 'worlds' && parts.length === 2) {
        if (req.method === 'GET') return send(res, 200, await store.listWorlds(root));
        if (req.method === 'POST') {
          const b = await readBody(req);
          await store.createWorld(root, String(b.id), String(b.config));
          return send(res, 201, { ok: true });
        }
      }
      const worldId = parts[2] ? decodeURIComponent(parts[2]) : '';
      if (parts[3] === 'config' && req.method === 'GET') {
        return send(res, 200, await store.readWorldConfig(root, worldId));
      }
      if (parts[3] === 'nodes' && parts.length === 4 && req.method === 'GET') {
        return send(res, 200, await store.listNodes(root, worldId));
      }
      if (parts[3] === 'nodes' && parts.length === 5) {
        const nodeId = decodeURIComponent(parts[4]!);
        if (req.method === 'GET') return send(res, 200, await store.readNode(root, worldId, nodeId));
        if (req.method === 'PUT') {
          const prev = await store.readNode(root, worldId, nodeId).catch(() => null);
          const node = toNode(await readBody(req), prev);
          if (node.kind === 'axiom' && node.cost.length === 0) {
            return send(res, 422, { error: '公理必须付出代价（铁律一）' });
          }
          await store.writeNode(root, worldId, node);
          return send(res, 200, node);
        }
        if (req.method === 'DELETE') {
          await store.deleteNode(root, worldId, nodeId);
          return send(res, 204);
        }
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      return send(res, 500, { error: (e as Error).message });
    }
  });
}

export const ROOT = process.cwd();
```

`src/server/index.ts`：

```ts
import { createServer } from './api';
const PORT = Number(process.env['PORT'] ?? 8787);
createServer(process.cwd()).listen(PORT, '127.0.0.1', () => {
  console.log(`api  http://127.0.0.1:${PORT}`);
});
```

- [ ] **Step 4: 运行确认 API 测试通过** — Run: `npm test -- tests/server/api.test.ts` → PASS（3 个用例）

- [ ] **Step 5: 建界面**

`index.html`：

```html
<!doctype html><html lang="zh"><head><meta charset="utf-8" /><title>小说工作台</title></head>
<body><div id="root"></div><script type="module" src="/src/ui/main.tsx"></script></body></html>
```

`src/ui/api.ts`：

```ts
export async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { 'content-type': 'application/json' }, ...init });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
export const listNodes = (w: string) => j<any[]>(`/api/worlds/${encodeURIComponent(w)}/nodes`);
export const readNode = (w: string, id: string) => j<any>(`/api/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}`);
export const saveNode = (w: string, n: any) => j<any>(`/api/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(n.id)}`, { method: 'PUT', body: JSON.stringify(n) });
```

`src/ui/views/NodeEditor.tsx`：

```tsx
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
    <div style={{ padding: 24, maxWidth: 720 }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)}
             style={{ fontSize: 22, width: '100%', border: 'none', borderBottom: '1px solid #ddd', outline: 'none' }} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14}
                style={{ width: '100%', marginTop: 12, fontSize: 15, lineHeight: 1.7, border: '1px solid #eee', padding: 12 }} />
      <div style={{ marginTop: 12 }}>
        <button onClick={save}>保存</button>
        {err && <span style={{ color: '#c00', marginLeft: 12 }}>{err}</span>}
      </div>
    </div>
  );
}
```

`src/ui/App.tsx`：

```tsx
import { useEffect, useState } from 'react';
import { listNodes, readNode } from './api';
import { NodeEditor } from './views/NodeEditor';

export function App() {
  const worldId = '记忆之世';
  const [nodes, setNodes] = useState<any[]>([]);
  const [current, setCurrent] = useState<any | null>(null);

  const refresh = () => listNodes(worldId).then(setNodes).catch(() => setNodes([]));
  useEffect(() => { void refresh(); }, []);

  const create = () => setCurrent({ id: `E-${Date.now()}`, kind: 'entry', title: '新条目', strength: 'soft', body: '' });

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui' }}>
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
        {current ? <NodeEditor worldId={worldId} node={current} onSaved={() => { void refresh(); }} />
                 : <p style={{ padding: 24, color: '#888' }}>从左侧选一个条目，或新建一个。</p>}
      </main>
    </div>
  );
}
```

`src/ui/main.tsx`：

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 6: 手动验证 M0**

Run: `npm run dev` → 浏览器打开 `http://localhost:5173`
Expected: 左侧看你手动建的 `data/worlds/记忆之世/`；点「＋ 新建条目」→ 填标题与正文 → 保存 → 左侧列表出现该条目 → 刷新页面仍在。
用记事本打开 `data/worlds/记忆之世/nodes/新条目.md`，确认 front matter + 正文可读。

- [ ] **Step 7: 提交**

```bash
git add src/server/api.ts src/server/index.ts src/ui index.html tests/server/api.test.ts
git commit -m "feat: HTTP API 与 M0 界面（列表/编辑/保存）"
```

---

# M1 · 引用（能写片段、能反查）

## Task 6: `[[双链]]` 解析与标题解析

**Files:**
- Create: `src/engine/wikiLink.ts`
- Test: `tests/engine/wikiLink.test.ts`

**Interfaces:**
- Produces:
  - `parseWikiLinks(text: string): string[]`（返回去重后的目标名，按出现顺序）
  - `resolveTargets(nodes: WorldNode[], targets: string[]): { resolved: Map<string, string>; missing: string[] }`（按 title 或 alias 匹配 → id）

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
    expect(parseWikiLinks('他把[[欠名录]]里又添了三个名字。[[玄帝]]那年。[[欠名录]]')).toEqual(['欠名录', '玄帝']);
  });

  it('忽略未闭合的方括号', () => {
    expect(parseWikiLinks('这是[[没闭合，还有[[好的一对]]')).toEqual(['好的一对']);
  });

  it('按标题与别名解析到 id，缺的单独列出', () => {
    const nodes = [mk('E-1', '还脉礼', ['还脉']), mk('E-2', '玄帝')];
    const r = resolveTargets(nodes, ['还脉', '玄帝', '不存在']);
    expect(r.resolved.get('还脉')).toBe('E-1');
    expect(r.resolved.get('玄帝')).toBe('E-2');
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
    if (id) resolved.set(t, id);
    else missing.push(t);
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

## Task 7: 建图（别名索引、入边、孤儿）

**Files:**
- Create: `src/engine/graph.ts`
- Test: `tests/engine/graph.test.ts`

**Interfaces:**
- Consumes: `WorldNode`、`Fragment`、`parseWikiLinks` / `resolveTargets`（Task 6）
- Produces:
  - `type EdgeType = 'derives' | 'manifests' | 'requires' | 'cites' | 'conflicts' | 'same_as'`
  - `interface Edge { type: EdgeType; from: string; to: string }`
  - `interface Graph { nodes: Map<string, WorldNode>; aliasIndex: Map<string, string[]>; inbound: Map<string, Edge[]>; outbound: Map<string, Edge[]>; missingLinks: string[] }`
  - `buildGraph(nodes: WorldNode[], fragments: Fragment[]): Graph`

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/graph.test.ts
import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import type { WorldNode } from '../../src/engine/types';
import type { Fragment } from '../../src/server/store';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], body: '', file: `nodes/${p.title}.md`, ...p
});
const frag = (id: string, text: string): Fragment => ({ id, chapter: 1, scene: 1, text, file: `fragments/${id}.md` });

describe('graph', () => {
  it('把 derives 记成入边与出边', () => {
    const ax = mk({ id: 'W-AX-002', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'] });
    const e = mk({ id: 'E-1', title: '法师无法世袭', derives: ['W-AX-002'] });
    const g = buildGraph([ax, e], []);
    expect(g.outbound.get('E-1')).toContainEqual({ type: 'derives', from: 'E-1', to: 'W-AX-002' });
    expect(g.inbound.get('W-AX-002')).toContainEqual({ type: 'derives', from: 'E-1', to: 'W-AX-002' });
  });

  it('正文里的双链变成 cites 入边', () => {
    const e = mk({ id: 'E-1', title: '欠名录' });
    const g = buildGraph([e], [frag('第03章-02', '袖口的[[欠名录]]又多了三个名字')]);
    expect(g.inbound.get('E-1')).toContainEqual({ type: 'cites', from: 'fragments/第03章-02.md', to: 'E-1' });
  });

  it('别名指向同一个节点，未解析的双链进 missingLinks', () => {
    const e = mk({ id: 'E-1', title: '还脉礼', aliases: ['还脉'] });
    const g = buildGraph([e], [frag('f1', '[[还脉]]与[[不存在的词]]')]);
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
import type { Fragment } from '../server/store';
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
  const g: Graph = { nodes: new Map(), aliasIndex: new Map(), inbound: new Map(), outbound: new Map(), missingLinks: [] };
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

## Task 8: 片段库写入与 cites 抽取接口

**Files:**
- Modify: `src/server/store.ts`（新增 `writeFragment`）
- Create: `src/server/fragments.ts` 不需要——直接放在 store
- Test: `tests/server/fragments.test.ts`

**Interfaces:**
- Produces: `writeFragment(root, worldId, { id, chapter, scene, text }): Promise<void>`；`readFragment(root, worldId, id): Promise<Fragment>`

- [ ] **Step 1: 写失败测试**

```ts
// tests/server/fragments.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../../src/server/store';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-frag-'));
  await store.createWorld(root, '记忆之世', 'id: 记忆之世\ntitle: 记忆之世\ngenre: { allowed: [], forbidden: [], expectation: "" }\ncalendar:\n  epochs: [{ name: 新历, start: 1, end: null }]\n  format: "{year}"\ntheme:\n  wound: 伤口\n  motif: 母题\n');
});
describe('片段库', () => {
  it('写入后能列出，带章节与场景', async () => {
    await store.writeFragment(root, '记忆之世', { id: '第03章-02', chapter: 3, scene: 2, text: '他把[[欠名录]]摊开。' });
    const list = await store.listFragments(root, '记忆之世');
    expect(list).toHaveLength(1);
    expect(list[0]!.chapter).toBe(3);
    expect(list[0]!.scene).toBe(2);
    expect(list[0]!.text).toContain('欠名录');
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/server/fragments.test.ts` → FAIL

- [ ] **Step 3: 实现（追加到 store.ts）**

```ts
export async function writeFragment(root: string, worldId: string,
  f: { id: string; chapter: number | null; scene: number | null; text: string }): Promise<void> {
  const dir = fragDir(root, worldId);
  await ensureDir(dir);
  const head = ['---', f.chapter !== null ? `chapter: ${f.chapter}` : null,
    f.scene !== null ? `scene: ${f.scene}` : null, '---', ''].filter((x) => x !== null).join('\n');
  await writeFile(join(dir, `${f.id}.md`), `${head}${f.text}`, 'utf8');
}

export async function readFragment(root: string, worldId: string, id: string): Promise<Fragment> {
  const all = await listFragments(root, worldId);
  const f = all.find((x) => x.id === id);
  if (!f) throw new Error(`找不到片段 ${id}`);
  return f;
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/server/fragments.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/server/store.ts tests/server/fragments.test.ts
git commit -m "feat: 片段库写入与读取"
```

---

## Task 9: 删除保护 + 反查 + 未定义专名提示

**Files:**
- Modify: `src/server/api.ts`
- Modify: `src/ui/App.tsx`、`src/ui/views/NodeEditor.tsx`
- Test: `tests/server/api-refs.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/worlds/:w/nodes/:id/citations` → `{ fragments: string[]; nodes: {id,title,via}[] }`
  - `DELETE` 在有入边时返回 `409` + `{ error, refs }`
  - `GET /api/worlds/:w/graph/missing` → `{ missing: string[] }`

- [ ] **Step 1: 写失败测试**

```ts
// tests/server/api-refs.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer } from '../../src/server/api';
import * as store from '../../src/server/store';

let root: string; let base: string; let close: () => Promise<void>;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-refs-'));
  const server = createServer(root);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
  await store.createWorld(root, '记忆之世', 'id: 记忆之世\ntitle: 记忆之世\ngenre: { allowed: [], forbidden: [], expectation: "" }\ncalendar:\n  epochs: [{ name: 新历, start: 1, end: null }]\n  format: "{year}"\ntheme:\n  wound: 伤口\n  motif: 母题\n');
  await fetch(`${base}/api/worlds/记忆之世/nodes/E-1`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'E-1', kind: 'entry', title: '欠名录', strength: 'soft', body: '' })
  });
  await store.writeFragment(root, '记忆之世', { id: '第03章-02', chapter: 3, scene: 2, text: '袖口的[[欠名录]]' });
});
afterAll(async () => { await close(); await rm(root, { recursive: true, force: true }); });

describe('引用与删除保护', () => {
  it('能查到片段与节点两种引用', async () => {
    const r = await (await fetch(`${base}/api/worlds/记忆之世/nodes/E-1/citations`)).json();
    expect(r.fragments).toContain('第03章-02');
  });

  it('被引用时删除返回 409 并列出引用处', async () => {
    const res = await fetch(`${base}/api/worlds/记忆之世/nodes/E-1`, { method: 'DELETE' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.refs.fragments).toContain('第03章-02');
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/server/api-refs.test.ts` → FAIL

- [ ] **Step 3: 实现 API（在 `api.ts` 中）**

```ts
import { buildGraph } from '../engine/graph';
import * as frag from './store';

async function loadGraph(worldId: string) {
  return buildGraph(await store.listNodes(root, worldId), await store.listFragments(root, worldId));
}
```
把 `root` 传入闭包（在 `createServer` 内部定义 `loadGraph`）。新增路由：

```ts
      if (parts[3] === 'nodes' && parts.length === 6 && parts[5] === 'citations') {
        const nodeId = decodeURIComponent(parts[4]!);
        const g = await loadGraph(worldId);
        const edges = g.inbound.get(nodeId) ?? [];
        return send(res, 200, {
          fragments: edges.filter((e) => e.type === 'cites').map((e) => e.from.replace(/^fragments\//, '').replace(/\.md$/, '')),
          nodes: edges.filter((e) => e.type !== 'cites').map((e) => ({ id: e.from, title: g.nodes.get(e.from)?.title ?? e.from, via: e.type }))
        });
      }
      if (parts[3] === 'graph' && parts[4] === 'missing') {
        return send(res, 200, { missing: (await loadGraph(worldId)).missingLinks });
      }
```

并把 `DELETE` 分支改为：

```ts
        if (req.method === 'DELETE') {
          const g = await loadGraph(worldId);
          const refs = g.inbound.get(nodeId) ?? [];
          if (refs.length > 0) {
            return send(res, 409, {
              error: `被 ${refs.length} 处引用，删除会断链`,
              refs: {
                fragments: refs.filter((e) => e.type === 'cites').map((e) => e.from.replace(/^fragments\//, '').replace(/\.md$/, '')),
                nodes: refs.filter((e) => e.type !== 'cites').map((e) => ({ id: e.from, title: g.nodes.get(e.from)?.title ?? e.from, via: e.type }))
              }
            });
          }
          await store.deleteNode(root, worldId, nodeId);
          return send(res, 204);
        }
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/server/api-refs.test.ts` → PASS

- [ ] **Step 5: 界面加反查与未定义专名提示**

在 `NodeEditor` 底部加：

```tsx
  const [refs, setRefs] = useState<any | null>(null);
  useEffect(() => { j<any>(`/api/worlds/${encodeURIComponent(worldId)}/nodes/${encodeURIComponent(node.id)}/citations`).then(setRefs).catch(() => setRefs(null)); }, [worldId, node.id]);
```
渲染：

```tsx
      {refs && (
        <div style={{ marginTop: 24, fontSize: 13, color: '#666' }}>
          <div>被片段引用：{refs.fragments.length ? refs.fragments.join('、') : '无'}</div>
          <div>被条目引用：{refs.nodes.length ? refs.nodes.map((r: any) => `${r.title}(${r.via})`).join('、') : '无'}</div>
        </div>
      )}
```
在 `App` 侧栏底部显示未定义专名：

```tsx
  const [missing, setMissing] = useState<string[]>([]);
  useEffect(() => { j<{ missing: string[] }>('/api/worlds/' + encodeURIComponent(worldId) + '/graph/missing').then((r) => setMissing(r.missing)).catch(() => setMissing([])); }, []);
```
渲染：

```tsx
        {missing.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 12, color: '#a60' }}>未定义专名：{missing.join('、')}</div>
        )}
```

- [ ] **Step 6: 手动验证**

Run: `npm run dev` → 在 `data/worlds/记忆之世/fragments/第03章-02.md` 写入含 `[[欠名录]]` 的一段 → 打开「欠名录」条目 → 底部显示“被片段引用：第03章-02”；点删除 → 弹出 409 提示列出引用处。

- [ ] **Step 7: 提交**

```bash
git add src/server/api.ts src/ui tests/server/api-refs.test.ts
git commit -m "feat: 引用反查、删除保护、未定义专名提示"
```

---

# M2 · 校验（第一次有体检）

## Task 10: 校验框架与内容规则 R4/R5/R10/R11/R12

**Files:**
- Create: `src/engine/rules/index.ts`, `src/engine/rules/content.ts`
- Modify: `src/engine/types.ts`（加 `Finding`）
- Test: `tests/engine/rules.test.ts`

**Interfaces:**
- Produces:
  - `interface Finding { rule: string; severity: Severity; nodeIds: string[]; message: string; hint?: string; actions?: string[] }`
  - `interface RuleContext { nodes: WorldNode[]; graph: Graph }`
  - `type Rule = (ctx: RuleContext) => Finding[]`
  - `runRules(ctx: RuleContext): Finding[]`（按 error→warn→info 排序）

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
  it('R4：既无 derives 也无 requires 的条目报 warn', () => {
    const f = run([mk({ id: 'E-1', title: '无根条目' })]);
    expect(f.find((x) => x.rule === 'R4')?.nodeIds).toEqual(['E-1']);
    expect(f.find((x) => x.rule === 'R4')?.severity).toBe('warn');
  });

  it('R5：从未被引用的条目报 info', () => {
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
    const nodes = [mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['记忆'], manifests: ['E-1'] }),
                   mk({ id: 'E-1', title: '表现一', derives: ['W-AX-1'] }),
                   mk({ id: 'W-AX-2', title: '公理乙', kind: 'axiom', strength: 'hard', cost: ['身份'] }),
                   mk({ id: 'W-AX-3', title: '公理丙', kind: 'axiom', strength: 'hard', cost: ['亲情'] })];
    const f = run(nodes);
    expect(f.find((x) => x.rule === 'R12')?.nodeIds).toEqual(['W-AX-2', 'W-AX-3']);
  });

  it('结果按 error → warn → info 排序', () => {
    const f = run([mk({ id: 'E-1', title: '无根' })]);
    const order = f.map((x) => x.severity);
    expect(order).toEqual([...order].sort((a, b) => ['error', 'warn', 'info'].indexOf(a) - ['error', 'warn', 'info'].indexOf(b)));
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/rules.test.ts` → FAIL

- [ ] **Step 3: 实现**

`src/engine/types.ts` 追加：

```ts
export interface Finding {
  rule: string; severity: Severity; nodeIds: string[]; message: string; hint?: string; actions?: string[];
}
```

`src/engine/rules/content.ts`：

```ts
import type { Finding, WorldNode } from '../types';
import type { Graph } from '../graph';

export interface RuleContext { nodes: WorldNode[]; graph: Graph }
export type Rule = (ctx: RuleContext) => Finding[];

const refs = (g: Graph, id: string) => g.inbound.get(id) ?? [];

export const R4: Rule = ({ nodes, graph }) =>
  nodes.filter((n) => n.kind === 'entry' && n.derives.length === 0 && n.requires.length === 0)
       .map((n) => ({ rule: 'R4', severity: 'warn', nodeIds: [n.id],
         message: `「${n.title}」没有公理支撑，也没有被任何主体需要`,
         hint: '它从哪条公理长出来的？指定一条，或标记为设定装饰', actions: ['指定公理', '标记为设定装饰'] }));

export const R5: Rule = ({ nodes, graph }) =>
  nodes.filter((n) => refs(graph, n.id).every((e) => e.type !== 'cites'))
       .map((n) => ({ rule: 'R5', severity: 'info', nodeIds: [n.id],
         message: `「${n.title}」从未进入正文`, hint: '要么用，要么删' }));

export const R10: Rule = ({ nodes }) =>
  nodes.filter((n) => n.body.trim().length < 20 && n.manifests.length === 0)
       .map((n) => ({ rule: 'R10', severity: 'warn', nodeIds: [n.id],
         message: `「${n.title}」只有标题`, hint: '补两句，或删' }));

export const R11: Rule = ({ nodes }) => {
  const axioms = nodes.filter((n) => n.kind === 'axiom');
  return axioms.length >= 3 ? [] : [{ rule: 'R11', severity: 'info', nodeIds: axioms.map((a) => a.id),
    message: `公理只有 ${axioms.length} 条，世界还不成立`, hint: '至少要 3 条' }];
};

export const R12: Rule = ({ nodes }) =>
  nodes.filter((n) => n.kind === 'axiom' && n.manifests.length < 2)
       .map((n) => ({ rule: 'R12', severity: 'warn', nodeIds: [n.id],
         message: `公理「${n.title}」只有 ${n.manifests.length} 个可感知表现（铁律二要求 ≥2）`,
         hint: '读者看不见这条公理', actions: ['给我三个表现候选'] }));

export const contentRules: Rule[] = [R4, R5, R10, R11, R12];
```

`src/engine/rules/index.ts`：

```ts
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
git add src/engine/rules src/engine/types.ts tests/engine/rules.test.ts
git commit -m "feat: 校验框架与内容规则 R4/R5/R10/R11/R12"
```

---

## Task 11: 结构规则 R6/R7/R8

**Files:**
- Create: `src/engine/rules/structural.ts`
- Modify: `src/engine/rules/index.ts`
- Test: `tests/engine/rules-structural.test.ts`

**Interfaces:**
- Produces: `R6`（别名冲突）、`R7`（派生链断裂）、`R8`（疑似同一物未合并），加入 `all`

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
  it('R7：条目 span 超出公理 span 时报 error', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'], span: { from: -1200, to: 700 } }),
      mk({ id: 'E-1', title: '脉正', derives: ['W-AX-1'], span: { from: 412, to: 720 } })
    ];
    const f = run(nodes).find((x) => x.rule === 'R7');
    expect(f?.severity).toBe('error');
    expect(f?.nodeIds).toEqual(['E-1']);
  });

  it('R7：span 完全被覆盖时不报', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'], span: { from: -1200, to: null } }),
      mk({ id: 'E-1', title: '脉正', derives: ['W-AX-1'], span: { from: 412, to: 720 } })
    ];
    expect(run(nodes).some((x) => x.rule === 'R7')).toBe(false);
  });

  it('R6：别名指向两个节点且 span 重叠时报 error', () => {
    const nodes = [
      mk({ id: 'E-1', title: '玄帝', aliases: ['玄天大帝'], span: { from: 300, to: null } }),
      mk({ id: 'E-2', title: '玄天大帝', aliases: ['玄帝'], span: { from: 500, to: null } })
    ];
    const f = run(nodes).find((x) => x.rule === 'R6');
    expect(f?.severity).toBe('error');
    expect(f?.nodeIds.sort()).toEqual(['E-1', 'E-2']);
  });

  it('R8：标题互相作为别名但没有 same_as 时给建议', () => {
    const nodes = [
      mk({ id: 'E-1', title: '玄帝', aliases: ['玄天大帝'] }),
      mk({ id: 'E-2', title: '玄天大帝' })
    ];
    expect(run(nodes).some((x) => x.rule === 'R8')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/rules-structural.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/rules/structural.ts
import type { Finding, Span } from '../types';
import type { Rule } from './content';

const overlaps = (a: Span, b: Span) => {
  const aEnd = a.to ?? Infinity, bEnd = b.to ?? Infinity;
  const aStart = a.from ?? -Infinity, bStart = b.from ?? -Infinity;
  return aStart <= bEnd && bStart <= aEnd;
};
const covers = (outer: Span, inner: Span) => {
  const oStart = outer.from ?? -Infinity, oEnd = outer.to ?? Infinity;
  const iStart = inner.from ?? -Infinity, iEnd = inner.to ?? Infinity;
  return iStart >= oStart && iEnd <= oEnd;
};

export const R7: Rule = ({ nodes }) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Finding[] = [];
  for (const n of nodes) {
    for (const axId of n.derives) {
      const ax = byId.get(axId);
      if (ax && ax.kind === 'axiom' && !covers(ax.span, n.span)) {
        out.push({ rule: 'R7', severity: 'error', nodeIds: [n.id],
          message: `派生链断裂：「${n.title}」的生效区间超出公理「${ax.title}」`,
          hint: '公理已经终止，依赖它的条目却还在',
          actions: ['指定新公理', '截断条目区间', '忽略'] });
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
      const a = byId.get(uniq[i]!), b = byId.get(uniq[j]!);
      if (!a || !b || !overlaps(a.span, b.span)) continue;
      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ rule: 'R6', severity: 'error', nodeIds: [a.id, b.id],
        message: `同一名称在重叠时间内指向两个条目：「${a.title}」与「${b.title}」`,
        hint: '合并，或加时间/地域限定', actions: ['合并为同一实体', '加时间限定'] });
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
    out.push({ rule: 'R8', severity: 'warn', nodeIds: [n.id, other.id],
      message: `「${n.title}」把「${other.title}」当成别名，但两者没有合并`,
      hint: '它们是同一个东西吗？', actions: ['建立 same_as', '删除该别名'] });
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

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/rules-structural.test.ts` → PASS（4 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/engine/rules tests/engine/rules-structural.test.ts
git commit -m "feat: 结构规则 R6/R7/R8（别名冲突/派生链断裂/未合并）"
```

---

## Task 12: 显式冲突规则 R1/R2/R3

**Files:**
- Create: `src/engine/rules/explicit.ts`
- Modify: `src/engine/rules/index.ts`
- Test: `tests/engine/rules-explicit.test.ts`

**Interfaces:**
- Produces: `explicitRules: Rule[]`（R1/R2/R3），加入 `all`

**设计说明（写进代码注释）**：语义互斥无法在 P0 自动判定，所以 R1/R3 依据**显式登记的 `conflicts_with` 边**；真正的语义互斥检测留给 P1 的 AI 审问。R2 依据 `firm` 节点的 `violations` 字段是否有对应后果节点。

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
  it('R1：两条 hard 被登记为互斥时报 error', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '法则甲', kind: 'axiom', strength: 'hard', cost: ['甲'], conflictsWith: ['W-AX-2'] }),
      mk({ id: 'W-AX-2', title: '法则乙', kind: 'axiom', strength: 'hard', cost: ['乙'] })
    ];
    const f = run(nodes).find((x) => x.rule === 'R1');
    expect(f?.severity).toBe('error');
    expect(f?.nodeIds.sort()).toEqual(['W-AX-1', 'W-AX-2']);
  });

  it('R3：myth 与 hard 冲突只给 info，并追问谁在撒谎', () => {
    const nodes = [
      mk({ id: 'E-1', title: '玄帝传说', strength: 'myth', conflictsWith: ['W-AX-1'] }),
      mk({ id: 'W-AX-1', title: '法则甲', kind: 'axiom', strength: 'hard', cost: ['甲'] })
    ];
    const f = run(nodes).find((x) => x.rule === 'R3');
    expect(f?.severity).toBe('info');
    expect(f?.hint).toMatch(/撒谎/);
  });

  it('R2：firm 记了违反但没有后果节点时报 warn', () => {
    const nodes = [mk({ id: 'E-1', title: '法师不得为己施法', strength: 'firm', violations: ['有人偷偷做过'] })];
    expect(run(nodes).some((x) => x.rule === 'R2')).toBe(true);
  });

  it('R2：firm 被其它条目引用（后果已登记）时不报', () => {
    const nodes = [
      mk({ id: 'E-1', title: '法师不得为己施法', strength: 'firm', violations: ['有人偷偷做过'] }),
      mk({ id: 'E-2', title: '废籍之刑', requires: ['E-1'], derives: ['W-AX-1'] })
    ];
    expect(run(nodes).some((x) => x.rule === 'R2')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/rules-explicit.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/rules/explicit.ts
import type { Finding } from '../types';
import type { Rule } from './content';

// 说明：P0 不做语义互斥检测（那需要 AI 判读）。
// R1/R3 依据显式登记的 conflicts_with 边；语义层留给 P1 的「审问」。

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
    const a = byId.get(from), b = byId.get(to);
    if (!a || !b || a.strength !== 'hard' || b.strength !== 'hard') continue;
    const key = [from, to].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ rule: 'R1', severity: 'error', nodeIds: [a.id, b.id],
      message: `两条 hard 法则登记为互斥：「${a.title}」与「${b.title}」`,
      hint: '它们不可能同时成立', actions: ['改 A', '改 B', '限定为不同地区/年代'] });
  }
  return out;
};

export const R3: Rule = ({ nodes }) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const [from, to] of edges(nodes)) {
    const a = byId.get(from), b = byId.get(to);
    if (!a || !b) continue;
    const myth = a.strength === 'myth' ? a : b.strength === 'myth' ? b : null;
    const hard = a.strength === 'hard' ? a : b.strength === 'hard' ? b : null;
    if (!myth || !hard) continue;
    const key = [myth.id, hard.id].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ rule: 'R3', severity: 'info', nodeIds: [myth.id, hard.id],
      message: `「${myth.title}」与硬法则「${hard.title}」冲突——这是设定好的误会吗？`,
      hint: '谁在撒这个谎，他得到什么？', actions: ['生成认知记录', '标记为民间误传'] });
  }
  return out;
};

export const R2: Rule = ({ nodes, graph }) => {
  const out: Finding[] = [];
  for (const n of nodes) {
    if (n.strength !== 'firm' || n.violations.length === 0) continue;
    const consequence = (graph.inbound.get(n.id) ?? []).some((e) => e.type === 'requires' || e.type === 'derives');
    if (!consequence) {
      out.push({ rule: 'R2', severity: 'warn', nodeIds: [n.id],
        message: `「${n.title}」写了有人违反，但没有登记后果`,
        hint: '破规矩要付代价：补一个后果条目，或降级为 soft',
        actions: ['补后果条目', '降级为 soft'] });
    }
  }
  return out;
};

export const explicitRules: Rule[] = [R1, R2, R3];
```

`src/engine/rules/index.ts`：

```ts
const all: Rule[] = [...contentRules, ...structuralRules, ...explicitRules];
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/rules-explicit.test.ts` → PASS（4 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/engine/rules tests/engine/rules-explicit.test.ts
git commit -m "feat: 显式冲突规则 R1/R2/R3"
```

---

## Task 13: CLI 体检器 + 诊断清单界面

**Files:**
- Create: `src/server/cli.ts`, `src/ui/views/Findings.tsx`
- Modify: `src/server/api.ts`（`GET /findings`）、`src/ui/App.tsx`
- Test: `tests/server/api-findings.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/worlds/:w/findings` → `Finding[]`
  - `npm run check <worldId>` → 终端彩色输出，退出码：有 error 时 1，否则 0

- [ ] **Step 1: 写失败测试**

```ts
// tests/server/api-findings.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer } from '../../src/server/api';
import * as store from '../../src/server/store';

let root: string; let base: string; let close: () => Promise<void>;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-find-'));
  const server = createServer(root);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
  await store.createWorld(root, '记忆之世', 'id: 记忆之世\ntitle: 记忆之世\ngenre: { allowed: [], forbidden: [], expectation: "" }\ncalendar:\n  epochs: [{ name: 新历, start: 1, end: null }]\n  format: "{year}"\ntheme:\n  wound: 伤口\n  motif: 母题\n');
});
afterAll(async () => { await close(); await rm(root, { recursive: true, force: true }); });

describe('findings 接口', () => {
  it('返回带规则号与严重度的清单', async () => {
    await store.writeNode(root, '记忆之世', {
      id: 'E-1', kind: 'entry', subtype: null, title: '无根条目', aliases: [],
      strength: 'soft', span: { from: null, to: null }, proposition: null, cost: [],
      derives: [], manifests: [], requires: [], conflictsWith: [], sameAs: [], violations: [],
      body: '这是一段足够长的正文内容，用来避免 R10 触发。', file: ''
    });
    const list = await (await fetch(`${base}/api/worlds/记忆之世/findings`)).json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((f: any) => f.rule === 'R4')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/server/api-findings.test.ts` → FAIL

- [ ] **Step 3: 实现 API 路由**

```ts
      if (parts[3] === 'findings' && req.method === 'GET') {
        const g = await loadGraph(worldId);
        const nodes = await store.listNodes(root, worldId);
        return send(res, 200, runRules({ nodes, graph: g }));
      }
```

`src/server/cli.ts`：

```ts
import { runRules } from '../engine/rules';
import { buildGraph } from '../engine/graph';
import * as store from './store';

const ICON = { error: '🔴', warn: '🟡', info: '⚪' } as const;

async function main() {
  const root = process.cwd();
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

Run: `npm test -- tests/server/api-findings.test.ts` → PASS
Run: `npx tsx src/server/cli.ts 记忆之世` → 打印按严重度分组的清单

- [ ] **Step 5: 诊断清单界面**

`src/ui/views/Findings.tsx`：

```tsx
import { useEffect, useState } from 'react';
import { j } from '../api';

const ICON: Record<string, string> = { error: '🔴', warn: '🟡', info: '⚪' };

export function Findings({ worldId, onOpen }: { worldId: string; onOpen: (id: string) => void }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { j<any[]>(`/api/worlds/${encodeURIComponent(worldId)}/findings`).then(setList).catch(() => setList([])); }, [worldId]);
  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
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
            {(f.actions ?? []).map((a: string) => <span key={a} style={{ fontSize: 12, color: '#0a7', marginRight: 12 }}>[{a}]</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}
```

`App.tsx` 侧栏加一项「诊断清单」，`state` 增加 `view: 'nodes' | 'findings'`，切到 findings 时渲染 `<Findings worldId={worldId} onOpen={(id) => readNode(worldId, id).then(setCurrent)} />`。

- [ ] **Step 6: 手动验证**

Run: `npm run dev` → 点「诊断清单」→ 见到 R4/R5/R11 等条目；点条目按钮 → 跳到该条目编辑页。
Run: `npm run check` → 终端输出同一份清单。

- [ ] **Step 7: 提交**

```bash
git add src/server/cli.ts src/server/api.ts src/ui tests/server/api-findings.test.ts
git commit -m "feat: CLI 体检器与诊断清单界面"
```

---

## Task 14: 时间切片 `stateAt` 与时间轴界面

**Files:**
- Create: `src/engine/query.ts`, `src/ui/views/Timeline.tsx`
- Modify: `src/server/api.ts`、`src/ui/App.tsx`
- Test: `tests/engine/query.test.ts`

**Interfaces:**
- Produces:
  - `stateAt(nodes: WorldNode[], year: number): WorldNode[]`
  - `citationsFor(graph: Graph, id: string): { fragments: string[]; nodes: { id: string; via: EdgeType }[] }`
  - `GET /api/worlds/:w/at?year=612` → `{ year, nodes: {id,title,strength,span}[] }`

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

describe('stateAt', () => {
  const nodes = [
    mk({ id: 'E-1', title: '脉正', span: { from: 412, to: 720 } }),
    mk({ id: 'E-2', title: '记忆当铺', span: { from: 588, to: null } }),
    mk({ id: 'E-3', title: '禁法运动', span: { from: 572, to: 600 } }),
    mk({ id: 'E-4', title: '还脉礼', span: { from: 300, to: null } })
  ];

  it('612 年在场的条目', () => {
    expect(stateAt(nodes, 612).map((n) => n.id)).toEqual(['E-1', 'E-2', 'E-4']);
  });

  it('600 年是禁法运动的最后一年（含端点）', () => {
    expect(stateAt(nodes, 600).map((n) => n.id)).toContain('E-3');
  });

  it('601 年就不再包含', () => {
    expect(stateAt(nodes, 601).map((n) => n.id)).not.toContain('E-3');
  });

  it('from 为 null 表示一直存在', () => {
    expect(stateAt([mk({ id: 'E-9', title: '永恒', span: { from: null, to: null } })], -5000)).toHaveLength(1);
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
    nodes: edges.filter((e) => e.type !== 'cites')
      .map((e) => ({ id: e.from, via: e.type }))
  };
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/query.test.ts` → PASS（4 个用例）

- [ ] **Step 5: API 与界面**

`api.ts` 新增：

```ts
      if (parts[3] === 'at' && req.method === 'GET') {
        const year = Number(url.searchParams.get('year') ?? 0);
        const nodes = await store.listNodes(root, worldId);
        return send(res, 200, {
          year,
          nodes: stateAt(nodes, year).map((n) => ({ id: n.id, title: n.title, strength: n.strength, span: n.span }))
        });
      }
```

`src/ui/views/Timeline.tsx`：

```tsx
import { useEffect, useState } from 'react';
import { j } from '../api';

export function Timeline({ worldId, onOpen }: { worldId: string; onOpen: (id: string) => void }) {
  const [year, setYear] = useState(612);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    j<any>(`/api/worlds/${encodeURIComponent(worldId)}/at?year=${year}`).then((r) => setRows(r.nodes)).catch(() => setRows([]));
  }, [worldId, year]);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ marginTop: 0 }}>时间轴</h2>
      <div style={{ marginBottom: 16 }}>
        <input type="range" min={0} max={800} value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 480 }} />
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

`App.tsx` 侧栏加入「时间轴」，`view` 增加 `'timeline'` 分支。

- [ ] **Step 6: 手动验证**

Run: `npm run dev` → 打开「时间轴」→ 拖动滑块到 612 → 列表只剩该年在场的条目；拖到 601 → 「禁法运动」消失。

- [ ] **Step 7: 提交**

```bash
git add src/engine/query.ts src/ui tests/engine/query.test.ts
git commit -m "feat: 时间切片 stateAt 与时间轴界面"
```

---

# M3 · 收口（能完整跑验收）

## Task 15: 三步开局引导与公理强制

**Files:**
- Create: `src/ui/views/Onboarding.tsx`
- Modify: `src/ui/App.tsx`、`src/server/api.ts`（新增 `GET /stats`）
- Test: `tests/server/api-stats.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/worlds/:w/stats` → `{ axioms: number; entries: number; manifestedAxioms: number }`
  - 首屏在 `axioms < 3` 时显示三步引导，`axioms >= 3` 后进入正常界面

- [ ] **Step 1: 写失败测试**

```ts
// tests/server/api-stats.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer } from '../../src/server/api';
import * as store from '../../src/server/store';

let root: string; let base: string; let close: () => Promise<void>;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-stats-'));
  const server = createServer(root);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
  await store.createWorld(root, '记忆之世', 'id: 记忆之世\ntitle: 记忆之世\ngenre: { allowed: [], forbidden: [], expectation: "" }\ncalendar:\n  epochs: [{ name: 新历, start: 1, end: null }]\n  format: "{year}"\ntheme:\n  wound: 伤口\n  motif: 母题\n');
});
afterAll(async () => { await close(); await rm(root, { recursive: true, force: true }); });

describe('stats', () => {
  it('统计公理数与已落表现的公理数', async () => {
    await store.writeNode(root, '记忆之世', {
      id: 'W-AX-1', kind: 'axiom', subtype: null, title: '记忆即燃料', aliases: [],
      strength: 'hard', span: { from: null, to: null }, proposition: '烧记忆', cost: ['记忆'],
      derives: [], manifests: [], requires: [], conflictsWith: [], sameAs: [], violations: [], body: '正文', file: ''
    });
    const s = await (await fetch(`${base}/api/worlds/记忆之世/stats`)).json();
    expect(s.axioms).toBe(1);
    expect(s.manifestedAxioms).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/server/api-stats.test.ts` → FAIL

- [ ] **Step 3: 实现 API**

```ts
      if (parts[3] === 'stats' && req.method === 'GET') {
        const nodes = await store.listNodes(root, worldId);
        const axioms = nodes.filter((n) => n.kind === 'axiom');
        return send(res, 200, {
          axioms: axioms.length,
          entries: nodes.filter((n) => n.kind === 'entry').length,
          manifestedAxioms: axioms.filter((a) => a.manifests.length >= 2).length
        });
      }
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/server/api-stats.test.ts` → PASS

- [ ] **Step 5: 三步引导界面**

`src/ui/views/Onboarding.tsx`：

```tsx
import { useState } from 'react';
import { j } from '../api';

export function Onboarding({ worldId, stats, onDone }: { worldId: string; stats: any; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');

  const addAxiom = async () => {
    if (!title.trim() || !cost.trim()) return;
    const id = `W-AX-${Date.now()}`;
    await j(`/api/worlds/${encodeURIComponent(worldId)}/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ id, kind: 'axiom', title, strength: 'hard', cost: cost.split(/[、,]/).map((s) => s.trim()).filter(Boolean) })
    });
    setTitle(''); setCost(''); onDone();
  };

  return (
    <div style={{ padding: 32, maxWidth: 660 }}>
      <h2>开始一个世界</h2>
      <p style={{ color: '#666' }}>① 这个世界最根本的缺失是什么？（在 world.yaml 的 theme.wound 里）</p>
      <p style={{ color: '#666' }}>② 至少三条公理，每条必须付出代价。当前 {stats?.axioms ?? 0} / 3</p>
      <div style={{ marginTop: 12 }}>
        <input placeholder="公理，例如：施法会永久烧毁施法者的记忆" value={title}
               onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} />
        <input placeholder="代价，用顿号分隔，例如：记忆、身份" value={cost}
               onChange={(e) => setCost(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 8 }} />
        <button onClick={addAxiom} style={{ marginTop: 8 }}>加一条公理</button>
      </div>
      <p style={{ color: '#666', marginTop: 20 }}>
        ③ 每条公理至少两个“能看见的东西” —— 公理建好后，在条目页给它们挂表现。
        当前已达标 {stats?.manifestedAxioms ?? 0} / {stats?.axioms ?? 0}
      </p>
    </div>
  );
}
```

`App.tsx`：拉 `stats`，当 `stats.axioms < 3` 时渲染 `<Onboarding />` 而不是主界面。

- [ ] **Step 6: 手动验证**

Run: `npm run dev` → 新世界里只显示三步引导 → 填一条不含代价的公理 → 保存失败并显示“公理必须付出代价（铁律一）”→ 加上代价后成功，计数从 0/3 变为 1/3 → 三条之后进入正常界面。

- [ ] **Step 7: 提交**

```bash
git add src/ui/views/Onboarding.tsx src/ui/App.tsx src/server/api.ts tests/server/api-stats.test.ts
git commit -m "feat: 三步开局引导与公理代价强制"
```

---

## Task 16: `index.json` 重建与启动加载

**Files:**
- Create: `src/server/indexFile.ts`
- Modify: `src/server/api.ts`（每次读取前确保索引可用；写入后失效）
- Test: `tests/server/indexFile.test.ts`

**Interfaces:**
- Produces:
  - `rebuildIndex(root, worldId): Promise<{ builtAt: string; nodeCount: number; edgeCount: number }>`（写 `<world>/index.json`）
  - `loadIndex(root, worldId): Promise<unknown>`（读；不存在则先重建）
  - `invalidateIndex(root, worldId): Promise<void>`（删文件）

- [ ] **Step 1: 写失败测试**

```ts
// tests/server/indexFile.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../../src/server/store';
import { rebuildIndex, invalidateIndex } from '../../src/server/indexFile';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-idx-'));
  await store.createWorld(root, '记忆之世', 'id: 记忆之世\ntitle: 记忆之世\ngenre: { allowed: [], forbidden: [], expectation: "" }\ncalendar:\n  epochs: [{ name: 新历, start: 1, end: null }]\n  format: "{year}"\ntheme:\n  wound: 伤口\n  motif: 母题\n');
});

describe('index.json', () => {
  it('可以重建并统计节点与边', async () => {
    await store.writeNode(root, '记忆之世', {
      id: 'E-1', kind: 'entry', subtype: null, title: '欠名录', aliases: [], strength: 'soft',
      span: { from: null, to: null }, proposition: null, cost: [], derives: ['W-AX-1'],
      manifests: [], requires: [], conflictsWith: [], sameAs: [], violations: [], body: '', file: ''
    });
    const r = await rebuildIndex(root, '记忆之世');
    expect(r.nodeCount).toBe(1);
    expect(r.edgeCount).toBe(1);
    expect((await stat(join(root, 'data', 'worlds', '记忆之世', 'index.json'))).isFile()).toBe(true);
  });

  it('删除后文件不存在（可重建的派生品）', async () => {
    await rebuildIndex(root, '记忆之世');
    await invalidateIndex(root, '记忆之世');
    await expect(stat(join(root, 'data', 'worlds', '记忆之世', 'index.json'))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/server/indexFile.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/server/indexFile.ts
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { buildGraph } from '../engine/graph';
import * as store from './store';

const indexPath = (root: string, worldId: string) => join(root, 'data', 'worlds', worldId, 'index.json');

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

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/server/indexFile.test.ts` → PASS

- [ ] **Step 5: 接到写入路径**

`api.ts` 中所有 `store.writeNode` / `store.deleteNode` / `store.writeFragment` 之后调用 `await invalidateIndex(root, worldId);`。`GET /findings` 与 `GET .../citations` 之前调用 `await loadIndex(root, worldId);`（确保索引存在，但不作为数据源——graph 仍由文件实时构建）。

- [ ] **Step 6: 手动验证**

Run: `npm run check` → 生成 `data/worlds/记忆之世/index.json`；删掉该文件 → 再跑一次 → 自动重建，输出不变。

- [ ] **Step 7: 提交**

```bash
git add src/server/indexFile.ts src/server/api.ts tests/server/indexFile.test.ts
git commit -m "feat: index.json 重建与启动加载"
```

---

## Task 17: 四条验收测试

**Files:**
- Create: `tests/acceptance/acceptance.test.ts`
- Create: `docs/superpowers/plans/acceptance-checklist.md`

**Interfaces:**
- Consumes: 全部前置任务的公开 API
- Produces: 可重复运行的验收套件，覆盖 spec §9 的四条

- [ ] **Step 1: 写验收测试（四条）**

```ts
// tests/acceptance/acceptance.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer } from '../../src/server/api';

let root: string; let base: string; let close: () => Promise<void>;
const W = '记忆之世';
const put = (id: string, body: unknown) =>
  fetch(`${base}/api/worlds/${W}/nodes/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-acc-'));
  const server = createServer(root);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
  await fetch(`${base}/api/worlds`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: W, config: `id: ${W}\ntitle: ${W}\ngenre: { allowed: [超自然], forbidden: [], expectation: "" }\ncalendar:\n  epochs: [{ name: 新历, start: 1, end: null }]\n  format: "{year}"\ntheme:\n  wound: 一个靠抽干世界来维持秩序的世界\n  motif: 记忆即代价\n` })
  });
});
afterAll(async () => { await close(); await rm(root, { recursive: true, force: true }); });

describe('验收一：半小时造世界（简化版，验证链路而非计时）', () => {
  it('5 公理 + 若干条目 + 1 片段，全程只走 HTTP', async () => {
    for (let i = 1; i <= 5; i++) {
      const r = await put(`W-AX-${i}`, { id: `W-AX-${i}`, kind: 'axiom', title: `公理${i}`, strength: 'hard', cost: [`代价${i}`], manifes: undefined });
      expect(r.status).toBe(200);
    }
    for (let i = 1; i <= 6; i++) {
      const r = await put(`E-${i}`, { id: `E-${i}`, kind: 'entry', title: `条目${i}`, strength: 'soft', derives: ['W-AX-1'], body: '这是足够长的正文内容，用来避免 R10 触发。' });
      expect(r.status).toBe(200);
    }
    const list = await (await fetch(`${base}/api/worlds/${W}/nodes`)).json();
    expect(list).toHaveLength(11);
    expect((await readFile(join(root, 'data', 'worlds', W, 'world.yaml'), 'utf8'))).toContain('wound');
  });
});

describe('验收二：故意埋雷（hard×hard）', () => {
  it('诊断清单能同时定位两条并给出三种解法', async () => {
    await put('W-AX-9', { id: 'W-AX-9', kind: 'axiom', title: '禁法法则', strength: 'hard', cost: ['秩序'], conflicts_with: ['W-AX-1'] });
    const list = await (await fetch(`${base}/api/worlds/${W}/findings`)).json();
    const r1 = list.find((f: any) => f.rule === 'R1');
    expect(r1).toBeTruthy();
    expect(r1.nodeIds.sort()).toEqual(['W-AX-1', 'W-AX-9']);
    expect(r1.actions).toHaveLength(3);
  });
});

describe('验收三：时间断层（R7）', () => {
  it('截断公理 span 后依赖它的条目立刻报 error', async () => {
    await put('W-AX-2', { id: 'W-AX-2', kind: 'axiom', title: '公理2', strength: 'hard', cost: ['代价2'], span: { from: 1, to: 700 } });
    await put('E-7', { id: 'E-7', kind: 'entry', title: '脉正', strength: 'firm', derives: ['W-AX-2'], span: { from: 412, to: 720 }, body: '这是一段足够长的正文内容避免 R10。' });
    const list = await (await fetch(`${base}/api/worlds/${W}/findings`)).json();
    const r7 = list.find((f: any) => f.rule === 'R7');
    expect(r7?.severity).toBe('error');
    expect(r7?.nodeIds).toContain('E-7');
  });
});

describe('验收四：删除保护', () => {
  it('被引用的条目删除返回 409 并列出引用处', async () => {
    await fetch(`${base}/api/worlds/${W}/nodes/E-1/citations`); // 确保索引可用
    const res = await fetch(`${base}/api/worlds/${W}/nodes/W-AX-1`, { method: 'DELETE' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.refs.nodes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/acceptance` → FAIL（因为还没有 `E-7` 的实现依赖顺序问题等，先确认测试能跑起来并暴露缺口）

- [ ] **Step 3: 修正实现让验收通过**

按失败信息逐一修：若 `PUT` 未把 `conflicts_with` 透传，修 `toNode`；若 `R7` 未在 `firm` 条目上触发，检查 `R7` 是否只对 `kind: 'axiom'` 判断（应当对任意 `derives` 生效）。

- [ ] **Step 4: 全部测试通过**

Run: `npm test`
Expected: 所有测试绿色，包含 acceptance 四组。

- [ ] **Step 5: 写人工验收清单**

`docs/superpowers/plans/acceptance-checklist.md`：

```markdown
# 世界观 P0 人工验收清单

1. `npm install && npm run dev` → 浏览器打开 5173，无报错
2. 造世界：填母题 → 加 3 条公理（故意有一条不填代价 → 必须被拒）→ 进入主界面
3. 写条目：新建「还脉礼」→ 写正文 → 保存 → 刷新仍在 → 用记事本打开 `data/worlds/<世界>/nodes/还脉礼.md` 确认可读
4. 引用：在 `fragments/` 建一个含 `[[还脉礼]]` 的片段 → 条目页底部显示“被片段引用”
5. 删除保护：删「还脉礼」→ 被 409 拦住并列出片段名
6. 体检：`npm run check` → 看到 R4/R11/R12 等；界面「诊断清单」显示同一份
7. 时间轴：拖到 612 年 → 只剩该年在场的条目
8. 未定义专名：片段里写 `[[不存在的词]]` → 侧栏出现提示
```

- [ ] **Step 6: 提交**

```bash
git add tests/acceptance docs/superpowers/plans/acceptance-checklist.md
git commit -m "test: 四条验收测试与人工验收清单"
```

---

## Self-Review

**1. Spec coverage**

| Spec 要求 | 落在哪个任务 |
|---|---|
| world.yaml（契约/历法/母题） | Task 3 |
| 节点 CRUD + 两个框录入 | Task 2、4、5 |
| 边 derives / manifests / cites | Task 7 |
| 边 requires / conflicts / same_as | Task 7（构建）、12（冲突规则用） |
| `stateAt(year)` | Task 14 |
| R1–R12 | Task 10（R4/R5/R10/R11/R12）、11（R6/R7/R8）、12（R1/R2/R3）；**R9 未实现** |
| 三/四视图 | Task 5（条目页/列表）、13（诊断清单）、14（时间轴）；卡片墙在 M0 用左侧列表代替，未单独建视图 |
| 极简片段库 | Task 8、9 |
| 未定义专名扫描 | Task 9（`/graph/missing` + 侧栏提示） |
| 三步开局引导 | Task 15 |
| index.json 可重建 | Task 16 |
| 四条验收测试 | Task 17 |
| 删除保护 | Task 9 |

**已知缺口（必须在计划中显式记录，不许假装覆盖）**：
- **R9（belief 与 hard 冲突）未实现**。它需要 `stance` 字段与置信度阈值，属 P1。
- **卡片墙视图未单独实现**，M0 用左侧列表承担浏览职责。若验收时认为不够，作为 P1 补。
- **R1 的语义互斥**只检测显式登记的 `conflicts_with`，真正的语义判定留给 P1 的 AI 审问。

**2. Placeholder scan**：已逐任务检查，无 “TBD / TODO / 类似 Task N / 适当处理错误”。

**3. Type consistency**：`WorldNode` 字段名在 Task 2 定义，Task 4/5/7/10–17 全部使用同名（`conflictsWith` / `sameAs` / `violations`）；front matter 的 snake_case（`conflicts_with` / `same_as`）只在 `frontmatter.ts` 与 `api.ts` 的 `toNode` 中出现，转换点唯一。
