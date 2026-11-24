import { beforeAll, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers.js';

const CONFIG = `id: T
title: T
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: ''
`;

let h: ReturnType<typeof createHandlers>;
beforeAll(async () => {
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-suggest-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: 'T', config: CONFIG } });
  await h({ method: 'PUT', path: '/worlds/T/nodes/W-AX-1', query: {}, body: {
    id: 'W-AX-1', kind: 'axiom', title: '记忆即燃料', cost: ['记忆'], manifests: [],
    body: '施法会烧掉记忆。', proposition: '',
  } });
});

it('返回命题/审问/裁决建议', async () => {
  const r = await h({ method: 'GET', path: '/worlds/T/nodes/W-AX-1/suggest', query: {}, body: null });
  expect(r.status).toBe(200);
  const body = r.json as { proposition: string; questions: string[]; rulings: string[] };
  expect(body.proposition).toBe('施法会烧掉记忆。');
  expect(body.questions.join('\n')).toContain('能被看见');
  expect(Array.isArray(body.rulings)).toBe(true);
});

it('不存在的节点返回 404', async () => {
  const r = await h({ method: 'GET', path: '/worlds/T/nodes/nope/suggest', query: {}, body: null });
  expect(r.status).toBe(404);
});
