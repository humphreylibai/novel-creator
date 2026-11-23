import { build } from 'esbuild';

await build({
  entryPoints: ['src/ui/main.tsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'public/app.js',
  logLevel: 'info',
});
