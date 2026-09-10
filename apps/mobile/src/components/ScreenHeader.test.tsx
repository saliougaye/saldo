import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { BackButton, ScreenHeader } from './ScreenHeader';

const mockBack = jest.fn();
const mockState = { canGoBack: true };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => mockState.canGoBack }),
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockBack.mockClear();
  mockState.canGoBack = true;
});

function Host({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </ThemeProvider>
  );
}

describe('BackButton', () => {
  it('pops the stack when pressed', async () => {
    await render(
      <Host>
        <BackButton />
      </Host>,
    );
    await userEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when there is nothing to go back to', async () => {
    mockState.canGoBack = false;
    await render(
      <Host>
        <BackButton />
      </Host>,
    );
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('keeps an explicit handler even with an empty stack', async () => {
    mockState.canGoBack = false;
    const onPress = jest.fn();
    await render(
      <Host>
        <BackButton onPress={onPress} />
      </Host>,
    );
    await userEvent.press(screen.getByLabelText('Back'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('ScreenHeader', () => {
  it('shows the title next to the back button', async () => {
    await render(
      <Host>
        <ScreenHeader title="New transaction" subtitle="Expense" />
      </Host>,
    );
    expect(screen.getByText('New transaction')).toBeTruthy();
    expect(screen.getByText('Expense')).toBeTruthy();
    expect(screen.getByLabelText('Back')).toBeTruthy();
  });
});
