import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text as RNText } from 'react-native';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { AMOUNTS_HIDDEN_KEY, HiddenAmountsProvider } from './HiddenAmountsProvider';
import { useHiddenAmounts, useHiddenMoney } from './hiddenAmounts';

const mockStore = new Map<string, string>();

// Stands in for the SQLite-backed provider: the flag is one key in `kv`.
jest.mock('../../db/DatabaseProvider', () => ({
  useDatabase: () => ({
    kv: {
      get: (key: string) => mockStore.get(key) ?? null,
      set: (key: string, value: string) => mockStore.set(key, value),
    },
  }),
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('it', []);
});

beforeEach(() => {
  mockStore.clear();
});

let renders = 0;

function Probe() {
  const { hidden, toggle } = useHiddenAmounts();
  const { format } = useHiddenMoney();
  renders += 1;
  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="toggle">
      <RNText testID="state">{hidden ? 'hidden' : 'visible'}</RNText>
      <RNText testID="money">{format(128_450, 'EUR', 'it')}</RNText>
    </Pressable>
  );
}

function renderProbe() {
  renders = 0;
  return render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <HiddenAmountsProvider>
          <Probe />
        </HiddenAmountsProvider>
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('HiddenAmountsProvider', () => {
  it('starts from the device flag', async () => {
    mockStore.set(AMOUNTS_HIDDEN_KEY, 'true');
    await renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('hidden');
    expect(screen.getByTestId('money')).toHaveTextContent('•••• €');
  });

  it('is visible on a fresh install', async () => {
    await renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('visible');
    expect(screen.getByTestId('money')).toHaveTextContent('1.284,50 €');
  });

  it('toggles in exactly one render per direction and persists', async () => {
    await renderProbe();
    const before = renders;
    await act(async () => {
      fireEvent.press(screen.getByLabelText('toggle'));
    });
    expect(mockStore.get(AMOUNTS_HIDDEN_KEY)).toBe('true');
    expect(screen.getByTestId('money')).toHaveTextContent('•••• €');
    // A screen calls these hooks at its top: every extra render here is a render of the whole screen.
    expect(renders - before).toBe(1);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('toggle'));
    });
    expect(mockStore.get(AMOUNTS_HIDDEN_KEY)).toBe('false');
    expect(screen.getByTestId('money')).toHaveTextContent('1.284,50 €');
    expect(renders - before).toBe(2);
  });
});
