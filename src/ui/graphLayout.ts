import type { NodeRecord } from './api.js';

export interface GraphEdge {
  source: string;
  target: string;
  via: 'derives' | 'manifests' | 'requires' | 'conflicts' | 'same';
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** 每条关系只保留一条边；指向不存在的节点留给调用方过滤。 */
export function buildEdges(nodes: NodeRecord[]): GraphEdge[] {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  const add = (source: string, target: string, via: GraphEdge['via']) => {
    if (!source || !target || source === target) return;
    const key = `${source}\u0000${target}\u0000${via}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ source, target, via });
  };
  for (const n of nodes) {
    const source = String(n['id'] ?? '');
    for (const target of list(n['derives'])) add(source, target, 'derives');
    for (const target of list(n['manifests'])) add(source, target, 'manifests');
    for (const target of list(n['requires'])) add(source, target, 'requires');
    for (const target of list(n['conflictsWith'])) add(source, target, 'conflicts');
    for (const target of list(n['sameAs'])) add(source, target, 'same');
  }
  return out;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  iterations?: number;
}

/**
 * 确定性 Fruchterman-Reingold：初始位置按索引排圆，不使用随机数；
 * 同输入必得同输出，方便测试与重复截图。
 */
export function forceLayout(
  nodes: NodeRecord[], edges: GraphEdge[], options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const width = options.width ?? 1000;
  const height = options.height ?? 700;
  const iterations = options.iterations ?? 120;
  const ids = nodes.map((n) => String(n['id'] ?? '')).filter(Boolean);
  const index = new Map(ids.map((id, i) => [id, i]));
  const pos = new Map<string, { x: number; y: number }>();
  const n = ids.length;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;
  ids.forEach((id, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, n);
    pos.set(id, { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  });
  if (n <= 1) return pos;

  const area = width * height;
  const k = Math.sqrt(area / n);
  const padding = 36;
  const clamp = (v: number, max: number) => Math.max(padding, Math.min(max - padding, v));
  const active = edges.filter((e) => index.has(e.source) && index.has(e.target));

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    // repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(ids[i]!)!;
        const b = pos.get(ids[j]!)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = 0.01 * (i + 1); dy = 0.01 * (j + 1); d = Math.hypot(dx, dy); }
        const force = (k * k) / d;
        const ux = dx / d;
        const uy = dy / d;
        const da = disp.get(ids[i]!)!;
        const db = disp.get(ids[j]!)!;
        da.x += ux * force; da.y += uy * force;
        db.x -= ux * force; db.y -= uy * force;
      }
    }
    // attraction
    for (const e of active) {
      const a = pos.get(e.source)!;
      const b = pos.get(e.target)!;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d = Math.hypot(dx, dy);
      if (d < 0.01) { dx = 0.01; dy = 0.01; d = Math.hypot(dx, dy); }
      const force = (d * d) / k;
      const ux = dx / d;
      const uy = dy / d;
      const da = disp.get(e.source)!;
      const db = disp.get(e.target)!;
      da.x -= ux * force; da.y -= uy * force;
      db.x += ux * force; db.y += uy * force;
    }
    // gravity + cooling
    const temp = k * (1 - iter / iterations) * 0.12;
    for (const id of ids) {
      const p = pos.get(id)!;
      const d = disp.get(id)!;
      d.x += (cx - p.x) * 0.02;
      d.y += (cy - p.y) * 0.02;
      const len = Math.hypot(d.x, d.y) || 1;
      p.x = clamp(p.x + (d.x / len) * Math.min(len, temp), width);
      p.y = clamp(p.y + (d.y / len) * Math.min(len, temp), height);
    }
  }
  return pos;
}
