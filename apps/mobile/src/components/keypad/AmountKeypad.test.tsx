import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { AmountInput } from '../AmountInput';
import { Screen } from '../Screen';

jest.mock('../../sync/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Host({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

interface FieldProps {
  buffer?: string;
  onChange?: (next: string) => void;
  allowNegative?: boolean;
  currency?: 'EUR' | 'JPY';
}

function Field({ buffer = '', onChange = jest.fn(), allowNegative, currency = 'EUR' }: FieldProps) {
  return (
    <Host>
      <Screen>
        <AmountInput
          testID="amount"
          buffer={buffer}
          onChange={onChange}
          currency={currency}
          locale="it"
          label="Importo"
          doneLabel="Fatto"
          allowNegative={allowNegative}
          negativeLabel="Negativo"
        />
      </Screen>
    </Host>
  );
}

/** The sign key is hidden from assistive technology on purpose (see the test below). */
const HIDDEN = { includeHiddenElements: true } as const;

/** Tapping the field focuses it on a device; RNTL delivers the focus itself. */
async function focusField() {
  await act(async () => {
    fireEvent(screen.getByTestId('amount'), 'focus');
  });
}

describe('AmountKeypad', () => {
  it('stays away until a field asks for it', async () => {
    await render(<Field />);
    expect(screen.queryByTestId('amount-keypad')).toBeNull();
  });

  it('comes up when the field is touched, and types into it', async () => {
    const onChange = jest.fn();
    await render(<Field onChange={onChange} />);
    await focusField();
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
    await userEvent.press(screen.getByTestId('keypad-key-7'));
    expect(onChange).toHaveBeenCalledWith('7');
  });

  it('shows the language separator and writes the buffer one', async () => {
    const onChange = jest.fn();
    await render(<Field buffer="12" onChange={onChange} />);
    await focusField();
    expect(screen.getByTestId('keypad-key-separator')).toHaveTextContent(',');
    await userEvent.press(screen.getByTestId('keypad-key-separator'));
    expect(onChange).toHaveBeenCalledWith('12.');
  });

  it('draws no separator key for a currency without a minor unit', async () => {
    await render(<Field currency="JPY" />);
    await focusField();
    expect(screen.queryByTestId('keypad-key-separator')).toBeNull();
  });

  it('deletes with the key above the action', async () => {
    const onChange = jest.fn();
    await render(<Field buffer="12" onChange={onChange} />);
    await focusField();
    await userEvent.press(screen.getByTestId('keypad-key-delete'));
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('offers no sign key unless the amount may be negative', async () => {
    await render(<Field />);
    await focusField();
    expect(screen.queryByTestId('keypad-key-sign', HIDDEN)).toBeNull();
  });

  it('flips the sign from the keypad', async () => {
    const onChange = jest.fn();
    await render(<Field buffer="12" onChange={onChange} allowNegative />);
    await focusField();
    await userEvent.press(screen.getByTestId('keypad-key-sign', HIDDEN));
    expect(onChange).toHaveBeenCalledWith('-12');
  });

  // The field's own tile is the switch a screen reader drives; the key is the thumb's shortcut to
  // the same state, and two switches called "Negativo" would be one too many.
  it('keeps the sign key out of the accessibility tree', async () => {
    await render(<Field buffer="12" allowNegative />);
    await focusField();
    expect(screen.queryByTestId('keypad-key-sign')).toBeNull();
    expect(screen.getByTestId('keypad-key-sign', HIDDEN)).toBeTruthy();
  });

  it('goes away on the action key, which is «Fatto» by default', async () => {
    await render(<Field />);
    await focusField();
    expect(screen.getByTestId('keypad-action')).toHaveTextContent('Fatto');
    await userEvent.press(screen.getByTestId('keypad-action'));
    expect(screen.queryByTestId('amount-keypad')).toBeNull();
  });
});
