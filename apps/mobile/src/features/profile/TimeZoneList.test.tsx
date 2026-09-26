import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { TimeZoneList } from './TimeZoneList';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('it', []);
});

// 10:45 in New York, 16:45 in Rome.
const NOW = new Date('2026-09-26T14:45:00.000Z');

async function show(props: {
  saved: string | null;
  device: string;
  onSelect?: (zone: string) => void;
}) {
  // `render` is async in this version of React Native Testing Library, as in HomeBudgetCard.test.tsx.
  await render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <TimeZoneList
          now={NOW}
          onSelect={props.onSelect ?? jest.fn()}
          saved={props.saved}
          device={props.device}
        />
      </ThemeProvider>
    </I18nextProvider>,
  );
}

describe('TimeZoneList', () => {
  it('shows the saved zone first, checked, with its local time', async () => {
    await show({ saved: 'Europe/Rome', device: 'Europe/Rome' });
    expect(screen.getByText('Attuale')).toBeTruthy();
    const rome = screen.getByRole('button', { name: /Roma/ });
    expect(rome.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getAllByText('16:45').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Il telefono è su/)).toBeNull();
  });

  it('warns when the phone is elsewhere, and offers its zone', async () => {
    const onSelect = jest.fn();
    await show({ saved: 'Europe/Rome', device: 'America/New_York', onSelect });
    expect(screen.getByText('Attuale e questo telefono')).toBeTruthy();
    expect(
      screen.getByText(
        'Il telefono è su New York, dove sono le 10:45. I conti restano su Roma finché non lo cambi.',
      ),
    ).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'Usa New York' }));
    expect(onSelect).toHaveBeenCalledWith('America/New_York');
  });

  it('finds a city by name, ignoring accents', async () => {
    await show({ saved: 'Europe/Rome', device: 'Europe/Rome' });
    await userEvent.type(screen.getByLabelText('Cerca una città'), 'zurigo');
    expect(screen.getByRole('button', { name: /Zurigo/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Tokyo/ })).toBeNull();
  });

  it('treats a renamed zone as the same zone', async () => {
    // Phones report Asia/Kolkata; CLDR lists it as Asia/Calcutta.
    await show({ saved: 'Asia/Kolkata', device: 'Asia/Calcutta' });
    expect(screen.queryByText(/Il telefono è su/)).toBeNull();
    expect(screen.getByRole('button', { name: /Kolkata/ }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('says so when nothing matches', async () => {
    await show({ saved: 'Europe/Rome', device: 'Europe/Rome' });
    await userEvent.type(screen.getByLabelText('Cerca una città'), 'atlantide');
    expect(screen.getByText('Nessuna città trovata.')).toBeTruthy();
  });

  it('saves the zone the user taps', async () => {
    const onSelect = jest.fn();
    await show({ saved: 'Europe/Rome', device: 'Europe/Rome', onSelect });
    await userEvent.type(screen.getByLabelText('Cerca una città'), 'tokyo');
    await userEvent.press(screen.getByRole('button', { name: /Tokyo/ }));
    expect(onSelect).toHaveBeenCalledWith('Asia/Tokyo');
  });
});
