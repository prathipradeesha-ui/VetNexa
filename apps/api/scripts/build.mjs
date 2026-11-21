// Production build: bundles the API (and the shared workspace package, which is TypeScript
// source) into a single ESM file, dist/server.js. Every npm dependency stays external and is
// installed normally in the runtime image, so native modules such as sharp keep working.
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@vetnexa/'));

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external,
  // Some bundled CommonJS code calls require(); give ESM output a working require.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
