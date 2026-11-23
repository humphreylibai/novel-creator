## Task 2: 世界配置读取与校验

**Files:**
- Create: `src/engine/worldConfig.ts`
- Test: `tests/engine/worldConfig.test.ts`

**Interfaces:**
- Produces: `parseWorldConfig(raw: string): WorldConfig`；`interface WorldConfig { id, title, genre{allowed,forbidden,expectation}, calendar{epochs,format,months}, theme{wound,motif} }`。缺 `theme.wound` 或空 `calendar.epochs` 抛错。

- [ ] **Step 1: 写失败测试**

```ts
// tests/engine/worldConfig.test.ts
import { describe, it, expect } from 'vitest';
import { parseWorldConfig } from '../../src/engine/worldConfig';

const RAW = `id: 记忆之世
title: 记忆之世
genre:
  allowed: [超自然, 社会]
  forbidden: [时间旅行]
  expectation: 代价必须兑现
calendar:
  epochs:
    - { name: 旧世, start: -1200, end: -1 }
    - { name: 新历, start: 1, end: null }
  format: "新历{year}年"
theme:
  wound: 一个靠抽干世界来维持秩序的世界
  motif: 记忆即代价
`;

describe('world.yaml', () => {
  it('解析出契约、历法、母题', () => {
    const c = parseWorldConfig(RAW);
    expect(c.genre.allowed).toEqual(['超自然', '社会']);
    expect(c.calendar.epochs).toHaveLength(2);
    expect(c.theme.wound).toContain('抽干');
  });
  it('缺母题时报错', () => {
    expect(() => parseWorldConfig(RAW.replace(/theme:[\s\S]*$/, ''))).toThrow(/wound/);
  });
  it('历法为空时报错', () => {
    expect(() => parseWorldConfig(RAW.replace(/epochs:[\s\S]*?format/, 'format'))).toThrow(/epochs/);
  });
});
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/engine/worldConfig.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/engine/worldConfig.ts
import { parse as parseYaml } from 'yaml';

export interface Epoch { name: string; start: number; end: number | null }
export interface WorldConfig {
  id: string; title: string;
  genre: { allowed: string[]; forbidden: string[]; expectation: string };
  calendar: { epochs: Epoch[]; format: string; months: string[] };
  theme: { wound: string; motif: string };
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function parseWorldConfig(raw: string): WorldConfig {
  const d = (parseYaml(raw) ?? {}) as Record<string, any>;
  const theme = d['theme'] ?? {};
  const wound = String(theme['wound'] ?? '').trim();
  if (!wound) throw new Error('world.yaml 缺少 theme.wound（一句话母题）');

  const cal = d['calendar'] ?? {};
  const epochsRaw = Array.isArray(cal['epochs']) ? cal['epochs'] : [];
  if (epochsRaw.length === 0) throw new Error('world.yaml 缺少 calendar.epochs（历法必须成数据）');
  const epochs: Epoch[] = epochsRaw.map((e: any) => ({
    name: String(e?.['name'] ?? ''),
    start: Number(e?.['start'] ?? 0),
    end: e?.['end'] === null || e?.['end'] === undefined ? null : Number(e['end'])
  }));

  return {
    id: String(d['id'] ?? ''),
    title: String(d['title'] ?? d['id'] ?? ''),
    genre: {
      allowed: arr(d['genre']?.['allowed']),
      forbidden: arr(d['genre']?.['forbidden']),
      expectation: String(d['genre']?.['expectation'] ?? '')
    },
    calendar: { epochs, format: String(cal['format'] ?? '{year}'), months: arr(cal['months']) },
    theme: { wound, motif: String(theme['motif'] ?? '') }
  };
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/engine/worldConfig.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/engine/worldConfig.ts tests/engine/worldConfig.test.ts
git commit -m "feat: world.yaml 解析与校验"
```

---

