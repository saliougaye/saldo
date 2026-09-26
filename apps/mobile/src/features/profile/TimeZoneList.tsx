import { groupTimeZones } from '@saldo/core';
import { formatWallTime, TIME_ZONES, timeZoneCity, timeZoneName, wallClock } from '@saldo/i18n';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { SectionDivider } from '../../components/SectionDivider';
import { TextField } from '../../components/TextField';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { OptionRow } from './SettingScreen';

export interface TimeZoneListProps {
  /** The zone in the synced settings; null only on a phone the backfill has not reached yet. */
  saved: string | null;
  /** The zone the phone runs in now. */
  device: string;
  /** Captured once by the screen: the times are read when it opens, not ticked. */
  now: Date;
  onSelect: (zone: string) => void;
}

/**
 * §6.8 Fuso orario, mockup variant «Viaggio + ora». The saved zone on top, and the phone's under it
 * when they differ, with a notice: travelling is the one moment when the web and the phone disagree
 * about today (D37). Each row shows the local time, not the GMT offset — people look for «where it
 * is 10:45», not for «GMT−4».
 */
export function TimeZoneList({ saved, device, now, onSelect }: TimeZoneListProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useAppLocale();
  const [query, setQuery] = useState('');

  const zones = useMemo(
    () =>
      [...TIME_ZONES].sort((a, b) =>
        timeZoneCity(a, locale).localeCompare(timeZoneCity(b, locale), locale),
      ),
    [locale],
  );
  const labelsOf = (zone: string) => [timeZoneCity(zone, locale), timeZoneName(zone, locale) ?? ''];
  const groups = groupTimeZones({ query, saved, device, zones, labelsOf });
  const time = (zone: string) => {
    const clock = wallClock(zone, now);
    return clock === null ? undefined : formatWallTime(clock);
  };
  const current = saved ?? device;
  const away = current !== device;

  const rows = (list: string[]) => (
    <Card padded={false}>
      <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
        {list.map((zone) => (
          <OptionRow
            key={zone}
            label={timeZoneCity(zone, locale)}
            subtitle={timeZoneName(zone, locale)}
            detail={time(zone)}
            selected={zone === current}
            onPress={() => onSelect(zone)}
          />
        ))}
      </View>
    </Card>
  );

  return (
    <>
      {away ? (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <IconBox name="plane" colour={theme.palette.textMuted} small />
            <Text style={{ flex: 1 }}>
              {t('timeZone.notice', {
                city: timeZoneCity(device, locale),
                time: time(device) ?? '',
                saved: timeZoneCity(current, locale),
              })}
            </Text>
          </View>
          <PrimaryButton
            label={t('timeZone.use', { city: timeZoneCity(device, locale) })}
            onPress={() => onSelect(device)}
          />
        </Card>
      ) : null}
      <TextField
        label={t('timeZone.search')}
        placeholder={t('timeZone.search')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      {groups.top.length > 0 ? (
        <>
          <SectionDivider label={t(away ? 'timeZone.currentAndPhone' : 'timeZone.current')} />
          {rows(groups.top)}
        </>
      ) : null}
      {groups.all.length > 0 ? (
        <>
          <SectionDivider label={t('timeZone.all')} />
          {rows(groups.all)}
        </>
      ) : null}
      {groups.top.length === 0 && groups.all.length === 0 ? (
        <Text color="textMuted">{t('timeZone.noResults')}</Text>
      ) : null}
    </>
  );
}
