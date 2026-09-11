'use client';

import { useState } from 'react';
import { authClient } from '../../../src/client/authClient';

interface Props {
  redirectUri: string;
  state: string;
  canRegister: boolean;
  requiresInvite: boolean;
  initialMode: 'login' | 'register';
}

const button = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: 'none',
  background: '#C7C7C7',
  color: '#0A0A0A',
  fontSize: 16,
  fontWeight: 500,
  cursor: 'pointer',
} as const;

const secondary = { ...button, background: 'transparent', color: '#C7C7C7' } as const;

const input = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: '#121212',
  color: '#EDEDED',
  fontSize: 16,
  boxSizing: 'border-box',
} as const;

/**
 * The two ceremonies of §9.3, run by Better Auth's passkey client. On success the browser follows
 * the `saldo://` redirect, which is what closes `openAuthSessionAsync` on the app side.
 */
export function MobileAuth({
  redirectUri,
  state,
  canRegister,
  requiresInvite,
  initialMode,
}: Props) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The ceremony leaves this browser holding a session. The app cannot read it, so a one-time
   * token is minted and travels back in the deep link: single use, one minute, stored hashed.
   */
  const finish = async () => {
    const { data, error } = await authClient.oneTimeToken.generate();
    if (error !== null || data === null) {
      throw new Error(error?.message ?? 'Could not finish sign-in');
    }
    const url = new URL(redirectUri);
    url.searchParams.set('ott', data.token);
    url.searchParams.set('state', state);
    window.location.href = url.toString();
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const login = () =>
    run(async () => {
      const { error } = await authClient.signIn.passkey();
      if (error !== null) throw new Error(error.message ?? 'Could not sign you in');
      await finish();
    });

  const register = () =>
    run(async () => {
      const name = displayName.trim();
      if (name.length === 0) throw new Error('Choose a name first');
      const invite = inviteCode.trim();
      if (requiresInvite && invite.length === 0) throw new Error('Enter your invite code');
      // `context` is the plugin's passthrough to `resolveUser`, where the registration policy, the
      // invite and the display name are all enforced server-side. It is one string, so both
      // fields travel through it as JSON.
      const { error } = await authClient.passkey.addPasskey({
        context: JSON.stringify({ name, invite: requiresInvite ? invite : undefined }),
        createSession: true,
      });
      if (error !== null) throw new Error(error.message ?? 'Could not create the account');
      await finish();
    });

  return (
    <main style={{ padding: 24, width: '100%', maxWidth: 360, display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
        {mode === 'login' ? 'Sign in to Saldo' : 'Create your account'}
      </h1>
      <p style={{ color: '#8C8C8C', margin: 0 }}>
        {mode === 'login'
          ? 'Use the passkey you registered on this server.'
          : requiresInvite
            ? 'Enter the invite code you were sent. Your passkey stays on this device; the server only stores its public key.'
            : 'Your passkey stays on this device; the server only stores its public key.'}
      </p>

      {mode === 'register' ? (
        <>
          <input
            style={input}
            placeholder="Your name"
            value={displayName}
            maxLength={80}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
          />
          {requiresInvite ? (
            <input
              style={{ ...input, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em' }}
              placeholder="Invite code"
              value={inviteCode}
              maxLength={32}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Invite code"
            />
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        style={button}
        disabled={busy}
        onClick={mode === 'login' ? login : register}
      >
        {busy ? 'Working…' : mode === 'login' ? 'Sign in with passkey' : 'Create account'}
      </button>

      {canRegister ? (
        <button
          type="button"
          style={secondary}
          disabled={busy}
          onClick={() => {
            setError(null);
            setMode(mode === 'login' ? 'register' : 'login');
          }}
        >
          {mode === 'login' ? 'Create account' : 'I already have a passkey'}
        </button>
      ) : null}

      {error === null ? null : (
        <p role="alert" style={{ color: '#E8823C', margin: 0 }}>
          {error}
        </p>
      )}
    </main>
  );
}
