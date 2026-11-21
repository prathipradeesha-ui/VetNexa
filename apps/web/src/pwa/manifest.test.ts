import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicDir = resolve(__dirname, '../../public');

interface Icon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

const manifest = JSON.parse(readFileSync(resolve(publicDir, 'manifest.webmanifest'), 'utf8')) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  icons: Icon[];
  shortcuts: { url: string; icons: Icon[] }[];
};

/** Width and height from a PNG file's header. */
function pngSize(src: string): string {
  const bytes = readFileSync(resolve(publicDir, src.replace(/^\//, '')));
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('web app manifest', () => {
  it('has what browsers need to offer installing the app', () => {
    expect(manifest.short_name).toBe('VetNexa');
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toMatch(/^#0a6c6c$/i);
  });

  it('has 192 and 512 pixel icons and a maskable icon', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  it('points every icon at a PNG file of the stated size', () => {
    const icons = [...manifest.icons, ...manifest.shortcuts.flatMap((s) => s.icons)];
    for (const icon of icons) expect(pngSize(icon.src)).toBe(icon.sizes);
    expect(pngSize('/icons/apple-touch-icon.png')).toBe('180x180');
  });

  it('has a shortcut to emergency help', () => {
    expect(manifest.shortcuts.map((s) => s.url)).toContain('/emergency');
  });
});
