import {
  endDateAfterCount,
  type LocalDate,
  nthOccurrence,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from '@saldo/core';
import { cadenceLabel, formatDayMonth } from '@saldo/i18n';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { CountStepper } from '../../components/CountStepper';
import { DateSheet } from '../../components/DateSheet';
import { ListRow } from '../../components/ListRow';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { presetOf, type RecurrencePreset, ruleForPreset } from './recurrenceCopy';

export interface RecurrenceSheetProps {
  visible: boolean;
  onClose: () => void;
  value: RecurrenceRule | null;
  /** The transaction's date: the anchor every label and preview is computed from (§5.9). */
  startDate: LocalDate;
  today: LocalDate;
  /** Every tap reports the whole rule; the sheet keeps no draft the form does not see. */
  onChange: (rule: RecurrenceRule | null) => void;
  /**
   * The date "dopo N volte" and the preview count from, when it is not `startDate`. The recurrence
   * detail passes the first date a *new* cadence fires after today (§5.9), so ten times means ten
   * times in the series that will exist, not ten from an anchor that series never sees.
   */
  anchorFor?: (rule: RecurrenceRule) => LocalDate;
}

const PRESETS: readonly Exclude<RecurrencePreset, 'custom'>[] = [
  'never',
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
];
const PRESET_KEYS: Record<Exclude<RecurrencePreset, 'custom'>, string> = {
  never: 'recurrence.never',
  weekly: 'recurrence.everyWeek',
  biweekly: 'recurrence.everyTwoWeeks',
  monthly: 'recurrence.everyMonth',
  yearly: 'recurrence.everyYear',
};
const UNITS: readonly RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const DEFAULT_TIMES = 12;
const MAX_INTERVAL = 99;
const MAX_TIMES = 365;
/** What "Personalizzato" opens on when nothing was set: the first thing the presets cannot say. */
const CUSTOM_START: RecurrenceRule = { frequency: 'monthly', interval: 2, endDate: null };

type EndMode = 'never' | 'date' | 'count';

/**
 * §6.16 "Ripeti": the presets a chip cannot hold, "Personalizzato" and the end. It edits the rule
 * in place, so closing it never loses anything; "Fatto" is only a way to close.
 */
export function RecurrenceSheet({
  visible,
  onClose,
  value,
  startDate,
  today,
  onChange,
  anchorFor,
}: RecurrenceSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const preset = presetOf(value);
  // "Personalizzato" stays open once chosen, even while its values happen to match a preset.
  const [customOpen, setCustomOpen] = useState(preset === 'custom');
  const [endMode, setEndMode] = useState<EndMode>(value?.endDate == null ? 'never' : 'date');
  const [times, setTimes] = useState(DEFAULT_TIMES);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  // The detail screen mounts this sheet with no rule and hands it one when it opens, so the two
  // states derived from the rule are re-read at that moment rather than only at mount. Only on
  // opening: while it is open, the user's taps are what these two follow.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read the rule when the sheet opens, not on every change
  useEffect(() => {
    if (!visible) return;
    setCustomOpen(presetOf(value) === 'custom');
    setEndMode(value?.endDate == null ? 'never' : 'date');
  }, [visible]);

  const custom = customOpen || preset === 'custom';

  const anchor = (rule: RecurrenceRule): LocalDate => anchorFor?.(rule) ?? startDate;
  const withEnd = (rule: RecurrenceRule, mode: EndMode, count: number): RecurrenceRule => {
    const from = { ...rule, startDate: anchor(rule) };
    return {
      ...rule,
      endDate:
        mode === 'never'
          ? null
          : mode === 'count'
            ? endDateAfterCount(from, count)
            : (rule.endDate ?? endDateAfterCount(from, count)),
    };
  };

  const pickPreset = (next: Exclude<RecurrencePreset, 'custom'>) => {
    setCustomOpen(false);
    const rule = ruleForPreset(next, value?.endDate ?? null);
    onChange(rule === null ? null : withEnd(rule, endMode, times));
  };
  const openCustom = () => {
    setCustomOpen(true);
    if (value === null) onChange(withEnd(CUSTOM_START, endMode, times));
  };
  const setInterval = (interval: number) => {
    if (value !== null) onChange(withEnd({ ...value, interval }, endMode, times));
  };
  const setUnit = (frequency: RecurrenceFrequency) => {
    if (value !== null) onChange(withEnd({ ...value, frequency }, endMode, times));
  };
  const pickEnd = (mode: EndMode) => {
    setEndMode(mode);
    if (value !== null) onChange(withEnd(value, mode, times));
  };
  const pickTimes = (count: number) => {
    setTimes(count);
    if (value !== null) onChange(withEnd(value, 'count', count));
  };

  const preview =
    value === null
      ? null
      : [1, 2, 3]
          .map((k) =>
            formatDayMonth(nthOccurrence({ ...value, startDate: anchor(value) }, k), locale),
          )
          .join(', ');
  const check = <Icon name="check" size={16} color={theme.palette.text} />;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('txForm.repeat')} tall>
      <View style={{ gap: 14 }}>
        <View
          style={{
            backgroundColor: theme.palette.raised,
            borderRadius: theme.radii.card,
            paddingHorizontal: 14,
          }}
        >
          {PRESETS.map((row) => {
            const rule = ruleForPreset(row, null);
            const selected = !custom && preset === row;
            return (
              <ListRow
                key={row}
                testID={`recurrence-preset-${row}`}
                title={t(PRESET_KEYS[row])}
                subtitle={rule === null ? undefined : cadenceLabel(rule, startDate, t, locale)}
                selected={selected}
                onPress={() => pickPreset(row)}
                trailing={selected ? check : undefined}
              />
            );
          })}
          <ListRow
            testID="recurrence-preset-custom"
            title={t('recurrence.custom')}
            subtitle={
              custom && value !== null
                ? cadenceLabel(value, startDate, t, locale)
                : t('recurrence.customHint')
            }
            selected={custom}
            onPress={openCustom}
            trailing={custom ? check : undefined}
          />
        </View>

        {custom && value !== null ? (
          <View
            style={{
              backgroundColor: theme.palette.raised,
              borderRadius: theme.radii.card,
              padding: theme.layout.cardPadding,
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text>{t('recurrence.every')}</Text>
              <CountStepper
                value={value.interval}
                min={1}
                max={MAX_INTERVAL}
                onChange={setInterval}
                accessibilityLabel={t('recurrence.every')}
                decrementLabel={t('common.decrement')}
                incrementLabel={t('common.increment')}
              />
            </View>
            <Segmented
              options={UNITS.map((unit) => ({ value: unit, label: t(`recurrence.unit_${unit}`) }))}
              value={value.frequency}
              onChange={setUnit}
              accessibilityLabel={t('recurrence.cadence')}
            />
            {preview === null ? null : (
              <Text size="caption" color="textFaint">
                {cadenceLabel(value, startDate, t, locale)} ·{' '}
                {t('recurrence.nextDates', { dates: preview })}
              </Text>
            )}
          </View>
        ) : null}

        {value === null ? null : (
          <View style={{ gap: 8 }}>
            <Text size="footnote" color="textMuted">
              {t('recurrence.end')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Chip
                label={t('recurrence.endNever')}
                active={endMode === 'never'}
                onPress={() => pickEnd('never')}
              />
              <Chip
                label={t('recurrence.endOnDate')}
                icon="cal"
                active={endMode === 'date'}
                onPress={() => {
                  pickEnd('date');
                  setEndPickerOpen(true);
                }}
              />
              <Chip
                label={t('recurrence.endAfterCount')}
                active={endMode === 'count'}
                onPress={() => pickEnd('count')}
              />
            </View>
            {endMode === 'date' && value.endDate !== null ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text size="footnote" color="textMuted">
                  {t('recurrence.lastOccurrence')}
                </Text>
                <Chip
                  label={formatDayMonth(value.endDate, locale)}
                  icon="cal"
                  chevron
                  onPress={() => setEndPickerOpen(true)}
                />
              </View>
            ) : null}
            {endMode === 'count' ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text size="footnote" color="textMuted">
                  {t('recurrence.times')}
                </Text>
                <CountStepper
                  value={times}
                  min={1}
                  max={MAX_TIMES}
                  onChange={pickTimes}
                  accessibilityLabel={t('recurrence.times')}
                  decrementLabel={t('common.decrement')}
                  incrementLabel={t('common.increment')}
                />
              </View>
            ) : null}
          </View>
        )}

        <PrimaryButton label={t('common.done')} onPress={onClose} />
      </View>

      <DateSheet
        visible={endPickerOpen}
        value={value?.endDate ?? startDate}
        today={today}
        title={t('recurrence.lastOccurrence')}
        onSelect={(date) => {
          if (value !== null) onChange({ ...value, endDate: date < startDate ? startDate : date });
        }}
        onClose={() => setEndPickerOpen(false)}
      />
    </Sheet>
  );
}
