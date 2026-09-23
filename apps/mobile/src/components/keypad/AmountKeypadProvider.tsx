import type { AmountKeypadKey } from '@saldo/core';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { View } from 'react-native';

/** What one amount field tells the keypad about itself while it owns it. */
export interface AmountKeypadSession {
  /** Identity of the field, so a second field can take the pad over from the first. */
  id: string;
  allowNegative: boolean;
  /** `null` for a currency without a minor unit: no separator key at all (§5.1). */
  separator: string | null;
  /** Label of the tall key: «Fatto» normally, «Continua» on an onboarding step. */
  actionLabel: string;
  /** A pinned pad stays up when its field loses focus (the onboarding steps). */
  pinned: boolean;
  onKey: (key: AmountKeypadKey) => void;
  onAction: () => void;
  /** Read on every render, so the sign key shows the state it toggles. */
  isNegative: () => boolean;
  /** The field's own view, so the screen can scroll it clear of the pad. */
  node: RefObject<View | null>;
}

export interface AmountKeypadController {
  session: AmountKeypadSession | null;
  open: (session: AmountKeypadSession) => void;
  /** Closes only if the caller still owns the pad: a field losing focus to the next one is a no-op. */
  close: (id: string) => void;
  /** Bumped on every press, so whatever reads the buffer through the session re-renders. */
  version: number;
  bump: () => void;
}

const noop = () => undefined;

const AmountKeypadContext = createContext<AmountKeypadController>({
  session: null,
  open: noop,
  close: noop,
  version: 0,
  bump: noop,
});

export function useAmountKeypad(): AmountKeypadController {
  return useContext(AmountKeypadContext);
}

/**
 * Holds the keypad for one screen. `Screen` mounts it, so every amount field has one without a
 * host provider of its own, and the pad can be drawn in the same bottom stack as the footer.
 */
export function AmountKeypadProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AmountKeypadSession | null>(null);
  const [version, setVersion] = useState(0);
  const owner = useRef<string | null>(null);

  const open = useCallback((next: AmountKeypadSession) => {
    owner.current = next.id;
    setSession((current) => (current !== null && current.id === next.id ? current : next));
  }, []);

  const close = useCallback((id: string) => {
    if (owner.current !== id) return;
    owner.current = null;
    setSession(null);
  }, []);

  const bump = useCallback(() => setVersion((n) => n + 1), []);

  const value = useMemo(
    () => ({ session, open, close, version, bump }),
    [session, open, close, version, bump],
  );
  return <AmountKeypadContext.Provider value={value}>{children}</AmountKeypadContext.Provider>;
}
