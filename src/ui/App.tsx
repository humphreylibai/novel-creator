import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listNodes, listWorlds, missingLinks, readNode, stats,
  type NodeRecord, type Stats,
} from './api.js';
import { Findings } from './views/Findings.js';
import { NodeEditor } from './views/NodeEditor.js';
import { Onboarding } from './views/Onboarding.js';
import { StagePlaceholder } from './views/StagePlaceholder.js';
import { Timeline } from './views/Timeline.js';

type StageId = 'setting' | 'planning' | 'writing';
type SystemId = 'world' | 'geography' | 'characters' | 'factions' | 'chronicle' | 'events';
type WorldView = 'nodes' | 'findings' | 'timeline';

const WORLD_VIEWS: { id: WorldView; label: string }[] = [
  { id: 'nodes', label: '条目' },
  { id: 'findings', label: '诊断' },
  { id: 'timeline', label: '时间轴' },
];

const STAGES: { id: StageId; label: string; reason: string }[] = [
  { id: 'setting', label: '① 设定', reason: '' },
  { id: 'planning', label: '② 规划', reason: '需要编年史与事件（尚未实现）' },
  { id: 'writing', label: '③ 创作', reason: '需要卷/集/章（尚未实现）' },
];

const SYSTEMS: { id: SystemId; label: string }[] = [
  { id: 'world', label: '世界观' },
  { id: 'geography', label: '地理' },
  { id: 'characters', label: '人物' },
  { id: 'factions', label: '势力' },
  { id: 'chronicle', label: '编年史' },
  { id: 'events', label: '事件' },
];

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const muted = { color: '#a8a29a' } as const;

export function App() {
  const [stage, setStage] = useState<StageId>('setting');
  const [system, setSystem] = useState<SystemId>('world');
  const [view, setView] = useState<WorldView>('nodes');

  const [worlds, setWorlds] = useState<string[]>([]);
  const [world, setWorld] = useState('');
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [selected, setSelected] = useState<NodeRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  /** null 表示「尚未加载」，不能据此显示开局引导。 */
  const [stat, setStat] = useState<Stats | null>(null);

  // 异步回调返回时用它判断世界是否已经切换；旧世界的结果一律丢弃。
  const worldRef = useRef(world);
  worldRef.current = world;

  const reloadWorlds = useCallback(async () => {
    try {
      const list = await listWorlds();
      setWorlds(list);
      setWorld((cur) => (list.includes(cur) ? cur : (list[0] ?? '')));
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, []);

  useEffect(() => {
    void reloadWorlds();
  }, [reloadWorlds]);

  useEffect(() => {
    setNodes([]);
    setSelected(null);
    if (!world) return;
    let alive = true;
    setLoading(true);
    listNodes(world)
      .then((list) => {
        if (!alive) return;
        setNodes(list);
        setError(null);
      })
      .catch((e: unknown) => {
        if (alive) setError(message(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [world]);

  useEffect(() => {
    let alive = true;
    if (!world) {
      setMissing([]);
      return;
    }
    missingLinks(world)
      .then((r) => { if (alive) setMissing(r.missing); })
      .catch(() => { if (alive) setMissing([]); });
    return () => { alive = false; };
  }, [world, nodes]);

  // 条目变化后重新取统计：新增公理、出口径变化都要让引导页的计数跟上。
  useEffect(() => {
    let alive = true;
    if (!world) {
      setStat(null);
      return;
    }
    stats(world)
      .then((s) => { if (alive) setStat(s); })
      .catch(() => { if (alive) setStat(null); });
    return () => { alive = false; };
  }, [world, nodes]);

  const reloadNodes = useCallback(async () => {
    const w = world;
    if (!w) return;
    try {
      const list = await listNodes(w);
      if (worldRef.current !== w) return;
      setNodes(list);
    } catch (e) {
      if (worldRef.current === w) setError(message(e));
    }
  }, [world]);

  const reloadStats = useCallback(async () => {
    const w = world;
    if (!w) return;
    try {
      const next = await stats(w);
      if (worldRef.current !== w) return;
      setStat(next);
    } catch {
      if (worldRef.current === w) setStat(null);
    }
  }, [world]);

  /** 引导页成功加一条公理后：计数与条目列表都要刷新，满三条才切回正常界面。 */
  const handleOnboardingDone = () => {
    void reloadStats();
    void reloadNodes();
  };

  const selectNode = async (record: NodeRecord) => {
    const id = String(record['id'] ?? '');
    const w = world;
    if (!w || !id) return;
    try {
      const next = await readNode(w, id);
      if (worldRef.current !== w) return;
      setSelected(next);
      setError(null);
    } catch (e) {
      if (worldRef.current === w) setError(message(e));
    }
  };

  /** 诊断 / 时间轴里的跳转：先切回条目视图，再加载节点；失败落到现有 error 状态。 */
  const openNodeById = async (id: string) => {
    setView('nodes');
    const w = world;
    if (!w) return;
    try {
      const next = await readNode(w, id);
      if (worldRef.current !== w) return;
      setSelected(next);
      setError(null);
    } catch (e) {
      if (worldRef.current === w) setError(message(e));
    }
  };

  const newEntry = () => {
    const stamp = Date.now().toString(36);
    setSelected({ id: `entry-${stamp}`, title: `新条目-${stamp}`, body: '', kind: 'entry', extra: {} });
  };

  const handleSaved = (saved: NodeRecord) => {
    // onSaved 可能来自切换世界前那次保存的旧闭包；世界已变时不能把它塞进新世界。
    if (!world || worldRef.current !== world) return;
    setSelected(saved);
    setError(null);
    void reloadNodes();
  };

  const stageMeta = STAGES.find((s) => s.id === stage) ?? STAGES[0]!;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 41, background: '#faf9f7', color: '#2c2926',
      display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px',
        background: '#fff', borderBottom: '1px solid #e7e2da',
      }}>
        <strong style={{ fontSize: 15 }}>小说工作台</strong>
        <nav style={{ display: 'flex', gap: 6 }}>
          {STAGES.map((item) => {
            const enabled = item.id === 'setting';
            const active = item.id === stage;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!enabled}
                title={item.reason || undefined}
                onClick={() => { if (enabled) setStage(item.id); }}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid transparent',
                  background: active ? '#b45309' : 'transparent',
                  color: enabled ? (active ? '#fff' : '#2c2926') : '#a8a29a',
                  cursor: enabled ? 'pointer' : 'not-allowed', fontSize: 13,
                }}
              >{item.label}</button>
            );
          })}
        </nav>
        <span style={{ flex: 1 }} />
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{
          width: 200, flexShrink: 0, padding: '12px 10px', background: '#fff',
          borderRight: '1px solid #e7e2da', overflow: 'auto',
        }}>
          <div style={{ fontSize: 11, letterSpacing: 1, ...muted, padding: '0 8px 8px' }}>设定系统</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {SYSTEMS.map((item) => {
              const enabled = item.id === 'world';
              const active = item.id === system;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!enabled}
                    title={enabled ? undefined : '尚未实现'}
                    onClick={() => { if (enabled) setSystem(item.id); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', marginBottom: 2, borderRadius: 6, border: 'none',
                      background: active ? '#f6efe6' : 'transparent',
                      color: enabled ? '#2c2926' : '#a8a29a',
                      cursor: enabled ? 'pointer' : 'not-allowed', fontSize: 13, textAlign: 'left',
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: 10 }}>{active ? '●' : '○'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div style={{ marginTop: 16, padding: '0 8px', fontSize: 11, ...muted }}>
            <div>诊断：见世界观面板「诊断」标签</div>
            {missing.length > 0 ? (
              <div style={{ marginTop: 6, fontSize: 12, color: '#a60' }}>
                未定义专名：{missing.join('、')}
              </div>
            ) : null}
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {stage === 'setting' && system === 'world' ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderBottom: '1px solid #e7e2da', background: '#fff',
              }}>
                <span style={{ fontSize: 12, ...muted }}>世界</span>
                <select
                  value={world}
                  disabled={worlds.length === 0}
                  onChange={(e) => { setStat(null); setWorld(e.target.value); }}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #e7e2da', background: '#fff' }}
                >
                  {worlds.length === 0
                    ? <option value="">还没有世界</option>
                    : worlds.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
                <div role="tablist" aria-label="世界观视图" style={{
                  display: 'flex', gap: 2, padding: 2, borderRadius: 6,
                  border: '1px solid #e7e2da', background: '#faf9f7',
                }}>
                  {WORLD_VIEWS.map((item) => {
                    const active = view === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setView(item.id)}
                        style={{
                          padding: '4px 10px', borderRadius: 4, border: 'none',
                          background: active ? '#fff' : 'transparent',
                          color: active ? '#b45309' : '#2c2926',
                          boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                          cursor: 'pointer', fontSize: 13,
                        }}
                      >{item.label}</button>
                    );
                  })}
                </div>
                {view === 'nodes' ? (
                  <button type="button" onClick={newEntry} disabled={!world} style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid #e7e2da',
                    background: '#fff', color: world ? '#2c2926' : '#a8a29a',
                    cursor: world ? 'pointer' : 'not-allowed', fontSize: 13,
                  }}>＋ 新建条目</button>
                ) : null}
                {loading ? <span style={{ fontSize: 12, ...muted }}>加载中…</span> : null}
              </div>

              {error ? (
                <div role="alert" style={{
                  margin: '10px 16px 0', padding: '8px 10px', borderRadius: 6,
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
                }}>{error}</div>
              ) : null}

              {worlds.length === 0 ? (
                <div style={{ padding: 24, color: '#a8a29a' }}>
                  在 data/worlds/ 下还没有世界。先用编辑器创建 world.yaml 与 nodes/ 目录。
                </div>
              ) : view === 'findings' ? (
                world
                  ? <Findings worldId={world} onOpen={(id) => void openNodeById(id)} />
                  : <div style={{ padding: 24, color: '#a8a29a' }}>加载中…</div>
              ) : view === 'timeline' ? (
                world
                  ? <Timeline worldId={world} onOpen={(id) => void openNodeById(id)} />
                  : <div style={{ padding: 24, color: '#a8a29a' }}>加载中…</div>
              ) : world && stat && stat.axioms < 3 && !selected ? (
                <Onboarding worldId={world} stats={stat} onDone={handleOnboardingDone} />
              ) : (
                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                  <div style={{
                    width: 220, flexShrink: 0, borderRight: '1px solid #e7e2da',
                    background: '#fff', overflow: 'auto', padding: '8px 6px',
                  }}>
                    {nodes.length === 0 && !loading
                      ? <div style={{ padding: 8, fontSize: 12, ...muted }}>还没有条目</div>
                      : null}
                    {nodes.map((node) => {
                      const id = String(node['id'] ?? '');
                      const active = selected !== null && String(selected['id'] ?? '') === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => void selectNode(node)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 6, padding: '7px 10px', marginBottom: 2, borderRadius: 6, border: 'none',
                            background: active ? '#f6efe6' : 'transparent',
                            color: '#2c2926', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(node['title'] ?? id)}
                          </span>
                          {node['kind'] === 'axiom'
                            ? <span style={{ fontSize: 10, color: '#b45309', flexShrink: 0 }}>公理</span>
                            : null}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
                    {selected ? (
                      <NodeEditor
                        key={String(selected['id'] ?? '')}
                        world={world}
                        node={selected}
                        onSaved={handleSaved}
                      />
                    ) : (
                      <div style={{ padding: 24, color: '#a8a29a' }}>选择左侧条目，或新建一条。</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <StagePlaceholder title={stageMeta.label} reason={stageMeta.reason || '尚未实现'} />
          )}
        </main>

        {/* 右栏是外壳的一部分，本任务刻意留空：后续检查器/诊断面板放进这里。 */}
        <aside aria-label="检查器（本任务留空）" style={{
          width: 220, flexShrink: 0, borderLeft: '1px solid #e7e2da', background: '#fff',
        }} />
      </div>
    </div>
  );
}
