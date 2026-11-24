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

export const listNodes = (w: string) => j<NodeRecord[]>(`/worlds/${encodeURIComponent(w)}/nodes`);

export const readNode = (w: string, id: string) =>
  j<NodeRecord>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}`);

export const saveNode = (w: string, n: NodeRecord) =>
  j<NodeRecord>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(String(n['id']))}`, {
    method: 'PUT',
    body: JSON.stringify(n),
  });

export const citations = (w: string, id: string) =>
  j<Citations>(`/worlds/${encodeURIComponent(w)}/nodes/${encodeURIComponent(id)}/citations`);

export const missingLinks = (w: string) =>
  j<{ missing: string[] }>(`/worlds/${encodeURIComponent(w)}/graph/missing`);
