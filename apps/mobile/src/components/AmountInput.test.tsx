import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AmountInput } from './AmountInput';
import { Screen } from './Screen';

jest.mock('../sync/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function show(props: Partial<ComponentProps<typeof AmountInput>> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <Screen>
          <AmountInput
            testID="amount"
            buffer=""
            onChange={jest.fn()}
            currency="EUR"
            locale="it"
            label="Saldo"
            doneLabel="Fatto"
            {...props}
          />
        </Screen>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

async function focusField() {
  await act(async () => {
    fireEvent(screen.getByTestId('amount'), 'focus');
  });
}

describe('AmountInput', () => {
  it('never opens the device keyboard: the keypad is the only way in', async () => {
    await show();
    expect(screen.getByTestId('amount').props.showSoftInputOnFocus).toBe(false);
  });

  it('shows the buffer with the language separator', async () => {
    await show({ buffer: '1234.5' });
    expect(screen.getByTestId('amount').props.value).toBe('1234,5');
  });

  it('keeps the sign out of the digits, so they never shift', async () => {
    await show({ buffer: '-12.34', allowNegative: true, negativeLabel: 'Negativo' });
    expect(screen.getByTestId('amount').props.value).toBe('12,34');
    expect(screen.getByRole('switch', { name: 'Negativo' })).toBeChecked();
  });

  it('still reads the sign out to a screen reader', async () => {
    await show({ buffer: '-12.34', allowNegative: true, negativeLabel: 'Negativo' });
    expect(screen.getByTestId('amount').props.accessibilityValue).toEqual({ text: '−12,34' });
  });

  it('offers the sign tile only where a balance may be negative', async () => {
    await show({ buffer: '12' });
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('flips the sign from the tile, with the keypad closed', async () => {
    const onChange = jest.fn();
    await show({ buffer: '12', onChange, allowNegative: true, negativeLabel: 'Negativo' });
    expect(screen.queryByTestId('amount-keypad')).toBeNull();
    await userEvent.press(screen.getByRole('switch', { name: 'Negativo' }));
    expect(onChange).toHaveBeenCalledWith('-12');
  });

  it('brings its keypad up on its own where a screen asks for it', async () => {
    await show({ autoFocus: true });
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
  });

  it('keeps a pinned keypad up when its action is taken', async () => {
    const onKeypadAction = jest.fn();
    await show({ keypadPinned: true, keypadActionLabel: 'Continua', onKeypadAction });
    await focusField();
    expect(screen.getByTestId('keypad-action')).toHaveTextContent('Continua');
    await userEvent.press(screen.getByTestId('keypad-action'));
    expect(onKeypadAction).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
  });

  it('puts the keypad away when the field is left for another one', async () => {
    await show({ autoFocus: true });
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
    await act(async () => {
      fireEvent(screen.getByTestId('amount'), 'blur');
    });
    expect(screen.queryByTestId('amount-keypad')).toBeNull();
  });

  it('keeps a pinned keypad up even then: it belongs to the step, not to the field', async () => {
    await show({ autoFocus: true, keypadPinned: true, keypadActionLabel: 'Continua' });
    await act(async () => {
      fireEvent(screen.getByTestId('amount'), 'blur');
    });
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
  });

  it('accepts text from a hardware keyboard, keeping the sign the tile owns', async () => {
    const onChange = jest.fn();
    await show({ buffer: '-1', onChange, allowNegative: true, negativeLabel: 'Negativo' });
    fireEvent.changeText(screen.getByTestId('amount'), '15');
    expect(onChange).toHaveBeenCalledWith('-15');
  });
});
