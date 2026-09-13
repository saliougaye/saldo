import { act, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus, Text as RNText, View } from 'react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PrivacyOverlay } from './PrivacyOverlay';

let mockAppLockEnabled = 'false';

// Stands in for the SQLite-backed provider: the overlay reads one key out of `kv` and nothing else.
jest.mock('../../db/DatabaseProvider', () => ({
  useDatabase: () => ({
    kv: { get: (key: string) => (key === 'appLockEnabled' ? mockAppLockEnabled : null) },
  }),
}));

type ChangeHandler = (status: AppStateStatus) => void;

/**
 * `AppState` has no way to fake a status change from JS, so the test takes the handler the
 * component registers and calls it — the same thing the native module does.
 */
const handlers: ChangeHandler[] = [];

async function appStateBecomes(status: AppStateStatus): Promise<void> {
  await act(async () => {
    for (const handler of handlers) handler(status);
  });
}

beforeEach(() => {
  handlers.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    const changeHandler = handler as ChangeHandler;
    handlers.push(changeHandler);
    // A real subscription stops firing once removed, and two covers mounted at once mean two
    // subscriptions — a fake that never unsubscribes would hide a leak in either of them.
    return {
      remove: () => {
        const at = handlers.indexOf(changeHandler);
        if (at >= 0) handlers.splice(at, 1);
      },
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function renderOverlay() {
  return render(
    <ThemeProvider preference="dark">
      <PrivacyOverlay />
    </ThemeProvider>,
  );
}

// The cover is decorative and hidden from assistive technology, which is also why the queries
// below have to be told to look at hidden elements to see it at all.
const COVER = { includeHiddenElements: true } as const;

describe('PrivacyOverlay', () => {
  it('covers the screen on the way out, so the app switcher photographs the cover', async () => {
    mockAppLockEnabled = 'true';
    await renderOverlay();

    expect(screen.queryByTestId('privacy-overlay', COVER)).toBeNull();
    await appStateBecomes('inactive');
    expect(screen.getByTestId('privacy-overlay', COVER)).toBeTruthy();
  });

  it('lifts the cover when the app comes back', async () => {
    mockAppLockEnabled = 'true';
    await renderOverlay();

    await appStateBecomes('background');
    expect(screen.getByTestId('privacy-overlay', COVER)).toBeTruthy();
    await appStateBecomes('active');
    expect(screen.queryByTestId('privacy-overlay', COVER)).toBeNull();
  });

  it('covers the screen it is mounted in, so each native window can carry its own', async () => {
    mockAppLockEnabled = 'true';
    await render(
      <ThemeProvider preference="dark">
        <PrivacyOverlay />
        {/* A modal route: its own window, its own content, its own cover over that content. */}
        <View>
          <RNText>1.234,00</RNText>
          <PrivacyOverlay />
        </View>
      </ThemeProvider>,
    );

    await appStateBecomes('inactive');
    // Two instances, one per window — a route that forgets the mount is a route that is
    // photographed, and the root layout's cover does not reach it.
    expect(screen.getAllByTestId('privacy-overlay', COVER)).toHaveLength(2);
    // Drawn *over* the amount rather than instead of it: the form keeps its state while covered.
    expect(screen.getByText('1.234,00')).toBeTruthy();
  });

  it('stays out of the way when the app lock is off', async () => {
    mockAppLockEnabled = 'false';
    await renderOverlay();

    await appStateBecomes('inactive');
    expect(screen.queryByTestId('privacy-overlay', COVER)).toBeNull();
  });
});
