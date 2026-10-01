import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { palettes } from '@saldo/ui';
import { describe, expect, it } from 'vitest';
import { buildManifest } from './manifest';

describe('buildManifest', () => {
  it('is an installable standalone app rooted at /', () => {
    const manifest = buildManifest('Saldo');
    expect(manifest).toMatchObject({
      name: 'Saldo',
      short_name: 'Saldo',
      start_url: '/',
      scope: '/',
      display: 'standalone',
    });
  });

  it('takes its colours from the palette', () => {
    const manifest = buildManifest('Saldo');
    expect(manifest.theme_color).toBe(palettes.light.surface);
    expect(manifest.background_color).toBe(palettes.light.surface);
  });

  it('cuts a long instance name for the home screen only', () => {
    const manifest = buildManifest('Casa Rossi finanze');
    expect(manifest.name).toBe('Casa Rossi finanze');
    expect(manifest.short_name).toBe('Casa Rossi f');
  });

  it('lists 192, 512 and a maskable 512, and every file exists', () => {
    const { icons = [] } = buildManifest('Saldo');
    expect(icons.map((icon) => `${icon.sizes}:${icon.purpose}`)).toEqual([
      '192x192:any',
      '512x512:any',
      '512x512:maskable',
    ]);
    for (const icon of icons) {
      expect(existsSync(join(import.meta.dirname, '../../public', icon.src)), icon.src).toBe(true);
    }
  });
});
