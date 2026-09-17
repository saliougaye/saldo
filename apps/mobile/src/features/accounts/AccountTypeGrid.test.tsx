import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { AccountTypeGrid } from './AccountTypeGrid';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderGrid(onChange = jest.fn()) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <AccountTypeGrid accessibilityLabel="Type" value="checking" onChange={onChange} />
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('AccountTypeGrid', () => {
  it('offers every account type, debit card included', async () => {
    await renderGrid();
    expect(screen.getAllByRole('radio').map((tile) => tile.props.accessibilityLabel)).toEqual([
      'Cash',
      'Bank',
      'Debit card',
      'Credit card',
      'Savings',
      'Investments',
    ]);
  });

  it('marks the chosen type', async () => {
    await renderGrid();
    expect(screen.getByRole('radio', { name: 'Bank' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Debit card' })).not.toBeChecked();
  });

  it('reports the type that was pressed', async () => {
    const onChange = jest.fn();
    await renderGrid(onChange);
    await userEvent.press(screen.getByRole('radio', { name: 'Debit card' }));
    expect(onChange).toHaveBeenCalledWith('debit_card');
  });

  // Three tiles share a row, and "Carta di credito" does not fit one line of a third.
  it('lets a label wrap to a second line instead of truncating it', async () => {
    await renderGrid();
    expect(screen.getByText('Credit card').props.numberOfLines).toBe(2);
  });
});
