import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Screen } from './Screen';

const mockOnRefresh = jest.fn();

// The hook needs the server, sync and toast providers; what `Screen` owes it is only the wiring.
jest.mock('../sync/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: mockOnRefresh }),
}));

/**
 * `useSafeAreaInsets` throws without a provider, and there is none in `jest.setup.js`. These are
 * the metrics of a notched phone, which is the case the padding exists for.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Host({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  mockOnRefresh.mockClear();
});

describe('Screen', () => {
  /**
   * The default is `'never'`, which swallows the first tap on any control while the keyboard is
   * up — a tap paid on every single transaction entry. This is the regression test for that.
   */
  it('delivers taps made while the keyboard is up', async () => {
    await render(
      <Host>
        <Screen>
          <RNText>body</RNText>
        </Screen>
      </Host>,
    );
    expect(screen.getByTestId('screen-scroll').props.keyboardShouldPersistTaps).toBe('handled');
  });

  // A fast fling back up a long list bounces past the top and fired the refresh on its own.
  it('ignores a refresh reached by momentum rather than by a pull from the top', async () => {
    await render(
      <Host>
        <Screen refreshable>
          <RNText>body</RNText>
        </Screen>
      </Host>,
    );
    const scroll = screen.getByTestId('screen-scroll');
    await fireEvent(scroll, 'scrollBeginDrag', {
      nativeEvent: { contentOffset: { x: 0, y: 600 } },
    });
    screen.getByTestId('screen-scroll').props.refreshControl.props.onRefresh();
    expect(mockOnRefresh).not.toHaveBeenCalled();

    await fireEvent(scroll, 'scrollBeginDrag', { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    screen.getByTestId('screen-scroll').props.refreshControl.props.onRefresh();
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });
});
