import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const dirOf = (root, worldId) => join(root, 'worlds', worldId, 'audits');
const fileOf = (root, worldId) => join(dirOf(root, worldId), 'latest.json');
export async function readAuditReport(root, worldId) {
    const file = fileOf(root, worldId);
    if (!existsSync(file))
        return null;
    try {
        const parsed = JSON.parse(await readFile(file, 'utf8'));
        if (!Array.isArray(parsed.findings))
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
export async function writeAuditReport(root, worldId, report) {
    await mkdir(dirOf(root, worldId), { recursive: true });
    await writeFile(fileOf(root, worldId), JSON.stringify(report, null, 2) + '\n', 'utf8');
}
export async function setAuditStatus(root, worldId, id, status) {
    const report = await readAuditReport(root, worldId);
    if (!report)
        throw new Error('还没有审计报告');
    const finding = report.findings.find((f) => f.id === id);
    if (!finding)
        throw new Error('找不到审计项');
    finding.status = status;
    await writeAuditReport(root, worldId, report);
    return finding;
}
