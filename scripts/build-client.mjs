import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

const out = await build({
  entryPoints: ['src/ui/client.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
  logLevel: 'info'
});

const code = out.outputFiles[0].text;
const wrapped = `window.__ModuleLoader__.load({
  id: '@local/novel-workbench',
  factory(require) {
    const module = { exports: {} };
    (function (module, exports) {
${code}
    })(module, module.exports);
    return module.exports;
  },
});
`;
writeFileSync('client.js', wrapped, 'utf8');
console.log('client.js written:', wrapped.length, 'chars');
