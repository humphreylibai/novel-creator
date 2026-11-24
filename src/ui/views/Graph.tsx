import { useEffect, useMemo, useState } from 'react';
import { listNodes, type NodeRecord } from '../api.js';
import { buildEdges, forceLayout, type GraphEdge } from '../graphLayout.js';

const W = 1000;
const H = 700;
const COLORS: Record<GraphEdge['via'], string> = {
  derives: '#8b5cf6',
  manifests: '#b45309',
  requires: '#0284c7',
  conflicts: '#dc2626',
  same: '#059669',
};
const LABELS: Record<GraphEdge['via'], string> = {
  derives: '派生', manifests: '表现', requires: '依赖', conflicts: '互斥', same: '同一',
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 力导向只读图；布局是确定性的，刷新不会乱跳。 */
export function Graph({ worldId, onOpen }: {
  worldId: string;
  onOpen: (id: string) => void;
}) {
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listNodes(worldId)
      .then((n) => { if (alive) setNodes(n); })
      .catch((e: unknown) => { if (alive) setError(message(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [worldId]);

  const edges = useMemo(() => buildEdges(nodes), [nodes]);
  const pos = useMemo(() => forceLayout(nodes, edges, { width: W, height: H }), [nodes, edges]);

  return (
    <div style={{ padding: 16, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>图谱</h2>
        <span style={{ fontSize: 12, color: '#a8a29a' }}>
          {loading ? '加载中…' : `${nodes.length} 个节点 · ${edges.length} 条边`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 11, color: '#6b645c' }}>
        {(Object.keys(LABELS) as GraphEdge['via'][]).map((via) => (
          <span key={via} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 2, background: COLORS[via], display: 'inline-block' }} />
            {LABELS[via]}
          </span>
        ))}
      </div>
      {error ? (
        <div role="alert" style={{
          padding: '8px 10px', borderRadius: 6, background: '#fef2f2',
          border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
        }}>{error}</div>
      ) : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxHeight: 'calc(100vh - 220px)', background: '#fff', border: '1px solid #e7e2da', borderRadius: 8 }}
      >
        {edges.map((e) => {
          const a = pos.get(e.source);
          const b = pos.get(e.target);
          if (!a || !b) return null;
          return (
            <line
              key={`${e.source}-${e.target}-${e.via}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={COLORS[e.via]}
              strokeWidth={e.via === 'conflicts' ? 1.8 : 1.1}
              strokeDasharray={e.via === 'requires' ? '4 3' : undefined}
              opacity={0.65}
            />
          );
        })}
        {nodes.map((n) => {
          const id = String(n['id'] ?? '');
          const p = pos.get(id);
          if (!p) return null;
          const isAxiom = n['kind'] === 'axiom';
          return (
            <g key={id} onClick={() => onOpen(id)} style={{ cursor: 'pointer' }}>
              <circle
                cx={p.x} cy={p.y} r={isAxiom ? 11 : 7}
                fill={isAxiom ? '#b45309' : '#fff'}
                stroke={isAxiom ? '#92400e' : '#8a857d'}
                strokeWidth={1.5}
              />
              <text
                x={p.x + (isAxiom ? 15 : 11)} y={p.y + 4}
                fontSize={isAxiom ? 12 : 11}
                fill="#2c2926"
                style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}
              >
                {String(n['title'] ?? id).slice(0, 14)}
              </text>
            </g>
          );
        })}
      </svg>
      <p style={{ fontSize: 11, color: '#a8a29a', margin: '6px 0' }}>
        点节点进入编辑器。布局为确定性力导向；连线颜色对应关系类型。
      </p>
    </div>
  );
}
