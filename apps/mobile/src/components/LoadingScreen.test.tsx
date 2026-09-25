import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { LoadingScreen } from './LoadingScreen';

async function show(label?: string) {
  await render(
    <ThemeProvider preference="dark">
      <LoadingScreen label={label} />
    </ThemeProvider>,
  );
}

it('spins, wordless and without Rocky, through a short boot wait', async () => {
  await show();
  expect(screen.getByTestId('loading-spinner')).toBeTruthy();
  expect(screen.queryByTestId('mascot-loading', { includeHiddenElements: true })).toBeNull();
});

it('shows Rocky waiting, and says what for, through a long wait', async () => {
  await show('Downloading your data…');
  expect(screen.getByText('Downloading your data…')).toBeTruthy();
  expect(screen.getByTestId('mascot-loading', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('loading-spinner')).toBeNull();
});
