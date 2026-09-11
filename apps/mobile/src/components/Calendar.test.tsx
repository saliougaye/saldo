import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Calendar } from './Calendar';

const TODAY = '2026-09-11';

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

async function show(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
  const onSelect = jest.fn();
  await render(
    <Host>
      <Calendar value={TODAY} today={TODAY} onSelect={onSelect} {...props} />
    </Host>,
  );
  return onSelect;
}

describe('Calendar', () => {
  it('opens on the month of the value and names it', async () => {
    await show();
    expect(screen.getByText('September 2026')).toBeTruthy();
  });

  it('walks months in both directions', async () => {
    await show();
    await userEvent.press(screen.getByLabelText('Previous month'));
    expect(screen.getByText('August 2026')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('Next month'));
    await userEvent.press(screen.getByLabelText('Next month'));
    expect(screen.getByText('October 2026')).toBeTruthy();
  });

  it('reports the day that was pressed', async () => {
    const onSelect = await show();
    await userEvent.press(screen.getByLabelText('September 3, 2026'));
    expect(onSelect).toHaveBeenCalledWith('2026-09-03');
  });

  it('marks the value as selected and leaves the rest alone', async () => {
    await show();
    expect(screen.getByLabelText('September 11, 2026').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByLabelText('September 12, 2026').props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('selects both ends of a range', async () => {
    await show({ value: { start: '2026-09-03', end: '2026-09-20' } });
    for (const label of ['September 3, 2026', 'September 20, 2026']) {
      expect(screen.getByLabelText(label).props.accessibilityState.selected).toBe(true);
    }
    expect(screen.getByLabelText('September 10, 2026').props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('refuses a day past the maximum', async () => {
    const onSelect = await show({ maxDate: TODAY });
    const future = screen.getByLabelText('September 12, 2026');
    expect(future.props.accessibilityState.disabled).toBe(true);
    await userEvent.press(future);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows the neighbouring months in the same grid, so the weeks stay whole', async () => {
    await show();
    // September 2026 starts on a Tuesday; an English calendar starts its week on Sunday.
    expect(screen.getByLabelText('August 30, 2026')).toBeTruthy();
    expect(screen.getByLabelText('October 10, 2026')).toBeTruthy();
  });
});
