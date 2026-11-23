// 待验证的适配层：DSH 的 ctx.webServer.register 形状（Node 风格 handler vs Fetch 风格）
// 尚未在真机确认。若安装后 /novel/ping 不通，只修改这一个文件，不要把适配逻辑复制到别处。
export interface PluginConfig { dataRoot: string }

export const inject = ['webServer'];

/** DSH 只在这里出现：路由注册与错误兜底。 */
export function apply(ctx: any, config: PluginConfig): void {
  const dataRoot = config?.dataRoot?.trim() || `${process.cwd()}\\data`;
  const web = ctx.webServer;
  if (!web?.register) {
    console.warn('[novel] webServer 不可用，工作台未挂载');
    return;
  }
  ctx.effect(() => web.register({
    path: '/novel/ping',
    kind: 'exact',
    handler: (_req: any, res: any) => {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, dataRoot, version: '0.1.0' }));
    }
  }));
}
