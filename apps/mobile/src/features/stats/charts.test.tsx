import { render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { CashflowChart } from './CashflowChart';
import { SpendHistoryChart } from './SpendHistoryChart';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

function Host({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </ThemeProvider>
  );
}

const BARS = [
  { key: '2026-02-27', label: 'Feb 27', income: 231_000, expenses: 198_500, current: false },
  { key: '2026-03-27', label: 'Mar 27', income: 231_000, expenses: 185_351, current: true },
];

describe('CashflowChart', () => {
  it('labels each column with its net, rounded and signed', async () => {
    await render(
      <Host>
        <CashflowChart bars={BARS} currency="EUR" locale="en" />
      </Host>,
    );
    expect(screen.getByText('+325')).toBeTruthy();
    expect(screen.getByText('+456')).toBeTruthy();
    expect(screen.getByText('Feb 27')).toBeTruthy();
  });

  it('shows a net loss with a minus sign', async () => {
    await render(
      <Host>
        <CashflowChart
          bars={[{ key: 'a', label: 'Mar 27', income: 100_00, expenses: 250_00, current: false }]}
          currency="EUR"
          locale="en"
        />
      </Host>,
    );
    expect(screen.getByText('−150')).toBeTruthy();
  });

  it('hatches the current cycle only, and explains the hatch in the legend', async () => {
    await render(
      <Host>
        <CashflowChart bars={BARS} currency="EUR" locale="en" />
      </Host>,
    );
    expect(screen.getByText('Current cycle')).toBeTruthy();
    expect(screen.getByText('Income')).toBeTruthy();
    expect(screen.getByText('Expenses')).toBeTruthy();
    // One pattern per hatched bar (income + expenses of the current cycle) plus the legend swatch.
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.match(/RNSVGPattern/g)).toHaveLength(3);
  });
});

describe('SpendHistoryChart', () => {
  it('labels each column with an unsigned amount', async () => {
    await render(
      <Host>
        <SpendHistoryChart
          bars={[
            { key: 'a', label: 'Feb 27', amount: 37_210, current: false },
            { key: 'b', label: 'Mar 27', amount: 42_000, current: true },
          ]}
          currency="EUR"
          locale="en"
        />
      </Host>,
    );
    expect(screen.getByText('372')).toBeTruthy();
    expect(screen.getByText('420')).toBeTruthy();
  });
});
