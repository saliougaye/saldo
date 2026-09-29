'use client';

import { Select as BaseSelect } from '@base-ui/react';
import type { IconName } from '@saldo/ui';
import { Icon } from './Icon';
import { paletteIndex } from './IconBox';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  icon?: IconName;
  /** The category palette's index: the icon takes its colour. */
  colorIndex?: number;
  /** Faint, right-aligned: an account's balance, a category's parent. */
  hint?: string;
  /** Options that share a group are listed under its label, in the order the group first appears. */
  group?: string;
}

interface Props {
  label: string;
  value: string | null;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  invalid?: boolean;
  /** Opens on mount: a list the person asked for with a link beside the field («Tutte le categorie»). */
  defaultOpen?: boolean;
  /** Leaves the hint to the list: two selects side by side have no room for it on the trigger. */
  hintInTrigger?: boolean;
}

function OptionIcon({ option }: { option: SelectOption }) {
  if (option.icon === undefined) return null;
  const colour =
    option.colorIndex === undefined
      ? undefined
      : `var(--category-${paletteIndex(option.colorIndex)})`;
  return (
    <span className={styles.icon} style={colour === undefined ? undefined : { color: colour }}>
      <Icon name={option.icon} size={16} />
    </span>
  );
}

/** Consecutive runs would split a group the caller spread out; this keeps one block per group. */
function grouped(options: readonly SelectOption[]) {
  const blocks: { group: string | undefined; options: SelectOption[] }[] = [];
  for (const option of options) {
    const block =
      option.group === undefined ? undefined : blocks.find((entry) => entry.group === option.group);
    if (block === undefined) blocks.push({ group: option.group, options: [option] });
    else block.options.push(option);
  }
  return blocks;
}

/**
 * The mockup's `.input.select` over Base UI's `Select`: the trigger shows the chosen option as the
 * list does (icon, label, hint), the popup is the filter menu's.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  invalid,
  defaultOpen,
  hintInTrigger = true,
}: Props) {
  const selected = options.find((option) => option.value === value);
  const renderItem = (option: SelectOption) => (
    <BaseSelect.Item
      key={option.value}
      value={option.value}
      label={option.label}
      className={styles.item}
    >
      <OptionIcon option={option} />
      <BaseSelect.ItemText className={styles.label}>{option.label}</BaseSelect.ItemText>
      {option.hint === undefined ? null : <span className={styles.hint}>{option.hint}</span>}
      <BaseSelect.ItemIndicator className={styles.check}>
        <Icon name="check" size={14} />
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  );
  return (
    <BaseSelect.Root<string>
      value={value}
      defaultOpen={defaultOpen}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <div className={styles.field}>
        <BaseSelect.Label className={styles.fieldLabel}>{label}</BaseSelect.Label>
        <BaseSelect.Trigger className={styles.trigger} aria-invalid={invalid === true}>
          {selected === undefined ? (
            <span className={`${styles.label} ${styles.placeholder}`}>{placeholder}</span>
          ) : (
            <>
              <OptionIcon option={selected} />
              <span className={styles.label}>{selected.label}</span>
              {selected.hint === undefined || !hintInTrigger ? null : (
                <span className={styles.hint}>{selected.hint}</span>
              )}
            </>
          )}
          <BaseSelect.Icon className={styles.chevron}>
            <Icon name="chevD" size={14} />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
      </div>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={8} align="start" alignItemWithTrigger={false}>
          <BaseSelect.Popup className={styles.popup}>
            <BaseSelect.List>
              {grouped(options).map((block) =>
                block.group === undefined ? (
                  block.options.map(renderItem)
                ) : (
                  <BaseSelect.Group key={block.group} className={styles.group}>
                    <BaseSelect.GroupLabel className={styles.groupLabel}>
                      {block.group}
                    </BaseSelect.GroupLabel>
                    {block.options.map(renderItem)}
                  </BaseSelect.Group>
                ),
              )}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
