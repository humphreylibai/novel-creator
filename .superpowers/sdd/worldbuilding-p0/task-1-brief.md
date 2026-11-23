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

