import * as store from './store.js';
import { isSafeName } from './safeName.js';
import { invalidateIndex } from './indexFile.js';
import { buildGraph } from '../engine/graph.js';
import { runRules } from '../engine/rules/index.js';
import { stateAt } from '../engine/query.js';
import { interrogate, rulingAdvice, suggestProposition } from '../engine/suggest.js';
import { llmConfigFromEnv, runSemanticAudit } from './llm.js';
import { readAuditReport, setAuditStatus, writeAuditReport } from './auditStore.js';
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const asRecord = (v) => (isRecord(v) ? v : {});
/** 只接受数组；标量 / null / 缺省一律交给调用方的回退值。 */
const strArray = (v) => (Array.isArray(v) ? v.map(String) : null);
const isStrength = (v) => v === 'hard' || v === 'firm' || v === 'soft' || v === 'myth';
const numOrNull = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
function pickSpan(v, fallback) {
    if (!isRecord(v))
        return fallback;
    return { from: numOrNull(v['from']), to: numOrNull(v['to']) };
}
/**
 * 请求体 → 领域节点。字段名转换（conflicts_with / same_as）只在这里发生一次；
 * extra 是未知 front matter 键的保存通道，缺了它保存往返就会静默丢数据。
 */
function toBelief(input, id) {
    const holder = String(input['holder'] ?? '').trim();
    const target = String(input['target'] ?? '').trim();
    const content = String(input['content'] ?? '').trim();
    const confidence = Number(input['confidence']);
    if (!holder || !target || !content)
        throw new Error('holder / target / content 都不能为空');
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
        throw new Error('confidence 必须是 0–1 之间的数字');
    return {
        id, holder, target, content, confidence,
        source: strArray(input['source']) ?? [],
        span: pickSpan(input['span'], { from: null, to: null }),
        file: `beliefs/${id}.yaml`,
    };
}
function toNode(input, prev) {
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
function collectRefs(g, nodeId, beliefs = []) {
    const fragments = new Set();
    const nodes = new Map();
    for (const edge of g.inbound.get(nodeId) ?? []) {
        if (edge.type === 'cites') {
            fragments.add(edge.from.replace(/^fragments\//, '').replace(/\.md$/, ''));
            continue;
        }
        const key = `${edge.from}\u0000${edge.type}`;
        if (!nodes.has(key)) {
            nodes.set(key, {
                id: edge.from,
                title: g.nodes.get(edge.from)?.title ?? edge.from,
                via: edge.type,
            });
        }
    }
    return {
        fragments: [...fragments], nodes: [...nodes.values()],
        beliefs: beliefs.filter((b) => b.target === nodeId).map((b) => b.id),
    };
}
export function createHandlers(root, options = {}) {
    return async function handle(req) {
        try {
            const parts = req.path.split('/').filter(Boolean);
            if (parts[0] === 'worlds' && parts.length === 1) {
                if (req.method === 'GET')
                    return { status: 200, json: await store.listWorlds(root) };
                if (req.method === 'POST') {
                    const b = asRecord(req.body);
                    const id = b['id'];
                    const config = b['config'];
                    if (typeof id !== 'string' || id.trim() === ''
                        || typeof config !== 'string' || config.trim() === '')
                        return { status: 400, json: { error: '需要 id 与 config' } };
                    if (!isSafeName(id))
                        return { status: 400, json: { error: '世界 id 不能包含路径分隔符' } };
                    try {
                        await store.createWorld(root, id, config);
                    }
                    catch (e) {
                        if (e instanceof Error && e.message.startsWith('世界已存在'))
                            return { status: 409, json: { error: e.message } };
                        throw e;
                    }
                    return { status: 201, json: { ok: true } };
                }
            }
            const worldId = parts[1] ? decodeURIComponent(parts[1]) : '';
            if (!worldId)
                return { status: 404, json: { error: '缺少世界 id' } };
            if (!isSafeName(worldId))
                return { status: 404, json: { error: '世界 id 非法' } };
            if (parts.length === 2 && req.method === 'DELETE') {
                try {
                    await store.deleteWorld(root, worldId);
                }
                catch (e) {
                    if (e instanceof Error && e.message.startsWith('找不到世界'))
                        return { status: 404, json: { error: e.message } };
                    throw e;
                }
                return { status: 204 };
            }
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
            if (parts[2] === 'nodes' && parts.length === 5 && parts[4] === 'citations'
                && req.method === 'GET') {
                const nodeId = decodeURIComponent(parts[3]);
                const g = buildGraph(await store.listNodes(root, worldId), await store.listFragments(root, worldId));
                return { status: 200, json: collectRefs(g, nodeId, await store.listBeliefs(root, worldId)) };
            }
            if (parts[2] === 'nodes' && parts.length === 5 && parts[4] === 'suggest'
                && req.method === 'GET') {
                const nodeId = decodeURIComponent(parts[3]);
                let node;
                try {
                    node = await store.readNode(root, worldId, nodeId);
                }
                catch (e) {
                    if (e instanceof Error && e.message.startsWith('找不到节点'))
                        return { status: 404, json: { error: e.message } };
                    throw e;
                }
                const nodes = await store.listNodes(root, worldId);
                const g = buildGraph(nodes, await store.listFragments(root, worldId));
                const beliefs = await store.listBeliefs(root, worldId);
                const findings = runRules({ nodes, graph: g, beliefs })
                    .filter((f) => f.nodeIds.includes(nodeId));
                return { status: 200, json: {
                        proposition: suggestProposition(node),
                        questions: interrogate(node, nodes),
                        rulings: findings.map((f) => rulingAdvice(f, nodes)),
                    } };
            }
            if (parts[2] === 'nodes' && parts.length === 4) {
                const nodeId = decodeURIComponent(parts[3]);
                if (req.method === 'GET') {
                    try {
                        return { status: 200, json: await store.readNode(root, worldId, nodeId) };
                    }
                    catch (e) {
                        // readNode 找不到节点是 404；其他异常（磁盘/解析等）继续走外层 500。
                        if (e instanceof Error && e.message.startsWith('找不到节点'))
                            return { status: 404, json: { error: e.message } };
                        throw e;
                    }
                }
                if (req.method === 'DELETE') {
                    const g = buildGraph(await store.listNodes(root, worldId), await store.listFragments(root, worldId));
                    if (!g.nodes.has(nodeId))
                        return { status: 404, json: { error: '节点不存在' } };
                    const refs = collectRefs(g, nodeId, await store.listBeliefs(root, worldId));
                    const total = refs.fragments.length + refs.nodes.length + refs.beliefs.length;
                    if (total > 0) {
                        return { status: 409, json: {
                                error: `被 ${total} 处引用，删除会断链`,
                                refs
                            } };
                    }
                    await store.deleteNode(root, worldId, nodeId);
                    await invalidateIndex(root, worldId).catch(() => { });
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
                    const fileName = node.title || node.id;
                    if (!isSafeName(fileName))
                        return { status: 400, json: { error: '标题不能为空或包含路径分隔符' } };
                    // 校验必须先于写盘：422 的节点不能留下任何文件。
                    if (node.kind === 'axiom' && node.cost.length === 0)
                        return { status: 422, json: { error: '公理必须付出代价（铁律一）' } };
                    const saved = await store.writeNode(root, worldId, node);
                    // 索引是派生品：失效失败不该让已经落盘的写操作返回 500。
                    await invalidateIndex(root, worldId).catch(() => { });
                    return { status: 200, json: saved };
                }
            }
            // 时间切片：?year= 缺省按 0 年；非有限数直接 400，避免把 NaN 透进引擎。
            if (parts[2] === 'at' && req.method === 'GET') {
                const year = Number(req.query['year'] ?? 0);
                if (!Number.isFinite(year))
                    return { status: 400, json: { error: `year 必须是数字：${req.query['year'] ?? ''}` } };
                const nodes = await store.listNodes(root, worldId);
                return { status: 200, json: {
                        year,
                        nodes: stateAt(nodes, year).map((n) => ({
                            id: n.id, title: n.title, strength: n.strength, span: n.span
                        }))
                    } };
            }
            // 语义审计：模型找矛盾，落盘为待确认报告；不自动改 conflictsWith。
            if (parts[2] === 'audit' && parts.length === 3 && req.method === 'POST') {
                const nodes = await store.listNodes(root, worldId);
                if (nodes.length === 0)
                    return { status: 400, json: { error: '世界里还没有节点，无法审计' } };
                const runner = options.audit;
                const config = options.llm ?? llmConfigFromEnv();
                if (!runner && !config)
                    return { status: 503, json: { error: '未配置语义审计模型：请设置 NOVEL_LLM_BASE_URL / NOVEL_LLM_MODEL / NOVEL_LLM_API_KEY' } };
                try {
                    const report = runner
                        ? await runner(nodes)
                        : await runSemanticAudit(nodes, config);
                    await writeAuditReport(root, worldId, report);
                    return { status: 200, json: report };
                }
                catch (e) {
                    return { status: 502, json: { error: e instanceof Error ? e.message : String(e) } };
                }
            }
            if (parts[2] === 'audits' && parts.length === 3 && req.method === 'GET')
                return { status: 200, json: await readAuditReport(root, worldId) };
            if (parts[2] === 'audits' && parts.length === 4 && parts[3] !== undefined && req.method === 'POST') {
                const id = decodeURIComponent(parts[3]);
                const body = asRecord(req.body);
                const status = body['status'];
                if (status !== 'accepted' && status !== 'dismissed')
                    return { status: 400, json: { error: 'status 只能是 accepted 或 dismissed' } };
                try {
                    const report = await readAuditReport(root, worldId);
                    const target = report?.findings.find((f) => f.id === id);
                    if (!target)
                        return { status: 404, json: { error: '找不到审计项' } };
                    if (status === 'accepted') {
                        const nodes = await store.listNodes(root, worldId);
                        const a = nodes.find((n) => n.id === target.a);
                        if (a && !a.conflictsWith.includes(target.b)) {
                            a.conflictsWith = [...a.conflictsWith, target.b];
                            await store.writeNode(root, worldId, a);
                            await invalidateIndex(root, worldId).catch(() => { });
                        }
                    }
                    const saved = await setAuditStatus(root, worldId, id, status);
                    return { status: 200, json: saved };
                }
                catch (e) {
                    return { status: 500, json: { error: e instanceof Error ? e.message : String(e) } };
                }
            }
            if (parts[2] === 'findings' && req.method === 'GET') {
                const nodes = await store.listNodes(root, worldId);
                const g = buildGraph(nodes, await store.listFragments(root, worldId));
                return { status: 200, json: runRules({
                        nodes, graph: g, beliefs: await store.listBeliefs(root, worldId),
                    }) };
            }
            if (parts[2] === 'beliefs' && parts.length === 3 && req.method === 'GET')
                return { status: 200, json: await store.listBeliefs(root, worldId) };
            if (parts[2] === 'beliefs' && parts.length === 4) {
                const beliefId = decodeURIComponent(parts[3]);
                if (!isSafeName(beliefId))
                    return { status: 400, json: { error: '认知 id 不能包含路径分隔符' } };
                if (req.method === 'PUT') {
                    let belief;
                    try {
                        belief = toBelief(asRecord(req.body), beliefId);
                    }
                    catch (e) {
                        return { status: 422, json: { error: e instanceof Error ? e.message : String(e) } };
                    }
                    const nodes = await store.listNodes(root, worldId);
                    if (!nodes.some((n) => n.id === belief.target))
                        return { status: 422, json: { error: `belief target 不存在：${belief.target}` } };
                    await store.writeBelief(root, worldId, belief);
                    return { status: 200, json: belief };
                }
                if (req.method === 'DELETE') {
                    try {
                        await store.deleteBelief(root, worldId, beliefId);
                    }
                    catch (e) {
                        if (e instanceof Error && e.message.startsWith('找不到认知'))
                            return { status: 404, json: { error: e.message } };
                        throw e;
                    }
                    return { status: 204 };
                }
            }
            if (parts[2] === 'fragments' && parts.length === 3 && req.method === 'GET')
                return { status: 200, json: await store.listFragments(root, worldId) };
            if (parts[2] === 'fragments' && parts.length === 4 && req.method === 'PUT') {
                const id = decodeURIComponent(parts[3]);
                if (!isSafeName(id))
                    return { status: 400, json: { error: '片段 id 不能包含路径分隔符' } };
                const b = asRecord(req.body);
                await store.writeFragment(root, worldId, {
                    id, chapter: numOrNull(b['chapter']), scene: numOrNull(b['scene']),
                    text: String(b['text'] ?? '')
                });
                await invalidateIndex(root, worldId).catch(() => { });
                return { status: 200, json: { ok: true } };
            }
            if (parts[2] === 'graph' && parts[3] === 'missing' && req.method === 'GET') {
                const g = buildGraph(await store.listNodes(root, worldId), await store.listFragments(root, worldId));
                return { status: 200, json: { missing: g.missingLinks } };
            }
            return { status: 404, json: { error: `未实现的路由 ${req.method} ${req.path}` } };
        }
        catch (e) {
            return { status: 500, json: { error: e instanceof Error ? e.message : String(e) } };
        }
    };
}
