import { describe, expect, it } from 'vitest';
import { parseCsv } from './csvParse';

describe('parseCsv', () => {
  it('reads a plain comma file with either line ending', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual({
      delimiter: ',',
      rows: [
        ['a', 'b'],
        ['1', '2'],
      ],
    });
    expect(parseCsv('a,b\n1,2')).toEqual({
      delimiter: ',',
      rows: [
        ['a', 'b'],
        ['1', '2'],
      ],
    });
  });

  it('unquotes fields that hold the delimiter, a quote or a newline', () => {
    expect(parseCsv('a,b,c\n"x,y","say ""hi""","two\nlines"')).toEqual({
      delimiter: ',',
      rows: [
        ['a', 'b', 'c'],
        ['x,y', 'say "hi"', 'two\nlines'],
      ],
    });
  });

  it('drops a leading BOM', () => {
    expect(parseCsv('﻿a,b\n1,2').rows[0]).toEqual(['a', 'b']);
  });

  it('detects a semicolon or a tab from the header', () => {
    expect(parseCsv('a;b\n1;2').delimiter).toBe(';');
    expect(parseCsv('a\tb\n1\t2').delimiter).toBe('\t');
  });

  it('ignores delimiters that only appear inside quotes', () => {
    // One real comma, three semicolons — but every semicolon is inside a quoted field.
    expect(parseCsv('"a;b;c",d\n1,2').delimiter).toBe(',');
  });

  it('produces no empty row for a trailing newline', () => {
    expect(parseCsv('a,b\n1,2\n').rows).toHaveLength(2);
    expect(parseCsv('a,b\n1,2\n\n').rows).toHaveLength(2);
  });

  it('keeps an empty field and a row of empty fields', () => {
    expect(parseCsv('a,b,c\n1,,3').rows[1]).toEqual(['1', '', '3']);
    expect(parseCsv('a,b\n,').rows[1]).toEqual(['', '']);
  });

  it('keeps a ragged row as it is, for the planner to report', () => {
    expect(parseCsv('a,b,c\n1,2').rows[1]).toEqual(['1', '2']);
  });

  it('reads an empty file as no rows at all', () => {
    expect(parseCsv('')).toEqual({ delimiter: ',', rows: [] });
    expect(parseCsv('\n')).toEqual({ delimiter: ',', rows: [] });
  });

  it('round-trips the real Spendee shape: quoted header cell, emoji, offsets', () => {
    const text =
      'Date,Wallet,Type,"Category name",Amount,Currency,Note,Labels,Author\n' +
      '2026-08-12T16:23:13+00:00,"My Money",Expense,Travel,-5.00000000,EUR,"aperitivo ",Banca🏦,"A Person"\n';
    const { rows, delimiter } = parseCsv(text);
    expect(delimiter).toBe(',');
    expect(rows[0]?.[3]).toBe('Category name');
    expect(rows[1]?.[0]).toBe('2026-08-12T16:23:13+00:00');
    expect(rows[1]?.[6]).toBe('aperitivo ');
    expect(rows[1]?.[7]).toBe('Banca🏦');
  });
});

describe('formula guard', () => {
  it('drops the apostrophe a formula guard put in front of =, +, - or @', () => {
    expect(parseCsv("a,b,c,d\n'=SUM(A1),'+39 333,'-1,'@casa").rows[1]).toEqual([
      '=SUM(A1)',
      '+39 333',
      '-1',
      '@casa',
    ]);
  });

  it('drops it inside a quoted field too', () => {
    expect(parseCsv('a\n"\'=Caffè, e brioche"').rows[1]).toEqual(['=Caffè, e brioche']);
  });

  it('drops it in front of a tab, a carriage return or a line feed', () => {
    expect(parseCsv('a\n"\'\t=1+1"').rows[1]).toEqual(['\t=1+1']);
    expect(parseCsv('a\n"\'\r-1"').rows[1]).toEqual(['\r-1']);
    expect(parseCsv('a\n"\'\n=1+1"').rows[1]).toEqual(['\n=1+1']);
  });

  it('keeps an apostrophe that is part of the text', () => {
    expect(parseCsv("a,b\n'90s playlist,l'estate").rows[1]).toEqual(["'90s playlist", "l'estate"]);
  });
});
