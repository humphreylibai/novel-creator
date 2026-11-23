export const VERSION = '0.1.0';

export interface PingPayload {
  ok: true;
  dataRoot: string;
  version: string;
}

export function pingPayload(dataRoot: string): PingPayload {
  return { ok: true, dataRoot, version: VERSION };
}
