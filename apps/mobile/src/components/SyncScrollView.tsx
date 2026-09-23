import { forwardRef, useRef } from 'react';
import { RefreshControl, ScrollView, type ScrollViewProps } from 'react-native';
import { useSyncRefresh } from '../sync/useSyncRefresh';
import { useTheme } from '../theme/ThemeProvider';

/**
 * A `ScrollView` a pull can sync (§8.5); with nothing to sync with, a plain one.
 *
 * Only a pull that starts at the top counts. iOS also fires the refresh when a fast fling carries
 * the content back past the top and bounces it beyond the threshold, which synced every time
 * somebody flicked back up a long list. A drag that begins with the content already at the top is
 * a pull; one that begins further down, and reaches the top by momentum, is not.
 */
export const SyncScrollView = forwardRef<ScrollView, Omit<ScrollViewProps, 'refreshControl'>>(
  function SyncScrollView({ onScrollBeginDrag, ...props }, ref) {
    const theme = useTheme();
    const refresh = useSyncRefresh();
    const startedAtTop = useRef(true);
    return (
      <ScrollView
        ref={ref}
        {...props}
        onScrollBeginDrag={(event) => {
          // A point of slack: the offset at rest can come back as a fraction above zero.
          startedAtTop.current = event.nativeEvent.contentOffset.y <= 1;
          onScrollBeginDrag?.(event);
        }}
        refreshControl={
          refresh === null ? undefined : (
            <RefreshControl
              // Left false when the pull is ignored: RefreshControl re-renders after `onRefresh`,
              // which ends the native spinner the bounce started.
              refreshing={refresh.refreshing}
              onRefresh={() => {
                if (startedAtTop.current) refresh.onRefresh();
              }}
              tintColor={theme.palette.textMuted}
              colors={[theme.palette.accent]}
              progressBackgroundColor={theme.palette.raised}
            />
          )
        }
      />
    );
  },
);
