import { SEVERITY_ORDER } from '../types.js';
import { contentRules } from './content.js';
const all = [...contentRules];
export function runRules(ctx) {
    return all.flatMap((r) => r(ctx))
        .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}
