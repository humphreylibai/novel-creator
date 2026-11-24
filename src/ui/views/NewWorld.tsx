import { useState } from 'react';
import { createWorld } from '../api.js';
import { buildWorldConfig } from '../worldDraft.js';

const field = {
  width: '100%', padding: '7px 9px', boxSizing: 'border-box' as const,
  border: '1px solid #e7e2da', borderRadius: 6, fontSize: 13,
};
const label = { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: 12, color: '#6b645c' };

/** 建世界只收最低限度：id/母题/历法；其余用默认值，进去再改。 */
export function NewWorld({ onCreated, onCancel }: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [wound, setWound] = useState('');
  const [motif, setMotif] = useState('');
  const [epoch, setEpoch] = useState('新历');
  const [start, setStart] = useState('1');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!id.trim() || !wound.trim()) {
      setError('世界 id 和母题（伤口）必填');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const config = buildWorldConfig({ id, title, wound, motif, epoch, start, end });
      await createWorld(id.trim(), config);
      onCreated(id.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      margin: '0 16px 10px', padding: 14, borderRadius: 8,
      border: '1px solid #e7e2da', background: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>新建世界</strong>
        <span style={{ fontSize: 11, color: '#a8a29a' }}>目录名就是世界 id</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onCancel} style={{
          border: 'none', background: 'transparent', color: '#6b645c', cursor: 'pointer', fontSize: 12,
        }}>取消</button>
        <button type="button" onClick={() => void submit()} disabled={saving} style={{
          padding: '5px 14px', borderRadius: 6, border: '1px solid #b45309',
          background: saving ? '#e7e2da' : '#b45309', color: saving ? '#a8a29a' : '#fff',
          cursor: saving ? 'wait' : 'pointer', fontSize: 13,
        }}>{saving ? '创建中…' : '创建'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={label}>世界 id（中文/英文/数字，不含路径分隔符）
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="例如：雾海纪" style={field} />
        </label>
        <label style={label}>标题（可留空）
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="显示名称" style={field} />
        </label>
        <label style={{ ...label, gridColumn: '1 / -1' }}>母题 / 伤口（必填，一句话）
          <input value={wound} onChange={(e) => setWound(e.target.value)}
            placeholder="这个世界最根本的缺失是什么？" style={field} />
        </label>
        <label style={label}>母题意象（可留空）
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="反复出现的意象" style={field} />
        </label>
        <label style={label}>纪元名
          <input value={epoch} onChange={(e) => setEpoch(e.target.value)} placeholder="新历" style={field} />
        </label>
        <label style={label}>起始年
          <input type="number" value={start} onChange={(e) => setStart(e.target.value)} style={field} />
        </label>
        <label style={label}>结束年（可留空 = 至今）
          <input type="number" value={end} onChange={(e) => setEnd(e.target.value)} style={field} />
        </label>
      </div>

      {error ? (
        <div role="alert" style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 6, background: '#fef2f2',
          border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, whiteSpace: 'pre-wrap',
        }}>{error}</div>
      ) : null}
    </div>
  );
}
