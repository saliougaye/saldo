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
  onKey: (key: AmountKeypadKey) => void;
  onAction: () => void;
  /** Whether the amount is negative as the pad opens; `setNegative` keeps it current after that. */
  negative: boolean;
  /** The field's own view, so the screen can scroll it clear of the pad. */
  node: RefObject<View | null>;
}

export interface AmountKeypadController {
  session: AmountKeypadSession | null;
  open: (session: AmountKeypadSession) => void;
  /** Closes only if the caller still owns the pad: a field losing focus to the next one is a no-op. */
  close: (id: string) => void;
  /** Whether the amount the pad serves is negative right now, so the sign key can show it. */
  negative: boolean;
  /** From the field that owns the pad, on every change of its sign. */
  setNegative: (id: string, value: boolean) => void;
}

const noop = () => undefined;

const AmountKeypadContext = createContext<AmountKeypadController>({
  session: null,
  open: noop,
  close: noop,
  negative: false,
  setNegative: noop,
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
  const [negative, setNegativeState] = useState(false);
  const owner = useRef<string | null>(null);

  const open = useCallback((next: AmountKeypadSession) => {
    owner.current = next.id;
    setNegativeState(next.negative);
    setSession((current) => (current !== null && current.id === next.id ? current : next));
  }, []);

  const close = useCallback((id: string) => {
    if (owner.current !== id) return;
    owner.current = null;
    setSession(null);
  }, []);

  const setNegative = useCallback((id: string, value: boolean) => {
    if (owner.current !== id) return;
    setNegativeState(value);
  }, []);

  const value = useMemo(
    () => ({ session, open, close, negative, setNegative }),
    [session, open, close, negative, setNegative],
  );
  return <AmountKeypadContext.Provider value={value}>{children}</AmountKeypadContext.Provider>;
}
