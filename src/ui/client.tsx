import { useEffect, useState } from 'react';

let open = false;
const listeners = new Set<(v: boolean) => void>();
export function toggleWorkbench(next?: boolean) {
  open = next ?? !open;
  for (const l of listeners) l(open);
}

export function Launcher() {
  const [visible, setVisible] = useState(open);
  useEffect(() => {
    const fn = (v: boolean) => setVisible(v);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return (
    <>
      <button onClick={() => toggleWorkbench()} style={{
        position: 'absolute', right: 16, bottom: 16, zIndex: 40,
        padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer'
      }}>工作台</button>
      {visible && <Workbench />}
    </>
  );
}

function Workbench() {
  const [ping, setPing] = useState<string>('未连接');
  const probe = async () => {
    try {
      const r = await fetch('/novel/ping');
      setPing(JSON.stringify(await r.json()));
    } catch (e) { setPing(`失败：${(e as Error).message}`); }
  };
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 39, background: 'rgba(255,255,255,0.98)',
      padding: 24, overflow: 'auto'
    }}>
      <h2 style={{ marginTop: 0 }}>小说工作台 <button onClick={() => toggleWorkbench(false)} style={{ float: 'right' }}>关闭</button></h2>
      <button onClick={probe}>测试 Host 连接</button>
      <pre style={{ marginTop: 12 }}>{ping}</pre>
    </div>
  );
}

interface ClientCtx {
  slots: {
    inject(name: string, fn: () => unknown): void;
    register(options: Record<string, unknown>, component: unknown): unknown;
  };
}

export const inject = ['slots'];

export function apply(ctx: ClientCtx) {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'novel-workbench-launcher', order: 20 },
    Launcher
  ));
}
