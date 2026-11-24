import { useEffect, useState } from 'react';
import {
  citations, deleteNode, saveNode,
  type Citations, type NodeRecord,
} from '../api.js';
import {
  joinList, nodePayload, relationOptions, splitList,
  type NodeDraft, type RelationField,
} from '../nodeFields.js';

const fieldStyle = {
  padding: '8px 10px', fontSize: 14, border: '1px solid #e7e2da', borderRadius: 6,
} as const;

const labelStyle = { fontSize: 12, color: '#6b645c', marginBottom: 4 } as const;

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : (typeof v === 'string' && v ? [v] : []);

function RelationSelect({ label, field, nodes, selfId, value, onChange }: {
  label: string;
  field: RelationField;
  nodes: NodeRecord[];
  selfId: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const options = relationOptions(nodes, field, selfId);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      <select
        multiple
        size={Math.max(3, Math.min(6, options.length))}
        value={value}
        disabled={options.length === 0}
        onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}
        style={{ ...fieldStyle, padding: 4 }}
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.title}（{o.id}）</option>)}
      </select>
      {options.length === 0
        ? <span style={{ fontSize: 11, color: '#a8a29a' }}>暂无可选节点</span>
        : null}
    </label>
  );
}

export function NodeEditor({ world, node, nodes, onSaved, onDeleted }: {
  world: string;
  node: NodeRecord;
  nodes: NodeRecord[];
  onSaved: (node: NodeRecord) => void;
  onDeleted: () => void;
}) {
  const id = String(node['id'] ?? '');
  const [kind, setKind] = useState<'axiom' | 'entry'>(
    node['kind'] === 'axiom' ? 'axiom' : 'entry');
  const [title, setTitle] = useState(String(node['title'] ?? ''));
  const [body, setBody] = useState(String(node['body'] ?? ''));
  const [strength, setStrength] = useState(String(node['strength'] ?? 'soft'));
  const [from, setFrom] = useState(String((node['span'] as { from?: unknown })?.from ?? ''));
  const [to, setTo] = useState(String((node['span'] as { to?: unknown })?.to ?? ''));
  const [aliases, setAliases] = useState(joinList(node['aliases']));
  const [cost, setCost] = useState(joinList(node['cost']));
  const [proposition, setProposition] = useState(String(node['proposition'] ?? ''));
  const [derives, setDerives] = useState(asList(node['derives']));
  const [manifests, setManifests] = useState(asList(node['manifests']));
  const [requires, setRequires] = useState(asList(node['requires']));
  const [conflictsWith, setConflictsWith] = useState(asList(node['conflictsWith']));
  const [sameAs, setSameAs] = useState(asList(node['sameAs']));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refs, setRefs] = useState<Citations | null>(null);

  useEffect(() => {
    setKind(node['kind'] === 'axiom' ? 'axiom' : 'entry');
    setTitle(String(node['title'] ?? ''));
    setBody(String(node['body'] ?? ''));
    setStrength(String(node['strength'] ?? 'soft'));
    setFrom(String((node['span'] as { from?: unknown })?.from ?? ''));
    setTo(String((node['span'] as { to?: unknown })?.to ?? ''));
    setAliases(joinList(node['aliases']));
    setCost(joinList(node['cost']));
    setProposition(String(node['proposition'] ?? ''));
    setDerives(asList(node['derives']));
    setManifests(asList(node['manifests']));
    setRequires(asList(node['requires']));
    setConflictsWith(asList(node['conflictsWith']));
    setSameAs(asList(node['sameAs']));
    setError(null);
  }, [node]);

  useEffect(() => {
    let alive = true;
    setRefs(null);
    if (!world || !id) return;
    citations(world, id)
      .then((r) => { if (alive) setRefs(r); })
      .catch(() => { if (alive) setRefs(null); });
    return () => { alive = false; };
  }, [world, id]);

  const save = async () => {
    const draft: NodeDraft = {
      kind, title, body, strength, from, to, aliases, cost, proposition,
    };
    if (!title.trim()) {
      setError('标题不能为空');
      return;
    }
    if (kind === 'axiom' && splitList(cost).length === 0) {
      setError('公理必须付出代价（铁律一）');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveNode(world, {
        ...nodePayload(node, draft),
        derives, manifests, requires,
        conflicts_with: conflictsWith,
        same_as: sameAs,
      });
      onSaved(saved);
    } catch (e) {
      // 服务端文案（例如 422「公理必须付出代价（铁律一）」）必须原样让人看见。
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`删除「${title}」？被引用时会被拦下。`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteNode(world, id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const isAxiom = kind === 'axiom';
  const persisted = Boolean(node['file']);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{isAxiom ? '公理' : '条目'}编辑器</h3>
        <span style={{ fontSize: 12, color: '#a8a29a' }}>{id}</span>
        <span style={{ flex: 1 }} />
        {persisted ? (
          <button type="button" onClick={() => void remove()} disabled={saving} style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid #fecaca',
            background: '#fff', color: '#b91c1c', cursor: saving ? 'wait' : 'pointer',
          }}>删除</button>
        ) : null}
        <button type="button" onClick={() => void save()} disabled={saving} style={{
          padding: '6px 16px', borderRadius: 6, border: '1px solid #b45309',
          background: saving ? '#e7e2da' : '#b45309', color: saving ? '#a8a29a' : '#fff',
          cursor: saving ? 'wait' : 'pointer',
        }}>{saving ? '保存中…' : '保存'}</button>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 150 }}>
          <span style={labelStyle}>类型</span>
          <select value={kind} onChange={(e) => setKind(e.target.value === 'axiom' ? 'axiom' : 'entry')}
            style={fieldStyle}>
            <option value="entry">条目</option>
            <option value="axiom">公理</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 150 }}>
          <span style={labelStyle}>强度</span>
          <select value={strength} onChange={(e) => setStrength(e.target.value)} style={fieldStyle}>
            <option value="hard">hard · 不可违反</option>
            <option value="firm">firm · 可破要留痕</option>
            <option value="soft">soft · 地方风味</option>
            <option value="myth">myth · 可能是假的</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
          <span style={labelStyle}>生效自</span>
          <input type="number" value={from} onChange={(e) => setFrom(e.target.value)}
            placeholder="留空 = 始终" style={fieldStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
          <span style={labelStyle}>生效至</span>
          <input type="number" value={to} onChange={(e) => setTo(e.target.value)}
            placeholder="留空 = 至今" style={fieldStyle} />
        </label>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="标题"
        style={{ ...fieldStyle, fontSize: 15 }}
      />
      <input
        value={aliases}
        onChange={(e) => setAliases(e.target.value)}
        placeholder="别名 / 讳称，用顿号或逗号分隔"
        style={fieldStyle}
      />
      {isAxiom ? (
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="代价，必填；用顿号或逗号分隔，例如：记忆、身份"
          style={fieldStyle}
        />
      ) : null}
      <textarea
        value={proposition}
        onChange={(e) => setProposition(e.target.value)}
        placeholder="命题：一句可判真假的话（公理必填；条目可留空）"
        style={{ ...fieldStyle, minHeight: 44, resize: 'vertical', fontFamily: 'inherit' }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="正文"
        style={{
          flex: 1, minHeight: 220, padding: '10px 12px', fontSize: 14, lineHeight: 1.7,
          border: '1px solid #e7e2da', borderRadius: 6, resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {!isAxiom ? (
          <RelationSelect label="派生自（公理）" field="derives" nodes={nodes} selfId={id}
            value={derives} onChange={setDerives} />
        ) : (
          <RelationSelect label="表现为（条目）" field="manifests" nodes={nodes} selfId={id}
            value={manifests} onChange={setManifests} />
        )}
        <RelationSelect label="依赖（requires）" field="requires" nodes={nodes} selfId={id}
          value={requires} onChange={setRequires} />
        <RelationSelect label="互斥（conflicts_with）" field="conflictsWith" nodes={nodes} selfId={id}
          value={conflictsWith} onChange={setConflictsWith} />
        <RelationSelect label="同一实体（same_as）" field="sameAs" nodes={nodes} selfId={id}
          value={sameAs} onChange={setSameAs} />
      </div>

      {error ? (
        <div role="alert" style={{
          padding: '8px 10px', borderRadius: 6, background: '#fef2f2',
          border: '1px solid #fecaca', color: '#b91c1c', whiteSpace: 'pre-wrap',
        }}>{error}</div>
      ) : null}

      {refs ? (
        <div style={{ marginTop: 8, fontSize: 13, color: '#a8a29a', lineHeight: 1.7 }}>
          <div>被片段引用：{refs.fragments.length ? refs.fragments.join('、') : '无'}</div>
          <div>被条目引用：{refs.nodes.length ? refs.nodes.map((r) => `${r.title}(${r.via})`).join('、') : '无'}</div>
        </div>
      ) : null}
    </div>
  );
}
