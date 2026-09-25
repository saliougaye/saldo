import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ApiClientError } from '../../net/apiClient';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ServerSignInPanel } from './ServerSignIn';

const mockCheck = jest.fn();
const mockConnect = jest.fn();
jest.mock('../../auth/ServerProvider', () => ({
  useServer: () => ({ check: mockCheck, connect: mockConnect, lastServerUrl: null }),
}));

const HEALTH = {
  app: 'saldo',
  apiVersion: 1,
  schemaVersion: 12,
  version: '0.3.1',
  registrationAllowed: true,
  attachmentsEnabled: false,
};

let i18n: I18nInstance;
beforeAll(async () => {
  i18n = await createI18n('en', []);
});
beforeEach(() => {
  mockCheck.mockReset();
  mockConnect.mockReset();
});

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderPanel(onConnected = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <ServerSignInPanel onConnected={onConnected} />
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return onConnected;
}

async function typeAndContinue(address: string) {
  await userEvent.type(screen.getByLabelText('Server address'), address);
  await userEvent.press(screen.getByText('Continue'));
}

describe('ServerSignInPanel', () => {
  it('previews the origin and keeps «Continue» off until the address is usable', async () => {
    await renderPanel();
    expect(screen.getByText('For example saldo.example.com')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Server address'), 'saldo.rossi.example.org');
    expect(screen.getByText('Connecting to https://saldo.rossi.example.org')).toBeTruthy();
  });

  it('swaps the field for the server row and offers the passkey', async () => {
    mockCheck.mockResolvedValue(HEALTH);
    await renderPanel();
    await typeAndContinue('saldo.rossi.example.org');
    expect(await screen.findByText('saldo.rossi.example.org')).toBeTruthy();
    expect(screen.getByText('Saldo 0.3.1')).toBeTruthy();
    expect(screen.getByText('Sign in with passkey')).toBeTruthy();
    expect(screen.getByText('Create account')).toBeTruthy();
    expect(screen.queryByLabelText('Server address')).toBeNull();
  });

  it('says in words that the server is not reachable, and tries the same address again', async () => {
    mockCheck.mockRejectedValue(new ApiClientError(503, 'unreachable', 'x'));
    await renderPanel();
    await typeAndContinue('saldo.rossi.example.org');
    expect(await screen.findByText('Not reachable')).toBeTruthy();
    await userEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText(/Still no answer\./)).toBeTruthy();
    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(mockCheck).toHaveBeenLastCalledWith('https://saldo.rossi.example.org');
  });

  it('sends a non-Saldo address back to the field, still typed', async () => {
    mockCheck.mockRejectedValue(new ApiClientError(502, 'not_saldo', 'x'));
    await renderPanel();
    await typeAndContinue('example.org');
    expect(await screen.findByText('Not a Saldo server')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
    await userEvent.press(screen.getByText('Change address'));
    expect(screen.getByLabelText('Server address').props.value).toBe('example.org');
  });

  it('signs in to the address it checked and hands over', async () => {
    mockCheck.mockResolvedValue(HEALTH);
    mockConnect.mockResolvedValue({ id: 'ada', displayName: 'Ada' });
    const onConnected = await renderPanel();
    await typeAndContinue('saldo.rossi.example.org');
    await userEvent.press(await screen.findByText('Sign in with passkey'));
    expect(mockConnect).toHaveBeenCalledWith(
      'https://saldo.rossi.example.org',
      'login',
      expect.objectContaining({ decideUnownedData: expect.any(Function) }),
    );
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('asks what to do with the phone’s own rows, and passes the answer on', async () => {
    mockCheck.mockResolvedValue(HEALTH);
    let answer: Promise<string> | undefined;
    mockConnect.mockImplementation(async (_url, _mode, questions) => {
      answer = questions.decideUnownedData();
      return { id: 'ada', displayName: 'Ada', answer: await answer };
    });
    await renderPanel();
    await typeAndContinue('saldo.rossi.example.org');
    await userEvent.press(await screen.findByText('Sign in with passkey'));
    await userEvent.press(await screen.findByText('Delete and use the server'));
    await act(async () => {
      await expect(answer).resolves.toBe('discard');
    });
  });
});
