import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { NewTagSheet } from './NewTagSheet';

const mockCreate = jest.fn();

jest.mock('../../db/DatabaseProvider', () => ({
  useRepositories: () => ({ tags: { create: (...args: unknown[]) => mockCreate(...args) } }),
}));
jest.mock('../../db/hooks', () => ({
  useTags: () => [{ id: 'a', name: 'Holiday' }],
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockCreate.mockClear();
});

/** `Sheet` reads the bottom inset, and there is no provider in `jest.setup.js`. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Host({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('NewTagSheet', () => {
  it('creates the tag with a trimmed name and closes', async () => {
    const onClose = jest.fn();
    await render(
      <Host>
        <NewTagSheet visible onClose={onClose} />
      </Host>,
    );
    fireEvent.changeText(screen.getByLabelText('Name'), '  Trip ');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    await userEvent.press(screen.getByText('Save'));
    expect(mockCreate).toHaveBeenCalledWith({ name: 'Trip' });
    expect(onClose).toHaveBeenCalled();
  });

  it('will not save an empty name or one another tag has', async () => {
    await render(
      <Host>
        <NewTagSheet visible onClose={jest.fn()} />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Name'), 'holiday');
    await waitFor(() =>
      expect(screen.getByText('A tag with this name already exists.')).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent(screen.getByLabelText('Name'), 'submitEditing');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
