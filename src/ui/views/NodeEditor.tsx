import { useEffect, useState } from 'react';
import { citations, saveNode, type Citations, type NodeRecord } from '../api.js';

export function NodeEditor({ world, node, onSaved }: {
  world: string;
  node: NodeRecord;
  onSaved: (node: NodeRecord) => void;
}) {
  const id = String(node['id'] ?? '');
  const [title, setTitle] = useState(String(node['title'] ?? ''));
  const [body, setBody] = useState(String(node['body'] ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refs, setRefs] = useState<Citations | null>(null);

  useEffect(() => {
    setTitle(String(node['title'] ?? ''));
    setBody(String(node['body'] ?? ''));
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
    setSaving(true);
    setError(null);
    try {
      const saved = await saveNode(world, { ...node, title, body });
      onSaved(saved);
    } catch (e) {
      // 服务端文案（例如 422「公理必须付出代价（铁律一）」）必须原样让人看见。
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const isAxiom = node['kind'] === 'axiom';

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{isAxiom ? '公理' : '条目'}编辑器</h3>
        <span style={{ fontSize: 12, color: '#a8a29a' }}>{id}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => void save()} disabled={saving} style={{
          padding: '6px 16px', borderRadius: 6, border: '1px solid #b45309',
          background: saving ? '#e7e2da' : '#b45309', color: saving ? '#a8a29a' : '#fff',
          cursor: saving ? 'wait' : 'pointer',
        }}>{saving ? '保存中…' : '保存'}</button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="标题"
        style={{ padding: '8px 10px', fontSize: 15, border: '1px solid #e7e2da', borderRadius: 6 }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="正文"
        style={{
          flex: 1, minHeight: 260, padding: '10px 12px', fontSize: 14, lineHeight: 1.7,
          border: '1px solid #e7e2da', borderRadius: 6, resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      {error ? (
        <div role="alert" style={{
          padding: '8px 10px', borderRadius: 6, background: '#fef2f2',
          border: '1px solid #fecaca', color: '#b91c1c', whiteSpace: 'pre-wrap',
        }}>{error}</div>
      ) : null}

      {refs ? (
        <div style={{ marginTop: 24, fontSize: 13, color: '#a8a29a', lineHeight: 1.7 }}>
          <div>被片段引用：{refs.fragments.length ? refs.fragments.join('、') : '无'}</div>
          <div>被条目引用：{refs.nodes.length ? refs.nodes.map((r) => `${r.title}(${r.via})`).join('、') : '无'}</div>
        </div>
      ) : null}
    </div>
  );
}
