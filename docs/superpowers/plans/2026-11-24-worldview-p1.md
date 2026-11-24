# 世界观 P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 补上 spec §3.4/§8 P1 的核心：belief 数据与编辑、R9、世界删除、力导向图谱，以及不依赖模型的「命题归纳/审问/裁决建议」。

**Architecture:** belief 继续走「一文件一记录 + front matter」；R9 是纯规则；图谱布局是纯函数（无 d3）；建议是服务端确定性文本生成，UI 只展示/填入。AI 模型接入单独列为可选端点，不阻塞 P1。

**Tech Stack:** TypeScript strict、React 18、Vitest、esbuild、YAML。

**Spec:** `docs/superpowers/specs/2026-11-23-worldbuilding-spec.md` §3.4、§5、§8 P1

## Global Constraints

- 不改 P0 的节点文件格式；belief 用 `worlds/<world>/beliefs/<id>.yaml`。
- R9 只做「可解释的近似」：hard + confidence > 0.8 + 文本不一致，消息必须提示人工确认。
- 图谱布局必须确定性（同输入同输出），不引入随机数。
- 建议功能明确标注「本地建议」；没有模型端点时不输出“AI 已生成”的假话。
- 每个任务先写失败测试，再实现，跑 `npm run verify` 后提交。

---

### Task 8: belief 数据模型 + 存储 + API + 编辑界面

**Files:**
- Modify: `src/engine/types.ts`
- Create: `src/engine/beliefs.ts`
- Create: `tests/engine/beliefs.test.ts`
- Modify: `src/host/store.ts`
- Modify: `src/host/handlers.ts`
- Create: `tests/host/handlers-beliefs.test.ts`
- Modify: `src/ui/api.ts`
- Create: `src/ui/views/Beliefs.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- `Belief`: `{ id: string; holder: string; target: string; content: string; confidence: number; source: string[]; span: Span; file: string }`
- `parseBelief(raw: string, fallbackId: string): Belief`
- `serializeBelief(b: Belief): string`
- `listBeliefs(root, world): Promise<Belief[]>`
- `writeBelief(root, world, b): Promise<void>`
- `deleteBelief(root, world, id): Promise<void>`
- API: `GET /worlds/:w/beliefs`, `PUT/DELETE /worlds/:w/beliefs/:id`

- [x] **Step 1: Write failing engine tests**

```ts
import { expect, it } from 'vitest';
import { parseBelief, serializeBelief } from '../../src/engine/beliefs.js';

it('解析 belief front matter 与字段', () => {
  const raw = `---\nholder: 民间\ntarget: W-MY-001\ncontent: 玄帝曾一统天下\nconfidence: 0.9\nsource: [说书人, 童谣]\nspan: { from: 300, to: null }\n---\n`;
  const b = parseBelief(raw, '玄帝传说');
  expect(b).toMatchObject({ id: '玄帝传说', holder: '民间', target: 'W-MY-001', confidence: 0.9 });
  expect(b.source).toEqual(['说书人', '童谣']);
  expect(b.span).toEqual({ from: 300, to: null });
});
```

- [x] **Step 2: Run to fail**

Run: `npm test -- tests/engine/beliefs.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement engine + store**

`Belief` uses `id`, `holder`, `target`, `content`, `confidence`, `source`, `span`, `file`. Validate:
- holder/target/content non-empty;
- confidence finite and 0..1; else throw.
- serialize via existing `frontmatter` helpers or simple YAML lines; use `stringify` from existing engine? Prefer `serialize` in `frontmatter.ts` to preserve style.
- store path `beliefs/<id>.yaml`, `isSafeName`, list `.yaml`, parse.

- [x] **Step 4: Add handlers tests**

- POST world, PUT belief, GET list, PUT invalid confidence -> 400/422, DELETE -> 204, missing -> 404.

- [x] **Step 5: Implement handlers + UI API**

- `GET /beliefs` -> `Belief[]`
- `PUT /beliefs/:id` -> 200, validates id/path.
- `DELETE` -> 204/404.
- UI `listBeliefs/saveBelief/deleteBelief`.

- [x] **Step 6: Build Beliefs view**

- left list: holder + target title; new button.
- right form: id, holder, target select (all nodes), content textarea, confidence number 0..1, source input (comma), span from/to.
- save/delete; error.
- App tab `beliefs`「认知」；pass nodes? Beliefs can fetch nodes itself; onChanged refresh.

- [x] **Step 7: Verify + commit**

Run: `npm run verify`
```bash
git add src/engine/types.ts src/engine/beliefs.ts tests/engine/beliefs.test.ts src/host/store.ts src/host/handlers.ts tests/host/handlers-beliefs.test.ts src/ui/api.ts src/ui/views/Beliefs.tsx src/ui/App.tsx public/app.js
git commit -m "feat: belief 认知层与编辑界面"
```

---

### Task 9: R9 高置信认知与 hard 冲突

**Files:**
- Create: `src/engine/rules/belief.ts`
- Create: `tests/engine/rules-belief.test.ts`
- Modify: `src/engine/rules/index.ts`
- Modify: `src/host/handlers.ts` (findings load beliefs)

**Interfaces:**
- `r9Beliefs(nodes, beliefs): Finding[]`

- [x] **Step 1: Failing tests**

- hard 目标 + confidence 0.9 + content 不含 title/proposition -> one warn R9 with both ids.
- soft 目标 -> none.
- confidence 0.8 (not >0.8) -> none.
- content 含 target title -> none.

- [x] **Step 2: Implement**

```ts
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
export function r9Beliefs(nodes: WorldNode[], beliefs: Belief[]): Finding[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return beliefs.flatMap((b) => {
    const n = byId.get(b.target);
    if (!n || n.strength !== 'hard' || b.confidence <= 0.8) return [];
    const hay = [n.title, ...n.aliases, n.proposition ?? ''].map(norm).filter(Boolean);
    const claim = norm(b.content);
    if (hay.some((h) => h && claim.includes(h))) return [];
    return [{
      rule: 'R9', severity: 'info' as const, nodeIds: [n.id, b.id],
      message: `${b.holder} 以 ${b.confidence} 的置信相信「${b.content}」，与 hard 条目「${n.title}」不一致；请确认是误解还是写漏`,
    }];
  });
}
```

- [x] **Step 3: Wire**

- `findings` handler loads beliefs and concatenates.
- CLI? `check` uses handlers? likely. Ensure no crash if beliefs dir missing.

- [x] **Step 4: Test + commit**

Run: `npm run verify`
```bash
git add src/engine/rules/belief.ts tests/engine/rules-belief.test.ts src/engine/rules/index.ts src/host/handlers.ts public/app.js
git commit -m "feat: R9 高置信认知冲突"
```

---

### Task 10: 世界删除（多作品管理）

**Files:**
- Modify: `src/host/store.ts`
- Modify: `src/host/handlers.ts`
- Create: `tests/host/handlers-worlds.test.ts`
- Modify: `src/ui/api.ts`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- `deleteWorld(root, id): Promise<void>`
- `DELETE /worlds/:id` -> 204 / 404
- `deleteWorld(id)` in UI API

- [x] **Step 1: Failing handler test**

- POST two worlds, DELETE one -> 204; list only other; DELETE again -> 404.
- `DELETE /worlds/..%2F..` -> 400 (path safety).

- [x] **Step 2: Implement**

- store uses `rm(dir, { recursive: true, force: false })`, validates `isSafeName`.
- handler calls store, invalidates caches (no cache? index per world; fine).
- UI delete button with confirm; after delete reload worlds; if deleted current, pick first or empty.
- Keep create/switch.

- [x] **Step 3: Verify + commit**

Run: `npm run verify`
```bash
git add src/host/store.ts src/host/handlers.ts tests/host/handlers-worlds.test.ts src/ui/api.ts src/ui/App.tsx public/app.js
git commit -m "feat: 删除世界"
```

---

### Task 11: 力导向图谱视图

**Files:**
- Create: `src/ui/graphLayout.ts`
- Create: `tests/ui/graph-layout.test.ts`
- Create: `src/ui/views/Graph.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- `buildEdges(nodes): { source: string; target: string; via: string }[]`
- `forceLayout(nodes, edges, opts): Map<string, { x: number; y: number }>`

- [x] **Step 1: Failing tests**

- `buildEdges` includes derives/manifests/requires/conflicts/same, dedupes.
- `forceLayout` returns finite positions for all nodes, deterministic (two calls equal), within width/height.

- [x] **Step 2: Implement deterministic FR layout**

- initialize circle (index-based).
- 120 iterations; repulsion `k*k/d`, attraction `d*d/k`, gravity to center, cooling.
- clamp.

- [x] **Step 3: Build SVG view**

- width/height from `window.innerWidth`? Use fixed viewBox 1000x700 and `preserveAspectRatio`; simpler.
- edges lines colored by `via`; nodes circles + labels; axioms larger/dark.
- click node -> `onOpen(id)`.
- legend.

- [x] **Step 4: App tab + verify/commit**

Run: `npm run verify`
```bash
git add src/ui/graphLayout.ts tests/ui/graph-layout.test.ts src/ui/views/Graph.tsx src/ui/App.tsx public/app.js
git commit -m "feat: 世界观力导向图谱"
```

---

### Task 12: 本地建议（命题/审问/裁决）

**Files:**
- Create: `src/engine/suggest.ts`
- Create: `tests/engine/suggest.test.ts`
- Modify: `src/host/handlers.ts`
- Modify: `tests/host/handlers-suggest.test.ts` (new)
- Modify: `src/ui/api.ts`
- Modify: `src/ui/views/NodeEditor.tsx`

**Interfaces:**
- `suggestProposition(node): string`
- `interrogate(node, nodes): string[]`
- `rulingAdvice(finding, nodes): string`
- `GET /worlds/:w/nodes/:id/suggest` -> `{ proposition: string; questions: string[]; rulings: string[] }`

- [x] **Step 1: Failing tests**

- entry without proposition -> proposition derived from title + first body sentence, non-empty.
- axiom missing cost -> question includes 代价.
- hard conflict -> ruling mentions both titles and asks which side changes.
- missing relations -> generates 公理/表现 questions.

- [x] **Step 2: Implement deterministic text**

- no external model; label "本地建议".
- endpoint aggregates findings involving node and returns advice for R1/R6/R9.

- [x] **Step 3: UI**

- NodeEditor “本地建议” panel: 按钮「归纳命题」填入 proposition；「审问我」列出 questions；「裁决建议」列出 rulings.
- fetch on demand, not automatically.
- display note: “这些是规则生成的提示，不是模型生成。”

- [x] **Step 4: Verify + commit**

Run: `npm run verify`
```bash
git add src/engine/suggest.ts tests/engine/suggest.test.ts src/host/handlers.ts tests/host/handlers-suggest.test.ts src/ui/api.ts src/ui/views/NodeEditor.tsx public/app.js
git commit -m "feat: 世界观本地建议"
```

---

### Task 13: P1 验收与文档

- 更新 `docs/superpowers/plans/acceptance-checklist.md`：belief/R9、删世界、图谱、建议。
- 更新 spec 的 P1 状态（若已实现）与已知缺口：R9 是文本近似；AI 端点未接。
- `npm run verify`、`npm run build`、浏览器走查。
- 最终报告分支/HEAD/未提交数据。

---

## Self-Review

- **Spec coverage:** belief 编辑（§3.4）、R9（§5）、多作品删除（§8 P1）、力导向图谱（§8 P1）、建议（§8 P1 的本地降级）都有任务。
- **Honesty:** AI 模型端点未接，任务 12 明确为本地建议，不冒充模型。
- **Dependency:** Task 9 需要 Task 8 的 belief 加载；Task 11 不依赖 belief。
- **Risk:** R9 用「文本包含 title/alias/proposition」判定“不冲突”，会漏报改写型冲突；文档必须写清。
