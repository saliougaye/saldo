import { useCallback, useReducer, useState } from 'react';
import { normaliseServerUrl, serverLabel } from '../../auth/link';
import { useServer } from '../../auth/ServerProvider';
import { needsEmail } from './emailAsk';
import { failureReason, initialProbe, type ProbeState, probeReducer } from './serverProbe';

type Answer<T> = { resolve: (value: T) => void } | null;

/**
 * The server step (§6.29 step 0, §6.30): an address, a probe of `/api/health`, then the passkey
 * ceremony and the two ownership questions `connect` may ask. Shared by onboarding and Profile so
 * the sign-in the app offers first and the one it offers later are one piece of code.
 */
export function useServerSignIn({ onConnected }: { onConnected?: () => void } = {}) {
  const { connect, check, lastServerUrl, saveEmail } = useServer();
  // The host is what the user typed; `http://` has to stay spelled out or it would come back https.
  const [address, setAddress] = useState(() => {
    if (lastServerUrl === null) return '';
    return lastServerUrl.startsWith('http://') ? lastServerUrl : serverLabel(lastServerUrl);
  });
  const [probe, dispatch] = useReducer(probeReducer, initialProbe);
  const [busy, setBusy] = useState(false);
  // Kept raw and worded at render time, so a change of language does not need a new attempt.
  const [failure, setFailure] = useState<unknown>(null);
  /**
   * Open only while `connect` waits for an answer. Each holds the `resolve` of the promise it
   * handed out, which is what lets a dialog answer a question asked deep inside the sign-in — and
   * why both must be resolved on every button, never dropped.
   */
  const [foreignData, setForeignData] = useState<
    ({ pending: number } & NonNullable<Answer<boolean>>) | null
  >(null);
  const [unowned, setUnowned] = useState<Answer<'adopt' | 'discard' | 'cancel'>>(null);
  /** Open while a freshly signed-in account still has the synthetic address of §9.1 (D32). */
  const [askEmail, setAskEmail] = useState(false);

  const run = useCallback(
    async (origin: string) => {
      try {
        dispatch({ type: 'answered', health: await check(origin) });
      } catch (caught) {
        dispatch({ type: 'failed', reason: failureReason(caught) });
      }
    },
    [check],
  );

  const origin = normaliseServerUrl(address);

  const submit = useCallback(() => {
    if (origin === null) return;
    setFailure(null);
    dispatch({ type: 'submit', origin });
    void run(origin);
  }, [origin, run]);

  const retry = useCallback(() => {
    if (probe.kind !== 'failed') return;
    dispatch({ type: 'retry' });
    void run(probe.origin);
  }, [probe, run]);

  const change = useCallback(() => {
    setFailure(null);
    dispatch({ type: 'change' });
  }, []);

  const signIn = useCallback(
    (mode: 'login' | 'register') => {
      if (probe.kind !== 'found') return;
      setBusy(true);
      setFailure(null);
      void (async () => {
        try {
          const signedIn = await connect(probe.origin, mode, {
            confirmForeignData: (pending) =>
              new Promise<boolean>((resolve) => setForeignData({ pending, resolve })),
            decideUnownedData: () =>
              new Promise<'adopt' | 'discard' | 'cancel'>((resolve) => setUnowned({ resolve })),
          });
          if (needsEmail(signedIn)) {
            // The question stands in front of `onConnected`: onboarding would otherwise leave this
            // screen for the app and the dialog would go with it.
            setAskEmail(true);
          } else {
            onConnected?.();
          }
        } catch (caught) {
          setFailure(caught);
        } finally {
          setBusy(false);
        }
      })();
    },
    [probe, connect, onConnected],
  );

  const answerForeignData = (accepted: boolean) => {
    foreignData?.resolve(accepted);
    setForeignData(null);
  };
  const answerUnowned = (answer: 'adopt' | 'discard' | 'cancel') => {
    unowned?.resolve(answer);
    setUnowned(null);
  };

  return {
    address,
    setAddress,
    probe,
    canSubmit: origin !== null && probe.kind === 'editing',
    busy,
    failure,
    submit,
    retry,
    change,
    signIn,
    foreignData,
    answerForeignData,
    unownedOpen: unowned !== null,
    answerUnowned,
    askEmail,
    saveEmail,
    dismissEmailAsk: () => {
      setAskEmail(false);
      onConnected?.();
    },
  };
}

export type ServerSignIn = ReturnType<typeof useServerSignIn>;
export type { ProbeState };
