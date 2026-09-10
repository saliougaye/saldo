import { PERIOD_KINDS, type PeriodKind } from '@saldo/core';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../theme/Icon';
import { useTheme } from '../../theme/ThemeProvider';

/** §5.2: how the user tracks spending. The pay cycle is the only kind that asks a second question. */
export function PeriodKindSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: PeriodKind;
  onSelect: (kind: PeriodKind) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('period.kind')}>
      <View>
        {PERIOD_KINDS.map((kind) => (
          <ListRow
            key={kind}
            title={t(`period.kind_${kind}`)}
            subtitle={t(`period.kindBody_${kind}`)}
            trailing={
              kind === selected ? (
                <Icon name="check" size={18} color={theme.palette.accent} />
              ) : undefined
            }
            onPress={() => {
              onSelect(kind);
              onClose();
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
