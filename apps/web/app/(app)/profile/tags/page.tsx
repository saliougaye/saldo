import { catalogs } from '@saldo/i18n';
import { plural } from '@saldo/i18n/translate';
import { tagsView } from '../../../../src/features/tags/tagsView';
import { tagMessages } from '../../../../src/i18n/tagMessages';
import { readPage } from '../../../../src/server/page/context';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { ListRow } from '../../../../src/ui/ListRow';
import { PanelLink } from '../../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { SettingsBox, SettingsSection } from '../../../../src/ui/SettingsSection';
import { TagForm, TagFormShared, type TagFormSharedValue } from './TagForm';
import styles from './tags.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/profile/tags';

/** `?new` opens «Nuovo tag», `?tag={id}` one tag; `?new` wins. An id that is not a live tag opens nothing. */
const PANEL_PARAMS = { flags: ['new'], values: ['tag'] } as const;

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
  const { t, locale } = page;
  const rows = tagsView(page.data);

  // What every form shares goes once to the provider; a body gets only what is its own.
  const shared: TagFormSharedValue = {
    tags: rows.map((row) => ({ id: row.id, name: row.name })),
    locale,
    messages: tagMessages(catalogs[locale]),
    closeHref: PATH,
    afterSave: PATH,
  };
  // Every panel the page can open, rendered here: a click only chooses one (`PanelSwitch`). A save,
  // a merge and a delete stay navigations to `PATH`, so the list shows what the server holds.
  const panels: Record<string, PanelSpec> = {
    new: {
      title: t('tags.newTag'),
      form: true,
      body: <TagForm tag={null} transactionsHref={null} />,
    },
    ...Object.fromEntries(
      rows.map((row): [string, PanelSpec] => [
        `tag:${row.id}`,
        {
          title: t('tags.editTag'),
          form: true,
          body: (
            <TagForm
              tag={row}
              transactionsHref={`/transactions?tag=${encodeURIComponent(row.id)}`}
            />
          ),
        },
      ]),
    ),
  };

  return (
    <TagFormShared value={shared}>
      <PanelSwitch
        baseHref={PATH}
        params={PANEL_PARAMS}
        panels={panels}
        closeLabel={t('common.close')}
        slot
      >
        <SettingsSection
          title={t('tags.title')}
          lead={t('tags.footnote')}
          trailing={
            <PanelLink className={styles.newTag} href={`${PATH}?new`}>
              <Icon name="plus" size={16} />
              {t('tags.newTag')}
            </PanelLink>
          }
        >
          <SettingsBox>
            {rows.length === 0 ? (
              <>
                <EmptyState title={t('tags.empty')} body={t('tags.emptyBody')} />
                {/* W11: the field of «New tag» is in the page; a save lists the tag. */}
                <div className={styles.first}>
                  <TagForm tag={null} transactionsHref={null} inline />
                </div>
              </>
            ) : (
              <div>
                {rows.map((row) => (
                  <ListRow
                    key={row.id}
                    href={`${PATH}?tag=${encodeURIComponent(row.id)}`}
                    selectId={`tag:${row.id}`}
                    icon="tag"
                    title={row.name}
                    trailing={
                      <span className={styles.uses}>
                        {plural(t, locale, 'tags.uses', row.uses)}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </SettingsBox>
        </SettingsSection>
      </PanelSwitch>
    </TagFormShared>
  );
}
