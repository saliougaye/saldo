/** Delimiters a file from another app is likely to use (§11.3). */
const DELIMITERS = [',', ';', '\t'] as const;

export type CsvDelimiter = (typeof DELIMITERS)[number];

export interface ParsedCsv {
  delimiter: CsvDelimiter;
  /** One entry per row, as written: a short row stays short for the planner to report. */
  rows: string[][];
}

/**
 * Counts each candidate delimiter in the first line, ignoring anything inside quotes — a file
 * whose first field is `"a;b;c"` is comma-separated, however many semicolons it holds.
 */
function detectDelimiter(text: string): CsvDelimiter {
  const counts = new Map<CsvDelimiter, number>(DELIMITERS.map((delimiter) => [delimiter, 0]));
  let inQuotes = false;
  for (const character of text) {
    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (character === '\n') break;
    for (const delimiter of DELIMITERS) {
      if (character === delimiter) counts.set(delimiter, (counts.get(delimiter) ?? 0) + 1);
    }
  }
  let best: CsvDelimiter = ',';
  for (const delimiter of DELIMITERS) {
    if ((counts.get(delimiter) ?? 0) > (counts.get(best) ?? 0)) best = delimiter;
  }
  return best;
}

/**
 * RFC 4180 in one pass (§11.3). Written rather than taken from a library because `@saldo/core`
 * imports nothing, and the rules are the same ones `toCsv` writes: `""` inside a quoted field is
 * one quote, and a quoted field may hold the delimiter or a line break.
 *
 * A BOM is dropped — our own export writes one — and both `\n` and `\r\n` end a row.
 */
export function parseCsv(text: string): ParsedCsv {
  const source = text.startsWith('﻿') ? text.slice(1) : text;
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let dirty = false;

  const endField = () => {
    row.push(field);
    field = '';
    dirty = true;
  };
  const endRow = () => {
    // A file ending in a newline, or holding a blank line, must not produce a row of one empty
    // field — but a genuine `,` line (two empty fields) must survive.
    if (dirty || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    row = [];
    field = '';
    dirty = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character ?? '';
      }
      continue;
    }
    if (character === '"') {
      inQuotes = true;
      dirty = true;
      continue;
    }
    if (character === delimiter) {
      endField();
      continue;
    }
    if (character === '\r' && source[index + 1] === '\n') continue;
    if (character === '\n' || character === '\r') {
      endRow();
      continue;
    }
    field += character ?? '';
    dirty = true;
  }
  endRow();

  return { delimiter, rows };
}
