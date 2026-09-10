'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useState } from 'react';

interface Props {
  redirectUri: string;
  codeChallenge: string;
  state: string;
  canRegister: boolean;
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

async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null
        ? ((payload as { error?: { message?: string } }).error?.message ?? 'Request failed')
        : 'Request failed';
    throw new Error(message);
  }
  return payload;
}

/**
 * The two ceremonies of §9.3. On success the server answers with the `saldo://` redirect it minted
 * and the browser follows it, which is what closes `openAuthSessionAsync` on the app side.
 */
export function MobileAuth({ redirectUri, codeChallenge, state, canRegister, initialMode }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (payload: unknown) => {
    const redirect =
      typeof payload === 'object' && payload !== null
        ? (payload as { redirect?: unknown }).redirect
        : undefined;
    if (typeof redirect !== 'string') throw new Error('The server did not return a redirect');
    window.location.href = redirect;
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
      const options = await postJson('/api/auth/login/options', {});
      const assertion = await startAuthentication({
        optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'],
      });
      finish(
        await postJson('/api/auth/login/verify', {
          response: assertion,
          code_challenge: codeChallenge,
          redirect_uri: redirectUri,
          state,
        }),
      );
    });

  const register = () =>
    run(async () => {
      const trimmed = displayName.trim();
      if (trimmed.length === 0) throw new Error('Choose a name first');
      const options = await postJson('/api/auth/register/options', { displayName: trimmed });
      const attestation = await startRegistration({
        optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'],
      });
      finish(
        await postJson('/api/auth/register/verify', {
          response: attestation,
          code_challenge: codeChallenge,
          redirect_uri: redirectUri,
          state,
        }),
      );
    });

  return (
    <main style={{ padding: 24, width: '100%', maxWidth: 360, display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
        {mode === 'login' ? 'Sign in to Saldo' : 'Create your account'}
      </h1>
      <p style={{ color: '#8C8C8C', margin: 0 }}>
        {mode === 'login'
          ? 'Use the passkey you registered on this server.'
          : 'Your passkey stays on this device; the server only stores its public key.'}
      </p>

      {mode === 'register' ? (
        <input
          style={input}
          placeholder="Your name"
          value={displayName}
          maxLength={80}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="name"
        />
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
