import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { MascotCelebrate, MascotPeek } from './Mascot';

// Reduce Motion is read through `useMotion`; mocking it there keeps Reanimated itself untouched.
const mockMotion = { reduced: false };
jest.mock('../theme/motion', () => ({
  ...jest.requireActual('../theme/motion'),
  useMotion: () => ({ reduced: mockMotion.reduced, duration: (ms: number) => ms }),
}));

async function show(node: React.ReactElement) {
  await render(<ThemeProvider preference="dark">{node}</ThemeProvider>);
}

describe.each([false, true])('with Reduce Motion %s', (isReduced) => {
  beforeEach(() => {
    mockMotion.reduced = isReduced;
  });

  it('peeks, hidden from screen readers', async () => {
    await show(<MascotPeek pose="idle" size={104} window={60} />);
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });

  it('celebrates, hidden from screen readers', async () => {
    await show(<MascotCelebrate size={136} />);
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });
});
