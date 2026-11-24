# 世界观 P0 收尾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 把世界观从「可跑通」补到 spec §4/§8 承诺的完整 P0：编辑公理与关系、删除保护、卡片墙、片段库、建世界、不可跳过的开局引导。

**Architecture:** 继续用现有 React 单页 + 本地 HTTP API。所有表单/过滤逻辑先落成 `src/ui/*.ts` 纯函数并单测，React 组件只负责状态与渲染；后端只补 `DELETE world`（若需要）与已有的节点/片段接口的 UI 接线，不引入新依赖。

**Tech Stack:** TypeScript strict、React 18、esbuild、Vitest 2.1.9、Node 20+ ESM。

**Spec:** `docs/superpowers/specs/2026-11-23-worldbuilding-spec.md`（§3 元模型、§4 视图、§8 P0）

## Global Constraints

- 相对 `src` import 一律带 `.js` 后缀；测试沿用现有风格。
- 不新增运行时依赖；不引入 UI 组件库。
- 所有面向用户的文案用中文；服务端 422/409 原文必须原样显示。
- `kind: axiom` 必须有非空 `cost`；前端先校验，后端仍兜底 422。
- 数据仍写在 `dataRoot/worlds/<worldId>/`；不改文件格式，只补 UI。
- 每个任务结束跑 `npm run verify`（或至少相关测试 + 构建），再提交。
- 当前工作区的《大明王朝1566》测试数据不提交，保持未跟踪；代码提交不要带上 `data/`。

---

### Task 1: 节点编辑闭环（类型/代价/强度/时间/别名/删除）

**Files:**
- Create: `src/ui/nodeFields.ts`
- Create: `tests/ui/node-fields.test.ts`
- Modify: `src/ui/api.ts`
- Modify: `src/ui/views/NodeEditor.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Produces: `splitList(raw: string): string[]`
- Produces: `joinList(value: unknown): string`
- Produces: `numberOrNull(raw: string): number | null`
- Produces: `nodePayload(base: NodeRecord, draft: NodeDraft): NodeRecord`
- Produces: `deleteNode(world: string, id: string): Promise<void>`
- `NodeDraft`: `{ kind: 'axiom'|'entry'; title: string; body: string; strength: string; from: string; to: string; aliases: string; cost: string; proposition: string }`
- Consumes: `saveNode` from `src/ui/api.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { joinList, nodePayload, numberOrNull, splitList } from '../../src/ui/nodeFields.js';

describe('nodeFields', () => {
  it('按中文/英文分隔符切列表并去空', () => {
    expect(splitList('记忆、身份, 亲情，  ')).toEqual(['记忆', '身份', '亲情']);
    expect(splitList('')).toEqual([]);
  });

  it('空字符串是 null 年份，数字字符串是数字', () => {
    expect(numberOrNull('')).toBeNull();
    expect(numberOrNull('1560')).toBe(1560);
    expect(numberOrNull('abc')).toBeNull();
  });

  it('payload 把 camelCase 关系写成服务端认识的 snake_case', () => {
    const base = { id: 'E-1', kind: 'entry', title: '旧' };
    const draft = {
      kind: 'entry', title: '海瑞', body: '正文', strength: 'firm',
      from: '1560', to: '1566', aliases: '海刚峰, 刚峰', cost: '',
      proposition: '',
    };
    const payload = nodePayload(base, draft);
    expect(payload).toMatchObject({
      id: 'E-1', kind: 'entry', title: '海瑞', strength: 'firm',
      span: { from: 1560, to: 1566 }, aliases: ['海刚峰', '刚峰'],
      cost: [], conflicts_with: [], same_as: [],
    });
  });

  it('joinList 把数组还原成顿号分隔文本', () => {
    expect(joinList(['记忆', '身份'])).toBe('记忆、身份');
    expect(joinList(undefined)).toBe('');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/node-fields.test.ts`
Expected: FAIL — module `src/ui/nodeFields.js` not found.

- [x] **Step 3: Write minimal implementation**

```ts
import type { NodeRecord } from './api.js';

export type NodeKind = 'axiom' | 'entry';

export interface NodeDraft {
  kind: NodeKind;
  title: string;
  body: string;
  strength: string;
  from: string;
  to: string;
  aliases: string;
  cost: string;
  proposition: string;
}

export const splitList = (raw: string): string[] =>
  raw.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean);

export const joinList = (value: unknown): string =>
  Array.isArray(value) ? value.map(String).join('、') : '';

export const numberOrNull = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export function nodePayload(base: NodeRecord, draft: NodeDraft): NodeRecord {
  const cost = splitList(draft.cost);
  return {
    ...base,
    kind: draft.kind,
    title: draft.title.trim(),
    body: draft.body,
    strength: draft.strength,
    span: { from: numberOrNull(draft.from), to: numberOrNull(draft.to) },
    aliases: splitList(draft.aliases),
    cost: draft.kind === 'axiom' ? cost : [],
    proposition: draft.proposition.trim() || null,
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/node-fields.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Wire the editor**

In `NodeEditor.tsx`:
- initialize `kind`, `strength`, `from`, `to`, `aliases`, `cost`, `proposition` from `node`.
- add controls: kind select (`条目` / `公理`), strength select (`hard`/`firm`/`soft`/`myth`), two number inputs, aliases input, cost input (only axiom), proposition input.
- save with `nodePayload(node, { ... })`; if `kind === 'axiom' && splitList(cost).length === 0`, set error `公理必须付出代价（铁律一）` and return without calling API.
- add delete button calling new `deleteNode`; on 204 call `onDeleted()`; 409 show `e.message`.
- prop signature becomes `{ world, node, nodes, onSaved, onDeleted }` (nodes used in Task 2; Task 1 can accept it unused or render empty).

In `api.ts`:
```ts
export const deleteNode = async (w: string, id: string): Promise<void> => {
  const res = await fetch(`/api/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (res.status === 204) return;
  const body = await res.json().catch(() => ({ error: res.statusText }));
  const b = body as { error?: string; refs?: { fragments: string[]; nodes: { title: string; via: string }[] } };
  const refs = b.refs
    ? `（片段：${b.refs.fragments.join('、') || '无'}；条目：${b.refs.nodes.map((n) => `${n.title}(${n.via})`).join('、') || '无'}）`
    : '';
  throw new Error(`${b.error ?? res.statusText}${refs}`);
};
```

In `App.tsx`:
- `newNode(kind: 'entry' | 'axiom')` initializes `strength: 'soft'`, `span: { from: null, to: null }`, `cost: []`, `aliases: []`, `derives: []`, `manifests: []`, `requires: []`, `conflictsWith: []`, `sameAs: []`, `proposition: null`.
- replace「＋ 新建条目」with two buttons：「＋ 新建条目」「＋ 新建公理」.
- `handleDeleted()` sets `setSelected(null)`, `void reloadNodes()`, `void reloadStats()`.
- pass `nodes={nodes}` and `onDeleted={handleDeleted}`.

- [x] **Step 6: Verify and commit**

Run: `npm run verify`
Expected: all tests pass; `public/app.js` rebuilt.
```bash
git add src/ui/nodeFields.ts tests/ui/node-fields.test.ts src/ui/api.ts src/ui/views/NodeEditor.tsx src/ui/App.tsx public/app.js
git commit -m "feat: 补全世界观节点编辑与删除"
```

---

### Task 2: 关系选择器（derives/manifests/requires/conflicts/same_as）

**Files:**
- Modify: `src/ui/nodeFields.ts`
- Modify: `tests/ui/node-fields.test.ts`
- Modify: `src/ui/views/NodeEditor.tsx`

**Interfaces:**
- Produces: `relationOptions(nodes: NodeRecord[], field: RelationField, selfId: string): { id: string; title: string }[]`
- `RelationField = 'derives' | 'manifests' | 'requires' | 'conflictsWith' | 'sameAs'`
- Consumes: `nodePayload` from Task 1

- [x] **Step 1: Write the failing test**

```ts
import { relationOptions } from '../../src/ui/nodeFields.js';

const nodes = [
  { id: 'W-AX-1', kind: 'axiom', title: '公理一' },
  { id: 'E-1', kind: 'entry', title: '条目一' },
  { id: 'E-2', kind: 'entry', title: '条目二' },
];

it('derives 只列公理，manifests 只列条目，排除自己', () => {
  expect(relationOptions(nodes, 'derives', 'E-1').map((n) => n.id)).toEqual(['W-AX-1']);
  expect(relationOptions(nodes, 'manifests', 'E-1').map((n) => n.id)).toEqual(['E-2']);
  expect(relationOptions(nodes, 'requires', 'E-1').map((n) => n.id)).toEqual(['W-AX-1', 'E-2']);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/node-fields.test.ts`
Expected: FAIL — `relationOptions` is not exported.

- [x] **Step 3: Implement**

```ts
export type RelationField = 'derives' | 'manifests' | 'requires' | 'conflictsWith' | 'sameAs';

export function relationOptions(nodes: NodeRecord[], field: RelationField, selfId: string) {
  return nodes
    .filter((n) => n['id'] !== selfId)
    .filter((n) => field === 'derives' ? n['kind'] === 'axiom'
      : field === 'manifests' ? n['kind'] === 'entry'
        : true)
    .map((n) => ({ id: String(n['id'] ?? ''), title: String(n['title'] ?? n['id'] ?? '') }))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh'));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/node-fields.test.ts`
Expected: PASS (6 tests).

- [x] **Step 5: Add controls to NodeEditor**

- local state for `derives`, `manifests`, `requires`, `conflictsWith`, `sameAs` (arrays).
- render native `<select multiple size={5}>` for each; `derives` only when `kind === 'entry'`; `manifests` only when `kind === 'axiom'`.
- options from `relationOptions(nodes, field, id)`, label `${title}（${id}）`.
- selected values via `e.target.selectedOptions`.
- save payload: `{ ...nodePayload(node, draft), derives, manifests, requires, conflicts_with: conflictsWith, same_as: sameAs }`.
- Ensure axiom -> manifests visible; entry -> derives visible.

- [x] **Step 6: Verify and commit**

Run: `npm run verify`
```bash
git add src/ui/nodeFields.ts tests/ui/node-fields.test.ts src/ui/views/NodeEditor.tsx public/app.js
git commit -m "feat: 世界观条目支持关系选择器"
```

---

### Task 3: 卡片墙

**Files:**
- Create: `src/ui/cardBadges.ts`
- Create: `tests/ui/card-badges.test.ts`
- Create: `src/ui/views/CardWall.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Produces: `badgesFor(findings: Finding[], nodeId: string): string[]`
- Consumes: `findings(world)` from `src/ui/api.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { badgesFor } from '../../src/ui/cardBadges.js';

const findings = [
  { rule: 'R4', severity: 'warn' as const, nodeIds: ['E-1'], message: '' },
  { rule: 'R5', severity: 'info' as const, nodeIds: ['E-1'], message: '' },
  { rule: 'R1', severity: 'error' as const, nodeIds: ['E-1', 'W-AX-1'], message: '' },
];

it('按节点汇总角标，去重且保持固定顺序', () => {
  expect(badgesFor(findings, 'E-1')).toEqual(['无公理支撑', '未被正文引用', '有未决矛盾']);
  expect(badgesFor(findings, 'E-2')).toEqual([]);
});
```

- [x] **Step 2: Run to fail**

Run: `npm test -- tests/ui/card-badges.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

```ts
import type { Finding } from '../engine/types.js';

const LABEL: Record<string, string> = {
  R4: '无公理支撑',
  R5: '未被正文引用',
  R1: '有未决矛盾',
  R6: '有未决矛盾',
  R3: '认知冲突',
};

export function badgesFor(findings: Finding[], nodeId: string): string[] {
  const out: string[] = [];
  for (const f of findings) {
    if (!f.nodeIds.includes(nodeId)) continue;
    const label = LABEL[f.rule];
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}
```

- [x] **Step 4: Run to pass**

Run: `npm test -- tests/ui/card-badges.test.ts`
Expected: PASS.

- [x] **Step 5: Build CardWall**

`CardWall.tsx`:
- fetch `findings(worldId)` on mount/world change.
- render responsive grid (`gridTemplateColumns: repeat(auto-fill, minmax(220px, 1fr))`).
- each card: title, `公理`/`条目`, strength, span text (`from → to/至今`), body excerpt (`slice(0, 60)`), badges.
- click card -> `onOpen(id)`.
- error banner.

`App.tsx`:
- add `'cards'` to `WorldView` and `WORLD_VIEWS` with label「卡片墙」.
- render `CardWall` for `view === 'cards'`; pass nodes + findings? CardWall can fetch nodes itself to avoid App prop; use `listNodes` and `findings`.
- Use `onOpen={(id) => { setView('nodes'); void openNodeById(id); }}`.

- [x] **Step 6: Verify and commit**

Run: `npm run verify`
```bash
git add src/ui/cardBadges.ts tests/ui/card-badges.test.ts src/ui/views/CardWall.tsx src/ui/App.tsx public/app.js
git commit -m "feat: 世界观卡片墙"
```

---

### Task 4: 片段库界面

**Files:**
- Modify: `src/ui/api.ts`
- Create: `src/ui/fragmentFields.ts`
- Create: `tests/ui/fragment-fields.test.ts`
- Create: `src/ui/views/Fragments.tsx`
- Modify: `src/ui/App.tsx`
- Test: `tests/host/handlers-fragments.test.ts`

**Interfaces:**
- Produces: `fragmentPayload(raw: { chapter: string; scene: string; text: string }): { chapter: number|null; scene: number|null; text: string }`
- Produces: `listFragments(w): Promise<FragmentRecord[]>`
- Produces: `saveFragment(w, id, body): Promise<void>`
- `FragmentRecord`: `{ id: string; chapter: number|null; scene: number|null; text: string; file: string }`

- [x] **Step 1: Write failing unit + handler tests**

`tests/ui/fragment-fields.test.ts`:
```ts
import { expect, it } from 'vitest';
import { fragmentPayload } from '../../src/ui/fragmentFields.js';

it('空章节/场次转 null，正文保持原样', () => {
  expect(fragmentPayload({ chapter: '', scene: '2', text: '他把[[还脉礼]]交还。' }))
    .toEqual({ chapter: null, scene: 2, text: '他把[[还脉礼]]交还。' });
});
```

`tests/host/handlers-fragments.test.ts`:
- create temp root, POST world with minimal config.
- PUT `/fragments/第一章` `{ chapter: 1, scene: 2, text: '[[E-1]]' }` -> 200.
- GET `/fragments` -> one item with chapter 1, scene 2, text.
- PUT invalid id `../x` -> 400.
Use `createHandlers` and `mkdtemp` like existing handler tests.

- [x] **Step 2: Run to fail**

Run: `npm test -- tests/ui/fragment-fields.test.ts tests/host/handlers-fragments.test.ts`
Expected: UI module missing; handler test should pass? If it passes, that's evidence the route exists; keep it as regression.

- [x] **Step 3: Implement API + helper**

`api.ts`:
```ts
export interface FragmentRecord {
  id: string; chapter: number | null; scene: number | null; text: string; file: string;
}
export const listFragments = (w: string) => j<FragmentRecord[]>(`/worlds/${encodeURIComponent(w)}/fragments`);
export const saveFragment = (w: string, id: string, body: { chapter: number|null; scene: number|null; text: string }) =>
  j<void>(`/worlds/${encodeURIComponent(w)}/fragments/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(body),
  });
```

`fragmentFields.ts`:
```ts
export const fragmentPayload = (raw: { chapter: string; scene: string; text: string }) => ({
  chapter: raw.chapter.trim() === '' ? null : Number(raw.chapter),
  scene: raw.scene.trim() === '' ? null : Number(raw.scene),
  text: raw.text,
});
```
(Use `Number.isFinite` fallback to null.)

- [x] **Step 4: Run tests**

Run: `npm test -- tests/ui/fragment-fields.test.ts tests/host/handlers-fragments.test.ts`
Expected: PASS.

- [x] **Step 5: Build Fragments view**

- two-column: left list of fragments (`第{chapter}章 · 场景{scene}` + id), right editor.
- new button creates local draft id `fragment-${Date.now().toString(36)}`.
- fields: chapter number, scene number, textarea; save via `saveFragment`.
- after save: refresh list; call `onChanged()` so App can refresh selected node citations.
- error banner; empty state.

`App.tsx`:
- add `'fragments'` view + label「片段」.
- render `<Fragments worldId={world} onChanged={() => { if (selected) void selectNode({ id: selected['id'] }); }} />`.
- Ensure `selectNode` accepts `NodeRecord`; it does.

- [x] **Step 6: Verify and commit**

Run: `npm run verify`
```bash
git add src/ui/api.ts src/ui/fragmentFields.ts tests/ui/fragment-fields.test.ts tests/host/handlers-fragments.test.ts src/ui/views/Fragments.tsx src/ui/App.tsx public/app.js
git commit -m "feat: 世界观片段库界面"
```

---

### Task 5: 新建世界界面

**Files:**
- Create: `src/ui/worldDraft.ts`
- Create: `tests/ui/world-draft.test.ts`
- Create: `src/ui/views/NewWorld.tsx`
- Modify: `src/ui/api.ts`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Produces: `buildWorldConfig(input: WorldDraftInput): string`
- `WorldDraftInput`: `{ id: string; title: string; wound: string; motif: string; epoch: string; start: string; end: string }`
- Produces: `createWorld(id: string, config: string): Promise<void>`

- [x] **Step 1: Write failing test**

```ts
import { expect, it } from 'vitest';
import { parseWorldConfig } from '../../src/engine/worldConfig.js';
import { buildWorldConfig } from '../../src/ui/worldDraft.js';

it('生成可被 parseWorldConfig 读回的 world.yaml', () => {
  const yaml = buildWorldConfig({
    id: '测试界', title: '测试界', wound: '缺一口井', motif: '水',
    epoch: '新历', start: '1', end: '',
  });
  const c = parseWorldConfig(yaml);
  expect(c.id).toBe('测试界');
  expect(c.theme.wound).toBe('缺一口井');
  expect(c.calendar.epochs[0]).toEqual({ name: '新历', start: 1, end: null });
});
```

- [x] **Step 2: Run to fail**

Run: `npm test -- tests/ui/world-draft.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

```ts
export interface WorldDraftInput {
  id: string; title: string; wound: string; motif: string;
  epoch: string; start: string; end: string;
}

const yamlString = (s: string) => JSON.stringify(s);

export function buildWorldConfig(i: WorldDraftInput): string {
  const end = i.end.trim() === '' ? 'null' : String(Number(i.end));
  return `id: ${yamlString(i.id.trim())}
title: ${yamlString(i.title.trim() || i.id.trim())}
genre: { allowed: [历史], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: ${yamlString(i.epoch.trim() || '新历')}, start: ${Number(i.start) || 1}, end: ${end} }]
  format: "{year}"
theme:
  wound: ${yamlString(i.wound.trim())}
  motif: ${yamlString(i.motif.trim())}
`;
}
```
Use `JSON.stringify` for YAML double-quoted scalars; safe for quotes/newlines.

`api.ts`:
```ts
export const createWorld = (id: string, config: string) =>
  j<{ ok: true }>('/worlds', { method: 'POST', body: JSON.stringify({ id, config }) });
```

- [x] **Step 4: Run to pass**

Run: `npm test -- tests/ui/world-draft.test.ts`
Expected: PASS.

- [x] **Step 5: Build NewWorld + App wiring**

`NewWorld.tsx`:
- controlled inputs; submit disabled unless id/wound non-empty.
- on submit `createWorld`, then `onCreated(id)`.
- error banner.

`App.tsx`:
- state `creatingWorld`; button「＋ 新建世界」next to select.
- onCreated: set creating false; `await reloadWorlds()`; `setWorld(id)`; `setStat(null)`.
- empty state gets the same button, not just text.
- keep world select working.

- [x] **Step 6: Verify and commit**

Run: `npm run verify`
```bash
git add src/ui/worldDraft.ts tests/ui/world-draft.test.ts src/ui/views/NewWorld.tsx src/ui/api.ts src/ui/App.tsx public/app.js
git commit -m "feat: 新建世界界面"
```

---

### Task 6: 开局引导不可跳过

**Files:**
- Create: `src/ui/onboarding.ts`
- Create: `tests/ui/onboarding.test.ts`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Produces: `onboardingActive(stat: Stats | null, hasSelection: boolean): boolean`
- Produces: `canCreateEntry(stat: Stats | null): boolean`

- [x] **Step 1: Write failing test**

```ts
import { expect, it } from 'vitest';
import { canCreateEntry, onboardingActive } from '../../src/ui/onboarding.js';

it('公理不足 3 条且未选中时显示引导，且禁止新建条目', () => {
  expect(onboardingActive({ axioms: 1, entries: 0, manifestedAxioms: 0 }, false)).toBe(true);
  expect(onboardingActive({ axioms: 3, entries: 0, manifestedAxioms: 0 }, false)).toBe(false);
  expect(onboardingActive(null, false)).toBe(false);
  expect(canCreateEntry({ axioms: 2, entries: 0, manifestedAxioms: 0 })).toBe(false);
  expect(canCreateEntry({ axioms: 3, entries: 0, manifestedAxioms: 0 })).toBe(true);
});
```

- [x] **Step 2: Run to fail**

Run: `npm test -- tests/ui/onboarding.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

```ts
import type { Stats } from './api.js';

export const onboardingActive = (stat: Stats | null, hasSelection: boolean): boolean =>
  !!stat && stat.axioms < 3 && !hasSelection;

export const canCreateEntry = (stat: Stats | null): boolean =>
  !stat || stat.axioms >= 3;
```

- [x] **Step 4: Run to pass**

Run: `npm test -- tests/ui/onboarding.test.ts`
Expected: PASS.

- [x] **Step 5: Wire gate**

- replace the inline onboarding condition with `onboardingActive(stat, selected !== null)`.
- disable both「＋新建条目」「＋新建公理」when `!canCreateEntry(stat)`; keep onboarding's own「加一条公理」available.
- ensure selecting an existing node while axioms < 3 still allows editing (not a bypass of creation).
- after third axiom, `handleOnboardingDone` reloads stats/nodes; buttons re-enable.

- [x] **Step 6: Verify and commit**

Run: `npm run verify`
```bash
git add src/ui/onboarding.ts tests/ui/onboarding.test.ts src/ui/App.tsx public/app.js
git commit -m "feat: 世界观开局引导禁止绕过"
```

---

### Task 7: 收尾验收与文档

**Files:**
- Modify: `docs/superpowers/plans/acceptance-checklist.md`
- Modify: `.superpowers/sdd/2026-11-23-worldbuilding-p0/progress.md` (git-ignored)

- [x] **Step 1: Manual UI verification**

Use the live service (8791) or a temp data root:
- 新建公理，填代价 -> 保存成功；空代价 -> 422 文案。
- 新建条目，选 derives/manifests/conflicts_with -> 保存 -> 刷新后关系仍在；诊断随之变化。
- 删除被引用节点 -> 409 并列出引用；删除无人引用节点 -> 204 且列表消失。
- 卡片墙显示角标；点击进入编辑器。
- 片段库新建/保存；重新打开条目，「被片段引用」更新。
- 新建世界 -> 下拉框出现并切换；< 3 公理时不能新建条目。
- 时间轴区间随世界历法变化。

- [x] **Step 2: Update the checklist**

- 删除“没有删除按钮 / 没有片段库 / 没有建世界界面”的已知缺口。
- 步骤 4/5 改成界面操作，不再要求手写 front matter。
- 保留 R9、R6、无鉴权、R1 显式登记、验收套件规模等仍未解决项。

- [x] **Step 3: Full verification**

Run: `npm run verify`
Expected: all tests pass; `public/app.js` and `lib/` build clean.
Run: `git status --short` — only intended files / test data.

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/plans/acceptance-checklist.md
git commit -m "docs: 更新世界观 P0 收尾验收"
```

---

## Self-Review

- **Spec coverage:** 编辑页字段（§4.1）、卡片墙/角标（§4.3）、片段库（§6）、建世界（§8 P0）、开局引导（§4.6）都有任务；R9、AI、多作品、图谱明确留给下一份 P1 计划。
- **No placeholders:** 每个任务都有可运行的测试/实现代码或明确选择器行为。
- **Type consistency:** `NodeDraft`/`nodePayload`/`relationOptions`/`Stats`/`FragmentRecord` 在任务间命名一致；`NodeEditor` 的 props 在 Task 1 定义，Task 2/4 沿用。
- **Known dependency:** Task 2 的 `nodes` prop 在 Task 1 已加入；Task 4 的 `onChanged` 依赖 `selectNode` 现有签名。
