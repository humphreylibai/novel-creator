import { SEVERITY_ORDER } from '../types.js';
import { contentRules } from './content.js';
import { structuralRules } from './structural.js';
import { explicitRules } from './explicit.js';
import { r9Beliefs } from './belief.js';
const all = [
    ...contentRules, ...structuralRules, ...explicitRules,
    ({ nodes, beliefs }) => r9Beliefs(nodes, beliefs ?? []),
];
export function runRules(ctx) {
    return all.flatMap((r) => r(ctx))
        .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}
