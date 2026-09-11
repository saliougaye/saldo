import type { LocalDate } from '@saldo/core';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Calendar } from './Calendar';
import { Chip } from './Chip';
import { Sheet } from './Sheet';

export interface DateSheetProps {
  visible: boolean;
  value: LocalDate;
  today: LocalDate;
  /** Picking a day is the whole purpose of the sheet, so it closes itself. */
  onSelect: (date: LocalDate) => void;
  onClose: () => void;
  title?: string;
  maxDate?: LocalDate;
}

/**
 * One day, picked from Saldo's own calendar. The shortcuts are here as well as on the form: most
 * transactions are today or yesterday, and someone who opened the sheet by mistake should not have
 * to find today in the grid to get back out.
 */
export function DateSheet({
  visible,
  value,
  today,
  onSelect,
  onClose,
  title,
  maxDate,
}: DateSheetProps) {
  const { t } = useTranslation();
  const choose = (date: LocalDate) => {
    onSelect(date);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? t('txForm.date')}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip
            label={t('txForm.today')}
            icon="cal"
            active={value === today}
            onPress={() => choose(today)}
          />
        </View>
        <Calendar value={value} today={today} onSelect={choose} maxDate={maxDate} />
      </View>
    </Sheet>
  );
}
