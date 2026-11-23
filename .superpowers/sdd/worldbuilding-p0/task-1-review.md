# Review package — Task 1 (a50c3d3 → eb2de1d)

## git log
eb2de1d chore: 补交 lib/engine 构建产物
c8a737f feat: 领域类型与 front matter 编解码

## name-status
A	lib/engine/frontmatter.js
A	lib/engine/types.js
M	package-lock.json
M	package.json
A	src/engine/frontmatter.ts
A	src/engine/types.ts
A	tests/engine/frontmatter.test.ts

## diff --stat
 lib/engine/frontmatter.js        | 61 +++++++++++++++++++++++++++++++++++
 lib/engine/types.js              |  1 +
 package-lock.json                | 10 ++++--
 package.json                     |  6 ++--
 src/engine/frontmatter.ts        | 68 ++++++++++++++++++++++++++++++++++++++++
 src/engine/types.ts              | 31 ++++++++++++++++++
 tests/engine/frontmatter.test.ts | 46 +++++++++++++++++++++++++++
 7 files changed, 218 insertions(+), 5 deletions(-)

## diff -U10（源码与配置，排除 lib/ 产物）
diff --git a/package-lock.json b/package-lock.json
index a78543b..3229907 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,27 +1,32 @@
 {
   "name": "@local/novel-workbench",
   "version": "0.1.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@local/novel-workbench",
       "version": "0.1.0",
+      "dependencies": {
+        "yaml": "^2.5.1"
+      },
       "devDependencies": {
         "@types/node": "^22.7.4",
         "@types/react": "^18.3.11",
         "esbuild": "^0.24.0",
         "tsx": "^4.19.1",
         "typescript": "^5.6.2",
-        "vitest": "^2.1.2",
-        "yaml": "^2.5.1"
+        "vitest": "^2.1.2"
+      },
+      "engines": {
+        "node": ">=20"
       }
     },
     "node_modules/@esbuild/aix-ppc64": {
       "version": "0.24.2",
       "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.24.2.tgz",
       "integrity": "sha512-thpVCb/rhxE/BnMLQ7GReQLLN8q9qbHmI55F4489/ByVg2aQaQ6kbcLb6FHkocZzQhxc4gx0sCk0tJkKBFzDhA==",
       "cpu": [
         "ppc64"
       ],
       "dev": true,
@@ -2460,21 +2465,20 @@
         "why-is-node-running": "cli.js"
       },
       "engines": {
         "node": ">=8"
       }
     },
     "node_modules/yaml": {
       "version": "2.9.1",
       "resolved": "https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz",
       "integrity": "sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==",
-      "dev": true,
       "license": "ISC",
       "bin": {
         "yaml": "bin.mjs"
       },
       "engines": {
         "node": ">= 14.6"
       },
       "funding": {
         "url": "https://github.com/sponsors/eemeli"
       }
diff --git a/package.json b/package.json
index 6007626..2603409 100644
--- a/package.json
+++ b/package.json
@@ -18,20 +18,22 @@
       "platform": "web",
       "immediately": false,
       "inject": ["@deepseek-ai/dsh-client-ui-layout"]
     }
   },
   "scripts": {
     "build": "tsc -p tsconfig.build.json && node scripts/build-client.mjs",
     "test": "vitest run",
     "verify": "npm run build && npm test"
   },
+  "dependencies": {
+    "yaml": "^2.5.1"
+  },
   "devDependencies": {
     "@types/node": "^22.7.4",
     "@types/react": "^18.3.11",
     "esbuild": "^0.24.0",
     "tsx": "^4.19.1",
     "typescript": "^5.6.2",
-    "vitest": "^2.1.2",
-    "yaml": "^2.5.1"
+    "vitest": "^2.1.2"
   }
 }
diff --git a/src/engine/frontmatter.ts b/src/engine/frontmatter.ts
new file mode 100644
index 0000000..f421669
--- /dev/null
+++ b/src/engine/frontmatter.ts
@@ -0,0 +1,68 @@
+import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
+import type { Span, Strength, WorldNode } from './types.js';
+
+const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
+
+export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
+  const clean = raw.replace(/^\uFEFF/, '');
+  const m = FENCE.exec(clean);
+  if (!m) throw new Error('缺少 front matter 围栏（文件必须以 --- 开头）');
+  const data = (parseYaml(m[1] ?? '') ?? {}) as Record<string, unknown>;
+  return { data, body: clean.slice(m[0].length) };
+}
+
+const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
+const numOrNull = (v: unknown): number | null =>
+  typeof v === 'number' && Number.isFinite(v) ? v : null;
+
+function toSpan(v: unknown): Span {
+  if (v && typeof v === 'object') {
+    const o = v as Record<string, unknown>;
+    return { from: numOrNull(o['from']), to: numOrNull(o['to']) };
+  }
+  return { from: null, to: null };
+}
+function toStrength(v: unknown): Strength {
+  return v === 'hard' || v === 'firm' || v === 'myth' ? v : 'soft';
+}
+
+export function parseNode(raw: string, file: string): WorldNode {
+  const { data, body } = parseFrontmatter(raw);
+  return {
+    id: String(data['id'] ?? ''),
+    kind: data['kind'] === 'axiom' ? 'axiom' : 'entry',
+    subtype: typeof data['subtype'] === 'string' ? data['subtype'] : null,
+    title: String(data['title'] ?? ''),
+    aliases: arr(data['aliases']),
+    strength: toStrength(data['strength']),
+    span: toSpan(data['span']),
+    proposition: typeof data['proposition'] === 'string' ? data['proposition'] : null,
+    cost: arr(data['cost']),
+    derives: arr(data['derives']),
+    manifests: arr(data['manifests']),
+    requires: arr(data['requires']),
+    conflictsWith: arr(data['conflicts_with']),
+    sameAs: arr(data['same_as']),
+    violations: arr(data['violations']),
+    body,
+    file
+  };
+}
+
+export function serializeNode(n: WorldNode): string {
+  const data: Record<string, unknown> = {
+    kind: n.kind, id: n.id, title: n.title, strength: n.strength,
+    ...(n.subtype ? { subtype: n.subtype } : {}),
+    ...(n.aliases.length ? { aliases: n.aliases } : {}),
+    span: n.span,
+    ...(n.proposition ? { proposition: n.proposition } : {}),
+    ...(n.cost.length ? { cost: n.cost } : {}),
+    ...(n.derives.length ? { derives: n.derives } : {}),
+    ...(n.manifests.length ? { manifests: n.manifests } : {}),
+    ...(n.requires.length ? { requires: n.requires } : {}),
+    ...(n.conflictsWith.length ? { conflicts_with: n.conflictsWith } : {}),
+    ...(n.sameAs.length ? { same_as: n.sameAs } : {}),
+    ...(n.violations.length ? { violations: n.violations } : {})
+  };
+  return `---\n${stringifyYaml(data)}---\n${n.body}`;
+}
diff --git a/src/engine/types.ts b/src/engine/types.ts
new file mode 100644
index 0000000..ecfeda6
--- /dev/null
+++ b/src/engine/types.ts
@@ -0,0 +1,31 @@
+export type Severity = 'error' | 'warn' | 'info';
+export const SEVERITY_ORDER: Severity[] = ['error', 'warn', 'info'];
+
+export type Strength = 'hard' | 'firm' | 'soft' | 'myth';
+export type NodeKind = 'axiom' | 'entry';
+export interface Span { from: number | null; to: number | null }
+
+export interface Finding {
+  rule: string; severity: Severity; nodeIds: string[];
+  message: string; hint?: string; actions?: string[];
+}
+
+export interface WorldNode {
+  id: string;
+  kind: NodeKind;
+  subtype: string | null;
+  title: string;
+  aliases: string[];
+  strength: Strength;
+  span: Span;
+  proposition: string | null;
+  cost: string[];
+  derives: string[];
+  manifests: string[];
+  requires: string[];
+  conflictsWith: string[];
+  sameAs: string[];
+  violations: string[];
+  body: string;
+  file: string;
+}
diff --git a/tests/engine/frontmatter.test.ts b/tests/engine/frontmatter.test.ts
new file mode 100644
index 0000000..775f341
--- /dev/null
+++ b/tests/engine/frontmatter.test.ts
@@ -0,0 +1,46 @@
+import { describe, it, expect } from 'vitest';
+import { parseNode, serializeNode } from '../../src/engine/frontmatter';
+
+const RAW = `---
+kind: axiom
+id: W-AX-002
+title: 记忆即燃料
+strength: hard
+span: { from: -1200, to: null }
+proposition: 施法会永久烧毁施法者的记忆
+cost: [记忆, 身份]
+---
+
+施法会永久烧毁施法者的记忆。
+
+这条规则不是秘密。
+`;
+
+describe('front matter 编解码', () => {
+  it('解析出结构化字段与正文', () => {
+    const n = parseNode(RAW, 'nodes/记忆即燃料.md');
+    expect(n.id).toBe('W-AX-002');
+    expect(n.kind).toBe('axiom');
+    expect(n.strength).toBe('hard');
+    expect(n.span).toEqual({ from: -1200, to: null });
+    expect(n.cost).toEqual(['记忆', '身份']);
+    expect(n.body.trim()).toBe('施法会永久烧毁施法者的记忆。\n\n这条规则不是秘密。');
+  });
+
+  it('缺省字段有安全默认值', () => {
+    const n = parseNode('---\nid: E-1\ntitle: 无字塔\n---\n正文', 'nodes/无字塔.md');
+    expect(n.kind).toBe('entry');
+    expect(n.strength).toBe('soft');
+    expect(n.derives).toEqual([]);
+    expect(n.span).toEqual({ from: null, to: null });
+  });
+
+  it('序列化后可原样解析回来', () => {
+    const n = parseNode(RAW, 'nodes/记忆即燃料.md');
+    expect(parseNode(serializeNode(n), n.file)).toEqual(n);
+  });
+
+  it('缺少围栏时抛错', () => {
+    expect(() => parseNode('没有 front matter', 'x.md')).toThrow(/front matter/i);
+  });
+});

## package-lock 的 yaml dev 标记变化（摘录）

  +      "dependencies": {
> +        "yaml": "^2.5.1"
  +      },
>        "devDependencies": {
           "@types/node": "^22.7.4",
  -        "vitest": "^2.1.2",
> -        "yaml": "^2.5.1"
  +        "vitest": "^2.1.2"
         "version": "2.9.1",
>        "resolved": "https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz",
         "integrity": "sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw=="
,
> -      "dev": true,
         "license": "ISC",
         "bin": {
>          "yaml": "bin.mjs"



