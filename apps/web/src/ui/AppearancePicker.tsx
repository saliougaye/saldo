'use client';

import { categoryColors, type IconName } from '@saldo/ui';
import { type KeyboardEvent, useRef } from 'react';
import styles from './AppearancePicker.module.css';
import { Icon } from './Icon';
import { paletteIndex } from './IconBox';
import { rovingTabStop, rovingTarget } from './rovingRadios';

interface Props {
  colorLabel: string;
  iconLabel: string;
  colorIndex: number;
  icon: string;
  icons: readonly IconName[];
  /** The accessible name of option `index` of `total` in the group called `label` («Colore 3 di 12»). */
  optionLabel: (label: string, index: number, total: number) => string;
  /** A budget has no colour of its own (it follows its first category): its picker offers icons only. */
  showColors?: boolean;
  onChange: (next: { colorIndex: number; icon: string }) => void;
}

/** One tab stop per group; the arrows move the selection and the focus with it (the radio pattern). */
function useRovingRadios(count: number, onSelect: (index: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const next = rovingTarget(event.key, index, count);
    if (next === null) return;
    event.preventDefault();
    onSelect(next);
    refs.current[next]?.focus();
  };
  const ref = (index: number) => (node: HTMLButtonElement | null) => {
    refs.current[index] = node;
  };
  return { onKeyDown, ref };
}

export function AppearancePicker({
  colorLabel,
  iconLabel,
  colorIndex,
  icon,
  icons,
  optionLabel,
  showColors = true,
  onChange,
}: Props) {
  const chosen = paletteIndex(colorIndex);
  // The stored icon may not be among those offered: then the first one takes the group's tab stop.
  const iconStop = rovingTabStop(icons.indexOf(icon as IconName), icons.length);
  const colors = useRovingRadios(categoryColors.length, (index) =>
    onChange({ colorIndex: index, icon }),
  );
  const glyphs = useRovingRadios(icons.length, (index) => {
    const name = icons[index];
    if (name !== undefined) onChange({ colorIndex, icon: name });
  });
  return (
    <div className={styles.picker}>
      {showColors ? (
        <div className={styles.group} role="radiogroup" aria-label={colorLabel}>
          {categoryColors.map((_, index) => (
            // biome-ignore lint/a11y/useSemanticElements: a swatch is drawn as a button; the radio role keeps the group's one tab stop.
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: the palette is a fixed list; the index is its identity.
              key={index}
              ref={colors.ref(index)}
              type="button"
              role="radio"
              aria-checked={index === chosen}
              aria-label={optionLabel(colorLabel, index + 1, categoryColors.length)}
              tabIndex={index === chosen ? 0 : -1}
              className={styles.swatch}
              style={{ background: `var(--category-${index})` }}
              onClick={() => onChange({ colorIndex: index, icon })}
              onKeyDown={(event) => colors.onKeyDown(event, index)}
            />
          ))}
        </div>
      ) : null}
      <div className={styles.group} role="radiogroup" aria-label={iconLabel}>
        {icons.map((name, index) => (
          // biome-ignore lint/a11y/useSemanticElements: as above.
          <button
            key={name}
            ref={glyphs.ref(index)}
            type="button"
            role="radio"
            aria-checked={name === icon}
            aria-label={optionLabel(iconLabel, index + 1, icons.length)}
            tabIndex={index === iconStop ? 0 : -1}
            className={styles.iconButton}
            onClick={() => onChange({ colorIndex, icon: name })}
            onKeyDown={(event) => glyphs.onKeyDown(event, index)}
          >
            <Icon name={name} size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
