import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { RecurrenceSheet } from './RecurrenceSheet';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

/** `Sheet` reads the bottom inset, and there is no provider in `jest.setup.js`. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('RecurrenceSheet', () => {
  it('reads the end from the rule it is opened with, not from the one it was mounted with', async () => {
    const { rerender } = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider preference="dark">
          <I18nextProvider i18n={i18n}>
            <RecurrenceSheet
              visible={false}
              onClose={() => {}}
              value={null}
              startDate="2026-09-18"
              today="2026-09-18"
              onChange={jest.fn()}
            />
          </I18nextProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await rerender(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider preference="dark">
          <I18nextProvider i18n={i18n}>
            <RecurrenceSheet
              visible
              onClose={() => {}}
              value={{ frequency: 'weekly', interval: 2, endDate: '2027-02-20' }}
              startDate="2026-09-18"
              today="2026-09-18"
              onChange={jest.fn()}
            />
          </I18nextProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    // "Last occurrence" is only drawn when the end mode is "on a date".
    expect(await screen.findByText('Last occurrence')).toBeTruthy();
  });

  it('counts "after N times" from the anchor the caller names', async () => {
    const onChange = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider preference="dark">
          <I18nextProvider i18n={i18n}>
            <RecurrenceSheet
              visible
              onClose={() => {}}
              value={{ frequency: 'weekly', interval: 1, endDate: null }}
              startDate="2026-09-18"
              today="2026-09-18"
              onChange={onChange}
              anchorFor={() => '2026-09-25'}
            />
          </I18nextProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await userEvent.press(screen.getByText('After N times'));
    // 12 Fridays from 25 Sep: the 12th is 11 Dec.
    expect(onChange).toHaveBeenLastCalledWith({
      frequency: 'weekly',
      interval: 1,
      endDate: '2026-12-11',
    });
  });
});
