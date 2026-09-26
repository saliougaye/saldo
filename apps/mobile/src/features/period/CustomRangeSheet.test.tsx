import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { CustomRangeSheet } from './CustomRangeSheet';

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

describe('CustomRangeSheet', () => {
  it('reaches no further than the end of the current period (§6.15)', async () => {
    const onApply = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider preference="dark">
          <I18nextProvider i18n={i18n}>
            <CustomRangeSheet
              visible
              initial={{ start: '2026-09-01', end: '2026-09-30' }}
              today="2026-09-26"
              maxDate="2026-09-30"
              onApply={onApply}
              onClose={() => {}}
            />
          </I18nextProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    // The last day of the period is still a choice; the first one after it is not.
    expect(screen.getByLabelText('September 30, 2026').props.accessibilityState.disabled).toBe(
      false,
    );
    const after = screen.getByLabelText('October 1, 2026');
    expect(after.props.accessibilityState.disabled).toBe(true);
    await userEvent.press(after);
    await userEvent.press(screen.getByText('Done'));
    expect(onApply).toHaveBeenCalledWith({ start: '2026-09-01', end: '2026-09-30' });
  });
});
