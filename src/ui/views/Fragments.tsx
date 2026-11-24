import { useEffect, useState } from 'react';
import { listFragments, saveFragment, type FragmentRecord } from '../api.js';
import { fragmentPayload } from '../fragmentFields.js';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const label = (f: FragmentRecord): string => {
  const ch = f.chapter === null ? '?' : f.chapter;
  const sc = f.scene === null ? '?' : f.scene;
  return `第${ch}章 · 场景${sc}`;
};

/** 极简片段库：正文里的 [[双链]] 进入建图，片段本身只做增改。 */
export function Fragments({ worldId, onChanged }: {
  worldId: string;
  onChanged: () => void;
}) {
  const [list, setList] = useState<FragmentRecord[]>([]);
  const [active, setActive] = useState('');
  const [chapter, setChapter] = useState('');
  const [scene, setScene] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listFragments(worldId);
      list.sort((a, b) =>
        (a.chapter ?? Number.MAX_SAFE_INTEGER) - (b.chapter ?? Number.MAX_SAFE_INTEGER)
        || (a.scene ?? Number.MAX_SAFE_INTEGER) - (b.scene ?? Number.MAX_SAFE_INTEGER)
        || a.id.localeCompare(b.id, 'zh'));
      setList(list);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [worldId]);

  const pick = (f: FragmentRecord) => {
    setActive(f.id);
    setChapter(f.chapter === null ? '' : String(f.chapter));
    setScene(f.scene === null ? '' : String(f.scene));
    setText(f.text);
    setError(null);
  };

  const create = () => {
    setActive(`fragment-${Date.now().toString(36)}`);
    setChapter('');
    setScene('');
    setText('');
    setError(null);
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    setError(null);
    try {
      await saveFragment(worldId, active, fragmentPayload({ chapter, scene, text }));
      await load();
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <div style={{
        width: 260, flexShrink: 0, borderRight: '1px solid #e7e2da', background: '#fff',
        overflow: 'auto', padding: 10,
      }}>
        <button type="button" onClick={create} style={{
          width: '100%', padding: '6px 10px', marginBottom: 8, borderRadius: 6,
          border: '1px solid #e7e2da', background: '#fff', cursor: 'pointer', fontSize: 13,
        }}>＋ 新建片段</button>
        {loading ? <div style={{ fontSize: 12, color: '#a8a29a' }}>加载中…</div> : null}
        {!loading && list.length === 0
          ? <div style={{ fontSize: 12, color: '#a8a29a', padding: 6 }}>还没有片段</div>
          : null}
        {list.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => pick(f)}
            style={{
              width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 2,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: f.id === active ? '#f6efe6' : 'transparent', fontSize: 12,
            }}
          >
            <div style={{ color: '#2c2926' }}>{label(f)}</div>
            <div style={{ color: '#a8a29a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.id} · {f.text.replace(/\s+/g, ' ').slice(0, 24) || '（空）'}
            </div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 20, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>片段库</h2>
          <span style={{ fontSize: 12, color: '#a8a29a' }}>{active || '未选择'}</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => void save()} disabled={!active || saving} style={{
            padding: '6px 16px', borderRadius: 6, border: '1px solid #b45309',
            background: !active || saving ? '#e7e2da' : '#b45309',
            color: !active || saving ? '#a8a29a' : '#fff',
            cursor: !active || saving ? 'not-allowed' : 'pointer',
          }}>{saving ? '保存中…' : '保存'}</button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
            <span style={{ fontSize: 12, color: '#6b645c' }}>章</span>
            <input type="number" value={chapter} onChange={(e) => setChapter(e.target.value)}
              placeholder="可留空" style={{ padding: 8, border: '1px solid #e7e2da', borderRadius: 6 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
            <span style={{ fontSize: 12, color: '#6b645c' }}>场景</span>
            <input type="number" value={scene} onChange={(e) => setScene(e.target.value)}
              placeholder="可留空" style={{ padding: 8, border: '1px solid #e7e2da', borderRadius: 6 }} />
          </label>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="正文片段。用 [[条目标题]] 或 [[别名]] 建立引用。"
          style={{
            flex: 1, minHeight: 360, padding: '10px 12px', fontSize: 14, lineHeight: 1.8,
            border: '1px solid #e7e2da', borderRadius: 6, resize: 'vertical', fontFamily: 'inherit',
          }}
        />

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
