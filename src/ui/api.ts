import type { Finding, Span, Strength } from '../engine/types.js';

export type { Finding, Severity } from '../engine/types.js';

export type NodeRecord = Record<string, unknown>;

export interface CitationNodeRef {
  id: string;
  title: string;
  via: string;
}

export interface Citations {
  fragments: string[];
  nodes: CitationNodeRef[];
}

/** 统一把 `/api` 前缀、204、错误体翻译成 Promise / Error。 */
export async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: { 'content-type': 'application/json' }, ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

export const listWorlds = () => j<string[]>('/worlds');

export const deleteWorld = (id: string) =>
  fetch(`/api/worlds/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(async (res) => {
    if (res.status === 204) return;
    const b = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(b.error ?? res.statusText);
  });

export const createWorld = (id: string, config: string) =>
  j<{ ok: true }>('/worlds', { method: 'POST', body: JSON.stringify({ id, config }) });

export const listNodes = (w: string) => j<NodeRecord[]>(`/worlds/${encodeURIComponent(w)}/nodes`);

export interface Stats {
  axioms: number;
  entries: number;
  manifestedAxioms: number;
}

export const stats = (w: string) => j<Stats>(`/worlds/${encodeURIComponent(w)}/stats`);

export const readNode = (w: string, id: string) =>
  j<NodeRecord>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}`);

export const saveNode = (w: string, n: NodeRecord) =>
  j<NodeRecord>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(String(n['id']))}`, {
    method: 'PUT',
    body: JSON.stringify(n),
  });

export async function deleteNode(w: string, id: string): Promise<void> {
  const res = await fetch(`/api/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (res.status === 204) return;
  const body = await res.json().catch(() => ({ error: res.statusText }));
  const b = body as {
    error?: string;
    refs?: { fragments: string[]; nodes: { title: string; via: string }[] };
  };
  const refs = b.refs
    ? `（片段：${b.refs.fragments.join('、') || '无'}；条目：${b.refs.nodes.map((n) => `${n.title}(${n.via})`).join('、') || '无'}）`
    : '';
  throw new Error(`${b.error ?? res.statusText}${refs}`);
}

export interface Suggestions {
  proposition: string;
  questions: string[];
  rulings: string[];
}

export const suggestions = (w: string, id: string) =>
  j<Suggestions>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}/suggest`);

export const citations = (w: string, id: string) =>
  j<Citations>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}/citations`);

export interface BeliefRecord {
  id: string;
  holder: string;
  target: string;
  content: string;
  confidence: number;
  source: string[];
  span: { from: number | null; to: number | null };
  file: string;
}

export const listBeliefs = (w: string) =>
  j<BeliefRecord[]>(`/worlds/${encodeURIComponent(w)}/beliefs`);

export const saveBelief = (w: string, id: string, body: Omit<BeliefRecord, 'id' | 'file'>) =>
  j<BeliefRecord>(`/worlds/${encodeURIComponent(w)}/beliefs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteBelief = (w: string, id: string) =>
  j<void>(`/worlds/${encodeURIComponent(w)}/beliefs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export interface FragmentRecord {
  id: string;
  chapter: number | null;
  scene: number | null;
  text: string;
  file: string;
}

export const listFragments = (w: string) =>
  j<FragmentRecord[]>(`/worlds/${encodeURIComponent(w)}/fragments`);

export const saveFragment = (w: string, id: string,
  body: { chapter: number | null; scene: number | null; text: string }) =>
  j<void>(`/worlds/${encodeURIComponent(w)}/fragments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const missingLinks = (w: string) =>
  j<{ missing: string[] }>(`/worlds/${encodeURIComponent(w)}/graph/missing`);

export const findings = (w: string) =>
  j<Finding[]>(`/worlds/${encodeURIComponent(w)}/findings`);

export interface TimelineNode {
  id: string;
  title: string;
  strength: Strength;
  span: Span;
}

export interface TimelineSlice {
  year: number;
  nodes: TimelineNode[];
}

/** 时间轴只需要历法；服务端返回的是完整 world.yaml 解析结果。 */
export interface WorldCalendar {
  calendar: { epochs: { start: number; end: number | null }[]; format?: string };
}

export const worldConfig = (w: string) =>
  j<WorldCalendar>(`/worlds/${encodeURIComponent(w)}/config`);

/** 某一年「在场」的条目切片；year 由服务端回显，界面以它为准。 */
export const atYear = (w: string, year: number) =>
  j<TimelineSlice>(`/worlds/${encodeURIComponent(w)}/at?year=${encodeURIComponent(String(year))}`);
