'use client';

import type { AppLocale } from '@saldo/i18n/format';
import { makeTranslator, plural } from '@saldo/i18n/translate';
import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type KeyboardEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { tagNameProblem } from '../../../../src/features/tags/tagsView';
import { tagWriteErrors } from '../../../../src/features/tags/writeErrors';
import type { TagMessages } from '../../../../src/i18n/tagMessages';
import { Alert } from '../../../../src/ui/Alert';
import { AppLink as Link } from '../../../../src/ui/AppLink';
import { FormFoot } from '../../../../src/ui/FormFoot';
import { Icon } from '../../../../src/ui/Icon';
import { TextField } from '../../../../src/ui/TextField';
import { newTagAction, renameTagAction } from './actions';
import { DeleteTag } from './DeleteTag';
import { MergeTag } from './MergeTag';
import styles from './tags.module.css';

interface Props {
  /** Null for «Nuovo tag». */
  tag: { id: string; name: string; updatedAt: string; uses: number } | null;
  /** Every live tag: the names already taken, and — without this one — what it can merge into. */
  tags: readonly { id: string; name: string }[];
  locale: AppLocale;
  messages: TagMessages;
  closeHref: string;
  /** Where a save, a merge or a delete lands. */
  afterSave: string;
  /** The transactions list filtered by this tag; null for a new one. */
  transactionsHref: string | null;
}

/**
 * «Nuovo tag» and «Modifica tag» (§5.10): a tag is only its name. An existing one also offers
 * «Vedi le transazioni», «Unisci a un altro tag» and «Elimina tag»; the last two ask first.
 */
export function TagForm({
  tag,
  tags,
  locale,
  messages,
  closeHref,
  afterSave,
  transactionsHref,
}: Props) {
  const t = useMemo(() => makeTranslator(messages), [messages]);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(tag?.name ?? '');
  const [problem, setProblem] = useState<{ field: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const errors = tagWriteErrors(messages.web.tags, t('tags.missing_taken'));
  const others = tags.filter((other) => other.id !== tag?.id);

  const save = () => {
    if (pending) return;
    const missing = tagNameProblem(name, tags, tag?.id ?? null);
    if (missing !== null) {
      setProblem({ field: true, text: t(`tags.missing_${missing}`) });
      form.current?.querySelector<HTMLElement>('[data-field="name"] input')?.focus();
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof renameTagAction>>;
      try {
        result =
          tag === null
            ? await newTagAction(name)
            : await renameTagAction({ id: tag.id, name, expectedUpdatedAt: tag.updatedAt });
      } catch {
        // A thrown action (the network, the server) keeps the draft and says so.
        setProblem({ field: false, text: errors.unexpected });
        return;
      }
      if (result.ok) {
        router.replace(afterSave);
        router.refresh();
        return;
      }
      setProblem({ field: result.error === 'taken', text: errors[result.error] });
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
      return;
    }
    // In a field Esc leaves the field; the next Esc closes the panel (`Panel` skips editable targets).
    if (event.key === 'Escape' && event.target instanceof HTMLInputElement) {
      event.target.blur();
    }
  };

  return (
    <form
      className={styles.form}
      ref={form}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      // N, E and ↑ ↓ do nothing while the form is open, even with the focus on the page (`ignoresShortcut`).
      data-owns-keys=""
    >
      <div className={styles.field} data-field="name">
        <TextField
          label={t('tags.name')}
          value={name}
          maxLength={40}
          autoComplete="off"
          autoFocus={tag === null}
          invalid={problem?.field === true}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
        />
      </div>

      {tag === null || transactionsHref === null ? null : (
        <div className={styles.field}>
          <Link className={styles.link} href={transactionsHref}>
            <span className={styles.linkText}>{t('csvImport.seeTransactions')}</span>
            <span className={styles.uses}>{plural(t, locale, 'tags.uses', tag.uses)}</span>
            <Icon name="chevR" size={16} />
          </Link>
          {others.length === 0 ? null : (
            <MergeTag
              id={tag.id}
              updatedAt={tag.updatedAt}
              targets={others}
              afterHref={afterSave}
              strings={{
                label: t('tags.mergeInto'),
                prompt: t('tags.mergeTitle', { name: tag.name }),
                note: (target) =>
                  tag.uses === 0
                    ? t('tags.mergeNoteUnused', { name: tag.name, target })
                    : plural(t, locale, 'tags.mergeNote', tag.uses, { name: tag.name, target }),
                confirm: t('tags.merge'),
                cancel: t('common.cancel'),
                busy: t('common.loading'),
                errors,
              }}
            />
          )}
        </div>
      )}

      {problem === null ? null : <Alert body={problem.text} />}

      <FormFoot
        hint={t('web.form.keyboardHint')}
        cancelHref={closeHref}
        cancelLabel={t('common.cancel')}
        submitLabel={t('common.save')}
        busyLabel={t('common.loading')}
        pending={pending}
        leading={
          tag === null ? undefined : (
            <DeleteTag
              id={tag.id}
              updatedAt={tag.updatedAt}
              afterHref={afterSave}
              strings={{
                action: t('tags.delete'),
                title: t('tags.deleteTitle', { name: tag.name }),
                body:
                  tag.uses === 0
                    ? t('tags.deleteNoteUnused')
                    : plural(t, locale, 'tags.deleteNote', tag.uses),
                confirm: t('common.delete'),
                cancel: t('common.cancel'),
                busy: t('common.loading'),
                errors,
              }}
            />
          )
        }
      />
    </form>
  );
}
