import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { TagEditSheet } from './TagEditSheet';
import { tagMissingForSave } from './tagName';

const mockRename = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../db/adminService', () => ({
  renameTag: (...args: unknown[]) => mockRename(...args),
  deleteTag: (...args: unknown[]) => mockDelete(...args),
}));
jest.mock('../../db/client', () => ({ db: {} }));
jest.mock('../../db/DatabaseProvider', () => ({ useRepositories: () => ({}) }));
jest.mock('../../db/hooks', () => ({
  useTags: () => [
    { id: 'a', name: 'Holiday' },
    { id: 'b', name: 'Move' },
  ],
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockRename.mockClear();
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

describe('tagMissingForSave', () => {
  const tags = [
    { id: 'a', name: 'Holiday' },
    { id: 'b', name: 'Move' },
  ];

  it('asks for a name', () => {
    expect(tagMissingForSave('  ', tags)).toBe('name');
  });

  it('refuses a name another tag already has, whatever its case', () => {
    expect(tagMissingForSave(' move ', tags)).toBe('taken');
    expect(tagMissingForSave('Move', tags, 'a')).toBe('taken');
  });

  it('lets a tag keep its own name or change only its case', () => {
    expect(tagMissingForSave('holiday', tags, 'a')).toBeNull();
    expect(tagMissingForSave('Trip', tags)).toBeNull();
  });
});

describe('TagEditSheet', () => {
  it('renames with a trimmed name on save, and closes', async () => {
    const onClose = jest.fn();
    await render(
      <Host>
        <TagEditSheet visible tag={tag} onClose={onClose} onDeleted={jest.fn()} />
      </Host>,
    );
    // `changeText` rather than `userEvent.type`: the component only reads the final value, and
    // typing it keystroke by keystroke was slow enough to time out under a full parallel run.
    fireEvent.changeText(screen.getByLabelText('Name'), ' Trip ');
    await userEvent.press(screen.getByText('Save'));
    expect(mockRename).toHaveBeenCalledWith({}, 'a', 'Trip');
    expect(onClose).toHaveBeenCalled();
  });

  it('will not save a name that is only whitespace, and says so', async () => {
    await render(
      <Host>
        <TagEditSheet visible tag={tag} onClose={jest.fn()} onDeleted={jest.fn()} />
      </Host>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.queryByText('Enter a name to save.')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Name'), '   ');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    expect(screen.getByText('Enter a name to save.')).toBeTruthy();
  });

  it('will not rename a tag onto the name of another one', async () => {
    await render(
      <Host>
        <TagEditSheet visible tag={tag} onClose={jest.fn()} onDeleted={jest.fn()} />
      </Host>,
    );
    fireEvent.changeText(screen.getByLabelText('Name'), 'move');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    expect(screen.getByText('A tag with this name already exists.')).toBeTruthy();
    fireEvent(screen.getByLabelText('Name'), 'submitEditing');
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('does not offer merging: that is its own action', async () => {
    await render(
      <Host>
        <TagEditSheet visible tag={tag} onClose={jest.fn()} onDeleted={jest.fn()} />
      </Host>,
    );
    expect(screen.queryByText('Move')).toBeNull();
    expect(screen.queryByText('Merge into another tag')).toBeNull();
  });

  it('asks inline before deleting, and can step back', async () => {
    const onDeleted = jest.fn();
    await render(
      <Host>
        <TagEditSheet visible tag={tag} onClose={jest.fn()} onDeleted={onDeleted} />
      </Host>,
    );
    await userEvent.press(screen.getByText('Delete tag'));
    expect(screen.getByText('Delete “Holiday”? The transactions stay.')).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();

    // The sheet's own Cancel comes first; the confirmation's is the last one.
    const cancels = screen.getAllByRole('button', { name: 'Cancel' });
    const stepBack = cancels[cancels.length - 1];
    if (stepBack === undefined) throw new Error('no inline Cancel');
    await userEvent.press(stepBack);
    expect(screen.queryByText('Delete “Holiday”? The transactions stay.')).toBeNull();
    expect(screen.getByText('Delete tag')).toBeTruthy();

    await userEvent.press(screen.getByText('Delete tag'));
    await userEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDelete).toHaveBeenCalledWith({}, {}, 'a');
    expect(onDeleted).toHaveBeenCalled();
  });
});
