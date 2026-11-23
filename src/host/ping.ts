import { readFileSync } from 'node:fs';

export const VERSION = '0.1.0';

export function pingHandler(root: string) {
  return () => ({ ok: true as const, dataRoot: root, version: VERSION });
}
