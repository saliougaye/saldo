import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { TagEditCard, tagMissingForSave } from './TagEditCard';

const mockRename = jest.fn();
const mockMerge = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../db/adminService', () => ({
  renameTag: (...args: unknown[]) => mockRename(...args),
  mergeTags: (...args: unknown[]) => mockMerge(...args),
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
  mockMerge.mockClear();
  mockDelete.mockClear();
});

const tag = { id: 'a', name: 'Holiday' } as const;

function Host({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </ThemeProvider>
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

describe('TagEditCard', () => {
  it('renames on save', async () => {
    await render(
      <Host>
        <TagEditCard tag={tag} onDeleted={jest.fn()} />
      </Host>,
    );
    // `changeText` rather than `userEvent.type`: the component only reads the final value, and
    // typing it keystroke by keystroke was slow enough to time out under a full parallel run.
    fireEvent.changeText(screen.getByLabelText('Name'), 'Trip');
    await userEvent.press(screen.getByText('Save'));
    expect(mockRename).toHaveBeenCalledWith({}, 'a', 'Trip');
  });

  it('will not save a name that is only whitespace, and says so', async () => {
    await render(
      <Host>
        <TagEditCard tag={tag} onDeleted={jest.fn()} />
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
        <TagEditCard tag={tag} onDeleted={jest.fn()} />
      </Host>,
    );
    fireEvent.changeText(screen.getByLabelText('Name'), 'move');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    expect(screen.getByText('A tag with this name already exists.')).toBeTruthy();
  });

  it('does not offer to merge a tag into itself', async () => {
    await render(
      <Host>
        <TagEditCard tag={tag} onDeleted={jest.fn()} />
      </Host>,
    );
    expect(screen.getByText('Move')).toBeTruthy();
    // "Holiday" is the tag being edited, so it is in the field, not in the merge list.
    expect(screen.queryAllByText('Holiday')).toEqual([]);
  });

  it('merges into another tag and leaves the screen', async () => {
    const onDeleted = jest.fn();
    await render(
      <Host>
        <TagEditCard tag={tag} onDeleted={onDeleted} />
      </Host>,
    );
    await userEvent.press(screen.getByText('Move'));
    expect(mockMerge).toHaveBeenCalledWith({}, {}, 'a', 'b');
    expect(onDeleted).toHaveBeenCalled();
  });

  it('asks before deleting', async () => {
    const onDeleted = jest.fn();
    await render(
      <Host>
        <TagEditCard tag={tag} onDeleted={onDeleted} />
      </Host>,
    );
    await userEvent.press(screen.getByText('Delete tag'));
    expect(mockDelete).not.toHaveBeenCalled();
    await userEvent.press(screen.getByText('Delete'));
    expect(mockDelete).toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalled();
  });
});
