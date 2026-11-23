import { useEffect, useState } from 'react';
import { App } from './App';

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
      {visible && <App onClose={() => toggleWorkbench(false)} />}
    </>
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
