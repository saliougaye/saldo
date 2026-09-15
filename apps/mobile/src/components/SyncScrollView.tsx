import { RefreshControl, ScrollView, type ScrollViewProps } from 'react-native';
import { useSyncRefresh } from '../sync/useSyncRefresh';
import { useTheme } from '../theme/ThemeProvider';

/** A `ScrollView` a pull can sync (§8.5); with nothing to sync with, a plain one. */
export function SyncScrollView(props: Omit<ScrollViewProps, 'refreshControl'>) {
  const theme = useTheme();
  const refresh = useSyncRefresh();
  return (
    <ScrollView
      {...props}
      refreshControl={
        refresh === null ? undefined : (
          <RefreshControl
            refreshing={refresh.refreshing}
            onRefresh={refresh.onRefresh}
            tintColor={theme.palette.textMuted}
            colors={[theme.palette.accent]}
            progressBackgroundColor={theme.palette.raised}
          />
        )
      }
    />
  );
}
