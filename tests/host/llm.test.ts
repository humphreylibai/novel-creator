import { describe, expect, it } from 'vitest';
import { llmConfigFromEnv, parseAuditContent, runSemanticAudit } from '../../src/host/llm.js';
import type { WorldNode } from '../../src/engine/types.js';

const node = (over: Partial<WorldNode>): WorldNode => ({
  id: 'A', kind: 'axiom', subtype: null, title: 'A', aliases: [],
  strength: 'hard', span: { from: null, to: null }, proposition: '甲',
  cost: ['代价'], derives: [], manifests: [], requires: [],
  conflictsWith: [], sameAs: [], violations: [], extra: {},
  body: '正文正文正文正文正文', file: 'nodes/A.md', ...over,
});

const nodes = [node({ id: 'A', title: 'A' }), node({ id: 'B', title: 'B' })];

describe('语义审计 JSON 解析', () => {
  it('接受合法 finding，忽略未知 id / 低置信度 / 非法关系', () => {
    const out = parseAuditContent(JSON.stringify({ findings: [
      { a: 'A', b: 'B', relation: 'contradiction', confidence: 0.9, reason: '不能同时成立', evidence: ['A: 甲'] },
      { a: 'A', b: 'B', relation: 'contradiction', confidence: 0.9, reason: '重复' },
      { a: 'A', b: 'X', relation: 'contradiction', confidence: 0.9, reason: '未知' },
      { a: 'A', b: 'B', relation: 'maybe', confidence: 0.9, reason: '非法关系' },
      { a: 'A', b: 'B', relation: 'tension', confidence: 0.2, reason: '低置信' },
    ] }), nodes);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ a: 'A', b: 'B', relation: 'contradiction', status: 'open' });
  });

  it('支持 ```json 围栏和前后说明', () => {
    const out = parseAuditContent('```json\n{"findings":[]}\n```', nodes);
    expect(out).toEqual([]);
    expect(parseAuditContent('结果：{"findings":[]}', nodes)).toEqual([]);
  });

  it('不是 JSON 时抛错', () => {
    expect(() => parseAuditContent('我不知道', nodes)).toThrow();
  });
});

describe('模型配置', () => {
  it('三个变量缺一不可', () => {
    expect(llmConfigFromEnv({ NOVEL_LLM_BASE_URL: 'http://x/v1' })).toBeNull();
    expect(llmConfigFromEnv({
      NOVEL_LLM_BASE_URL: 'http://x/v1', NOVEL_LLM_MODEL: 'm', NOVEL_LLM_API_KEY: 'k',
    })).toMatchObject({ baseURL: 'http://x/v1', model: 'm', apiKey: 'k' });
  });
});

describe('runSemanticAudit', () => {
  it('带 Bearer key 调 chat/completions 并解析', async () => {
    let url = ''; let auth = ''; let body: any = null;
    const fake = (async (input: string, init?: RequestInit) => {
      url = input; auth = String((init?.headers as Record<string, string>).authorization);
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        findings: [{ a: 'A', b: 'B', relation: 'tension', confidence: 0.8, reason: '有张力', evidence: ['A: 甲'] }],
      }) } }] }), { status: 200 });
    }) as typeof fetch;
    const report = await runSemanticAudit(nodes, {
      baseURL: 'http://model/v1', model: 'm', apiKey: 'secret',
    }, fake);
    expect(url).toBe('http://model/v1/chat/completions');
    expect(auth).toBe('Bearer secret');
    expect(body.model).toBe('m');
    expect(report.findings[0]).toMatchObject({ relation: 'tension', confidence: 0.8 });
  });

  it('HTTP 错误转成可读错误', async () => {
    const fake = (async () => new Response('boom', { status: 500 })) as typeof fetch;
    await expect(runSemanticAudit(nodes, {
      baseURL: 'http://model/v1', model: 'm', apiKey: 'k',
    }, fake)).rejects.toThrow('HTTP 500');
  });
});
