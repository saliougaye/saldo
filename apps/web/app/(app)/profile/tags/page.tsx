import { catalogs } from '@saldo/i18n';
import { plural } from '@saldo/i18n/translate';
import { tagsView } from '../../../../src/features/tags/tagsView';
import { tagMessages } from '../../../../src/i18n/tagMessages';
import { readPage } from '../../../../src/server/page/context';
import { AppLink as Link } from '../../../../src/ui/AppLink';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { ListRow } from '../../../../src/ui/ListRow';
import { Section } from '../../../../src/ui/Section';
import { ProfilePanel } from '../ProfilePanel';
import { TagForm } from './TagForm';
import styles from './tags.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/profile/tags';

/**
 * Profilo → Tag (§5.10, §17.1.7): every tag with how many transactions carry it, most used first,
 * and one panel — `?new` for «Nuovo tag», `?tag={id}` to rename, merge or delete one. The tag view
 * (totals, split) stays on the phone: a tag's «Vedi le transazioni» opens the list filtered by it.
 */
export default async function ProfileTagsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, params } = page;
  const rows = tagsView(page.data);

  // `?new` wins over `?tag=`; an id that is not a live tag opens nothing.
  const creating = params.new !== undefined;
  const editing = creating ? undefined : rows.find((row) => row.id === params.tag);
  const open = creating || editing !== undefined;

  return (
    <>
      <Section
        open
        title={t('tags.title')}
        trailing={
          <Link className={styles.newTag} href={`${PATH}?new`}>
            <Icon name="plus" size={16} />
            {t('tags.newTag')}
          </Link>
        }
      >
        <p className={styles.note}>{t('tags.footnote')}</p>
        {rows.length === 0 ? (
          <EmptyState title={t('tags.empty')} body={t('tags.emptyBody')} />
        ) : (
          <div>
            {rows.map((row) => (
              <ListRow
                key={row.id}
                href={`${PATH}?tag=${encodeURIComponent(row.id)}`}
                selected={editing?.id === row.id}
                icon="tag"
                title={row.name}
                trailing={
                  <span className={styles.uses}>{plural(t, locale, 'tags.uses', row.uses)}</span>
                }
              />
            ))}
          </div>
        )}
      </Section>

      {open ? (
        <ProfilePanel
          key="form"
          sheet
          title={t(creating ? 'tags.newTag' : 'tags.editTag')}
          closeHref={PATH}
          closeLabel={t('common.close')}
        >
          <TagForm
            // A switch between «Nuovo» and «Modifica», or between two tags, is a new form.
            key={editing?.id ?? 'new'}
            tag={editing ?? null}
            tags={rows.map((row) => ({ id: row.id, name: row.name }))}
            locale={locale}
            messages={tagMessages(catalogs[locale])}
            closeHref={PATH}
            afterSave={PATH}
            transactionsHref={
              editing === undefined ? null : `/transactions?tag=${encodeURIComponent(editing.id)}`
            }
          />
        </ProfilePanel>
      ) : null}
    </>
  );
}
