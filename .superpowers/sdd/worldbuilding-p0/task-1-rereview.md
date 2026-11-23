# Re-review — Task 1 补丁轮 A (eb2de1d → e50c01d)

## diff --stat
 lib/engine/frontmatter.js        | 32 ++++++++++++++++++++++++++----
 src/engine/frontmatter.ts        | 31 +++++++++++++++++++++++++----
 src/engine/types.ts              |  2 ++
 tests/engine/frontmatter.test.ts | 42 ++++++++++++++++++++++++++++++++++++++++
 4 files changed, 99 insertions(+), 8 deletions(-)

## diff -U15（全量，本补丁只改 engine）
diff --git a/src/engine/frontmatter.ts b/src/engine/frontmatter.ts
index f421669..297a91b 100644
--- a/src/engine/frontmatter.ts
+++ b/src/engine/frontmatter.ts
@@ -1,68 +1,91 @@
 import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
 import type { Span, Strength, WorldNode } from './types.js';
 
-const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
+const FENCE = /^---\r?\n(?:([\s\S]*?)\r?\n)?---\r?\n?/;
 
 export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
   const clean = raw.replace(/^\uFEFF/, '');
   const m = FENCE.exec(clean);
   if (!m) throw new Error('缺少 front matter 围栏（文件必须以 --- 开头）');
   const data = (parseYaml(m[1] ?? '') ?? {}) as Record<string, unknown>;
   return { data, body: clean.slice(m[0].length) };
 }
 
-const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
+/** 已知字段在 YAML 里的键名；其余键一律收进 extra 原样保留。 */
+const KNOWN_KEYS = new Set([
+  'kind', 'id', 'subtype', 'title', 'aliases', 'strength', 'span', 'proposition',
+  'cost', 'derives', 'manifests', 'requires', 'conflicts_with', 'same_as', 'violations'
+]);
+
+const arr = (v: unknown): string[] => {
+  if (Array.isArray(v)) return v.map(String);
+  // 标量写法（cost: 记忆 / derives: W-AX-002）合法，包成单元素数组
+  if (typeof v === 'string' || typeof v === 'number') return [String(v)];
+  return [];
+};
 const numOrNull = (v: unknown): number | null =>
   typeof v === 'number' && Number.isFinite(v) ? v : null;
 
+function toExtra(data: Record<string, unknown>): Record<string, unknown> {
+  const extra: Record<string, unknown> = {};
+  for (const [k, v] of Object.entries(data)) if (!KNOWN_KEYS.has(k)) extra[k] = v;
+  return extra;
+}
+
+const norm = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');
+
 function toSpan(v: unknown): Span {
   if (v && typeof v === 'object') {
     const o = v as Record<string, unknown>;
     return { from: numOrNull(o['from']), to: numOrNull(o['to']) };
   }
   return { from: null, to: null };
 }
 function toStrength(v: unknown): Strength {
-  return v === 'hard' || v === 'firm' || v === 'myth' ? v : 'soft';
+  const s = norm(v);
+  return s === 'hard' || s === 'firm' || s === 'myth' ? s : 'soft';
 }
 
 export function parseNode(raw: string, file: string): WorldNode {
   const { data, body } = parseFrontmatter(raw);
   return {
     id: String(data['id'] ?? ''),
-    kind: data['kind'] === 'axiom' ? 'axiom' : 'entry',
+    kind: norm(data['kind']) === 'axiom' ? 'axiom' : 'entry',
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
+    extra: toExtra(data),
     body,
     file
   };
 }
 
 export function serializeNode(n: WorldNode): string {
   const data: Record<string, unknown> = {
+    // 未知键先铺，已知字段后写：同名冲突时已知字段覆盖
+    ...n.extra,
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
diff --git a/src/engine/types.ts b/src/engine/types.ts
index ecfeda6..933ed3c 100644
--- a/src/engine/types.ts
+++ b/src/engine/types.ts
@@ -14,18 +14,20 @@ export interface WorldNode {
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
+  /** front matter 里不在已知字段表中的键，原样保留，序列化时写回 */
+  extra: Record<string, unknown>;
   body: string;
   file: string;
 }
diff --git a/tests/engine/frontmatter.test.ts b/tests/engine/frontmatter.test.ts
index 775f341..8e57cfb 100644
--- a/tests/engine/frontmatter.test.ts
+++ b/tests/engine/frontmatter.test.ts
@@ -31,16 +31,58 @@ describe('front matter 编解码', () => {
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
+
+  it('snake_case 字段映射到 camelCase', () => {
+    const n = parseNode(
+      '---\nid: E-1\ntitle: 无字塔\nconflicts_with: [W-AX-002]\nsame_as: [E-MF-004]\n---\n正文',
+      'nodes/无字塔.md'
+    );
+    expect(n.conflictsWith).toEqual(['W-AX-002']);
+    expect(n.sameAs).toEqual(['E-MF-004']);
+  });
+
+  it('未知键收进 extra 并往返写回', () => {
+    const n = parseNode(
+      '---\nid: E-2\ntitle: 无字塔\ntags: [a, b]\nsource: 手写\n---\n正文',
+      'nodes/无字塔.md'
+    );
+    expect(n.extra).toEqual({ tags: ['a', 'b'], source: '手写' });
+    expect(parseNode(serializeNode(n), n.file).extra).toEqual({ tags: ['a', 'b'], source: '手写' });
+  });
+
+  it('数组字段接受标量写法', () => {
+    const n = parseNode(
+      '---\nid: E-3\ntitle: 无字塔\ncost: 记忆\nderives: W-AX-002\n---\n正文',
+      'nodes/无字塔.md'
+    );
+    expect(n.cost).toEqual(['记忆']);
+    expect(n.derives).toEqual(['W-AX-002']);
+  });
+
+  it('空 front matter 块可解析', () => {
+    const n = parseNode('---\n---\n正文', 'nodes/空.md');
+    expect(n.kind).toBe('entry');
+    expect(n.extra).toEqual({});
+  });
+
+  it('枚举大小写不敏感', () => {
+    const n = parseNode(
+      '---\nkind: AXiom\nstrength: Hard\n---\n正文',
+      'nodes/大小写.md'
+    );
+    expect(n.kind).toBe('axiom');
+    expect(n.strength).toBe('hard');
+  });
 });

