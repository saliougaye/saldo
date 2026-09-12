import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PeriodProvider } from './PeriodProvider';
import { PeriodSheet } from './PeriodSheet';

jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ currency: 'EUR', periodKind: 'month', cycleStartDay: 27 }),
  useTransactionsInRange: () => [],
}));

jest.mock('../../db/DatabaseProvider', () => ({
  useRepositories: () => ({ settings: { update: jest.fn() } }),
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

/** `Sheet` reads the bottom inset, and there is no provider in `jest.setup.js`. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Host({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <PeriodProvider>{children}</PeriodProvider>
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('PeriodSheet', () => {
  it('keeps itself open while the custom range sheet on top of it is dismissing', async () => {
    const onClose = jest.fn();
    await render(
      <Host>
        <PeriodSheet visible onClose={onClose} />
      </Host>,
    );

    const user = userEvent.setup();
    await user.press(screen.getByText('Custom period'));
    await user.press(screen.getByText('Done'));

    // Two stacked `Modal`s dismissing in the same frame leave iOS with a screen that takes no
    // touches at all, so this sheet waits for `CustomRangeSheet`'s `onDismissed` instead (§6.15).
    expect(onClose).not.toHaveBeenCalled();
  });
});
