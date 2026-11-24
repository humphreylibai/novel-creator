import { useEffect, useState } from 'react';
import {
  deleteBelief, listBeliefs, listNodes, saveBelief,
  type BeliefRecord, type NodeRecord,
} from '../api.js';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const num = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};
const split = (raw: string) => raw.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean);

/** 认知编辑：同一个 target 可以有很多 holder，各自置信/来源/时间不同。 */
export function Beliefs({ worldId, onChanged }: {
  worldId: string;
  onChanged: () => void;
}) {
  const [list, setList] = useState<BeliefRecord[]>([]);
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [active, setActive] = useState('');
  const [holder, setHolder] = useState('');
  const [target, setTarget] = useState('');
  const [content, setContent] = useState('');
  const [confidence, setConfidence] = useState('0.8');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bs, ns] = await Promise.all([listBeliefs(worldId), listNodes(worldId)]);
      setList(bs);
      setNodes(ns);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [worldId]);

  const pick = (b: BeliefRecord) => {
    setActive(b.id);
    setHolder(b.holder);
    setTarget(b.target);
    setContent(b.content);
    setConfidence(String(b.confidence));
    setSource(b.source.join('、'));
    setFrom(b.span.from === null ? '' : String(b.span.from));
    setTo(b.span.to === null ? '' : String(b.span.to));
    setError(null);
  };

  const create = () => {
    setActive(`belief-${Date.now().toString(36)}`);
    setHolder('');
    setTarget(nodes[0] ? String(nodes[0]['id'] ?? '') : '');
    setContent('');
    setConfidence('0.8');
    setSource('');
    setFrom('');
    setTo('');
    setError(null);
  };

  const save = async () => {
    if (!active) return;
    const c = Number(confidence);
    if (!Number.isFinite(c) || c < 0 || c > 1) {
      setError('置信度必须是 0–1 之间的数字');
      return;
    }
    if (!holder.trim() || !target || !content.trim()) {
      setError('holder / target / content 都不能为空');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveBelief(worldId, active, {
        holder: holder.trim(), target, content: content.trim(), confidence: c,
        source: split(source), span: { from: num(from), to: num(to) },
      });
      await load();
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!active || !window.confirm(`删除认知「${active}」？`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteBelief(worldId, active);
      setActive('');
      await load();
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  };

  const titleOf = (id: string) => String(nodes.find((n) => n['id'] === id)?.['title'] ?? id);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <div style={{
        width: 260, flexShrink: 0, borderRight: '1px solid #e7e2da', background: '#fff',
        overflow: 'auto', padding: 10,
      }}>
        <button type="button" onClick={create} style={{
          width: '100%', padding: '6px 10px', marginBottom: 8, borderRadius: 6,
          border: '1px solid #e7e2da', background: '#fff', cursor: 'pointer', fontSize: 13,
        }}>＋ 新建认知</button>
        {loading ? <div style={{ fontSize: 12, color: '#a8a29a' }}>加载中…</div> : null}
        {!loading && list.length === 0
          ? <div style={{ fontSize: 12, color: '#a8a29a', padding: 6 }}>还没有认知记录</div>
          : null}
        {list.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => pick(b)}
            style={{
              width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 2,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: b.id === active ? '#f6efe6' : 'transparent', fontSize: 12,
            }}
          >
            <div style={{ color: '#2c2926' }}>{b.holder} · {b.confidence}</div>
            <div style={{ color: '#a8a29a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {titleOf(b.target)} · {b.content}
            </div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 20, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>认知层</h2>
          <span style={{ fontSize: 12, color: '#a8a29a' }}>{active || '未选择'}</span>
          <span style={{ flex: 1 }} />
          {active ? (
            <button type="button" onClick={() => void remove()} disabled={saving} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #fecaca',
              background: '#fff', color: '#b91c1c', cursor: saving ? 'wait' : 'pointer',
            }}>删除</button>
          ) : null}
          <button type="button" onClick={() => void save()} disabled={!active || saving} style={{
            padding: '6px 16px', borderRadius: 6, border: '1px solid #b45309',
            background: !active || saving ? '#e7e2da' : '#b45309',
            color: !active || saving ? '#a8a29a' : '#fff',
            cursor: !active || saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '保存中…' : '保存'}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b645c' }}>谁相信（holder）</span>
            <input value={holder} onChange={(e) => setHolder(e.target.value)}
              placeholder="民间 / 教团 / 主角" style={{ padding: 8, border: '1px solid #e7e2da', borderRadius: 6 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b645c' }}>对哪个条目（target）</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}
              style={{ padding: 8, border: '1px solid #e7e2da', borderRadius: 6 }}>
              <option value="">选择条目</option>
              {nodes.map((n) => (
                <option key={String(n['id'])} value={String(n['id'])}>
                  {String(n['title'] ?? n['id'])}（{String(n['id'])}）
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
            <span style={{ fontSize: 12, color: '#6b645c' }}>他们相信的内容</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="一句他们真的会说的话" style={{
                minHeight: 70, padding: 8, border: '1px solid #e7e2da', borderRadius: 6, fontFamily: 'inherit',
              }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b645c' }}>置信度 0–1</span>
            <input type="number" min={0} max={1} step={0.05} value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              style={{ padding: 8, border: '1px solid #e7e2da', borderRadius: 6 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b645c' }}>来源（顿号分隔）</span>
            <input value={source} onChange={(e) => setSource(e.target.value)}
              placeholder="说书人、祠庙壁画、童谣"
              style={{ padding: 8, border: '1px solid #e7e2da', borderRadius: 6 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b645c' }}>从（年）</span>
            <input type="number" value={from} onChange={(e) => setFrom(e.target.value)}
              placeholder="可留空" style={{ padding: 8, border: '1px solid #e7e2da', borderRadius: 6 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b645c' }}>至（年）</span>
            <input type="number" value={to} onChange={(e) => setTo(e.target.value)}
              placeholder="可留空 = 至今" style={{ padding: 8, border: '1px solid #e7e2da', borderRadius: 6 }} />
          </label>
        </div>

        {error ? (
          <div role="alert" style={{
            padding: '8px 10px', borderRadius: 6, background: '#fef2f2',
            border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, whiteSpace: 'pre-wrap',
          }}>{error}</div>
        ) : null}
      </div>
    </div>
  );
}
