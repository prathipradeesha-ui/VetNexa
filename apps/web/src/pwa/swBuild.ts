import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Fills in the service worker's build ID and file list, so it can save the whole app for
 * offline use. The ID changes whenever any built file changes, which makes phones replace
 * their saved copy with the new version.
 */
export function fillServiceWorker(source: string, files: string[], buildId: string): string {
  const list = JSON.stringify(files.map((file) => `/${file}`).sort());
  const filled = source
    .replace(/const BUILD_ID = '[^']*';/, `const BUILD_ID = '${buildId}';`)
    .replace(/const BUILD_FILES = \[\];/, `const BUILD_FILES = ${list};`);
  if (!filled.includes(`'${buildId}'`) || !filled.includes(list)) {
    throw new Error('sw.js no longer has the BUILD_ID and BUILD_FILES lines to fill in');
  }
  return filled;
}

/** A short ID from the built file names and the pages they belong to. */
export function buildIdFor(files: string[], pages: string[]): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort()) hash.update(`${file}\n`);
  for (const page of pages) hash.update(page);
  return hash.digest('hex').slice(0, 12);
}

/** Vite plugin: after a production build, write the file list into dist/sw.js. */
export function serviceWorkerFiles(): Plugin {
  return {
    name: 'vetnexa-service-worker-files',
    apply: 'build',
    writeBundle(options, bundle) {
      const outDir = options.dir ?? 'dist';
      const files = Object.keys(bundle).filter((file) => file.startsWith('assets/'));
      const pages = ['index.html', 'offline.html'].map((page) =>
        readFileSync(join(outDir, page), 'utf8'),
      );
      const swPath = join(outDir, 'sw.js');
      const source = readFileSync(swPath, 'utf8');
      writeFileSync(swPath, fillServiceWorker(source, files, buildIdFor(files, pages)));
    },
  };
}
