import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { DeleteTagSheet } from './DeleteTagSheet';

const mockDelete = jest.fn();

jest.mock('../../db/adminService', () => ({
  deleteTag: (...args: unknown[]) => mockDelete(...args),
}));
jest.mock('../../db/client', () => ({ db: {} }));
jest.mock('../../db/DatabaseProvider', () => ({ useRepositories: () => ({}) }));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockDelete.mockClear();
});

const tag = { id: 'a', name: 'Holiday' } as const;

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

describe('DeleteTagSheet', () => {
  it('asks, and says the transactions stay', async () => {
    await render(
      <Host>
        <DeleteTagSheet visible tag={tag} uses={3} onClose={jest.fn()} onDeleted={jest.fn()} />
      </Host>,
    );
    expect(screen.getByText('Delete “Holiday”?')).toBeTruthy();
    expect(
      screen.getByText('The 3 transactions that carry it stay, without this tag.'),
    ).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('words the note for one transaction and for none', async () => {
    const { rerender } = await render(
      <Host>
        <DeleteTagSheet visible tag={tag} uses={1} onClose={jest.fn()} onDeleted={jest.fn()} />
      </Host>,
    );
    expect(
      screen.getByText('The transaction that carries it stays, without this tag.'),
    ).toBeTruthy();
    await rerender(
      <Host>
        <DeleteTagSheet visible tag={tag} uses={0} onClose={jest.fn()} onDeleted={jest.fn()} />
      </Host>,
    );
    expect(screen.getByText('No transaction uses it.')).toBeTruthy();
  });

  it('deletes on confirm, and leaves', async () => {
    const onDeleted = jest.fn();
    const onClose = jest.fn();
    await render(
      <Host>
        <DeleteTagSheet visible tag={tag} uses={3} onClose={onClose} onDeleted={onDeleted} />
      </Host>,
    );
    await userEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDelete).toHaveBeenCalledWith({}, {}, 'a');
    expect(onClose).toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalled();
  });

  it('cancels without deleting', async () => {
    const onClose = jest.fn();
    await render(
      <Host>
        <DeleteTagSheet visible tag={tag} uses={3} onClose={onClose} onDeleted={jest.fn()} />
      </Host>,
    );
    await userEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
