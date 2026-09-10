import type { IconName } from '@saldo/ui';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

const ICONS: Record<string, IconName> = {
  index: 'house',
  transactions: 'list',
  stats: 'trend',
  accounts: 'wallet',
};

/**
 * Only what the tab bar reads. expo-router 57 vendors its own copy of the react-navigation types,
 * so importing `BottomTabBarProps` from `@react-navigation/bottom-tabs` gives a second, subtly
 * different type; a structural type keeps this component independent of either.
 */
export interface TabBarProps {
  state: { index: number; routes: readonly { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
  onFabPress: () => void;
  /** Route name to visible label. The layout owns the i18n keys, so this stays decoupled. */
  label: (routeName: string) => string;
  fabLabel: string;
}

/**
 * Custom tab bar of §6.14: height 78 plus the bottom inset, with the FAB raised 16px over the
 * middle. The FAB is part of the bar so it keeps its place on every tab.
 */
export function TabBar({ state, navigation, onFabPress, label, fabLabel }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const half = Math.ceil(state.routes.length / 2);

  const renderTab = (route: { key: string; name: string }, index: number) => {
    const focused = state.index === index;
    const icon = ICONS[route.name] ?? 'list';
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => navigation.navigate(route.name)}
        style={{ flex: 1, alignItems: 'center', gap: 5, paddingTop: 12 }}
      >
        <Icon
          name={icon}
          size={20}
          color={focused ? theme.palette.text : theme.palette.textFaint}
        />
        <Text size="caption" color={focused ? 'text' : 'textFaint'}>
          {label(route.name)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        height: theme.layout.tabBarHeight + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: theme.palette.bg,
        borderTopWidth: 1,
        borderTopColor: theme.palette.border,
      }}
    >
      {state.routes.slice(0, half).map(renderTab)}
      <View style={{ width: theme.layout.fabSize + 16, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fabLabel}
          onPress={onFabPress}
          style={{
            position: 'absolute',
            top: -theme.layout.fabLift,
            width: theme.layout.fabSize,
            height: theme.layout.fabSize,
            borderRadius: theme.radii.fab,
            backgroundColor: theme.palette.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={24} color={theme.palette.onAccent} />
        </Pressable>
      </View>
      {state.routes.slice(half).map((route, index) => renderTab(route, index + half))}
    </View>
  );
}
