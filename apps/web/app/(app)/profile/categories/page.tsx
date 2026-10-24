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
import { AppLink as Link } from '../../../../src/ui/AppLink';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { IconBox } from '../../../../src/ui/IconBox';
import { ListRow } from '../../../../src/ui/ListRow';
import { PanelLink } from '../../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { panelHrefFor } from '../../../../src/ui/panelUrl';
import { SettingsBox, SettingsSection } from '../../../../src/ui/SettingsSection';
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

/** `?d=income` shows the income categories; anything else, the expenses. */
const DIRECTIONS = ['expense', 'income'] as const;

/**
 * Profilo → Categorie (§5.11, §17.1.7, spec §06): Uscite or Entrate — a switch beside «Nuova
 * categoria», kept in the URL as `?d=income` — with the children indented, «N voci» beside each,
 * up/down arrows inside a sibling group, and one panel — `?new`, `?c={id}` for the form,
 * `?archived` for the archived list with «Ripristina». Every link keeps `?d=`, so a save or a close
 * comes back to the same list, and a new category starts in its direction. Nothing here is deleted;
 * archiving can move the transactions. Figures and rules are `categoriesView` and core's.
 */
export default async function ProfileCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency } = page;
  const direction = page.params.d === 'income' ? 'income' : 'expense';
  // The list with no panel open: where ✕, a save and an archive come back to.
  const base = direction === 'income' ? `${PATH}?d=income` : PATH;
  const hrefFor = (key: string) => panelHrefFor(base, key, PANEL_PARAMS);
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
      closeHref={base}
      afterSave={base}
      archive={
        form.id === null || form.updatedAt === null ? undefined : (
          <ArchiveCategory
            id={form.id}
            updatedAt={form.updatedAt}
            afterHref={base}
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
  const fresh = categoryFormView({ data: page.data, currency, mode: 'new', id: null, direction });
  if (fresh !== null) {
    panels.new = {
      title: t('categories.newCategory'),
      form: true,
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
      // The mockup's «Modifica categoria»: the category's icon in its colour, before the title.
      leading: <IconBox name={category.icon as IconName} colorIndex={category.colorIndex} />,
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
        href={hrefFor(`c:${item.id}`)}
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

  const section = view.sections.find((item) => item.direction === direction);
  const rows = section?.rows ?? [];
  const directionLabel = (value: (typeof DIRECTIONS)[number]) =>
    t(value === 'expense' ? 'categories.expenses' : 'categories.income');

  return (
    <CategoryFormShared value={shared}>
      <PanelSwitch
        baseHref={base}
        params={PANEL_PARAMS}
        panels={panels}
        closeLabel={t('common.close')}
        slot
      >
        <SettingsSection
          title={t('categories.title')}
          lead={t('categories.lead')}
          trailing={
            <>
              {/* Links, not a client control: the list is the server's, and `?d=` survives a reload. */}
              {/* biome-ignore lint/a11y/useSemanticElements: two links, not form controls: a fieldset is for inputs. */}
              <div
                className={styles.switch}
                role="group"
                aria-label={t('web.categories.directionLabel')}
              >
                {DIRECTIONS.map((value) => (
                  <Link
                    key={value}
                    className={styles.switchOption}
                    href={value === 'income' ? `${PATH}?d=income` : PATH}
                    aria-current={value === direction ? 'page' : undefined}
                  >
                    {directionLabel(value)}
                  </Link>
                ))}
              </div>
              <PanelLink className={styles.newCategory} href={hrefFor('new')}>
                <Icon name="plus" size={16} />
                {t('categories.newCategory')}
              </PanelLink>
            </>
          }
        >
          <SettingsBox
            more={
              view.archived.length > 0 ? (
                <ListRow
                  href={hrefFor('archived')}
                  selectId="archived"
                  leading={<IconBox name="archive" />}
                  title={t('categories.archivedSection')}
                  trailing={<span className={styles.count}>{view.archived.length}</span>}
                />
              ) : undefined
            }
          >
            {rows.length === 0 ? (
              <EmptyState title={t('categories.empty')} body={t('categories.emptyNote')} />
            ) : (
              <div>{rows.map(row)}</div>
            )}
          </SettingsBox>
        </SettingsSection>
      </PanelSwitch>
    </CategoryFormShared>
  );
}
