import { j, listNodes, listWorlds, readNode, saveNode } from '../../../src/ui/api';

const calls: { url: string; init?: RequestInit }[] = [];
let next: () => Response = () => new Response('null');

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), init });
  return next();
}) as typeof fetch;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

next = () => json(200, ['记忆之世']);
const worlds = await listWorlds();
if (calls.at(-1)?.url !== '/novel/worlds') throw new Error(`worlds url: ${calls.at(-1)?.url}`);
if (JSON.stringify(worlds) !== JSON.stringify(['记忆之世'])) throw new Error('worlds body');
console.log('listWorlds OK:', calls.at(-1)?.url, worlds);

next = () => json(200, [{ id: '还脉礼', title: '还脉礼' }]);
const nodes = await listNodes('记忆之世');
const nodesUrl = `/novel/worlds/${encodeURIComponent('记忆之世')}/nodes`;
if (calls.at(-1)?.url !== nodesUrl) throw new Error(`nodes url: ${calls.at(-1)?.url}`);
if (nodes.length !== 1 || nodes[0]?.['id'] !== '还脉礼') throw new Error('nodes body');
console.log('listNodes OK:', calls.at(-1)?.url);

next = () => json(200, { id: '还脉礼', title: '还脉礼', body: '以血还脉。' });
const node = await readNode('记忆之世', '还脉礼');
const nodeUrl = `/novel/worlds/${encodeURIComponent('记忆之世')}/nodes/${encodeURIComponent('还脉礼')}`;
if (calls.at(-1)?.url !== nodeUrl) throw new Error(`read url: ${calls.at(-1)?.url}`);
if (node['body'] !== '以血还脉。') throw new Error('node body');
console.log('readNode OK:', calls.at(-1)?.url);

next = () => json(200, { ok: true });
await saveNode('记忆之世', { id: '还脉礼', title: '还脉礼', body: '改' });
const last = calls.at(-1)!;
if (last.url !== nodeUrl) throw new Error(`save url: ${last.url}`);
if (last.init?.method !== 'PUT') throw new Error(`save method: ${last.init?.method}`);
const sent = JSON.parse(String(last.init?.body)) as Record<string, unknown>;
if (sent['title'] !== '还脉礼' || sent['body'] !== '改') throw new Error('save body');
const headers = new Headers(last.init?.headers);
if (headers.get('content-type') !== 'application/json') throw new Error('content-type header');
console.log('saveNode OK:', last.url, last.init?.method, String(last.init?.body));

next = () => json(422, { error: '公理必须付出代价（铁律一）' });
let caught = '';
try {
  await saveNode('记忆之世', { id: '公理', kind: 'axiom', cost: [] });
} catch (e) {
  caught = (e as Error).message;
}
if (caught !== '公理必须付出代价（铁律一）') throw new Error(`422 message: ${caught}`);
console.log('422 message OK:', caught);

next = () => new Response(null, { status: 204 });
const empty = await j<undefined>('/worlds/x/nodes/y', { method: 'DELETE' });
if (empty !== undefined) throw new Error('204 should be undefined');
console.log('204 OK: undefined');

console.log('API SMOKE OK');
