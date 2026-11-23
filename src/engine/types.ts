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
  body: string;
  file: string;
}
