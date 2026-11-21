import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildIdFor, fillServiceWorker } from './swBuild';

const source = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');

describe('service worker build step', () => {
  it('writes the build ID and every built file into sw.js', () => {
    const filled = fillServiceWorker(source, ['assets/b.js', 'assets/a.css'], 'abc123');
    expect(filled).toContain("const BUILD_ID = 'abc123';");
    expect(filled).toContain('const BUILD_FILES = ["/assets/a.css","/assets/b.js"];');
  });

  it('fails the build if sw.js changes shape', () => {
    expect(() => fillServiceWorker('const X = 1;', ['assets/a.js'], 'abc123')).toThrow();
  });

  it('gives a new build ID when any file or page changes', () => {
    const id = buildIdFor(['assets/a.js'], ['<html>']);
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(buildIdFor(['assets/a.js'], ['<html>'])).toBe(id);
    expect(buildIdFor(['assets/b.js'], ['<html>'])).not.toBe(id);
    expect(buildIdFor(['assets/a.js'], ['<html lang>'])).not.toBe(id);
  });
});
