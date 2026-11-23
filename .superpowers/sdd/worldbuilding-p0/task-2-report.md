# Task 2 Report: 世界配置读取与校验

**Status:** DONE
**Commit:** `31e3d18` — `feat: world.yaml 解析与校验`（3 files changed, 170 insertions）
**Branch:** `feat/p0-worldbuilding`（父提交 `041fc49`）
**Files:**
- `src/engine/worldConfig.ts`（新建）
- `tests/engine/worldConfig.test.ts`（新建）
- `lib/engine/worldConfig.js`（构建产物，按账本 R2 入库）

## 做了什么

1. **TDD 先行（RED 已亲眼看它失败）**
   - 把 brief Step 1 的 3 条测试逐字照抄进 `tests/engine/worldConfig.test.ts`（`RAW` 常量、用例名、断言、错误正则全部一字不改）。
   - 在同一文件追加 4 条「brief 已规定的接口/缺省行为」补测（见「偏差 2」），全部在实现前写好。
   - `npm test -- tests/engine/worldConfig.test.ts` → FAIL，原因是模块不存在：
     ```
     Error: Failed to load url ../../src/engine/worldConfig (resolved id: ../../src/engine/worldConfig)
     in D:/code/novel/tests/engine/worldConfig.test.ts. Does the file exist?
     ```
     即「功能缺失」，不是拼写/配置错误。日志：`.superpowers/sdd/worldbuilding-p0/task-2-test-red.log`（exit 1，`Tests no tests`）。
2. **实现（GREEN）**
   - `src/engine/worldConfig.ts` 导出 `Epoch`、`WorldConfig`、`parseWorldConfig(raw: string): WorldConfig`；字段名与 brief 逐字一致。
   - 校验与 brief 一致：`theme.wound` 去空白后为空 → 抛 `world.yaml 缺少 theme.wound（一句话母题）`；`calendar.epochs` 非数组或空数组 → 抛 `world.yaml 缺少 calendar.epochs（历法必须成数据）`。
   - 缺省值与 brief 一致：`id` → `''`、`title` → `title ?? id ?? ''`、`format` → `'{year}'`、`months`/`allowed`/`forbidden` → `[]`、`expectation`/`motif` → `''`；`epoch.end` 为 `null`/`undefined` 时保留 `null`，否则 `Number()`。
   - 纯函数：只 import `yaml`；无 fs、无 `node:` 内建、无 DSH API；对外签名无 `any`（brief 的 `Record<string, any>` 已按委托要求收紧，见「偏差 1」）。
3. **验证并提交**：`npm run verify` exit 0；`npx tsc -p tsconfig.json --noEmit`（含 tests 的全量 strict）exit 0；直接在 Node ESM 里 import 构建产物做冒烟，确认 `lib/engine/worldConfig.js` 可用。提交只含上述 3 个文件，`?? .superpowers/` 为报告目录，不入库。

## RED → GREEN 证据

### RED（模块未实现）

```
FAIL  tests/engine/worldConfig.test.ts [ tests/engine/worldConfig.test.ts ]
Error: Failed to load url ../../src/engine/worldConfig (resolved id: ../../src/engine/worldConfig)
 Test Files  1 failed (1)
      Tests  no tests
EXIT=1
```

### GREEN（定向测试）

```
✓ tests/engine/worldConfig.test.ts (7 tests) 19ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
EXIT=0
```

日志：`.superpowers/sdd/worldbuilding-p0/task-2-test-green.log`。

## `npm run verify` 输出摘要

命令：`npm run verify`（= `npm run build && npm test`），exit 0：

```
> tsc -p tsconfig.build.json && node scripts/build-client.mjs
client.js written: 3572 chars

 ✓ tests/host/ping.test.ts (1 test) 3ms
 ✓ tests/host/dataRoot.test.ts (2 tests) 3ms
 ✓ tests/host/plugin.test.ts (2 tests) 4ms
 ✓ tests/host/plugin-route.test.ts (2 tests) 3ms
 ✓ tests/engine/worldConfig.test.ts (7 tests) 24ms
 ✓ tests/engine/frontmatter.test.ts (12 tests) 29ms

 Test Files  6 passed (6)
      Tests  26 passed (26)
```

完整日志：`.superpowers/sdd/worldbuilding-p0/task-2-verify.log`。

补充证据：
- `npx tsc -p tsconfig.json --noEmit` → exit 0（src + tests 全量 strict，含 `noUncheckedIndexedAccess`）。
- 产物冒烟（`node --input-type=module` 直接 import `./lib/engine/worldConfig.js`）：
  ```
  {"id":"测试","title":"记忆之世","genre":{"allowed":[],"forbidden":[],"expectation":""},
   "calendar":{"epochs":[{"name":"新历","start":1,"end":null}],"format":"{year}","months":[]},
   "theme":{"wound":"世界会遗忘","motif":""}}
  ERR: world.yaml 缺少 theme.wound（一句话母题）
  ```
  证明构建产物可运行、校验文案生效。
- 提交后重跑 `npm run verify`，`git status` 仅剩 `?? .superpowers/`，`git diff -- lib` 为空 → 入库产物与当前源码构建结果无漂移。

## 与 brief 的偏差及原因

1. **`Record<string, any>` → `unknown` + `asRecord()` 类型守卫**（委托明确要求）
   - 新增 `asRecord(v: unknown): Record<string, unknown>`：普通对象原样返回，标量 / 序列 / `null` 返回 `{}`。
   - 运行时行为与 brief 等价：brief 对这些位置做的是属性读取（`d['theme']`、`e?.['name']` 等），在非对象上读不到键即 `undefined`；`asRecord` 返回 `{}` 后读取同样的键仍是 `undefined`。唯一被「处理掉」的是 Brief 里 `d['genre']?.['allowed']` 对数组/标量的可选链，结果同为 `undefined`。
   - 保持一致的边界：`parseYaml` 本身对非法 YAML 抛错仍向上传播（brief 未捕获）；`theme.wound` 非字符串时仍 `String()` 后判定；`title` 用 `??` 而非 `||`，空串不回退到 id；`epoch.end` 区分 `null` 与数字。
2. **测试 3 条 → 7 条（新增 4 条，均不引入新行为）**
   brief 的 3 条原样保留，另补 4 条断言 brief 已规定的字段与缺省值，避免这些分支零覆盖：
   | 用例 | 覆盖 |
   | --- | --- |
   | `契约与母题完整读出` | `id`、`title`、`forbidden`、`expectation`、`format`、`months` 缺省、`motif` |
   | `历法时段保留负数年份，null 表示至今` | 两个 epoch 的 `name/start/end` 完整对象（含 `start: -1200`、`end: null`） |
   | `缺省值安全，标题回退 id` | 无 `title` 时回退 `id`；`format` 默认 `'{year}'`；`months`/`genre` 默认空；epoch 缺 `end` 得 `null` |
   | `非映射 YAML 不崩溃，按缺母题报错` | 标量根、序列根均走 `theme.wound` 错误，而不是 `TypeError` |
   这 4 条是在实现之前与 brief 测试一起写的，RED 阶段同样因模块缺失而失败；没有事后补测。
3. **`lib/engine/worldConfig.js` 一并入库**：brief Step 5 只 `git add` 两个源文件，但账本 R2 裁决要求 `lib/**` 入库；委托也明确要求 `git add lib`。已照办。
4. 除上述两点外，API 名、字段名、默认值、错误文案、测试代码均照抄 brief，未自行发明行为。

## Concerns

1. **本函数是「解析 + 两条必填校验」，不是完整校验器**：`calendar.epochs` 只检查「非空数组」，不检查年份是否为整数、`start <= end`、纪元是否重叠/乱序（全局约束写的是「年份整数」，但 brief 的运行行为未要求抛错）。`Number()` 对 `'新历'`、`null`、`{}` 会产生 `NaN` 而非报错。建议后续在 Task 10 的规则层（或专门的 world 校验）补 R13 类规则；当前实现严格服从 brief。
2. **非 mapping 的 epoch 条目会静默降级**：例如 `epochs: [旧世]` 会得到 `{ name: '', start: 0, end: null }`，不报错。这是 brief 中 `e?.['name']` 的既有语义，未改动。
3. **`months` 的非空读取没有独立断言**：只断言了缺省 `[]`；非空分支与 `allowed`/`forbidden` 共用同一个 `arr()`（后者已被 brief 测试覆盖）。若评审要求逐字段覆盖，可再补一条 `months: [一月, 二月]` 的用例，但这会超出 brief 给定的测试集，故未擅加。
4. **`String()` 兜底会把对象/数组字段变成 `"[object Object]"` 或逗号串**（如 `wound: { a: 1 }` 会被当作非空母题接受）。同样是 brief 的既有行为；若需要严格类型校验，应在后续校验层做。
