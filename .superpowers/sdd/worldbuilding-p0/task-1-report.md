# Task 1 Report: 领域类型与 front matter 编解码

**Status:** DONE_WITH_CONCERNS
**Commits:**
- `c8a737f` — `feat: 领域类型与 front matter 编解码`（源文件 + 测试 + `yaml` 依赖迁移）
- `eb2de1d` — `chore: 补交 lib/engine 构建产物`（按 R2 裁决补齐 `lib/engine/*.js`）
- `e50c01d` — `fix: 补上未知键保留、标量数组与枚举归一（评审 A1-A4）`（补丁轮 A）
- `041fc49` — `fix: 非 mapping front matter 不再生成垃圾 extra，并拦截原型键（评审 B1）`（补丁轮 B）

**Branch:** `feat/p0-worldbuilding`（父提交 `a50c3d3`）

## 做了什么

1. **TDD 先行（RED 已亲眼看它失败）**
   - 逐字照抄 brief Step 1 的测试到 `tests/engine/frontmatter.test.ts`（4 个用例）。
   - `npm test -- tests/engine/frontmatter.test.ts` → FAIL，原因是 `Failed to load url ../../src/engine/frontmatter ... Does the file exist?`（模块未实现，不是拼写错误）。
2. **实现（GREEN）**
   - 新建 `src/engine/types.ts`：`Severity` / `SEVERITY_ORDER` / `Strength` / `NodeKind` / `Span` / `Finding` / `WorldNode`，与 brief 的接口清单逐字一致。
   - 新建 `src/engine/frontmatter.ts`：`parseFrontmatter`、`parseNode`、`serializeNode`；snake_case（`conflicts_with` / `same_as`）→ camelCase（`conflictsWith` / `sameAs`）的转换只出现在这里。
   - 纯函数：只 import `yaml` 与 `./types`，无 `node:` 内建、无文件系统、无 DSH API。对外签名无 `any`（内部用 `unknown` + `as Record<string, unknown>` / `Array.isArray` 收窄）。
3. **`yaml` 依赖迁移（brief 外、按 lead 要求）**
   - `package.json`：`yaml` 从 `devDependencies` 移到 `dependencies`；`npm install` 更新 lockfile。
4. **验证并提交**：`npm run verify` 通过；`npx tsc -p tsconfig.json --noEmit`（含 tests 的全量 strict 类型检查）通过。

## 验证证据

### `npm run verify`（命令：`npm run verify`，exit code 0）

```
> @local/novel-workbench@0.1.0 verify
> npm run build && npm test

> tsc -p tsconfig.build.json && node scripts/build-client.mjs
client.js written: 3572 chars

 RUN  v2.1.9 D:/code/novel

 ✓ tests/host/ping.test.ts (1 test) 3ms
 ✓ tests/host/plugin-route.test.ts (2 tests) 4ms
 ✓ tests/host/dataRoot.test.ts (2 tests) 3ms
 ✓ tests/host/plugin.test.ts (2 tests) 4ms
 ✓ tests/engine/frontmatter.test.ts (4 tests) 21ms

 Test Files  5 passed (5)
      Tests  11 passed (11)
```

摘要：5 个测试文件 / 11 个用例全绿（原 4 文件 7 用例 + 本任务 1 文件 4 用例）；`tsc -p tsconfig.json --noEmit` 亦 exit 0。

### 运行时冒烟（证明 `yaml` 必须在 `dependencies`）

构建产物 `lib/engine/frontmatter.js` 首行为：

```js
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
```

即宿主直接加载 `lib/` 时会在**运行时**解析裸包名 `yaml`。用 Node ESM 直接加载该产物：

```
node --input-type=module -e "import { parseNode, serializeNode } from './lib/engine/frontmatter.js'; ..."
→ conflictsWith 正确来自 snake_case conflicts_with，span 为 {from:-1200,to:null}
→ ROUNDTRIP true
```

同时确认 `import type { ... } from './types.js'` 已被完全擦除，产物中不存在相对类型导入。

## `yaml` 依赖迁移证据

`package.json` 片段（after）：

```json
  "dependencies": {
    "yaml": "^2.5.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "@types/react": "^18.3.11",
    "esbuild": "^0.24.0",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vitest": "^2.1.2"
  }
```

`package-lock.json` 变化：

```diff
@@ 根包条目
+      "dependencies": {
+        "yaml": "^2.5.1"
+      },
       "devDependencies": {
-        "vitest": "^2.1.2",
-        "yaml": "^2.5.1"
+        "vitest": "^2.1.2"
+      },
+      "engines": {
+        "node": ">=20"
       }
@@ node_modules/yaml
       "version": "2.9.1",
-      "dev": true,
       "license": "ISC",
```

要点：`node_modules/yaml` 的 `"dev": true` 被移除 = 生产依赖；版本未变（2.9.1），无其他包版本漂移。`npm install` 顺带把根条目的 `engines`（`>=20`，package.json 既有字段）同步进了 lockfile，属元数据补全，非版本变更。

## 与 brief 的偏差及原因

1. **`src/engine/types.ts` 是「新建」而非 brief 写的「Modify」**：`src/engine/` 目录此前不存在，只能创建。内容与 brief 逐字一致。
2. **`frontmatter.ts` 的类型导入写成 `from './types.js'`（brief 为 `'./types'`）**：与仓库既有约定一致（`src/host/plugin.ts` 用 `./dataRoot.js`）。类型导入会被擦除，当前两者等价；但 `types.ts` 含有运行时值 `SEVERITY_ORDER`，后续 engine 模块若 import 它，Node ESM 要求相对导入带扩展名——用 `.js` 可避免将来踩坑。
3. **测试文件数交代不符（非本次偏差）**：委托说明称已有 3 个测试文件 7 个用例，实际 HEAD 上为 4 个文件（`tests/host/{ping,dataRoot,plugin-route,plugin}.test.ts`）7 个用例。
4. **`lib/engine/*.js` 首次提交时未入库**：已按 lead 裁决（R2）补交，见文末「补交：lib/engine 构建产物」。
5. 其余（API 名、字段名、默认值、正则、错误文案、测试代码）均逐字照抄 brief，无自行发明。

## Concerns

1. ~~**构建产物 `lib/engine/{types,frontmatter}.js` 已生成但仍是 untracked**~~ → **已解决（R2 裁决，补交提交 `eb2de1d`）**。首次提交时 brief Step 5 只 `git add` 三个源文件，我严格照做而未提交产物；lead 裁决 `lib/` 与 `client.js` 一律入库以保证「干净 checkout 即可安装」，已按裁决补交，详见文末小节。
2. **`npm install` 的报告里有 6 个已知漏洞（3 moderate / 1 high / 2 critical）**，全部为既有 devDependency 链上的问题，与 `yaml` 迁移无关；我没有跑 `npm audit fix --force`（会引入破坏性升级，超出边界）。
3. **`span` 的语义未在类型层约束**：`from`/`to` 均为 `number | null`，`from > to`、`to` 缺省等非法组合目前能被解析通过，留给后续校验层（`Finding`）处理——这是 brief 的设计，但意味着 `parseNode` 不是验证器，别把它当数据校验用。
4. ~~**`serializeNode` 会丢弃未知字段**~~ → **已解决（裁决 A1，提交 `e50c01d`）**：未知键现收进 `WorldNode.extra` 并在序列化时写回。**残留限制（无法消除）**：YAML 注释不被保留，往返会丢注释；按 lead 要求未引入额外依赖。

## 补丁轮 A（裁决 A1–A4）

**提交：** `e50c01d` — `fix: 补上未知键保留、标量数组与枚举归一（评审 A1-A4）`（4 files changed, 99 insertions）

**TDD 过程：** 先加 5 条测试并跑出 RED（4 条失败：`extra` 为 `undefined`、`cost` 得 `[]`、空块抛「缺少 front matter 围栏」、`kind: AXiom` 得 `entry`），再改实现转 GREEN。

### A1 · 未知键必须保留（数据丢失风险）

- **`src/engine/types.ts`**：`WorldNode` 新增 `extra: Record<string, unknown>`，带注释说明「不在已知字段表中的键，原样保留，序列化时写回」。
- **`src/engine/frontmatter.ts`**：新增 `KNOWN_KEYS` 集合（15 个 YAML 键：`kind`/`id`/`subtype`/`title`/`aliases`/`strength`/`span`/`proposition`/`cost`/`derives`/`manifests`/`requires`/`conflicts_with`/`same_as`/`violations`）与 `toExtra()`；`parseNode` 用 `Object.entries` 遍历，凡不在 `KNOWN_KEYS` 的键原样放进 `extra`。
- **`serializeNode`**：`data` 以 `...n.extra` 开头铺未知键，随后写已知字段 → **同名冲突时已知字段覆盖**（已知字段在对象字面量里位置靠后）。已知字段为空的数组仍按原规则省略不写。
- 关键点：`extra` 里的值保持 YAML 解析后的原始结构（数组、嵌套对象、数字、布尔都不做 stringify 转换），往返不丢形状。
- **已知限制**：YAML 注释无法保留（解析后即丢失），未为此引入依赖。

### A2 · 数组字段接受标量写法

- **`src/engine/frontmatter.ts` 的 `arr()`**：`Array` → `map(String)`；`string` / `number` → 包成单元素数组（`cost: 记忆` → `['记忆']`，`derives: W-AX-002` → `['W-AX-002']`）；`null` / `undefined` / 其他类型 → `[]`。
- 影响面：`aliases`/`cost`/`derives`/`manifests`/`requires`/`conflictsWith`/`sameAs`/`violations` 九个字段共用此函数，全部受益，`derives` 边不再静默消失。

### A3 · 枚举大小写不敏感 + 空 front matter 可解析

- **`norm()`**：`string` → `trim().toLowerCase()`；非字符串 → `''`。
- `strength`：`norm()` 后匹配 `hard`/`firm`/`myth`，仍不认识 → `soft`（未知值降级行为按裁决保留）。
- `kind`：`norm()` 后 `=== 'axiom'` → `axiom`，否则 `entry`（同上）。
- **围栏正则**：`/^---\r?\n(?:([\s\S]*?)\r?\n)?---\r?\n?/` —— 把 YAML 块包进可选的 `(?:...)?`，使 `---\n---\n` 空块可匹配（`m[1]` 为 `undefined` → `parseYaml('')` → `null` → `{}`）。非空块仍要求闭合围栏前有换行，不会把正文里的 `---` 误当围栏。
- 保留现状、未加校验：`span` 的 `from > to` 不在此处抛错，按裁决留给 Task 10 的独立规则 **R13（区间非法）**。

### A4 · 测试

`tests/engine/frontmatter.test.ts` 由 4 条增至 **9 条**（原 4 条未改动，新增 5 条）：

| 用例 | 覆盖 |
| --- | --- |
| `snake_case 字段映射到 camelCase` | `conflicts_with` → `conflictsWith`、`same_as` → `sameAs`（全项目唯一转换点，此前零测试） |
| `未知键收进 extra 并往返写回` | `tags` / `source` 进 `extra`，`serializeNode` 后再解析仍在 |
| `数组字段接受标量写法` | `cost: 记忆` → `['记忆']`、`derives: W-AX-002` → `['W-AX-002']` |
| `空 front matter 块可解析` | `---\n---\n正文` → `kind: 'entry'` 且 `extra` 为 `{}` |
| `枚举大小写不敏感` | `kind: AXiom` → `axiom`、`strength: Hard` → `hard` |

比 lead 预期的「14 用例左右」多 1 条：A3 的枚举归一（大小写 + 空块）属两条独立行为，按 TDD 一行为一用例拆开，最终 **5 文件 / 16 用例**。

### 补丁轮验证

```
npm run verify → exit 0
 Test Files  5 passed (5)
      Tests  16 passed (16)
npx tsc -p tsconfig.json --noEmit → exit 0
git status → 仅 ?? .superpowers/（不受版本控制的报告目录）
git diff -- lib → 空（构建产物与已提交内容无漂移）
```

**产物入库**：`lib/engine/frontmatter.js` 随本次提交更新（`types.js` 因接口被擦除无需改动）；已 `git add lib`，`git ls-files lib` 仍为 5 行。额外的运行时冒烟（直接 `import './lib/engine/frontmatter.js'`）确认产物里 A1–A3 全部生效：`extra` 含 `tags`/`source`、`cost` 为 `['记忆']`、`kind=axiom`、`strength=hard`，且序列化输出把未知键写在已知字段之前（已知字段优先覆盖的副作用，键序不影响语义）。

## 补交：lib/engine 构建产物

**背景：** lead 裁决（账本 R2）——构建产物 `lib/` 与 `client.js` 一律入库，目的是「干净 checkout 即可安装」。Task 0 已提交 `lib/host/*.js`，Task 1 生成的 `lib/engine/*.js` 必须一并入库，否则干净 checkout 的插件运行时缺少引擎 JS。

**提交：** `eb2de1d` — `chore: 补交 lib/engine 构建产物`（2 files changed, 62 insertions）

**本次补交的文件（仅新增，未改动既有 `lib/host/*.js`）：**

- `lib/engine/frontmatter.js` — 由 `src/engine/frontmatter.ts` 编译，保留运行时 `import ... from 'yaml'`，类型导入已擦除
- `lib/engine/types.js` — 由 `src/engine/types.ts` 编译，导出运行时值 `SEVERITY_ORDER`

**核对结果：**

- `git add lib` 后暂存区只有上述两个文件，`git status` 中 `?? lib/` 已消失（仅剩不属本任务提交范围的 `?? .superpowers/`，即本报告所在目录）
- `git ls-files lib` 现为 **5 行**：`lib/engine/frontmatter.js`、`lib/engine/types.js`、`lib/host/dataRoot.js`、`lib/host/ping.js`、`lib/host/plugin.js`
- **产物与源码无漂移**：补交后重跑 `npm run verify`（exit 0，5 文件 / 11 用例全绿），`git status` 中 `lib/` 无任何改动、`git diff -- lib` 为空 —— 说明入库的产物正是当前源码构建出的字节内容，不会出现「提交的 JS 与 TS 不一致」

## 补丁轮 B（B1）

**提交：** `041fc49` — `fix: 非 mapping front matter 不再生成垃圾 extra，并拦截原型键（评审 B1）`（3 files changed, 50 insertions）

**问题复现（RED，与复审描述逐字吻合）：**

- `---\n记忆即燃料\n---\n正文` → `extra = {'0':'记','1':'忆',...}`，写回是字符索引键
- `---\n- a\n- b\n---\n正文` → `extra = {'0':'a','1':'b'}`，列表被改写成 map
- `---\n__proto__: { polluted: true }\nid: E-1\n---\n正文` → `Object.getPrototypeOf(extra)` 变成 `{ polluted: true }`（原型 setter 生效，键本身静默丢失）

### 落实位置

**`src/engine/frontmatter.ts` · `toExtra()`**

1. **形态判据前置**：新增 `isPlainRecord(v): v is Record<string, unknown>`（`typeof v === 'object' && v !== null && !Array.isArray(v)`），`toExtra` 入口即 `if (!isPlainRecord(data)) return {}`。`null` / 数组 / 标量 / 字符串一律返回空 `extra`，不再对非 mapping 做 `Object.entries`。
   - 签名由 `toExtra(data: Record<string, unknown>)` 改为 `toExtra(data: unknown)`，让调用方无法再传入未经检查的形态。
2. **不安全键拦截**：新增 `UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])`，循环中 `if (KNOWN_KEYS.has(k) || UNSAFE_KEYS.has(k)) continue`。注释写明原因：`extra['__proto__'] = v` 会走原型 setter，键静默丢失并改写 `extra` 的原型。

**未动**：`KNOWN_KEYS` 与 15 个已知字段的映射不变；`extra` 仍为必填字段（后续任务字面量由它们自己补）；`span` 的 `from > to` 仍留给 Task 10 的 R13。

### 新增测试（3 条）

| 用例 | 断言 |
| --- | --- |
| `标量 front matter 不产生字符索引键` | `extra` 为 `{}`、`body` 为 `正文`、`kind` 为 `entry` |
| `序列 front matter 不产生索引键且往返不变成 map` | `extra` 为 `{}`、`body` 为 `正文`、`serializeNode` 后再解析 `extra` 仍为 `{}` 且无 `'0'` 键 |
| `原型相关键不进 extra，也不污染原型` | `extra` 无 `__proto__` 自有属性、`Object.getPrototypeOf(extra) === Object.prototype`、全局原型未被污染、其余字段（`id`）正常解析 |

比预期的 2 条多 1 条：`__proto__` 拦截是新行为，按 TDD 需独立用例保护，故最终 **5 文件 / 19 用例**。

### 补丁轮 B 验证

```
npm run verify → exit 0
 Test Files  5 passed (5)
      Tests  19 passed (19)
npx tsc -p tsconfig.json --noEmit → exit 0
git status → 仅 ?? .superpowers/
```

**产物冒烟**（直接 `import './lib/engine/frontmatter.js'`）：标量/序列输入 `extra = {}`、`body = 正文`；`__proto__` 输入下 `hasOwnProperty('__proto__') === false`、`getPrototypeOf(extra) === Object.prototype`、`({}).polluted === undefined`。`lib/engine/frontmatter.js` 已随提交更新；`types.js` 无改动（接口擦除），`git ls-files lib` 仍 5 行。

### 已知限制（B1 相关，无法通过本层修复）

- 标量/序列 front matter 的**原始内容会被丢弃**：它们本就不构成合法的节点元数据，`serializeNode` 只能写出标准映射（`kind/id/title/strength/span` + 空正文外的一切按已知规则重建）。本次修复保证的是「不产生垃圾键、不把序列改写成 map、不污染原型」，不是「保留原列表」。
- YAML 注释仍不保留（A1 已记录）。
