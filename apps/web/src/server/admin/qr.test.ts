import { create } from 'qrcode';
import { describe, expect, it } from 'vitest';
import { qrSvgPath } from './qr';

const TEXT = 'https://saldo.example.com/register?invite=ABCD-EFGH-JKLM-NPQR';

/** The dark modules as the library reports them, independently of the function under test. */
function darkModules(text: string): { size: number; dark: Set<string> } {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const dark = new Set<string>();
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) dark.add(`${col} ${row}`);
    }
  }
  return { size: modules.size, dark };
}

describe('qrSvgPath', () => {
  it('reports the matrix size', () => {
    const { size } = qrSvgPath(TEXT);
    expect(size).toBe(darkModules(TEXT).size);
    // A QR side is 17 + 4 × version, so at least 21.
    expect((size - 17) % 4).toBe(0);
    expect(size).toBeGreaterThanOrEqual(21);
  });

  it('draws one unit square per dark module, and nothing else', () => {
    const { path } = qrSvgPath(TEXT);
    const { dark } = darkModules(TEXT);
    expect(path.match(/M/g)).toHaveLength(dark.size);
    const drawn = [...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(new Set(drawn)).toEqual(dark);
    expect(drawn).toHaveLength(dark.size);
  });

  it('marks the corner module of the three finder patterns dark, and not the fourth corner', () => {
    const { size, path } = qrSvgPath(TEXT);
    const drawn = (x: number, y: number) => path.includes(`M${x} ${y}h1v1h-1z`);
    expect(drawn(0, 0)).toBe(true);
    expect(drawn(size - 1, 0)).toBe(true);
    expect(drawn(0, size - 1)).toBe(true);
    // The bottom-right corner carries data, not a finder; a fixed answer would be luck.
    const { dark } = darkModules(TEXT);
    expect(drawn(size - 1, size - 1)).toBe(dark.has(`${size - 1} ${size - 1}`));
  });

  it('is deterministic, and a different text gives a different path', () => {
    expect(qrSvgPath(TEXT)).toEqual(qrSvgPath(TEXT));
    expect(qrSvgPath(`${TEXT}x`).path).not.toBe(qrSvgPath(TEXT).path);
  });
});
