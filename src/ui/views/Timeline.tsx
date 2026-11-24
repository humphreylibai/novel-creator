import { useEffect, useState } from 'react';
import { atYear, type TimelineNode } from '../api.js';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * 时间轴：拖一条年份滑杆，看该年在场的条目。
 * 切片由服务端 `/at?year=` 计算（stateAt），这里只负责展示与跳转。
 */
export function Timeline({ worldId, onOpen }: { worldId: string; onOpen: (id: string) => void }) {
  const [year, setYear] = useState(612);
  const [rows, setRows] = useState<TimelineNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    setLoading(true);
    atYear(worldId, year)
      .then((r) => { if (alive) setRows(r.nodes); })
      .catch((e: unknown) => {
        if (!alive) return;
        setRows([]);
        setError(message(e));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [worldId, year]);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>
        时间轴 · 纪元 {year} 年
        {loading ? <span style={{ marginLeft: 8, fontSize: 12, color: '#a8a29a' }}>加载中…</span> : null}
      </h2>

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={0}
          max={800}
          value={year}
          aria-label="年份"
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: 480 }}
        />
        <span style={{ marginLeft: 12, fontSize: 13 }}>纪元 {year} 年</span>
        <span style={{ marginLeft: 12, fontSize: 12, color: '#a8a29a' }}>在场 {rows.length} 条</span>
      </div>

      {error ? (
        <div role="alert" style={{
          padding: '8px 10px', borderRadius: 6,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
        }}>{error}</div>
      ) : null}

      {!error && !loading && rows.length === 0 ? (
        <p style={{ color: '#a8a29a' }}>这一年没有在场的条目。</p>
      ) : null}

      {rows.map((n) => (
        <div
          key={n.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <span style={{ width: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.title}
          </span>
          <span style={{ color: '#a8a29a', fontSize: 12, width: 120 }}>
            {n.span.from ?? '—'} → {n.span.to ?? '至今'}
          </span>
          <button
            type="button"
            onClick={() => onOpen(n.id)}
            style={{
              padding: '2px 8px', fontSize: 12, borderRadius: 4,
              border: '1px solid #e7e2da', background: '#fff', color: '#2c2926', cursor: 'pointer',
            }}
          >打开</button>
        </div>
      ))}
    </div>
  );
}
