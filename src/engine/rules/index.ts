import { SEVERITY_ORDER, type Finding } from '../types.js';
import type { Rule, RuleContext } from './content.js';
import { contentRules } from './content.js';
import { structuralRules } from './structural.js';
import { explicitRules } from './explicit.js';
import { r9Beliefs } from './belief.js';

const all: Rule[] = [
  ...contentRules, ...structuralRules, ...explicitRules,
  ({ nodes, beliefs }) => r9Beliefs(nodes, beliefs ?? []),
];

export function runRules(ctx: RuleContext): Finding[] {
  return all.flatMap((r) => r(ctx))
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

export type { Rule, RuleContext };
