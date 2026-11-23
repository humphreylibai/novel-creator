# Task 4 报告：请求处理层（纯函数，可单测）

## 状态

完成。任务提交 `1d05fa6`（`feat: 请求处理层（纯函数，可单测）`），补丁轮 C 提交 `cd9b4c6`（`fix: 路由契约补丁 C（404/400/URL id/kind 降级）`），分支 `feat/p0-worldbuilding`。
`npm run verify` 全绿：build 通过，8 个测试文件 / **40 个用例**全部通过（31 个存量 + handlers 9 个：原 brief 5 个 + 补丁 C 4 个）。

## 做了什么

- 新建 `src/host/handlers.ts`：
  - 对外接口按 brief：`NovelReq` / `NovelRes` / `createHandlers(root): (req) => Promise<NovelRes>`。
  - 路由：`GET|POST /worlds`、`GET /worlds/:w/config`、`GET /worlds/:w/nodes`、`GET|PUT|DELETE /worlds/:w/nodes/:id`、`GET /worlds/:w/stats`；未知路由 404。
  - `store.*` 是唯一文件系统入口；`PUT` 直接返回 `store.writeNode` 的返回值（含 `file`），不再二次读取。
  - `readNode(...).catch(() => null)` 用于区分「新建」与「更新」；`readNode` 未命中时抛错的行为保持不变。
- 新建 `tests/host/handlers.test.ts`：brief 的 5 个用例照抄（未增删断言）。
- `lib/host/handlers.js` 随构建产出并随源码一起提交（裁决 R2）。

## RED → GREEN 证据

**RED**（先写测试，`npm test -- tests/host/handlers.test.ts`）：

```
FAIL  tests/host/handlers.test.ts [ tests/host/handlers.test.ts ]
Error: Failed to load url ../../src/host/handlers ... Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```

失败原因是模块不存在（功能缺失），不是拼写/环境错误；此时 `src/host/handlers.ts` 尚未创建。

**GREEN**（实现后同一命令）：

```
✓ tests/host/handlers.test.ts (5 tests) 40ms
Test Files  1 passed (1)
     Tests  5 passed (5)
```

## `npm run verify` 摘要

```
> tsc -p tsconfig.build.json && node scripts/build-client.mjs
client.js written: 3572 chars

✓ tests/host/dataRoot.test.ts (2 tests)
✓ tests/host/ping.test.ts (1 test)
✓ tests/host/plugin.test.ts (2 tests)
✓ tests/host/plugin-route.test.ts (2 tests)
✓ tests/engine/worldConfig.test.ts (7 tests)
✓ tests/engine/frontmatter.test.ts (12 tests)
✓ tests/host/handlers.test.ts (5 tests)
✓ tests/host/store.test.ts (5 tests)

Test Files  8 passed (8)
     Tests  36 passed (36)
```

另对**构建产物**（不是 vitest 转译）做了一次 Node ESM 冒烟，覆盖 brief 用例之外的两条关键路径：

- `extra` / `conflicts_with` / `same_as` 往返：PUT 后 GET 得到
  `extra: { seed: '真相x', tone: '灰' }`、`conflictsWith: ['W-AX-1']`、`sameAs: ['W-AX-2']`。
- 局部更新（只传 `{ title: '改名' }`）：`id`、`cost`、`extra`、`conflictsWith` 全部从 `prev` 保留，文件从
  `nodes/额外键.md` 移到 `nodes/改名.md`。
- 422 后节点数仍为 1（坏数据未落盘）；404 与 422 的响应体都只有 `error` 一个键且值为字符串。

## 两个易错点

### 1. 422 判定必须在写盘之前

`PUT .../nodes/:id` 的顺序是：

1. `readNode(...).catch(() => null)` 取旧值（没有也不报错）；
2. `toNode(body, prev)` 归一化成 `WorldNode`；
3. `node.kind === 'axiom' && node.cost.length === 0` → 立即返回 `422`；
4. 只有通过校验才调用 `store.writeNode`。

单测「公理没代价返回 422 且不落盘」随后 `GET /nodes` 断言 `[]` 通过，证明 422 分支没有产生文件。冒烟里也确认 422 后已有节点数不变。

### 2. 错误体形状固定为 `{ error: string }`

- 422：`{ error: '公理必须付出代价（铁律一）' }`
- 404（缺世界 id / 未实现路由）：`{ error: string }`
- 500：`{ error: e instanceof Error ? e.message : String(e) }`，即使抛出的不是 `Error`，也保证 `error` 是字符串而不是 `undefined`。
- 成功响应才带业务字段（`{ ok: true }`、节点、列表、stats、config）；错误响应不再附加 `code`/`detail` 等字段。

`conflicts_with → conflictsWith`、`same_as → sameAs` 的转换只在 `toNode` 里发生一次；handler 其余部分不再出现 snake_case。

## 与 brief 的偏差

1. **相对导入带 `.js` 后缀**：`'./store.js'`、`'../engine/types.js'`。原因：`lib/**` 入库且被 Node ESM 直接加载，无后缀在 Node 下会 `ERR_MODULE_NOT_FOUND`；与 `store.ts` / `plugin.ts` 既有写法一致。
2. **`toNode` 入参从 `any` 改为 `unknown` + 收窄**：全局约束要求 strict 且对外签名不出现 `any`。有效请求体的运行时行为与 brief 一致（`id`/`title` 的 `String` 回退、`prev` 字段保留、snake_case 映射）；对非法类型更保守：非数组的 `aliases/cost/...`、非法 `strength`、非字符串 `body/proposition` 回退到 `prev` 或空值，而不会把错误类型写进 `WorldNode`。
3. **`toNode` 增加 `extra`**：`extra: isRecord(input.extra) ? input.extra : (prev?.extra ?? {})`，对应继承约定 #1；未知 front matter 键在「读 → 改 → PUT」往返中不丢失（冒烟已验）。
4. **500 的错误消息取值**：brief 用 `(e as Error).message`，实现用 `e instanceof Error ? e.message : String(e)`，以满足「错误体形状 `{ error: string }`」。
5. **POST/PUT 的 body 收窄**：brief 的 `req.body as any` 改为 `asRecord(req.body)`（非对象按空对象处理）；合法请求行为不变。
6. 测试文件中原 brief 的 5 个用例逐字照抄，包括 `(got.json as any).title`；补丁轮 C 另追加 4 条契约回归用例（见文末），未使用 brief 外的新依赖。

## 担心的地方

- **stats 的 `manifestedAxioms` 定义是 `manifests.length >= 2`**（brief），按 lead 指示保持不变；若后续规则/规格对「已落表」的定义不同，需要回到这里调整。
- 仍没有做完整的请求体 schema 校验（例如 `aliases` 内元素类型、`span` 区间合法性、URL/body id 之外的字段一致性）；本任务只按补丁轮 C 补了必需的四条路由契约，其余留给后续校验/规则任务。
- 原报告列出的另外四条（GET 缺失节点返回 500、URL/body id 不一致、POST 缺参数建 `"undefined"`、axiom 无法降级）已在补丁轮 C 修复，见下。

## 补丁轮 C（C1–C4）

按 lead 的复核意见修复四条路由契约问题；`manifestedAxioms` 定义和 500 兜底文案按要求未动。
提交 `cd9b4c6`（`fix: 路由契约补丁 C（404/400/URL id/kind 降级）`），源码、测试与重新构建的 `lib/host/handlers.js` 一并入库。

### C1 · GET 不存在的节点 → 404

`GET /worlds/:w/nodes/:id` 用单独 try/catch 包住 `store.readNode`；仅当错误消息以「找不到节点」开头时返回 `404 { error: '找不到节点 <id>' }`，其他异常 rethrow 给外层 500。测试断言 404 且 body 严格等于 `{ error: '找不到节点 不存在' }`（只有 `error` 一个键）。

### C2 · URL 的 node id 是权威

PUT 先取 body 的 `id`；`toNode` 后若 body 带 id 且 `String(bodyId) !== nodeId`，返回 `400 { error: 'id 与路径不一致' }`；否则强制 `node.id = nodeId`，再走 422 判定与写盘。测试用 `PUT /worlds/记忆之世/nodes/E-1` + body `{ id: 'E-2' }` 断言 400，并确认节点列表里没有 E-2（未写盘）。

### C3 · POST /worlds 参数校验

`id` 必须是非空白字符串、`config` 必须是非空白字符串，否则返回 `400 { error: '需要 id 与 config' }`，且不调用 `store.createWorld`。测试用独立临时 root 发空 body，断言 400 且 `GET /worlds` 仍为 `[]`（不会建出 `"undefined"` 目录）。

### C4 · axiom 可降回 entry

`toNode` 的 kind 改为三态：`kind === undefined` 沿用 `prev.kind`（新节点默认 entry）；`kind === 'axiom'` 为 axiom；其余显式值一律 entry。测试先建带 cost 的 axiom，再只传 `{ kind: 'entry' }` PUT，断言 200 且读回 kind 为 entry。

### RED → GREEN

RED（先加 4 条测试，实现未改）：

```
tests/host/handlers.test.ts (9 tests | 4 failed)
× GET 不存在的节点返回 404 而不是 500 → expected 500 to be 404
× URL 的 node id 是权威：body id 不一致返回 400 → expected 200 to be 400
× POST /worlds 缺 id 或 config 返回 400 且不建世界 → expected 201 to be 400
× axiom 可以降回 entry → expected 'axiom' to be 'entry'
```

GREEN（修完后）：

```
✓ tests/host/handlers.test.ts (9 tests)
```

### `npm run verify`（补丁轮 C 后）

```
Test Files  8 passed (8)
     Tests  40 passed (40)
```

handlers 9 个用例（原 5 + 补丁 4），其余 31 个存量用例不变。

