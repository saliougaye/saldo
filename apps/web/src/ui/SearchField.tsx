'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './SearchField.module.css';
import { TextField } from './TextField';

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
  const [text, setText] = useState(value);
  return (
    <search className={styles.form}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams(keep);
          const query = text.trim();
          if (query !== '') next.set('q', query);
          const params = next.toString();
          router.push(params === '' ? path : `${path}?${params}`);
        }}
      >
        <TextField
          label={label}
          placeholder={placeholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          type="search"
          autoComplete="off"
        />
      </form>
    </search>
  );
}
