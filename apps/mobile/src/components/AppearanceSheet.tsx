import { categoryColors, ICON_NAMES, type IconName } from '@saldo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { Sheet } from './Sheet';
import { TextField } from './TextField';

export interface IconGroup {
  /** Translated through `iconGroups.<key>`; only shown when there is more than one group. */
  key: string;
  icons: readonly IconName[];
}

export interface AppearanceSheetProps {
  visible: boolean;
  onClose: () => void;
  colorIndex: number;
  icon: IconName;
  groups: readonly IconGroup[];
  /** Category icons come from the whole library, so they need a search; account icons do not. */
  searchable?: boolean;
  onChange: (value: { colorIndex: number; icon: IconName }) => void;
}

/**
 * Colour and icon, together, out of the form.
 *
 * Both used to be wrapping grids at the bottom of `AccountForm` and in the *middle* of
 * `CategoryForm`, where the whole icon library sat above the colour, the parent and the budget and
 * buried all three. They are one choice — what the thing looks like — made and closed, which is a
 * sheet by the rule the form-architecture investigation settled on.
 */
export function AppearanceSheet({
  visible,
  onClose,
  colorIndex,
  icon,
  groups,
  searchable = false,
  onChange,
}: AppearanceSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const colour = theme.categoryColor(colorIndex);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!searchable || normalized.length === 0) return null;
    return ICON_NAMES.filter((name) => name.toLowerCase().includes(normalized));
  }, [query, searchable]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('common.appearance')} tall>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {categoryColors.map((swatch, index) => (
          <Pressable
            key={swatch}
            accessibilityRole="button"
            accessibilityState={{ selected: index === colorIndex }}
            accessibilityLabel={swatch}
            // 30pt swatches 8 apart cannot reach 44 without their slop meeting in the gap, so
            // it meets there: a tap between two swatches picks one of them rather than nothing,
            // and picking the wrong colour costs one more tap.
            hitSlop={7}
            onPress={() => onChange({ colorIndex: index, icon })}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: swatch,
              borderWidth: index === colorIndex ? 2 : 0,
              borderColor: theme.palette.text,
            }}
          />
        ))}
      </View>

      {searchable ? (
        <TextField label={t('categories.iconSearch')} value={query} onChangeText={setQuery} />
      ) : null}

      <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
        {results === null ? (
          <View style={{ gap: 12 }}>
            {groups.map((group) => (
              <View key={group.key} style={{ gap: 6 }}>
                {groups.length > 1 ? (
                  <Text size="caption" color="textFaint">
                    {t(`iconGroups.${group.key}`)}
                  </Text>
                ) : null}
                <IconGrid
                  names={group.icons}
                  selected={icon}
                  colour={colour}
                  onSelect={(next) => onChange({ colorIndex, icon: next })}
                />
              </View>
            ))}
          </View>
        ) : (
          <IconGrid
            names={results}
            selected={icon}
            colour={colour}
            onSelect={(next) => onChange({ colorIndex, icon: next })}
          />
        )}
      </ScrollView>
    </Sheet>
  );
}

function IconGrid({
  names,
  selected,
  colour,
  onSelect,
}: {
  names: readonly IconName[];
  selected: IconName;
  colour: string;
  onSelect: (name: IconName) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {names.map((name) => {
        const isSelected = name === selected;
        return (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={name}
            // 36pt tiles, 6 apart: 4 each way, on the same reasoning as the swatches above.
            hitSlop={4}
            onPress={() => onSelect(name)}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.iconBox,
              backgroundColor: isSelected ? theme.tint(colour, 0.18) : theme.palette.raised,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Icon name={name} size={18} color={isSelected ? colour : theme.palette.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}
