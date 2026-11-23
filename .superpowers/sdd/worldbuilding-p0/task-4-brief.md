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

