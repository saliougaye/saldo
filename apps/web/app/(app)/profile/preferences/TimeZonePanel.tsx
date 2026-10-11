'use client';

import { groupTimeZones } from '@saldo/core';
import type { AppLocale } from '@saldo/i18n/format';
import { useEffect, useMemo, useState } from 'react';
import { listedZone } from '../../../../src/features/profile/deviceZone';
import { timeZoneRows, zoneTimes } from '../../../../src/features/profile/timeZoneRows';
import { useMinute } from '../../../../src/features/profile/useMinute';
import { Alert } from '../../../../src/ui/Alert';
import { type ListOption, OptionList } from '../../../../src/ui/OptionList';
import { TextField } from '../../../../src/ui/TextField';
import styles from './preferences.module.css';
import { useSaveSetting } from './useSaveSetting';

interface Props {
  /** The zone in the synced settings, under the id the list holds; null if none is stored yet. */
  saved: string | null;
  /** The app's language: the cities, the names of the zones and their order. */
  locale: AppLocale;
  /** The minute of the server's render (`minuteOf`): the hours of the HTML, and of the hydration. */
  renderedAt: number;
  strings: {
    title: string;
    note: string;
    search: string;
    current: string;
    /** The top group's name when this device is somewhere else than the saved zone. */
    currentAndDevice: string;
    all: string;
    noResults: string;
  };
}

/**
 * §6.8 Fuso orario (D37), as the phone's `TimeZoneList`: the saved zone on top, and this device's
 * under it when they differ — travelling must not bury it under «R» — then every zone, searchable
 * by city, zone name or id. Saved as it is chosen; the server computes «today» with it.
 *
 * The list is the browser's: the zones and their names are static tables, and the hour in each
 * zone is this browser's, new at each minute while the panel is open. The page sends no list, so
 * the panel opens in place like the other preferences.
 */
export function TimeZonePanel({ saved, locale, renderedAt, strings }: Props) {
  const { shown, error, save } = useSaveSetting(saved);
  const [query, setQuery] = useState('');
  const zones = useMemo(() => timeZoneRows(locale, saved), [locale, saved]);
  const ids = useMemo(() => zones.map((row) => row.zone), [zones]);
  const byZone = useMemo(() => new Map(zones.map((row) => [row.zone, row])), [zones]);
  const minute = useMinute(renderedAt);
  const times = useMemo(() => zoneTimes(ids, new Date(minute * 60_000)), [ids, minute]);

  // The browser's zone is only known here, after the mount: the server renders for any browser.
  const [device, setDevice] = useState<string | null>(null);
  useEffect(() => {
    const reported = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDevice(listedZone(reported, new Set(ids)));
  }, [ids]);

  const current = shown ?? device;
  const away = device !== null && current !== null && current !== device;
  const groups = useMemo(() => {
    const labelsOf = (zone: string) => [byZone.get(zone)?.city ?? '', byZone.get(zone)?.name ?? ''];
    if (current === null) {
      // Neither a saved zone nor one the browser names: the plain list.
      const found = groupTimeZones({ query, saved: null, device: '', zones: ids, labelsOf });
      return { top: [], all: found.all };
    }
    return groupTimeZones({
      query,
      saved: current,
      device: device ?? current,
      zones: ids,
      labelsOf,
    });
  }, [query, current, device, ids, byZone]);

  const rows = (list: readonly string[]): ListOption<string>[] =>
    list.map((zone) => ({
      value: zone,
      label: byZone.get(zone)?.city ?? zone,
      subtitle: byZone.get(zone)?.name,
      detail: times.get(zone),
    }));

  return (
    <>
      <p className={styles.note}>{strings.note}</p>
      <TextField
        label={strings.search}
        placeholder={strings.search}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {error === null ? null : <Alert body={error} />}
      {groups.top.length === 0 && groups.all.length === 0 ? (
        <p className={styles.note}>{strings.noResults}</p>
      ) : null}
      <OptionList
        label={strings.title}
        groups={[
          { label: away ? strings.currentAndDevice : strings.current, options: rows(groups.top) },
          { label: strings.all, options: rows(groups.all) },
        ]}
        selected={current}
        onSelect={(zone) => {
          // The device's zone shows selected while none is stored: choosing it is what stores it.
          if (zone !== shown) save({ key: 'timeZone', value: zone }, zone);
        }}
      />
    </>
  );
}
