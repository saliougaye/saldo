import { act, render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { HiddenAmountsProvider } from '../features/hidden/HiddenAmountsProvider';
import { createI18n } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AmountText, AnimatedAmount } from './AmountText';

let mockHidden = 'false';

jest.mock('../db/DatabaseProvider', () => ({
  useDatabase: () => ({
    kv: {
      get: (key: string) => (key === 'amountsHidden' ? mockHidden : null),
      set: () => {},
    },
  }),
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('it', []);
});

function renderAmount() {
  return render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <HiddenAmountsProvider>
          <AmountText minor={-128_450} currency="EUR" locale="it" />
        </HiddenAmountsProvider>
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('AmountText', () => {
  it('shows the figure and no mask when visible', async () => {
    mockHidden = 'false';
    await renderAmount();
    expect(screen.getByText('−1.284', { exact: false })).toBeTruthy();
    expect(screen.queryByLabelText('Importo nascosto')).toBeNull();
  });

  it('hides the figure from sight and from assistive technology', async () => {
    mockHidden = 'true';
    await renderAmount();
    expect(screen.getByLabelText('Importo nascosto')).toBeTruthy();
    expect(screen.getByText('•••• €')).toBeTruthy();
    // The real text is still in layout (it holds the width) but out of the accessibility tree.
    expect(screen.queryByText('−1.284', { exact: false })).toBeNull();
    expect(screen.getByText('−1.284', { exact: false, includeHiddenElements: true })).toBeTruthy();
  });

  it('renders without a provider, visible', async () => {
    await render(
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <AmountText minor={500} currency="USD" locale="en" />
        </I18nextProvider>
      </ThemeProvider>,
    );
    expect(screen.getByText('$5', { exact: false })).toBeTruthy();
  });
});

describe('AnimatedAmount', () => {
  afterEach(() => jest.useRealTimers());

  function hero(minor: number) {
    return (
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <AnimatedAmount minor={minor} currency="EUR" locale="it" size="hero" />
        </I18nextProvider>
      </ThemeProvider>
    );
  }

  it('keeps the minus of a balance in the red', async () => {
    await render(hero(-12_000));
    expect(screen.getByText('−120', { exact: false })).toBeTruthy();
  });

  it('lands on the minus after counting down across zero', async () => {
    jest.useFakeTimers();
    const view = await render(hero(5_000));
    expect(screen.getByText('50', { exact: false })).toBeTruthy();
    await view.rerender(hero(-12_000));
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(screen.getByText('−120', { exact: false })).toBeTruthy();
  });
});
