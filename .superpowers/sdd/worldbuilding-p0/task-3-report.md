# Task 3 报告：文件存储层（唯一 fs 边界）

## 状态

完成。提交 `ba39014`（`feat: 文件存储层（世界/节点/片段）`），分支 `feat/p0-worldbuilding`。
`npm run verify` 全绿：build 通过，7 个测试文件 / **31 个用例**全部通过（26 个存量 + 5 个新增）。

## 做了什么

- 新建 `src/host/store.ts`（唯一触碰 fs 的模块），按 brief 提供：
  - 路径：`worldDir` / `nodesDir` / `fragDir`（全部相对调用方传入的 `root`，内部拼 `worlds/<id>/...`，不读全局配置、无硬编码绝对路径）。
  - 世界：`createWorld(root, id, configYaml)`（建 nodes/fragments/beliefs 三个目录 + 写 world.yaml）、`listWorlds(root)`、`readWorldConfig(root, id)`。
  - 节点：`listNodes`、`readNode`、`writeNode`、`deleteNode`；YAML 解析/序列化一律走 `parseNode` / `serializeNode`，`store.ts` 内没有任何自拼 YAML 或手写 front matter 解析。
  - 片段：`listFragments`、`writeFragment`、`readFragment`，`Fragment { id, chapter, scene, text, file }` 在列表与单品读取间同形。
- 新建 `tests/host/store.test.ts`：brief 的 5 个用例照抄，唯一补丁是 `node()` 字面量里的 `extra: {}`（Task 1 后 `WorldNode.extra` 必填）。
- `lib/host/store.js` 随构建产出并入库（裁决 R2）。

## RED → GREEN 证据

**RED**（先写测试，`npm test -- tests/host/store.test.ts`）：

```
 FAIL  tests/host/store.test.ts [ tests/host/store.test.ts ]
Error: Failed to load url ../../src/host/store (resolved id: ../../src/host/store) in D:/code/novel/tests/host/store.test.ts. Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

失败原因是模块不存在（功能缺失），不是拼写错误；此时 `src/host/store.ts` 尚未创建。

**GREEN**（实现后同一命令）：

```
 ✓ tests/host/store.test.ts (5 tests) 70ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

## `npm run verify` 输出摘要

```
> tsc -p tsconfig.build.json && node scripts/build-client.mjs
client.js written: 3572 chars

 ✓ tests/host/dataRoot.test.ts (2 tests)
 ✓ tests/host/ping.test.ts (1 tests)
 ✓ tests/host/plugin-route.test.ts (2 tests)
 ✓ tests/host/plugin.test.ts (2 tests)
 ✓ tests/engine/worldConfig.test.ts (7 tests)
 ✓ tests/engine/frontmatter.test.ts (12 tests)
 ✓ tests/host/store.test.ts (5 tests)

 Test Files  7 passed (7)
      Tests  31 passed (31)
```

额外做了一次运行时冒烟（构建产物由 Node 直接 ESM 加载，而不是只在 vitest 里过）：

```
$ node -e "import('./lib/host/store.js').then(m=>console.log(Object.keys(m).sort().join(',')))"
runtime exports: createWorld,deleteNode,fragDir,listFragments,listNodes,listWorlds,
                 nodesDir,readFragment,readNode,readWorldConfig,worldDir,writeFragment,writeNode
```

## 两个易错点

### 1. 改标题必须移动文件且不留副本

`writeNode` 的流程是：`ensureDir` → 由新标题算出 `rel` → 用 `listNodes` 按 id 找旧记录（拿旧 `file`）→ 把新内容写到 `rel` → 若 `prev.file !== rel` 才 `unlink` 旧文件，且 `unlink` 用 `.catch(() => undefined)` 吞错，清理失败不会让保存失败。

测试 `改标题会移动文件而不是留下副本` 通过列表反查：旧文件若残留，`listNodes` 会返回两条（`旧名`、`新名`），断言 `map(n => n.title)).toEqual(['新名'])` 必然失败。另外用临时脚本直接查了盘上文件（root 为系统临时目录）：

```
disk nodes: [ '新名.md' ]
list file: [ 'nodes/新名.md' ] | count: 1
read file: nodes/新名.md | title: 新名 | extra: {"seed":"真相x"}
```

即：盘上只剩新文件、列表只有一条、`readNode().file` 与列表一致、`extra` 经 `serializeNode` 后原样回来。

### 2. `file` 字段的形态与标题里的非法字符

- `file` 是**相对世界目录**的路径：`nodes/<title>.md` / `fragments/<id>.md`。`listNodes` 把 `nodes/${f}` 交给 `parseNode`，`writeNode` 返回同一个字符串，因此列表、`readNode`、`writeNode` 返回值三者一致（上面冒烟已验证）。
- 文件名直接用标题原样拼（`node.title || node.id`，空标题回退到 id），**不做任何 sanitize**。这是 brief 的最小语义，本任务的明确限制：
  - 标题含 `/` 或 `\` 会被当成子目录，目标目录不存在 → `writeFile` 抛 `ENOENT`；
  - Windows 非法字符（`: * ? " < > |`）或结尾点/空格 → 抛 `EINVAL` / 被系统改写；
  - `.` / `..` 之类的标题同样会指到错误位置。
  - 也就是说这类标题**会在写入时显式失败，不会静默写到别处**；P0 不做文件名清洗，界面上应在写入前拦住（后续 UI/校验任务处理）。片段 id 作为文件名同理。

## 与 brief 的偏差

1. **相对导入带 `.js` 后缀**：brief 写的是 `'../engine/frontmatter'`，实现为 `'../engine/frontmatter.js'`（含 `worldConfig.js`、`types.js`）。原因：`lib/**` 入库且被 Node 以 ESM 直接加载（`index.js` 里 `export { ... } from './lib/host/plugin.js'`），无后缀的相对说明符在 Node ESM 下会 `ERR_MODULE_NOT_FOUND`；补齐后缀后 `node -e "import('./lib/host/store.js')"` 才可通过（上面有输出）。这也与 `src/host/plugin.ts` 的既有写法一致。
2. 测试 import 去掉了 brief 里的 `rm`（brief 的用例从未使用它），避免留下未使用导入；测试逻辑与断言完全没动。
3. 按继承约定给 `node()` 补了 `extra: {}`。
4. 为满足 `strict` + `noUncheckedIndexedAccess`，补了显式返回类型（`ensureDir(): Promise<void>`、`num(k): number | null`）；行为与 brief 一致。
5. `writeNode` 里旧文件清理那行加了注释说明「改标题即换文件」，代码本身与 brief 相同。

## 担心的地方

- `listNodes` 用 `Promise.all` 解析目录内所有 `.md`，任何一个文件 front matter 损坏都会让整个列表/`readNode`/`writeNode` 一起抛错（brief 设计如此，`writeNode` 依赖 `listNodes` 找旧文件）。世界大起来后建议逐文件容错（跳过坏文件并返回告警），但那会改变 `listNodes` 的签名/语义，留给后续任务决定。
- 写入前扫全量节点的 O(n) 成本；P0 量级没问题，跨世界大库时值得改成 id→file 索引。
- 同 id 的两个文件（手工复制导致）不会被 `writeNode` 去重，只按排序第一个当 `prev`；`readNode` 同理取第一个。
- 标题/片段 id 的文件名限制见上，未做清洗，属于已知边界。
