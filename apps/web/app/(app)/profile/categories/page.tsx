import { catalogs, formatMoneyParts } from '@saldo/i18n';
import { plural } from '@saldo/i18n/translate';
import type { IconName } from '@saldo/ui';
import {
  type CategoryRowView,
  categoriesView,
} from '../../../../src/features/categories/categoriesView';
import {
  type CategoryFormView,
  categoryFormView,
} from '../../../../src/features/categories/formView';
import { categoryWriteErrors } from '../../../../src/features/categories/writeErrors';
import { categoryMessages } from '../../../../src/i18n/categoryMessages';
import { readPage } from '../../../../src/server/page/context';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { IconBox } from '../../../../src/ui/IconBox';
import { ListRow } from '../../../../src/ui/ListRow';
import { PanelLink } from '../../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { Section } from '../../../../src/ui/Section';
import { ArchiveCategory, type ArchiveStrings } from './ArchiveCategory';
import { CategoryForm, CategoryFormShared, type CategoryFormSharedValue } from './CategoryForm';
import styles from './categories.module.css';
import { ReorderButtons } from './ReorderButtons';
import { RestoreCategory } from './RestoreCategory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/profile/categories';

/**
 * `?new` opens «Nuova categoria», `?c={id}` one category, `?archived` the archived list. `?new` wins
 * over `?c=`, which wins over `?archived`. An id that is not a live category opens nothing.
 */
const PANEL_PARAMS = {
  flags: ['new', 'archived'],
  values: ['c'],
  order: ['new', 'c', 'archived'],
} as const;

/**
 * Profilo → Categorie (§5.11, §17.1.7): Uscite and Entrate with the children indented, «N voci»
 * beside each, up/down arrows inside a sibling group, and one panel — `?new`, `?c={id}` for the
 * form, `?archived` for the archived list with «Ripristina». Nothing here is deleted; archiving
 * can move the transactions. Figures and rules are `categoriesView` and core's.
 */
export default async function ProfileCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency } = page;
  const view = categoriesView(page.data);
  const catalog = catalogs[locale];

  const moneyParts = formatMoneyParts(0, currency, locale, 'never');
  const saveErrors = categoryWriteErrors(catalog.web.categories, 'save');
  const restoreErrors = categoryWriteErrors(catalog.web.categories, 'restore');
  const archiveStrings: ArchiveStrings = {
    action: t('categories.archive'),
    title: t('categories.archiveTitle'),
    moveTo: t('categories.moveTo'),
    noMove: t('categories.noParent'),
    confirm: t('categories.archive'),
    confirmMove: t('categories.moveAndArchive'),
    cancel: t('common.cancel'),
    busy: t('common.loading'),
    errors: saveErrors,
  };
  // What every form shares goes once to the provider; a body gets only what is its own.
  const shared: CategoryFormSharedValue = {
    categories: page.data.categories,
    decimalSeparator: moneyParts.decimalSeparator,
    symbol: moneyParts.symbol,
    symbolPosition: moneyParts.symbolPosition,
    messages: categoryMessages(catalog),
    archive: archiveStrings,
  };

  // `uses` is the row's count (`categoriesView`), not a scan of the transactions for each form. The
  // dialog sends the version the form loaded.
  const formBody = (form: CategoryFormView, uses = 0) => (
    <CategoryForm
      view={form}
      closeHref={PATH}
      afterSave={PATH}
      archive={
        form.id === null || form.updatedAt === null ? undefined : (
          <ArchiveCategory
            id={form.id}
            updatedAt={form.updatedAt}
            afterHref={PATH}
            uses={uses}
            body={plural(t, locale, 'categories.archiveBody', uses)}
          />
        )
      }
    />
  );

  // Every panel the page can open, rendered here: a click only chooses one (`PanelSwitch`). A save,
  // a reorder, an archive and a restore stay navigations, so the list shows what the server holds.
  const panels: Record<string, PanelSpec> = {};
  const fresh = categoryFormView({ data: page.data, currency, mode: 'new', id: null });
  if (fresh !== null) {
    panels.new = {
      title: t('categories.newCategory'),
      form: true,
      bare: true,
      body: formBody(fresh),
    };
  }
  // Every live category has a form, also a child whose parent is archived: it has no row, but
  // `?c=ID` (a link from MCP, say) opens it, as before the panel was in place.
  for (const category of page.data.categories) {
    if (category.archivedAt !== null) continue;
    const form = categoryFormView({ data: page.data, currency, mode: 'edit', id: category.id });
    if (form === null) continue;
    panels[`c:${category.id}`] = {
      title: t('categories.editCategory'),
      form: true,
      bare: true,
      body: formBody(form, view.usage.get(category.id) ?? 0),
    };
  }
  panels.archived = {
    title: t('categories.archived'),
    form: true,
    body: (
      <>
        <p className={styles.note}>{t('categories.archivedNote')}</p>
        {view.archived.length === 0 ? (
          <p className={styles.note}>{t('categories.archivedEmpty')}</p>
        ) : (
          view.archived.map((item) => (
            <ListRow
              key={item.id}
              leading={
                <span className={styles.faded}>
                  <IconBox name={item.icon as IconName} colorIndex={item.colorIndex} />
                </span>
              }
              title={item.name}
              subtitle={item.parentName ?? undefined}
              trailing={
                <RestoreCategory
                  id={item.id}
                  label={t('common.restore')}
                  busyLabel={t('common.loading')}
                  errors={restoreErrors}
                />
              }
            />
          ))
        )}
      </>
    ),
  };

  const row = (item: CategoryRowView) => (
    <div key={item.id} className={`${styles.line} ${item.depth === 1 ? styles.child : ''}`}>
      <ListRow
        href={`${PATH}?c=${item.id}`}
        selectId={`c:${item.id}`}
        icon={item.icon as IconName}
        colorIndex={item.colorIndex}
        title={item.name}
        trailing={
          item.uses === 0 ? undefined : (
            <span className={styles.uses}>{plural(t, locale, 'categories.uses', item.uses)}</span>
          )
        }
      />
      <ReorderButtons
        id={item.id}
        canMoveUp={item.canMoveUp}
        canMoveDown={item.canMoveDown}
        upLabel={t('categories.moveUp', { name: item.name })}
        downLabel={t('categories.moveDown', { name: item.name })}
        errors={saveErrors}
      />
    </div>
  );

  return (
    <CategoryFormShared value={shared}>
      <PanelSwitch
        baseHref={PATH}
        params={PANEL_PARAMS}
        panels={panels}
        closeLabel={t('common.close')}
        slot
      >
        {view.sections.map((section, index) => (
          <Section
            key={section.direction}
            open
            title={t(section.direction === 'expense' ? 'categories.expenses' : 'categories.income')}
            trailing={
              index === 0 ? (
                <PanelLink className={styles.newCategory} href={`${PATH}?new`}>
                  <Icon name="plus" size={16} />
                  {t('categories.newCategory')}
                </PanelLink>
              ) : null
            }
            more={
              index === view.sections.length - 1 && view.archived.length > 0 ? (
                <ListRow
                  href={`${PATH}?archived`}
                  selectId="archived"
                  leading={<IconBox name="archive" />}
                  title={t('categories.archivedSection')}
                  trailing={<span className={styles.count}>{view.archived.length}</span>}
                />
              ) : undefined
            }
          >
            {section.rows.length === 0 ? (
              <EmptyState title={t('categories.empty')} body={t('categories.emptyNote')} />
            ) : (
              <div>{section.rows.map(row)}</div>
            )}
          </Section>
        ))}
      </PanelSwitch>
    </CategoryFormShared>
  );
}
