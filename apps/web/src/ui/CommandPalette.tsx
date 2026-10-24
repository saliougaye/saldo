'use client';

import { Autocomplete } from '@base-ui/react/autocomplete';
import { Dialog } from '@base-ui/react/dialog';
import { MAX_SEARCH_QUERY, rankSearch, SEARCH_GROUP_LIMIT } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { PaletteCommand, PaletteCommands } from '../features/search/commands';
import type { SearchResult } from '../features/search/searchView';
import styles from './CommandPalette.module.css';
import { Icon } from './Icon';
import { useNavTransition } from './NavPending';
import { NEW_TRANSACTION_HREF, openNewTransaction } from './NewTransactionLink';
import { VisuallyHidden } from './VisuallyHidden';

interface Row {
  id: string;
  title: string;
  detail: string | null;
  figure: string | null;
  icon: string;
  href: string;
}

interface Group {
  value: string;
  label: string;
  items: Row[];
  /** Rows of an older query, kept on screen while the new one runs (§05), but not to be opened. */
  stale?: boolean;
}

interface Props {
  commands: PaletteCommands;
  /** `searchAction`, handed down by the layout: `src/ui` does not import from `app/`. */
  search: (query: string) => Promise<SearchResult>;
  /** The platform from the request's `User-Agent`: `⌘K` on Apple systems, `Ctrl K` elsewhere. */
  apple: boolean;
  strings: {
    button: string;
    title: string;
    placeholder: string;
    actions: string;
    goTo: string;
    searching: string;
    error: string;
    noResultsHint: string;
    move: string;
    open: string;
    close: string;
  };
}

/** Palette spec §05: a request 150ms after the last key, not one per character. */
const DEBOUNCE_MS = 150;

/**
 * What owns the keyboard while it is open (palette spec §02): a confirmation, another dialog, the
 * transaction form. A `Panel` (`data-panel`) does not: the palette opens over a detail.
 */
const OTHER_OWNER =
  '[role="dialog"]:not([data-panel]):not([data-palette]), [role="alertdialog"], form[data-owns-keys]';

function otherOwnerOpen(): boolean {
  for (const owner of document.querySelectorAll(OTHER_OWNER)) {
    if (owner.getClientRects().length > 0) return true;
  }
  return false;
}

function commandRow(command: PaletteCommand): Row {
  return {
    id: `command:${command.id}`,
    title: command.label,
    detail: null,
    figure: null,
    icon: command.icon,
    href: command.href,
  };
}

/**
 * The command palette (spec 2026-10-23): the top bar's «Search» and `⌘K` / `Ctrl K` on every page.
 * Base UI's `Autocomplete`, inline in a `Dialog`, is the combobox and the listbox; the browser ranks
 * the commands, and `search` ranks the user's data on the server.
 */
export function CommandPalette({ commands, search, apple, strings }: Props) {
  const router = useRouter();
  const startNav = useNavTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  /** The query typed now: an answer to any other one is dropped. */
  const latest = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Set when a row is chosen: the page or the form takes the focus, not the trigger. */
  const leaving = useRef(false);

  const reset = () => {
    clearTimeout(timer.current);
    latest.current = '';
    setQuery('');
    setResult(null);
    setPending(false);
    setFailed(false);
  };

  const changeOpen = (next: boolean) => {
    if (next) leaving.current = false;
    else reset();
    setOpen(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;
      // A held ⌘K repeats the event: it must not open and close the palette over and over.
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      if (!open && otherOwnerOpen()) return;
      event.preventDefault();
      if (open) reset();
      else leaving.current = false;
      setOpen(!open);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  const onQuery = (next: string) => {
    setQuery(next);
    latest.current = next;
    clearTimeout(timer.current);
    if (next.trim() === '') {
      setResult(null);
      setPending(false);
      setFailed(false);
      return;
    }
    setPending(true);
    timer.current = setTimeout(() => {
      search(next).then(
        (answer) => {
          if (latest.current !== next) return;
          setResult(answer);
          setPending(false);
          setFailed(false);
        },
        () => {
          if (latest.current !== next) return;
          setPending(false);
          setFailed(true);
        },
      );
    }, DEBOUNCE_MS);
  };

  const go = (href: string) => {
    leaving.current = true;
    changeOpen(false);
    if (href === NEW_TRANSACTION_HREF && openNewTransaction(true)) return;
    startNav(() => router.push(href));
  };

  const text = query.trim();
  const rankCommands = (list: PaletteCommand[]) =>
    text === ''
      ? list.filter((command) => command.primary)
      : rankSearch(
          text,
          list.map((command) => ({ value: command, text: command.label })),
          { limit: SEARCH_GROUP_LIMIT },
        );
  const current = result !== null && result.query === text ? result : null;
  const groups: Group[] = [
    {
      value: 'actions',
      label: strings.actions,
      items: rankCommands(commands.actions).map(commandRow),
    },
    { value: 'pages', label: strings.goTo, items: rankCommands(commands.pages).map(commandRow) },
    ...(text === '' || result === null
      ? []
      : result.groups.map((group) => ({
          value: group.key,
          label: group.label,
          items: group.hits.map((hit) => ({ ...hit, id: `${group.key}:${hit.id}` })),
          stale: current === null || failed,
        }))),
  ].filter((group) => group.items.length > 0);
  const nothing = current !== null && !pending && groups.length === 0;
  if (current !== null) {
    groups.push({
      value: 'all',
      label: '',
      items: [
        {
          id: 'all',
          title: current.seeAll.label,
          detail: null,
          figure: null,
          icon: 'search',
          href: current.seeAll.href,
        },
      ],
    });
  }
  const status = failed
    ? strings.error
    : pending
      ? strings.searching
      : nothing && current !== null
        ? current.noMatch
        : '';

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger className={styles.trigger} aria-keyshortcuts="Meta+K Control+K">
        <Icon name="search" size={16} />
        <span>{strings.button}</span>
        <span className={styles.kbd} aria-hidden="true">
          {apple ? '⌘K' : 'Ctrl K'}
        </span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup
          className={styles.popup}
          aria-label={strings.title}
          data-palette=""
          initialFocus={input}
          finalFocus={() => !leaving.current}
        >
          <Autocomplete.Root
            open
            inline
            items={groups}
            value={query}
            onValueChange={(next, details) => {
              if (details.reason === 'input-change' || details.reason === 'input-clear')
                onQuery(next);
            }}
            filter={null}
            autoHighlight="always"
            keepHighlight
            itemToStringValue={(row: Row) => row.title}
          >
            <div className={styles.head}>
              <Icon name="search" size={16} className={styles.headIcon} />
              <Autocomplete.Input
                ref={input}
                className={styles.input}
                // The server reads no more than this: a longer text would never match its answer.
                maxLength={MAX_SEARCH_QUERY}
                placeholder={strings.placeholder}
                aria-label={strings.title}
              />
              {pending ? (
                <span className={styles.pending} aria-hidden="true">
                  {strings.searching}
                </span>
              ) : null}
              <Dialog.Close className={styles.close} aria-label={strings.close}>
                <kbd className={styles.kbd}>Esc</kbd>
              </Dialog.Close>
            </div>
            <div className={styles.body}>
              <Autocomplete.Status>
                <VisuallyHidden>{status}</VisuallyHidden>
              </Autocomplete.Status>
              {nothing && current !== null ? (
                <div className={styles.message}>
                  <p className={styles.messageTitle}>{current.noMatch}</p>
                  <p className={styles.messageHint}>{strings.noResultsHint}</p>
                </div>
              ) : null}
              {failed ? <p className={styles.message}>{strings.error}</p> : null}
              <Autocomplete.List className={styles.list}>
                {(group: Group) => (
                  <Autocomplete.Group
                    key={group.value}
                    items={group.items}
                    className={styles.group}
                    // «See all» has no heading: its one row names the group.
                    aria-label={group.label === '' ? group.items[0]?.title : undefined}
                  >
                    {group.label === '' ? null : (
                      <Autocomplete.GroupLabel className={styles.groupLabel}>
                        {group.label}
                      </Autocomplete.GroupLabel>
                    )}
                    <Autocomplete.Collection>
                      {(row: Row) => (
                        <Autocomplete.Item
                          key={row.id}
                          value={row}
                          className={styles.item}
                          disabled={group.stale === true}
                          onClick={() => go(row.href)}
                        >
                          <span className={styles.itemIcon}>
                            <Icon name={row.icon as IconName} size={16} />
                          </span>
                          <span className={styles.itemText}>
                            <span className={styles.itemTitle}>{row.title}</span>
                            {row.detail === null ? null : (
                              <span className={styles.itemDetail}>{row.detail}</span>
                            )}
                          </span>
                          {row.figure === null ? null : (
                            <span className={styles.itemFigure}>{row.figure}</span>
                          )}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.Collection>
                  </Autocomplete.Group>
                )}
              </Autocomplete.List>
            </div>
            <div className={styles.foot} aria-hidden="true">
              <span>
                <kbd className={styles.kbd}>↑</kbd>
                <kbd className={styles.kbd}>↓</kbd>
                {strings.move}
              </span>
              <span>
                <kbd className={styles.kbd}>↵</kbd>
                {strings.open}
              </span>
              <span>
                <kbd className={styles.kbd}>Esc</kbd>
                {strings.close}
              </span>
            </div>
          </Autocomplete.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
