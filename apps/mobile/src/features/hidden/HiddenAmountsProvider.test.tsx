import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { Pressable, Text as RNText } from 'react-native';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { CIPHER } from './cipher';
import {
  AMOUNTS_HIDDEN_KEY,
  HiddenAmountsProvider,
  useHiddenAmounts,
  useHiddenMoney,
} from './HiddenAmountsProvider';

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
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function Probe() {
  const { hidden, phase, toggle } = useHiddenAmounts();
  const { format } = useHiddenMoney();
  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="toggle">
      <RNText testID="state">{`${hidden ? 'hidden' : 'visible'}/${phase}`}</RNText>
      <RNText testID="money">{format(128_450, 'EUR', 'it')}</RNText>
    </Pressable>
  );
}

function renderProbe() {
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
    expect(screen.getByTestId('state')).toHaveTextContent('hidden/hidden');
    expect(screen.getByTestId('money')).toHaveTextContent('•••• €');
  });

  it('is visible on a fresh install', async () => {
    await renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('visible/visible');
    expect(screen.getByTestId('money')).toHaveTextContent('1.284,50 €');
  });

  it('scrambles for the length of the cipher, then settles and persists', async () => {
    await renderProbe();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('toggle'));
    });
    expect(mockStore.get(AMOUNTS_HIDDEN_KEY)).toBe('true');
    expect(screen.getByTestId('state')).toHaveTextContent('hidden/scrambling');
    const noisy = screen.getByTestId('money').props.children as string;
    expect(noisy).toMatch(/^\d\.\d{3},\d{2} €$/);

    await act(async () => {
      jest.advanceTimersByTime(CIPHER.steps * CIPHER.stepMs);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('hidden/hidden');
    expect(screen.getByTestId('money')).toHaveTextContent('•••• €');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('toggle'));
    });
    expect(mockStore.get(AMOUNTS_HIDDEN_KEY)).toBe('false');
    expect(screen.getByTestId('state')).toHaveTextContent('visible/scrambling');
    await act(async () => {
      jest.advanceTimersByTime(CIPHER.steps * CIPHER.stepMs);
    });
    expect(screen.getByTestId('money')).toHaveTextContent('1.284,50 €');
  });
});
