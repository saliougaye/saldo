import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { EmailAskDialog } from './EmailAskDialog';

/**
 * Both assertions below wait for a state change behind a promise. The library's default is one
 * second, which the whole suite running in parallel with the other packages has already exceeded
 * once on this machine — and "did the dialog eventually show the refusal" is not a question about
 * speed. Long enough to be honest, short enough to still fail rather than hang.
 */
const SETTLES_IN = { timeout: 5000 };

let i18n: I18nInstance;
beforeAll(async () => {
  i18n = await createI18n('en', []);
});

async function renderDialog(props: {
  onSave: (email: string) => Promise<void>;
  onDismiss: () => void;
}) {
  await render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <EmailAskDialog visible onSave={props.onSave} onDismiss={props.onDismiss} />
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('EmailAskDialog', () => {
  it('will not send an address the server would refuse', async () => {
    const onSave = jest.fn();
    await renderDialog({ onSave, onDismiss: jest.fn() });
    await fireEvent.changeText(screen.getByTestId('email-ask-field'), 'ada');
    await fireEvent.press(screen.getByTestId('email-ask-save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sends the address once it is one', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await renderDialog({ onSave, onDismiss: jest.fn() });
    await fireEvent.changeText(screen.getByTestId('email-ask-field'), 'ada@example.com');
    await fireEvent.press(screen.getByTestId('email-ask-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('ada@example.com'), SETTLES_IN);
  });

  it('shows the server’s refusal and stays open', async () => {
    const onSave = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('taken'), { code: 'email_taken' }));
    const onDismiss = jest.fn();
    await renderDialog({ onSave, onDismiss });
    await fireEvent.changeText(screen.getByTestId('email-ask-field'), 'ada@example.com');
    await fireEvent.press(screen.getByTestId('email-ask-save'));
    await waitFor(
      () => expect(screen.getByText(/già di un altro account|another account/i)).toBeTruthy(),
      SETTLES_IN,
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('can be postponed', async () => {
    const onDismiss = jest.fn();
    await renderDialog({ onSave: jest.fn(), onDismiss });
    await fireEvent.press(screen.getByTestId('email-ask-later'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
