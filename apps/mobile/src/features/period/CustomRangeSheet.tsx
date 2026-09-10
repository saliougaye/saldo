import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateRange, LocalDate } from '@saldo/core';
import { formatLongDate } from '@saldo/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton } from '../../components/Button';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';

/** `YYYY-MM-DD` from a picker date, in the device's own calendar day (§3.2). */
function toLocalDate(date: Date): LocalDate {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as LocalDate;
}

function toPickerDate(value: LocalDate): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
}

/** §6.15 "Periodo personalizzato": any range the user wants, not just a whole period. */
export function CustomRangeSheet({
  visible,
  initial,
  onApply,
  onClose,
}: {
  visible: boolean;
  initial: DateRange;
  onApply: (range: DateRange) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const [start, setStart] = useState<LocalDate>(initial.start);
  const [end, setEnd] = useState<LocalDate>(initial.end);
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);

  // The end can never precede the start; moving the start drags the end along.
  const valid = start <= end;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('period.custom')}>
      <View style={{ gap: 4 }}>
        <ListRow
          title={t('period.customFrom')}
          trailing={<Text color="textMuted">{formatLongDate(start, locale)}</Text>}
          onPress={() => setEditing('start')}
        />
        <ListRow
          title={t('period.customTo')}
          trailing={<Text color="textMuted">{formatLongDate(end, locale)}</Text>}
          onPress={() => setEditing('end')}
        />
        {editing === null ? null : (
          <Pressable onPress={() => setEditing(null)}>
            <DateTimePicker
              value={toPickerDate(editing === 'start' ? start : end)}
              mode="date"
              display="inline"
              onChange={(_event, picked) => {
                if (picked === undefined) return;
                const value = toLocalDate(picked);
                if (editing === 'start') {
                  setStart(value);
                  if (value > end) setEnd(value);
                } else {
                  setEnd(value);
                }
              }}
            />
          </Pressable>
        )}
        <View style={{ marginTop: 8 }}>
          <PrimaryButton
            label={t('common.done')}
            disabled={!valid}
            onPress={() => {
              onApply({ start, end });
              onClose();
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}
