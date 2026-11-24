import { mkdir, readdir, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseNode, serializeNode } from '../engine/frontmatter.js';
import { parseWorldConfig } from '../engine/worldConfig.js';
import { parseBelief, serializeBelief } from '../engine/beliefs.js';
import { isSafeName } from './safeName.js';
export const worldDir = (root, id) => join(root, 'worlds', id);
export const nodesDir = (root, id) => join(worldDir(root, id), 'nodes');
export const fragDir = (root, id) => join(worldDir(root, id), 'fragments');
export const beliefsDir = (root, id) => join(worldDir(root, id), 'beliefs');
async function ensureDir(p) {
    await mkdir(p, { recursive: true });
}
export async function createWorld(root, id, configYaml) {
    if (!isSafeName(id))
        throw new Error('非法世界 id');
    // 建世界不能静默覆盖：world.yaml 里有母题/历法/类型契约，误点一次就没了。
    if (existsSync(join(worldDir(root, id), 'world.yaml')))
        throw new Error(`世界已存在：${id}`);
    await ensureDir(nodesDir(root, id));
    await ensureDir(fragDir(root, id));
    await ensureDir(join(worldDir(root, id), 'beliefs'));
    await writeFile(join(worldDir(root, id), 'world.yaml'), configYaml, 'utf8');
}
export async function listWorlds(root) {
    const dir = join(root, 'worlds');
    if (!existsSync(dir))
        return [];
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}
export async function readWorldConfig(root, worldId) {
    return parseWorldConfig(await readFile(join(worldDir(root, worldId), 'world.yaml'), 'utf8'));
}
export async function listNodes(root, worldId) {
    const dir = nodesDir(root, worldId);
    if (!existsSync(dir))
        return [];
    const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
    const nodes = await Promise.all(files.map(async (f) => parseNode(await readFile(join(dir, f), 'utf8'), `nodes/${f}`)));
    return nodes.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
}
export async function readNode(root, worldId, nodeId) {
    const found = (await listNodes(root, worldId)).find((n) => n.id === nodeId);
    if (!found)
        throw new Error(`找不到节点 ${nodeId}`);
    return found;
}
export async function writeNode(root, worldId, node) {
    const dir = nodesDir(root, worldId);
    await ensureDir(dir);
    const name = node.title || node.id;
    if (!isSafeName(name))
        throw new Error('非法文件名');
    const rel = `nodes/${name}.md`;
    const prev = (await listNodes(root, worldId)).find((n) => n.id === node.id);
    await writeFile(join(worldDir(root, worldId), rel), serializeNode({ ...node, file: rel }), 'utf8');
    // 改了标题就是换了文件：旧文件必须清掉，否则列表里会出现同 id 的两份
    if (prev && prev.file !== rel)
        await unlink(join(worldDir(root, worldId), prev.file)).catch(() => undefined);
    return { ...node, file: rel };
}
export async function deleteNode(root, worldId, nodeId) {
    const node = await readNode(root, worldId, nodeId);
    await unlink(join(worldDir(root, worldId), node.file));
}
export async function listFragments(root, worldId) {
    const dir = fragDir(root, worldId);
    if (!existsSync(dir))
        return [];
    const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
    return Promise.all(files.map(async (f) => {
        const raw = await readFile(join(dir, f), 'utf8');
        const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
        const head = m?.[1] ?? '';
        const num = (k) => {
            const r = new RegExp(`${k}:\\s*(\\d+)`).exec(head);
            return r ? Number(r[1]) : null;
        };
        return {
            id: f.replace(/\.md$/, ''), chapter: num('chapter'), scene: num('scene'),
            text: m ? raw.slice(m[0].length) : raw, file: `fragments/${f}`
        };
    }));
}
export async function writeFragment(root, worldId, f) {
    const dir = fragDir(root, worldId);
    await ensureDir(dir);
    if (!isSafeName(f.id))
        throw new Error('非法文件名');
    const head = ['---', f.chapter !== null ? `chapter: ${f.chapter}` : null,
        f.scene !== null ? `scene: ${f.scene}` : null, '---', ''].filter((x) => x !== null).join('\n');
    await writeFile(join(dir, `${f.id}.md`), `${head}${f.text}`, 'utf8');
}
export async function readFragment(root, worldId, id) {
    const found = (await listFragments(root, worldId)).find((f) => f.id === id);
    if (!found)
        throw new Error(`找不到片段 ${id}`);
    return found;
}
export async function listBeliefs(root, worldId) {
    const dir = beliefsDir(root, worldId);
    let names;
    try {
        names = await readdir(dir);
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return [];
        throw e;
    }
    const out = [];
    for (const name of names.filter((x) => x.endsWith('.yaml'))) {
        try {
            out.push(parseBelief(await readFile(join(dir, name), 'utf8'), basename(name, '.yaml'), `beliefs/${name}`));
        }
        catch (e) {
            // 单个手写 belief 坏了不能拖垮整个诊断；跳过并留下服务端日志。
            console.warn(`[novel] 跳过无法解析的认知文件 ${name}:`, e instanceof Error ? e.message : e);
        }
    }
    return out.sort((a, b) => a.id.localeCompare(b.id, 'zh'));
}
export async function writeBelief(root, worldId, b) {
    if (!isSafeName(b.id))
        throw new Error('非法认知 id');
    const dir = beliefsDir(root, worldId);
    await ensureDir(dir);
    await writeFile(join(dir, `${b.id}.yaml`), serializeBelief(b), 'utf8');
}
export async function deleteBelief(root, worldId, id) {
    if (!isSafeName(id))
        throw new Error('非法认知 id');
    try {
        await unlink(join(beliefsDir(root, worldId), `${id}.yaml`));
    }
    catch (e) {
        if (e.code === 'ENOENT')
            throw new Error(`找不到认知 ${id}`);
        throw e;
    }
}
export async function deleteWorld(root, id) {
    if (!isSafeName(id))
        throw new Error('非法世界 id');
    const dir = worldDir(root, id);
    if (!existsSync(dir))
        throw new Error(`找不到世界 ${id}`);
    await rm(dir, { recursive: true, force: false });
}
