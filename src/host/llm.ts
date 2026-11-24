import { createHash } from 'node:crypto';
import type { AuditFinding, AuditReport, WorldNode } from '../engine/types.js';

export interface LlmConfig {
  baseURL: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface LlmEnv {
  NOVEL_LLM_BASE_URL?: string;
  NOVEL_LLM_MODEL?: string;
  NOVEL_LLM_API_KEY?: string;
  NOVEL_LLM_TIMEOUT_MS?: string;
}

/** 只读环境变量；密钥绝不打日志、不写文件、不回传前端。 */
export function llmConfigFromEnv(env: LlmEnv = process.env): LlmConfig | null {
  const baseURL = (env.NOVEL_LLM_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const model = (env.NOVEL_LLM_MODEL ?? '').trim();
  const apiKey = (env.NOVEL_LLM_API_KEY ?? '').trim();
  if (!baseURL || !model || !apiKey) return null;
  const timeout = Number(env.NOVEL_LLM_TIMEOUT_MS ?? '');
  return {
    baseURL, model, apiKey,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 240_000,
  };
}

const auditId = (a: string, b: string, relation: string): string => {
  const key = [a, b].sort().join('\u0000') + '\u0000' + relation;
  return 'AUD-' + createHash('sha256').update(key).digest('hex').slice(0, 12);
};

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) + '…' : s);

function promptFor(nodes: WorldNode[]): string {
  const cards = nodes.map((n) => ({
    id: n.id,
    title: n.title,
    kind: n.kind,
    strength: n.strength,
    aliases: n.aliases,
    span: n.span,
    proposition: n.proposition,
    cost: n.cost,
    manifests: n.manifests,
    body: clip(n.body, 240),
  }));
  return `你是严格的小说世界观连续性审校。下面是一个世界的全部设定节点。请找出彼此存在真实矛盾（contradiction）或明显张力（tension）的节点对。

判定规则：
1. 只有两条设定在同一适用范围、同一时间段内无法同时为真，才算 contradiction；需要解释、但可共存的冲突算 tension。
2. 不要把“主题对照、立场不同、不同地区、不同年代、人物相信不同说法、myth 与 hard 的认知冲突”当成 contradiction；除非它们在物理事实上无法同时成立。
3. 不要臆造设定，不要因为措辞不同就报冲突；必须引用节点里的原文作为证据。
4. 只使用下面存在的 id；a 与 b 不能相同；优先检查 strength=hard 或 firm 的节点。
5. 没有发现就返回空数组，不要为了凑数硬报。

只输出一个 JSON 对象，不要 Markdown、不要解释：
{"findings":[{"a":"节点id","b":"节点id","relation":"contradiction|tension","confidence":0.0,"reason":"一句话说明为什么不能/难以同时成立","evidence":["节点id: 原文短句"]}]}

节点 JSON：
${JSON.stringify(cards)}`;
}

interface RawFinding {
  a?: unknown; b?: unknown; relation?: unknown;
  confidence?: unknown; reason?: unknown; evidence?: unknown;
}

export function parseAuditContent(content: string, nodes: WorldNode[]): AuditFinding[] {
  let text = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence?.[1]) text = fence[1].trim();
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
  }
  const parsed = JSON.parse(text) as { findings?: unknown };
  if (!Array.isArray(parsed.findings)) throw new Error('模型输出缺少 findings 数组');

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: AuditFinding[] = [];
  for (const item of parsed.findings as RawFinding[]) {
    const a = typeof item.a === 'string' ? item.a : '';
    const b = typeof item.b === 'string' ? item.b : '';
    const relation = item.relation;
    if (a === b || !byId.has(a) || !byId.has(b)) continue;
    if (relation !== 'contradiction' && relation !== 'tension') continue;
    const confidence = Number(item.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) continue;
    if (confidence < 0.65) continue;
    const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
    if (!reason) continue;
    const evidence = Array.isArray(item.evidence)
      ? item.evidence.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 4)
      : [];
    const id = auditId(a, b, relation);
    if (seen.has(id)) continue;
    seen.add(id);
    const an = byId.get(a)!;
    const bn = byId.get(b)!;
    out.push({
      id, a, b, relation, confidence, reason, evidence,
      status: 'open',
      alreadyRegistered: an.conflictsWith.includes(b) || bn.conflictsWith.includes(a),
    });
  }
  return out.sort((x, y) => y.confidence - x.confidence);
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/** 调 OpenAI-compatible chat completions；只接受 JSON 结果。 */
export async function runSemanticAudit(
  nodes: WorldNode[], config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<AuditReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 240_000);
  let res: Response;
  try {
    res = await fetchImpl(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 8000,
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: '你只输出合法 JSON，不输出 Markdown。' },
          { role: 'user', content: promptFor(nodes) },
        ],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError')
      throw new Error(`模型请求超时（${Math.round((config.timeoutMs ?? 240_000) / 1000)}s）`);
    throw new Error(`模型请求失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const detail = clip(await res.text().catch(() => ''), 300);
    throw new Error(`模型返回 HTTP ${res.status}${detail ? `：${detail}` : ''}`);
  }
  const body = await res.json() as ChatResponse;
  const choice = body.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    const fin = (choice as { finish_reason?: string } | undefined)?.finish_reason ?? 'unknown';
    throw new Error(`模型返回为空（finish_reason=${fin}）`);
  }
  const findings = parseAuditContent(content, nodes);
  return {
    model: config.model,
    createdAt: new Date().toISOString(),
    nodeCount: nodes.length,
    findings,
  };
}
