import { render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { GoalCloseSheet } from './GoalCloseSheet';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

/** `Sheet` reads the bottom inset, and there is no provider in `jest.setup.js`. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function show(reached: boolean) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <GoalCloseSheet
            visible
            reached={reached}
            onClose={jest.fn()}
            balanceLabel="€3,000.00"
            parentName="Checking"
            onRecordExpense={jest.fn()}
            onReturn={jest.fn()}
          />
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('GoalCloseSheet', () => {
  it('celebrates a reached goal with Rocky, hidden from screen readers', async () => {
    await show(true);
    expect(screen.getByText('Did you use the money?')).toBeTruthy();
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });

  it('has no Rocky for a goal closed before its target', async () => {
    await show(false);
    expect(screen.getByText('Did you use the money?')).toBeTruthy();
    expect(screen.queryByTestId('mascot', { includeHiddenElements: true })).toBeNull();
  });
});
