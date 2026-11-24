import { useCallback, useEffect, useState } from 'react';
import {
  findings, listAudits, listNodes, runAudit, setAuditStatus,
  type AuditFinding, type AuditReport, type Finding, type NodeRecord, type Severity,
} from '../api.js';

const ICON: Record<Severity, string> = { error: '🔴', warn: '🟡', info: '⚪' };
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const RELATION_LABEL: Record<AuditFinding['relation'], string> = {
  contradiction: '矛盾',
  tension: '张力',
};

const short = (s: string, n = 120) => (s.length > n ? s.slice(0, n) + '…' : s);

/**
 * 诊断清单：
 * - 上半部分是规则诊断（R1–R12），确定性、可解释。
 * - 下半部分是语义审计（模型调用），只产出待确认项，不自动改设定。
 */
export function Findings({ worldId, onOpen }: { worldId: string; onOpen: (id: string) => void }) {
  const [list, setList] = useState<Finding[]>([]);
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadFindings = useCallback(async () => {
    const r = await findings(worldId);
    setList(r);
  }, [worldId]);

  useEffect(() => {
    let alive = true;
    setList([]);
    setNodes([]);
    setReport(null);
    setError(null);
    setAuditError(null);
    setLoading(true);
    Promise.all([findings(worldId), listNodes(worldId), listAudits(worldId)])
      .then(([f, n, a]) => {
        if (!alive) return;
        setList(f);
        setNodes(n);
        setReport(a);
      })
      .catch((e: unknown) => { if (alive) setError(message(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [worldId]);

  const run = async () => {
    setAuditing(true);
    setAuditError(null);
    try {
      const next = await runAudit(worldId);
      setReport(next);
      await loadFindings();
    } catch (e: unknown) {
      setAuditError(message(e));
    } finally {
      setAuditing(false);
    }
  };

  const decide = async (f: AuditFinding, status: 'accepted' | 'dismissed') => {
    setBusyId(f.id);
    setAuditError(null);
    try {
      const saved = await setAuditStatus(worldId, f.id, status);
      setReport((prev) => prev
        ? { ...prev, findings: prev.findings.map((x) => (x.id === f.id ? saved : x)) }
        : prev);
      if (status === 'accepted') await loadFindings();
    } catch (e: unknown) {
      setAuditError(message(e));
    } finally {
      setBusyId(null);
    }
  };

  const titleOf = (id: string): string =>
    String(nodes.find((n) => String(n['id'] ?? '') === id)?.['title'] ?? id);

  const openItems = report?.findings.filter((f) => f.status === 'open') ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
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

      {/* 语义审计：模型发现，和确定性规则分开显示 */}
      <section style={{
        margin: '4px 0 20px', padding: '12px 14px', borderRadius: 8,
        border: '1px solid #e7e2da', background: '#fffdf9',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>语义审计 · 模型发现</div>
            <div style={{ fontSize: 12, color: '#8a847b', marginTop: 2 }}>
              让模型比较设定之间的真实矛盾；只生成待确认项，不会自动改任何设定。运行时会把这批设定文本发送到你配置的模型 provider。
            </div>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={auditing}
            style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 6, border: '1px solid #b45309',
              background: auditing ? '#f5e6d3' : '#fff', color: '#b45309', fontSize: 13,
              cursor: auditing ? 'wait' : 'pointer',
            }}
          >{auditing ? '审计中…' : report ? '重新审计' : '运行语义审计'}</button>
        </div>

        {auditError ? (
          <div role="alert" style={{
            marginTop: 10, padding: '8px 10px', borderRadius: 6,
            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12,
          }}>{auditError}</div>
        ) : null}

        {report ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: '#a8a29a', marginBottom: 6 }}>
              {report.model} · {new Date(report.createdAt).toLocaleString('zh-CN')} · 扫描 {report.nodeCount} 个节点
            </div>
            {report.findings.length === 0 ? (
              <div style={{ fontSize: 13, color: '#6b7280' }}>这次没有发现新的语义矛盾。</div>
            ) : (
              report.findings.map((f) => {
                const done = f.status !== 'open';
                return (
                  <div key={f.id} style={{
                    borderTop: '1px solid #f0ebe3', padding: '9px 0',
                    opacity: done ? 0.66 : 1,
                  }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: f.relation === 'contradiction' ? '#b91c1c' : '#b45309' }}>
                        {f.relation === 'contradiction' ? '🔴' : '🟡'} {RELATION_LABEL[f.relation]}
                      </span>
                      {' '}置信度 {f.confidence.toFixed(2)}
                      {f.alreadyRegistered ? <span style={{ marginLeft: 8, fontSize: 11, color: '#8a847b' }}>已登记</span> : null}
                      {f.status === 'accepted' ? <span style={{ marginLeft: 8, fontSize: 11, color: '#0a7' }}>已确认并登记</span> : null}
                      {f.status === 'dismissed' ? <span style={{ marginLeft: 8, fontSize: 11, color: '#8a847b' }}>已驳回</span> : null}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13 }}>
                      <button type="button" onClick={() => onOpen(f.a)} style={linkBtn}>{titleOf(f.a)}</button>
                      <span style={{ color: '#8a847b', margin: '0 5px' }}>×</span>
                      <button type="button" onClick={() => onOpen(f.b)} style={linkBtn}>{titleOf(f.b)}</button>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#4b5563' }}>{f.reason}</div>
                    {f.evidence.length ? (
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: '#8a847b' }}>
                        {f.evidence.map((e, i) => <li key={`${f.id}-e${i}`}>{short(e)}</li>)}
                      </ul>
                    ) : null}
                    {!done && !f.alreadyRegistered ? (
                      <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                        <button type="button" disabled={busyId === f.id}
                          onClick={() => void decide(f, 'accepted')} style={acceptBtn}>
                          确认为冲突
                        </button>
                        <button type="button" disabled={busyId === f.id}
                          onClick={() => void decide(f, 'dismissed')} style={dismissBtn}>
                          驳回
                        </button>
                      </div>
                    ) : null}
                    {!done && f.alreadyRegistered ? (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#8a847b' }}>
                        这两条已经登记在 conflicts_with 里，不需要重复确认。
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
            {openItems.length > 0 ? (
              <div style={{ marginTop: 8, fontSize: 11, color: '#a8a29a' }}>
                还有 {openItems.length} 条待确认；确认后会写入 `conflicts_with`，并由 R1 再校验。
              </div>
            ) : null}
          </div>
        ) : !auditing ? (
          <div style={{ marginTop: 10, fontSize: 12, color: '#a8a29a' }}>
            还没有审计报告。点「运行语义审计」让模型通读当前世界。
          </div>
        ) : null}
      </section>

      <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>规则诊断 · {list.length}</h3>
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
              <button key={id} type="button" onClick={() => onOpen(id)} style={linkBtn}>
                {id}
              </button>
            ))}
            {(f.actions ?? []).length ? (
              <div style={{ marginTop: 4, fontSize: 12, color: '#8a847b' }}>
                裁决建议（不会自动执行）：{(f.actions ?? []).join(' · ')}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

const linkBtn = {
  marginRight: 8, padding: '2px 8px', fontSize: 12, borderRadius: 4,
  border: '1px solid #e7e2da', background: '#fff', color: '#2c2926',
  cursor: 'pointer',
} as const;

const acceptBtn = {
  padding: '3px 9px', fontSize: 12, borderRadius: 5, border: '1px solid #0a7',
  background: '#f0fdf4', color: '#0a7', cursor: 'pointer',
} as const;

const dismissBtn = {
  padding: '3px 9px', fontSize: 12, borderRadius: 5, border: '1px solid #d6d3d1',
  background: '#fff', color: '#6b7280', cursor: 'pointer',
} as const;
