export type Severity = 'error' | 'warn' | 'info';
export const SEVERITY_ORDER: Severity[] = ['error', 'warn', 'info'];

export type Strength = 'hard' | 'firm' | 'soft' | 'myth';
export type NodeKind = 'axiom' | 'entry';
export interface Span { from: number | null; to: number | null }

export interface Finding {
  rule: string; severity: Severity; nodeIds: string[];
  message: string; hint?: string; actions?: string[];
}

export interface WorldNode {
  id: string;
  kind: NodeKind;
  subtype: string | null;
  title: string;
  aliases: string[];
  strength: Strength;
  span: Span;
  proposition: string | null;
  cost: string[];
  derives: string[];
  manifests: string[];
  requires: string[];
  conflictsWith: string[];
  sameAs: string[];
  violations: string[];
  /** front matter 里不在已知字段表中的键，原样保留，序列化时写回 */
  extra: Record<string, unknown>;
  body: string;
  file: string;
}

/** 认知记录：某个 holder 相信 target 的某个说法。 */
export interface Belief {
  id: string;
  holder: string;
  target: string;
  content: string;
  confidence: number;
  source: string[];
  span: Span;
  file: string;
}
