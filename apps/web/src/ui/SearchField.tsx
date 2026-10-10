'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useNavTransition } from './NavPending';
import styles from './SearchField.module.css';
import { VisuallyHidden } from './VisuallyHidden';

interface Props {
  /** The list this searches. */
  path: string;
  /** What the query must not lose: the filters and the period, already narrowed — never `q`. */
  keep: Record<string, string>;
  value: string;
  label: string;
  placeholder: string;
}

/**
 * The search of §5.12, which lives in the URL like every other filter. It navigates on submit
 * rather than on every keystroke: a Server Component page re-renders on navigation, and a request
 * per character would re-read the whole projection each time.
 *
 * The selected row is dropped on the way, as a chip drops it (`toggleHref`): a row the new query
 * no longer matches would leave the panel showing something the list does not hold.
 */
export function SearchField({ path, keep, value, label, placeholder }: Props) {
  const router = useRouter();
  const startNav = useNavTransition();
  const [text, setText] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  // `/` jumps to the search, as on the phone's keyboard shortcut list (§17.1.7) — unless a field already has the key.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.defaultPrevented || event.metaKey || event.ctrlKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <search className={styles.form}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams(keep);
          const query = text.trim();
          if (query !== '') next.set('q', query);
          const params = next.toString();
          startNav(() => router.push(params === '' ? path : `${path}?${params}`));
        }}
      >
        <label className={styles.field} htmlFor={id}>
          <VisuallyHidden>{label}</VisuallyHidden>
          <Icon name="search" size={16} className={styles.icon} />
          <input
            ref={input}
            id={id}
            className={styles.input}
            placeholder={placeholder}
            value={text}
            onChange={(event) => setText(event.target.value)}
            type="search"
            aria-keyshortcuts="/"
            autoComplete="off"
          />
          <span className={styles.kbd} aria-hidden="true">
            /
          </span>
        </label>
      </form>
    </search>
  );
}
