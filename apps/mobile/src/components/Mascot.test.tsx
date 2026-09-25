import { mascot } from '@saldo/ui';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Mascot, MascotCelebrate, MascotPeek } from './Mascot';
import { MASCOT_STATES } from './mascotPlayback';

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

  it.each(MASCOT_STATES)('draws %s, hidden from screen readers', async (state) => {
    await show(<Mascot state={state} size={64} />);
    expect(screen.getByTestId(`mascot-${state}`, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId(`mascot-${state}`)).toBeNull();
  });

  it('peeks, hidden from screen readers', async () => {
    await show(<MascotPeek state="idle" size={mascot.emptySize} window={mascot.emptyWindow} />);
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('mascot-idle', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });

  it('celebrates, hidden from screen readers', async () => {
    await show(<MascotCelebrate size={mascot.celebrateSize} />);
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('mascot-success', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });
});
