import { render, screen } from '@testing-library/react-native';
import { Text as RNText, StyleSheet } from 'react-native';
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

  // The fade is decorative, so it is hidden from assistive technology — which is also why the
  // queries below have to be told to look at hidden elements to see it at all.
  const FADE = { includeHiddenElements: true } as const;

  it('fades the content into the footer it draws over it', async () => {
    await render(
      <Host>
        <Screen footer={<RNText>save</RNText>}>
          <RNText>body</RNText>
        </Screen>
      </Host>,
    );
    expect(screen.getByText('save')).toBeTruthy();
    expect(screen.getByTestId('screen-scroll-fade', FADE)).toBeTruthy();
  });

  it('draws no fade on a screen with no footer, which has nothing to hide behind', async () => {
    await render(
      <Host>
        <Screen>
          <RNText>body</RNText>
        </Screen>
      </Host>,
    );
    expect(screen.queryByTestId('screen-scroll-fade', FADE)).toBeNull();
  });

  it('lets a refreshable screen be pulled to sync', async () => {
    await render(
      <Host>
        <Screen refreshable>
          <RNText>body</RNText>
        </Screen>
      </Host>,
    );
    const control = screen.getByTestId('screen-scroll').props.refreshControl;
    expect(control.props.onRefresh).toBe(mockOnRefresh);
  });

  // A spinner is drawn at the top of the scroll view's frame; with the inset inside the content it
  // spun under the status bar, and a pull looked like it did nothing.
  it('keeps the scroll view below the status bar, where a pull can be seen', async () => {
    await render(
      <Host>
        <Screen refreshable>
          <RNText>body</RNText>
        </Screen>
      </Host>,
    );
    const scroll = screen.getByTestId('screen-scroll');
    expect(StyleSheet.flatten(scroll.props.style).marginTop).toBe(METRICS.insets.top + 8);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingTop).toBeUndefined();
  });

  // Transactions scrolls as a whole, so a pull anywhere syncs, and keeps its search pinned.
  it('pins the children it is told to', async () => {
    await render(
      <Host>
        <Screen refreshable stickyHeaderIndices={[1]}>
          <RNText>header</RNText>
          <RNText>search</RNText>
        </Screen>
      </Host>,
    );
    expect(screen.getByTestId('screen-scroll').props.stickyHeaderIndices).toEqual([1]);
  });

  it('offers no pull on any other screen: a sheet already closes on that gesture', async () => {
    await render(
      <Host>
        <Screen>
          <RNText>body</RNText>
        </Screen>
      </Host>,
    );
    expect(screen.getByTestId('screen-scroll').props.refreshControl).toBeUndefined();
  });
});
