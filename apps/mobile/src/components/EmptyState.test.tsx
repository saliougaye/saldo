import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { EmptyState, type EmptyStateProps } from './EmptyState';

const onPress = jest.fn();

beforeEach(() => onPress.mockClear());

const copy = {
  title: 'No budgets',
  body: 'A budget caps a category.',
  action: { label: 'New budget', onPress },
};

async function renderState(props: EmptyStateProps, theme: 'dark' | 'light' = 'dark') {
  await render(
    <ThemeProvider preference={theme}>
      <EmptyState {...props} />
    </ThemeProvider>,
  );
}

describe('EmptyState', () => {
  it.each([
    { kind: 'yet', ghost: 'bar', ...copy },
    { kind: 'noMatch', icon: 'search', ...copy },
    { kind: 'notFound', icon: 'inbox', ...copy },
  ] as const)('$kind shows its title as a header, its body and its action', async (props) => {
    await renderState(props);
    expect(screen.getByRole('header', { name: 'No budgets' })).toBeTruthy();
    expect(screen.getByText('A budget caps a category.')).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'New budget' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws three ghost layers for "nothing yet", hidden from screen readers', async () => {
    await renderState({ kind: 'yet', ghost: 'row', ...copy });
    expect(screen.getAllByTestId('empty-ghost', { includeHiddenElements: true })).toHaveLength(3);
    expect(screen.queryAllByTestId('empty-ghost')).toHaveLength(0);
  });

  it.each(['dark', 'light'] as const)('renders the stack in the %s theme', async (theme) => {
    await renderState({ kind: 'yet', ghost: 'chips', ...copy }, theme);
    expect(screen.getAllByTestId('empty-ghost', { includeHiddenElements: true })).toHaveLength(3);
  });

  it.each([
    { kind: 'yet', ghost: 'row', ...copy },
    { kind: 'noMatch', icon: 'search', ...copy },
    { kind: 'notFound', icon: 'inbox', ...copy },
  ] as const)('$kind survives a press held and released on its action', async (props) => {
    await renderState(props);
    const button = screen.getByRole('button', { name: 'New budget' });
    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'noMatch', icon: 'search', ...copy },
    { kind: 'notFound', icon: 'inbox', ...copy },
  ] as const)('$kind draws no stack: nothing is waiting to be created', async (props) => {
    await renderState(props);
    expect(screen.queryAllByTestId('empty-ghost', { includeHiddenElements: true })).toHaveLength(0);
  });
});
