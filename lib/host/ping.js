export const VERSION = '0.1.0';
export function pingPayload(dataRoot) {
    return { ok: true, dataRoot, version: VERSION };
}
