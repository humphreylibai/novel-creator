import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuditReport, AuditFinding } from '../engine/types.js';

const dirOf = (root: string, worldId: string): string =>
  join(root, 'worlds', worldId, 'audits');
const fileOf = (root: string, worldId: string): string =>
  join(dirOf(root, worldId), 'latest.json');

export async function readAuditReport(root: string, worldId: string): Promise<AuditReport | null> {
  const file = fileOf(root, worldId);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as AuditReport;
    if (!Array.isArray(parsed.findings)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeAuditReport(
  root: string, worldId: string, report: AuditReport,
): Promise<void> {
  await mkdir(dirOf(root, worldId), { recursive: true });
  await writeFile(fileOf(root, worldId), JSON.stringify(report, null, 2) + '\n', 'utf8');
}

export async function setAuditStatus(
  root: string, worldId: string, id: string,
  status: AuditFinding['status'],
): Promise<AuditFinding> {
  const report = await readAuditReport(root, worldId);
  if (!report) throw new Error('还没有审计报告');
  const finding = report.findings.find((f) => f.id === id);
  if (!finding) throw new Error('找不到审计项');
  finding.status = status;
  await writeAuditReport(root, worldId, report);
  return finding;
}
