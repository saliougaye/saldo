import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ErrorNote } from './ErrorNote';

it('says what went wrong, with Rocky above it hidden from screen readers', async () => {
  await render(
    <ThemeProvider preference="dark">
      <ErrorNote message="This is not a Saldo backup." />
    </ThemeProvider>,
  );
  expect(screen.getByText('This is not a Saldo backup.')).toBeTruthy();
  expect(screen.getByTestId('mascot-error', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('mascot-error')).toBeNull();
});
