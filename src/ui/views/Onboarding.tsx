import { useState } from 'react';
import { saveNode, type Stats } from '../api.js';

const splitCost = (raw: string) =>
  raw.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);

/**
 * 三步开局引导：只在「世界观 → 条目」且公理不足三条时替换主区。
 * 代价不在这里做非空校验——空代价照样发给服务端，由 422 文案原样显示。
 */
export function Onboarding({ worldId, stats, onDone }: {
  worldId: string;
  stats: Stats;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addAxiom = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setErr(null);
    try {
      await saveNode(worldId, {
        id: `W-AX-${Date.now()}`,
        kind: 'axiom',
        title: title.trim(),
        strength: 'hard',
        cost: splitCost(cost),
        body: '',
      });
      setTitle('');
      setCost('');
      onDone();
    } catch (e) {
      // 服务端文案（例如 422「公理必须付出代价（铁律一）」）必须原样让人看见。
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 680 }}>
      <h2 style={{ marginTop: 0, fontSize: 20 }}>开始一个世界</h2>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>① 这个世界最根本的缺失是什么？</h3>
        <p style={{ margin: 0, color: '#6b645c', fontSize: 13, lineHeight: 1.7 }}>
          写在 world.yaml 的 theme.wound 里。它决定了这个世界为什么值得被讲述。
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>
          ② 至少三条公理，每条必须付出代价
          <span style={{ marginLeft: 8, color: '#b45309', fontWeight: 400 }}>
            当前 {stats.axioms} / 3
          </span>
        </h3>
        <input
          placeholder="公理，例如：施法会永久烧毁施法者的记忆"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', padding: 8, boxSizing: 'border-box', border: '1px solid #e7e2da', borderRadius: 6 }}
        />
        <input
          placeholder="代价，用顿号分隔，例如：记忆、身份"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          style={{ width: '100%', padding: 8, marginTop: 8, boxSizing: 'border-box', border: '1px solid #e7e2da', borderRadius: 6 }}
        />
        <button
          type="button"
          onClick={() => void addAxiom()}
          disabled={!title.trim() || saving}
          style={{
            marginTop: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #b45309',
            background: !title.trim() || saving ? '#e7e2da' : '#b45309',
            color: !title.trim() || saving ? '#a8a29a' : '#fff',
            cursor: !title.trim() || saving ? 'not-allowed' : 'pointer',
          }}
        >{saving ? '保存中…' : '加一条公理'}</button>
        {err ? (
          <div role="alert" style={{
            marginTop: 8, padding: '8px 10px', borderRadius: 6,
            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
            whiteSpace: 'pre-wrap',
          }}>{err}</div>
        ) : null}
      </section>

      <section>
        <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>
          ③ 每条公理至少两个“能看见的东西”
          <span style={{ marginLeft: 8, color: '#b45309', fontWeight: 400 }}>
            已达标 {stats.manifestedAxioms} / {stats.axioms}
          </span>
        </h3>
        <p style={{ margin: 0, color: '#6b645c', fontSize: 13, lineHeight: 1.7 }}>
          给每条公理挂上至少两条 manifest：仪式、器物、称谓、禁令皆可。凑满三条公理后进入正常界面。
        </p>
      </section>
    </div>
  );
}
