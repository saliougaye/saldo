import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { MergeTagSheet } from './MergeTagSheet';

const mockMerge = jest.fn();

jest.mock('../../db/adminService', () => ({
  mergeTags: (...args: unknown[]) => mockMerge(...args),
}));
jest.mock('../../db/client', () => ({ db: {} }));
jest.mock('../../db/DatabaseProvider', () => ({ useRepositories: () => ({}) }));
jest.mock('../../db/hooks', () => ({
  useTags: () => [
    { id: 'a', name: 'Holiday' },
    { id: 'b', name: 'Move' },
    { id: 'c', name: 'Refund' },
  ],
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockMerge.mockClear();
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

describe('MergeTagSheet', () => {
  it('lists every other tag, never the one being merged', async () => {
    await render(
      <Host>
        <MergeTagSheet visible tag={tag} uses={3} onClose={jest.fn()} onMerged={jest.fn()} />
      </Host>,
    );
    expect(screen.getByText('Merge “Holiday” into…')).toBeTruthy();
    expect(screen.getByText('Move')).toBeTruthy();
    expect(screen.getByText('Refund')).toBeTruthy();
    expect(screen.queryByText('Holiday')).toBeNull();
  });

  it('does nothing on a tap: picking a tag only says what will happen', async () => {
    await render(
      <Host>
        <MergeTagSheet visible tag={tag} uses={3} onClose={jest.fn()} onMerged={jest.fn()} />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();
    await userEvent.press(screen.getByText('Move'));
    expect(mockMerge).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'The 3 transactions tagged “Holiday” move to “Move”, and “Holiday” goes away. This can’t be undone.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled();
  });

  it('merges into the picked tag on confirm, and leaves', async () => {
    const onMerged = jest.fn();
    const onClose = jest.fn();
    await render(
      <Host>
        <MergeTagSheet visible tag={tag} uses={1} onClose={onClose} onMerged={onMerged} />
      </Host>,
    );
    await userEvent.press(screen.getByText('Refund'));
    expect(
      screen.getByText(
        'The transaction tagged “Holiday” moves to “Refund”, and “Holiday” goes away. This can’t be undone.',
      ),
    ).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'Merge' }));
    expect(mockMerge).toHaveBeenCalledWith({}, {}, 'a', 'c');
    expect(onClose).toHaveBeenCalled();
    expect(onMerged).toHaveBeenCalled();
  });

  it('words the note for a tag no transaction carries', async () => {
    await render(
      <Host>
        <MergeTagSheet visible tag={tag} uses={0} onClose={jest.fn()} onMerged={jest.fn()} />
      </Host>,
    );
    await userEvent.press(screen.getByText('Move'));
    expect(screen.getByText('“Holiday” goes away into “Move”. This can’t be undone.')).toBeTruthy();
  });

  it('cancels without merging', async () => {
    const onClose = jest.fn();
    await render(
      <Host>
        <MergeTagSheet visible tag={tag} uses={3} onClose={onClose} onMerged={jest.fn()} />
      </Host>,
    );
    await userEvent.press(screen.getByText('Move'));
    await userEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockMerge).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
