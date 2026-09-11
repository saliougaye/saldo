import { describe, expect, it } from 'vitest';
import { generateInviteCode, hashInviteCode, normaliseInviteCode } from './inviteCode';

describe('generateInviteCode', () => {
  it('is four groups of four unambiguous symbols', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}(-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}){3}$/);
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateInviteCode()));
    expect(codes.size).toBe(200);
  });
});

describe('normaliseInviteCode', () => {
  it('accepts what a person actually types', () => {
    const canonical = normaliseInviteCode('7GQ4-XM2B-PDVT-9NKS');
    expect(normaliseInviteCode('7gq4xm2bpdvt9nks')).toBe(canonical);
    expect(normaliseInviteCode('  7GQ4 XM2B PDVT 9NKS  ')).toBe(canonical);
  });

  it('folds the symbols that get misread', () => {
    // O→0, I→1, L→1, U→V: a code read off a screen works whatever the reader assumed.
    expect(normaliseInviteCode('O1IL-UUUU-0000-1111')).toBe('0111VVVV00001111');
  });

  it('drops anything that is not a symbol, so punctuation cannot change the answer', () => {
    expect(normaliseInviteCode('7GQ4/XM2B.PDVT_9NKS')).toBe(normaliseInviteCode('7GQ4XM2BPDVT9NKS'));
  });
});

describe('hashInviteCode', () => {
  it('is stable across every spelling of the same code', () => {
    const code = generateInviteCode();
    expect(hashInviteCode(code.toLowerCase())).toBe(hashInviteCode(code));
    expect(hashInviteCode(code.replace(/-/g, ''))).toBe(hashInviteCode(code));
  });

  it('is a sha-256 hex digest, so the table never holds a usable code', () => {
    const hash = hashInviteCode('7GQ4-XM2B-PDVT-9NKS');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('7GQ4');
  });

  it('separates two codes that differ by one symbol', () => {
    expect(hashInviteCode('7GQ4-XM2B-PDVT-9NKS')).not.toBe(hashInviteCode('7GQ4-XM2B-PDVT-9NKT'));
  });
});
