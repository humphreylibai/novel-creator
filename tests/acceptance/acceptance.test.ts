// spec §9 的四条验收：造世界、埋雷、时间断层、删除保护。
// 全部走 createHandlers 的公开接口，不直接碰磁盘，也不 mock 引擎。
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers.js';

const W = '记忆之世';
const CONFIG = `id: ${W}
title: ${W}
genre: { allowed: [超自然], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 一个靠抽干世界来维持秩序的世界
  motif: 记忆即代价
`;

let h: ReturnType<typeof createHandlers>;
beforeAll(async () => {
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-acc-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: W, config: CONFIG } });
});

const put = (id: string, body: unknown) =>
  h({ method: 'PUT', path: `/worlds/${W}/nodes/${id}`, query: {}, body });

describe('验收一：造世界（链路，不计时）', () => {
  it('5 公理 + 6 条目', async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await put(`W-AX-${i}`, { id: `W-AX-${i}`, kind: 'axiom', title: `公理${i}`, strength: 'hard', cost: [`代价${i}`] })).status).toBe(200);
    }
    for (let i = 1; i <= 6; i++) {
      expect((await put(`E-${i}`, { id: `E-${i}`, kind: 'entry', title: `条目${i}`, strength: 'soft', derives: ['W-AX-1'], body: '这是足够长的正文内容，用来避免 R10 触发。' })).status).toBe(200);
    }
    const list = await h({ method: 'GET', path: `/worlds/${W}/nodes`, query: {}, body: null });
    expect((list.json as any[]).length).toBe(11);
  });
});

describe('验收二：故意埋雷（hard×hard）', () => {
  it('同时定位两条并给三种解法', async () => {
    await put('W-AX-9', { id: 'W-AX-9', kind: 'axiom', title: '禁法法则', strength: 'hard', cost: ['秩序'], conflicts_with: ['W-AX-1'] });
    const r = await h({ method: 'GET', path: `/worlds/${W}/findings`, query: {}, body: null });
    const r1 = (r.json as any[]).find((f) => f.rule === 'R1');
    expect(r1).toBeTruthy();
    expect(r1.nodeIds.sort()).toEqual(['W-AX-1', 'W-AX-9']);
    expect(r1.actions).toHaveLength(3);
  });
});

describe('验收三：时间断层（R7）', () => {
  it('截断公理 span 后依赖它的条目立刻报 error', async () => {
    await put('W-AX-2', { id: 'W-AX-2', kind: 'axiom', title: '公理2', strength: 'hard', cost: ['代价2'], span: { from: 1, to: 700 } });
    await put('E-7', { id: 'E-7', kind: 'entry', title: '脉正', strength: 'firm', derives: ['W-AX-2'], span: { from: 412, to: 720 }, body: '这是一段足够长的正文内容避免 R10。' });
    const r = await h({ method: 'GET', path: `/worlds/${W}/findings`, query: {}, body: null });
    const r7 = (r.json as any[]).find((f) => f.rule === 'R7');
    expect(r7?.severity).toBe('error');
    expect(r7?.nodeIds).toContain('E-7');
  });
});

describe('验收四：删除保护', () => {
  it('被引用的条目删除返回 409 并列出引用处', async () => {
    const r = await h({ method: 'DELETE', path: `/worlds/${W}/nodes/W-AX-1`, query: {}, body: null });
    expect(r.status).toBe(409);
    expect((r.json as any).refs.nodes.length).toBeGreaterThan(0);
  });
});
