import { useEffect, useState } from 'react';
import {
  findings as loadFindings, listNodes,
  type NodeRecord,
} from '../api.js';
import type { Finding, Span } from '../../engine/types.js';
import { badgesFor } from '../cardBadges.js';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const spanText = (raw: unknown): string => {
  const s = raw as Span | undefined;
  if (!s) return '— → 至今';
  return `${s.from ?? '—'} → ${s.to ?? '至今'}`;
};

const excerpt = (raw: unknown): string => {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
};

/** 卡片墙：只读浏览，角标来自诊断；点击进入编辑器。 */
export function CardWall({ worldId, onOpen }: {
  worldId: string;
  onOpen: (id: string) => void;
}) {
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([listNodes(worldId), loadFindings(worldId)])
      .then(([n, f]) => {
        if (!alive) return;
        setNodes(n);
        setFindings(f);
      })
      .catch((e: unknown) => { if (alive) setError(message(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [worldId]);

  return (
    <div style={{ padding: 20, overflow: 'auto' }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 17 }}>
        卡片墙 · {nodes.length}
        {loading ? <span style={{ marginLeft: 8, fontSize: 12, color: '#a8a29a' }}>加载中…</span> : null}
      </h2>

      {error ? (
        <div role="alert" style={{
          padding: '8px 10px', borderRadius: 6, marginBottom: 12,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
        }}>{error}</div>
      ) : null}

      {!loading && !error && nodes.length === 0 ? (
        <p style={{ color: '#a8a29a' }}>还没有条目。</p>
      ) : null}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
      }}>
        {nodes.map((n) => {
          const id = String(n['id'] ?? '');
          const badges = badgesFor(findings, id);
          const isAxiom = n['kind'] === 'axiom';
          return (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              style={{
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6,
                padding: 12, minHeight: 150, borderRadius: 8, background: '#fff',
                border: `1px solid ${isAxiom ? '#f0d9bd' : '#e7e2da'}`,
                cursor: 'pointer', color: '#2c2926', fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(n['title'] ?? id)}
                </strong>
                <span style={{ flex: 1 }} />
                {isAxiom ? <span style={{ fontSize: 10, color: '#b45309' }}>公理</span> : null}
              </div>
              <div style={{ fontSize: 11, color: '#a8a29a' }}>
                {String(n['strength'] ?? 'soft')} · {spanText(n['span'])}
              </div>
              <div style={{ fontSize: 12, color: '#6b645c', lineHeight: 1.6, flex: 1 }}>
                {excerpt(n['body']) || '（正文为空）'}
              </div>
              {badges.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {badges.map((b) => (
                    <span key={b} style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 999,
                      background: b === '有未决矛盾' ? '#fef2f2' : b === '无公理支撑' ? '#fffbeb' : '#f5f5f4',
                      color: b === '有未决矛盾' ? '#b91c1c' : b === '无公理支撑' ? '#a16207' : '#78716c',
                    }}>{b}</span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
