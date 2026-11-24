import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers.js';

const CONFIG = `id: 记忆之世
title: 记忆之世
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: 母题
`;

let h: ReturnType<typeof createHandlers>;

beforeAll(async () => {
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-at-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/W-AX-1', query: {}, body: {
    id: 'W-AX-1', kind: 'axiom', title: '公理一', strength: 'hard',
    cost: ['代价'], span: { from: 1, to: 700 }, body: '这是一段足够长的公理正文，避免触发 R10。',
  } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-1', query: {}, body: {
    id: 'E-1', kind: 'entry', title: '脉正', strength: 'firm', derives: ['W-AX-1'],
    span: { from: 412, to: 720 }, body: '这是一段足够长的条目正文，避免触发 R10。',
  } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-2', query: {}, body: {
    id: 'E-2', kind: 'entry', title: '长存', strength: 'soft',
    span: { from: null, to: null }, body: '这是一段足够长的条目正文，避免触发 R10。',
  } });
});

const at = (year: string | null) =>
  h({ method: 'GET', path: '/worlds/记忆之世/at', query: year === null ? {} : { year }, body: null });
const ids = (r: Awaited<ReturnType<typeof at>>) =>
  (r.json as { nodes: { id: string }[] }).nodes.map((n) => n.id);

describe('时间切片路由', () => {
  it('按年份返回在场条目，端点包含', async () => {
    const before = await at('411');
    expect(before.status).toBe(200);
    expect((before.json as { year: number }).year).toBe(411);
    expect(ids(before)).toContain('W-AX-1');
    expect(ids(before)).toContain('E-2');
    expect(ids(before)).not.toContain('E-1');

    const atStart = await at('412');
    expect(ids(atStart)).toContain('E-1');

    const atEnd = await at('700');
    expect(ids(atEnd)).toContain('W-AX-1');
    expect(ids(atEnd)).toContain('E-1');

    const afterEnd = await at('701');
    expect(ids(afterEnd)).not.toContain('W-AX-1');
    expect(ids(afterEnd)).toContain('E-1');
  });

  it('缺省 year 按 0 年；非数字返回 400', async () => {
    const zero = await at(null);
    expect(zero.status).toBe(200);
    expect((zero.json as { year: number }).year).toBe(0);
    expect(ids(zero)).toContain('E-2');
    expect(ids(zero)).not.toContain('E-1');

    const bad = await at('abc');
    expect(bad.status).toBe(400);
  });
});
