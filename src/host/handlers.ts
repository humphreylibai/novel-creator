import * as store from './store.js';
import type { Span, Strength, WorldNode } from '../engine/types.js';

export interface NovelReq { method: string; path: string; query: Record<string, string>; body: unknown }
export interface NovelRes { status: number; json?: unknown }

type JsonRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is JsonRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asRecord = (v: unknown): JsonRecord => (isRecord(v) ? v : {});

/** 只接受数组；标量 / null / 缺省一律交给调用方的回退值。 */
const strArray = (v: unknown): string[] | null => (Array.isArray(v) ? v.map(String) : null);

const isStrength = (v: unknown): v is Strength =>
  v === 'hard' || v === 'firm' || v === 'soft' || v === 'myth';

const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function pickSpan(v: unknown, fallback: Span): Span {
  if (!isRecord(v)) return fallback;
  return { from: numOrNull(v['from']), to: numOrNull(v['to']) };
}

/**
 * 请求体 → 领域节点。字段名转换（conflicts_with / same_as）只在这里发生一次；
 * extra 是未知 front matter 键的保存通道，缺了它保存往返就会静默丢数据。
 */
function toNode(input: JsonRecord, prev: WorldNode | null): WorldNode {
  const rawId = input['id'];
  const rawTitle = input['title'];
  const kind = input['kind'] === undefined
    ? (prev?.kind ?? 'entry')
    : input['kind'] === 'axiom' ? 'axiom' : 'entry';

  return {
    id: rawId !== undefined && rawId !== null ? String(rawId) : (prev?.id ?? ''),
    kind,
    subtype: typeof input['subtype'] === 'string' ? input['subtype'] : (prev?.subtype ?? null),
    title: rawTitle !== undefined && rawTitle !== null
      ? String(rawTitle)
      : (prev?.title ?? (rawId !== undefined && rawId !== null ? String(rawId) : '')),
    aliases: strArray(input['aliases']) ?? prev?.aliases ?? [],
    strength: isStrength(input['strength']) ? input['strength'] : (prev?.strength ?? 'soft'),
    span: pickSpan(input['span'], prev?.span ?? { from: null, to: null }),
    proposition: typeof input['proposition'] === 'string'
      ? input['proposition']
      : (prev?.proposition ?? null),
    cost: strArray(input['cost']) ?? prev?.cost ?? [],
    derives: strArray(input['derives']) ?? prev?.derives ?? [],
    manifests: strArray(input['manifests']) ?? prev?.manifests ?? [],
    requires: strArray(input['requires']) ?? prev?.requires ?? [],
    conflictsWith: strArray(input['conflicts_with']) ?? prev?.conflictsWith ?? [],
    sameAs: strArray(input['same_as']) ?? prev?.sameAs ?? [],
    violations: strArray(input['violations']) ?? prev?.violations ?? [],
    extra: isRecord(input['extra']) ? input['extra'] : (prev?.extra ?? {}),
    body: typeof input['body'] === 'string' ? input['body'] : (prev?.body ?? ''),
    file: prev?.file ?? ''
  };
}

export function createHandlers(root: string): (req: NovelReq) => Promise<NovelRes> {
  return async function handle(req: NovelReq): Promise<NovelRes> {
    try {
      const parts = req.path.split('/').filter(Boolean);

      if (parts[0] === 'worlds' && parts.length === 1) {
        if (req.method === 'GET') return { status: 200, json: await store.listWorlds(root) };
        if (req.method === 'POST') {
          const b = asRecord(req.body);
          const id = b['id'];
          const config = b['config'];
          if (typeof id !== 'string' || id.trim() === ''
            || typeof config !== 'string' || config.trim() === '')
            return { status: 400, json: { error: '需要 id 与 config' } };
          await store.createWorld(root, id, config);
          return { status: 201, json: { ok: true } };
        }
      }

      const worldId = parts[1] ? decodeURIComponent(parts[1]) : '';
      if (!worldId) return { status: 404, json: { error: '缺少世界 id' } };

      if (parts[2] === 'config' && req.method === 'GET')
        return { status: 200, json: await store.readWorldConfig(root, worldId) };

      if (parts[2] === 'stats' && req.method === 'GET') {
        const nodes = await store.listNodes(root, worldId);
        const axioms = nodes.filter((n) => n.kind === 'axiom');
        return { status: 200, json: {
          axioms: axioms.length,
          entries: nodes.filter((n) => n.kind === 'entry').length,
          manifestedAxioms: axioms.filter((a) => a.manifests.length >= 2).length
        } };
      }

      if (parts[2] === 'nodes' && parts.length === 3 && req.method === 'GET')
        return { status: 200, json: await store.listNodes(root, worldId) };

      if (parts[2] === 'nodes' && parts.length === 4) {
        const nodeId = decodeURIComponent(parts[3]!);
        if (req.method === 'GET') {
          try {
            return { status: 200, json: await store.readNode(root, worldId, nodeId) };
          } catch (e) {
            // readNode 找不到节点是 404；其他异常（磁盘/解析等）继续走外层 500。
            if (e instanceof Error && e.message.startsWith('找不到节点'))
              return { status: 404, json: { error: e.message } };
            throw e;
          }
        }
        if (req.method === 'DELETE') {
          await store.deleteNode(root, worldId, nodeId);
          return { status: 204 };
        }
        if (req.method === 'PUT') {
          const input = asRecord(req.body);
          const bodyId = input['id'];
          const prev = await store.readNode(root, worldId, nodeId).catch(() => null);
          const node = toNode(input, prev);
          // URL 的 id 是权威；body 带 id 时必须一致，避免写到另一个节点。
          if (bodyId !== undefined && bodyId !== null && String(bodyId) !== nodeId)
            return { status: 400, json: { error: 'id 与路径不一致' } };
          node.id = nodeId;
          // 校验必须先于写盘：422 的节点不能留下任何文件。
          if (node.kind === 'axiom' && node.cost.length === 0)
            return { status: 422, json: { error: '公理必须付出代价（铁律一）' } };
          return { status: 200, json: await store.writeNode(root, worldId, node) };
        }
      }

      return { status: 404, json: { error: `未实现的路由 ${req.method} ${req.path}` } };
    } catch (e) {
      return { status: 500, json: { error: e instanceof Error ? e.message : String(e) } };
    }
  };
}
