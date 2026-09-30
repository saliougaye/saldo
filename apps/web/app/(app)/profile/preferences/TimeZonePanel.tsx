'use client';

import { groupTimeZones } from '@saldo/core';
import { useEffect, useMemo, useState } from 'react';
import { listedZone } from '../../../../src/features/profile/deviceZone';
import type { ZoneOption } from '../../../../src/features/profile/preferenceOptions';
import { Alert } from '../../../../src/ui/Alert';
import { type ListOption, OptionList } from '../../../../src/ui/OptionList';
import { TextField } from '../../../../src/ui/TextField';
import styles from './preferences.module.css';
import { type SettingErrors, useSaveSetting } from './useSaveSetting';

interface Props {
  /** The zone in the synced settings, under the id the list holds; null if none is stored yet. */
  saved: string | null;
  /** Every zone, sorted by city in the app's language, with the hour there when the page rendered. */
  zones: readonly ZoneOption[];
  /** A current IANA name → the id `zones` lists it under, for the zone this browser reports. */
  aliases: Readonly<Record<string, string>>;
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
  errors: SettingErrors;
}

/**
 * §6.8 Fuso orario (D37), as the phone's `TimeZoneList`: the saved zone on top, and this device's
 * under it when they differ — travelling must not bury it under «R» — then every zone, searchable
 * by city, zone name or id. Saved as it is chosen; the server computes «today» with it.
 */
export function TimeZonePanel({ saved, zones, aliases, strings, errors }: Props) {
  const { shown, error, save } = useSaveSetting(saved, errors);
  const [query, setQuery] = useState('');
  const byZone = useMemo(() => new Map(zones.map((option) => [option.zone, option])), [zones]);

  // The browser's zone is only known here, after the mount: the server renders for any browser.
  const [device, setDevice] = useState<string | null>(null);
  useEffect(() => {
    const reported = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDevice(listedZone(reported, aliases, new Set(zones.map((option) => option.zone))));
  }, [aliases, zones]);

  const current = shown ?? device;
  const away = device !== null && current !== null && current !== device;
  const groups = useMemo(() => {
    if (current === null) {
      // Neither a saved zone nor one the browser names: the plain list.
      const found = groupTimeZones({
        query,
        saved: null,
        device: '',
        zones: zones.map((option) => option.zone),
        labelsOf: (zone) => [byZone.get(zone)?.city ?? '', byZone.get(zone)?.name ?? ''],
      });
      return { top: [], all: found.all };
    }
    return groupTimeZones({
      query,
      saved: current,
      device: device ?? current,
      zones: zones.map((option) => option.zone),
      labelsOf: (zone) => [byZone.get(zone)?.city ?? '', byZone.get(zone)?.name ?? ''],
    });
  }, [query, current, device, zones, byZone]);

  const rows = (list: readonly string[]): ListOption<string>[] =>
    list.map((zone) => ({
      value: zone,
      label: byZone.get(zone)?.city ?? zone,
      subtitle: byZone.get(zone)?.name,
      detail: byZone.get(zone)?.time,
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
