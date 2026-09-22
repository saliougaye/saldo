import type { PermissionAnswer, PermissionKey } from '@saldo/core';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PermissionsList } from './PermissionsList';

let i18n: I18nInstance;
beforeAll(async () => {
  i18n = await createI18n('it', []);
});

const PENDING: Record<PermissionKey, PermissionAnswer> = {
  notifications: 'pending',
  camera: 'pending',
  appLock: 'pending',
};

function renderList(
  answers: Record<PermissionKey, PermissionAnswer>,
  handlers: Partial<{
    onActivate: (key: PermissionKey) => void;
    onLater: (key: PermissionKey) => void;
    onOpenSettings: () => void;
  }> = {},
) {
  return render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <PermissionsList
          answers={answers}
          onActivate={handlers.onActivate ?? jest.fn()}
          onLater={handlers.onLater ?? jest.fn()}
          onOpenSettings={handlers.onOpenSettings ?? jest.fn()}
        />
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('PermissionsList', () => {
  it('opens only the first pending row', async () => {
    await renderList(PENDING);
    expect(screen.getByText(/budget sta per finire/)).toBeTruthy();
    expect(screen.queryByText(/fotografare uno scontrino/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Attiva' })).toHaveLength(1);
  });

  it('reports «Attiva» and «Più tardi» for the open row', async () => {
    const onActivate = jest.fn();
    const onLater = jest.fn();
    await renderList({ ...PENDING, notifications: 'later' }, { onActivate, onLater });
    await userEvent.press(screen.getByRole('button', { name: 'Attiva' }));
    expect(onActivate).toHaveBeenCalledWith('camera');
    await userEvent.press(screen.getByRole('button', { name: 'Più tardi' }));
    expect(onLater).toHaveBeenCalledWith('camera');
  });

  it('says what each answered row became', async () => {
    await renderList({ notifications: 'granted', camera: 'later', appLock: 'denied' });
    expect(screen.getByText('Attive')).toBeTruthy();
    expect(screen.getByText('Più tardi')).toBeTruthy();
    expect(screen.getByText('Non attivato')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Attiva' })).toBeNull();
  });

  it('links a denied permission to the system settings, but not the lock', async () => {
    const onOpenSettings = jest.fn();
    await renderList({ notifications: 'denied', camera: 'granted', appLock: 'denied' }, { onOpenSettings });
    const links = screen.getAllByRole('button', { name: 'Apri le Impostazioni di sistema' });
    expect(links).toHaveLength(1);
    const [link] = links;
    if (link === undefined) throw new Error('no settings link');
    await userEvent.press(link);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
