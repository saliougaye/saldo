import { describe, expect, it } from 'vitest';
import {
  authorizeReadOnly,
  chosenScopes,
  clientNote,
  loginRedirect,
  offersWrite,
  parseChosenScopes,
} from './consentView';

describe('loginRedirect', () => {
  it('sends to /login with the same signed query, which /login resumes (0.4a-2 decision 10)', () => {
    expect(loginRedirect('client_id=abc&scope=read+write&sig=x%2By')).toBe(
      '/login?client_id=abc&scope=read+write&sig=x%2By',
    );
  });
});

describe('scopes on the page', () => {
  it('offers write only when the client asked for it', () => {
    expect(offersWrite(['read', 'write'])).toBe(true);
    expect(offersWrite(['read'])).toBe(false);
  });

  it('sends read always, and write only when asked and ticked', () => {
    expect(chosenScopes(['read', 'write'], true)).toEqual(['read', 'write']);
    expect(chosenScopes(['read', 'write'], false)).toEqual(['read']);
    expect(chosenScopes(['read'], true)).toEqual(['read']);
  });

  it('reads «Autorizza solo la lettura» only when write was asked and unticked', () => {
    expect(authorizeReadOnly(['read', 'write'], false)).toBe(true);
    expect(authorizeReadOnly(['read', 'write'], true)).toBe(false);
    expect(authorizeReadOnly(['read'], false)).toBe(false);
  });
});

describe('clientNote', () => {
  it('says «registrata adesso» for a client nobody has seen', () => {
    expect(clientNote({ fresh: true, previouslyAuthorizedAt: null })).toEqual({
      key: 'web.consent.registeredNow',
    });
  });

  it('says when this user authorized it before', () => {
    expect(
      clientNote({ fresh: false, previouslyAuthorizedAt: new Date('2026-09-28T08:00:00.000Z') }),
    ).toEqual({ key: 'web.consent.authorizedBefore', dateIso: '2026-09-28T08:00:00.000Z' });
  });

  it('says nothing for a known client this user never authorized', () => {
    expect(clientNote({ fresh: false, previouslyAuthorizedAt: null })).toBeNull();
  });
});

describe('parseChosenScopes', () => {
  it('accepts read, or read and write, in any order', () => {
    expect(parseChosenScopes(['read'])).toEqual(['read']);
    expect(parseChosenScopes(['write', 'read'])).toEqual(['read', 'write']);
  });

  it('refuses anything else from the browser', () => {
    expect(parseChosenScopes([])).toBeNull();
    expect(parseChosenScopes(['write'])).toBeNull();
    expect(parseChosenScopes(['read', 'read'])).toBeNull();
    expect(parseChosenScopes(['read', 'admin'])).toBeNull();
    expect(parseChosenScopes('read')).toBeNull();
    expect(parseChosenScopes(undefined)).toBeNull();
  });
});
