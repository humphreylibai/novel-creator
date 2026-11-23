import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const out = await build({
  entryPoints: ['src/ui/client.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  external: ['react'],
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
  logLevel: 'info'
});

const code = out.outputFiles[0].text;
const wrapped = `window.__ModuleLoader__.load({
  id: '@local/novel-workbench',
  factory(require) {
    const React = require('react');
    const module = { exports: {} };
    (function (module, exports, React) {
${code}
    })(module, module.exports, React);
    return module.exports;
  },
});
`;
mkdirSync('dist', { recursive: true });
writeFileSync('client.js', wrapped, 'utf8');
console.log('client.js written:', wrapped.length, 'chars');
