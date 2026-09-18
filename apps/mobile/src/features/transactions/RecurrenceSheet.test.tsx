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

async function show(value: Parameters<typeof RecurrenceSheet>[0]['value']) {
  const onChange = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <RecurrenceSheet
            visible
            onClose={() => {}}
            value={value}
            startDate="2026-09-18"
            today="2026-09-18"
            onChange={onChange}
          />
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return onChange;
}

describe('RecurrenceSheet', () => {
  it('reports a preset as soon as it is tapped', async () => {
    const onChange = await show(null);
    await userEvent.press(screen.getByText('Every 2 weeks'));
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'weekly', interval: 2, endDate: null });
  });

  it('opens the custom block and steps the interval', async () => {
    const onChange = await show({ frequency: 'monthly', interval: 1, endDate: null });
    await userEvent.press(screen.getByText('Custom'));
    await userEvent.press(screen.getByLabelText('More'));
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'monthly', interval: 2, endDate: null });
    // The sheet is controlled: the parent did not re-render it with the new value in this test, so
    // the preview still describes interval 1 — every month from 18 Sep.
    expect(screen.getByText(/next: Oct 18, Nov 18, Dec 18/)).toBeTruthy();
  });

  it('turns "after N times" into an end date', async () => {
    const onChange = await show({ frequency: 'monthly', interval: 1, endDate: null });
    await userEvent.press(screen.getByText('After N times'));
    // Default 12 times from 2026-09-18 → 2027-08-18.
    expect(onChange).toHaveBeenLastCalledWith({
      frequency: 'monthly',
      interval: 1,
      endDate: '2027-08-18',
    });
  });

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
});
