import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers.js';
import type { AuditReport } from '../../src/engine/types.js';

const CONFIG = `id: 审计界
title: 审计界
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: ''
`;

const report: AuditReport = {
  model: 'test-model', createdAt: '2026-11-24T00:00:00.000Z', nodeCount: 2,
  findings: [{
    id: 'AUD-1', a: 'A', b: 'B', relation: 'contradiction', confidence: 0.9,
    reason: '不可能同时成立', evidence: ['A: 甲'], status: 'open', alreadyRegistered: false,
  }],
};

let h: ReturnType<typeof createHandlers>;
let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-audit-'));
  h = createHandlers(root, { audit: async () => report });
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '审计界', config: CONFIG } });
  await h({ method: 'PUT', path: '/worlds/审计界/nodes/A', query: {}, body: {
    id: 'A', kind: 'axiom', title: 'A', strength: 'hard', cost: ['代价'],
    body: '正文正文正文正文正文',
  } });
  await h({ method: 'PUT', path: '/worlds/审计界/nodes/B', query: {}, body: {
    id: 'B', kind: 'axiom', title: 'B', strength: 'hard', cost: ['代价'],
    body: '正文正文正文正文正文',
  } });
});

describe('语义审计 API', () => {
  it('运行、读取、接受后写入 conflictsWith', async () => {
    const run = await h({ method: 'POST', path: '/worlds/审计界/audit', query: {}, body: {} });
    expect(run.status).toBe(200);
    const got = await h({ method: 'GET', path: '/worlds/审计界/audits', query: {}, body: null });
    expect((got.json as any).findings[0].status).toBe('open');

    const accepted = await h({
      method: 'POST', path: '/worlds/审计界/audits/AUD-1', query: {}, body: { status: 'accepted' },
    });
    expect(accepted.status).toBe(200);
    const node = await h({ method: 'GET', path: '/worlds/审计界/nodes/A', query: {}, body: null });
    expect((node.json as any).conflictsWith).toContain('B');
    const findings = await h({ method: 'GET', path: '/worlds/审计界/findings', query: {}, body: null });
    expect((findings.json as any).some((f: any) => f.rule === 'R1')).toBe(true);
  });

  it('没有模型配置且没有注入时返回 503', async () => {
    const plain = createHandlers(root);
    const r = await plain({ method: 'POST', path: '/worlds/审计界/audit', query: {}, body: {} });
    expect(r.status).toBe(503);
  });

  it('驳回只改状态，不写 conflictsWith', async () => {
    await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '驳回界', config: CONFIG } });
    await h({ method: 'PUT', path: '/worlds/驳回界/nodes/C', query: {}, body: {
      id: 'C', kind: 'axiom', title: 'C', strength: 'hard', cost: ['代价'], body: '正文正文正文正文正文',
    } });
    await h({ method: 'PUT', path: '/worlds/驳回界/nodes/D', query: {}, body: {
      id: 'D', kind: 'axiom', title: 'D', strength: 'hard', cost: ['代价'], body: '正文正文正文正文正文',
    } });
    const h2 = createHandlers(root, { audit: async () => ({
      ...report,
      findings: [{ ...report.findings[0]!, id: 'AUD-C-D', a: 'C', b: 'D' }],
    }) });
    await h2({ method: 'POST', path: '/worlds/驳回界/audit', query: {}, body: {} });
    const r = await h2({ method: 'POST', path: '/worlds/驳回界/audits/AUD-C-D', query: {}, body: { status: 'dismissed' } });
    expect(r.status).toBe(200);
    const node = await h2({ method: 'GET', path: '/worlds/驳回界/nodes/C', query: {}, body: null });
    expect((node.json as any).conflictsWith).toEqual([]);
  });
});
