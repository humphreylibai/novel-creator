import * as path from 'node:path';
// DSH 插件进程的 cwd 是 profile 目录，作品数据不能落在那里；默认以包根为准。
export function resolveDataRoot(configured, packageRoot) {
    const trimmed = (configured ?? '').trim();
    if (trimmed)
        return trimmed;
    return path.join(packageRoot, 'data');
}
