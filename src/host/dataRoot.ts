import * as path from 'node:path';

export function resolveDataRoot(configured: string | undefined, packageRoot: string): string {
  const trimmed = (configured ?? '').trim();
  if (trimmed) return trimmed;
  return path.join(packageRoot, 'data');
}
