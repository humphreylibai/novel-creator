import { useEffect, useState } from 'react';
import { findings, type Finding, type Severity } from '../api.js';

const ICON: Record<Severity, string> = { error: '🔴', warn: '🟡', info: '⚪' };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * 诊断清单：挂载或世界切换时取一次 `/findings`，不做实时刷新。
 * 规则号、严重度、提示、可跳转的节点都直接来自引擎的 Finding。
 */
export function Findings({ worldId, onOpen }: { worldId: string; onOpen: (id: string) => void }) {
  const [list, setList] = useState<Finding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setList([]);
    setError(null);
    setLoading(true);
    findings(worldId)
      .then((r) => { if (alive) setList(r); })
      .catch((e: unknown) => { if (alive) setError(message(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [worldId]);

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>
        诊断清单 · {list.length}
        {loading ? <span style={{ marginLeft: 8, fontSize: 12, color: '#a8a29a' }}>加载中…</span> : null}
      </h2>

      {error ? (
        <div role="alert" style={{
          padding: '8px 10px', borderRadius: 6,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
        }}>{error}</div>
      ) : null}

      {!error && !loading && list.length === 0 ? (
        <p style={{ color: '#a8a29a' }}>没有发现问题。</p>
      ) : null}

      {list.map((f, i) => (
        <div key={`${f.rule}-${i}`} style={{ borderBottom: '1px solid #f0f0f0', padding: '10px 0' }}>
          <div style={{ fontSize: 13 }}>
            <b>{ICON[f.severity]}</b>{' '}
            <code style={{ color: '#666' }}>{f.rule}</code>{' '}
            {f.message}
          </div>
          {f.hint ? (
            <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>{f.hint}</div>
          ) : null}
          <div style={{ marginTop: 6 }}>
            {f.nodeIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onOpen(id)}
                style={{
                  marginRight: 8, padding: '2px 8px', fontSize: 12, borderRadius: 4,
                  border: '1px solid #e7e2da', background: '#fff', color: '#2c2926',
                  cursor: 'pointer',
                }}
              >{id}</button>
            ))}
            {(f.actions ?? []).map((a) => (
              <span key={a} style={{ fontSize: 12, color: '#0a7', marginRight: 12 }}>[{a}]</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
