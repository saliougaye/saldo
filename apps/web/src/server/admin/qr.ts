import { create } from 'qrcode';

/**
 * The QR of a text as one SVG path, built on the server so the browser ships no encoder. The
 * client draws it in a `viewBox` of `size + 8` (a four-module quiet zone) with the two theme-
 * independent QR colours: a QR is dark on light in both themes, an inverted one is not read by
 * every scanner.
 *
 * Level M rather than the default: an invite link is short, so there is room for a symbol that
 * survives a scratch, and it stays a version or two smaller than H.
 *
 * `path` is one `M{x} {y}h1v1h-1z` per dark module, in row-major order, so the same text always
 * gives the same string.
 */
export function qrSvgPath(text: string): { size: number; path: string } {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const squares: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) squares.push(`M${col} ${row}h1v1h-1z`);
    }
  }
  return { size: modules.size, path: squares.join('') };
}
