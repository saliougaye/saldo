import { catalogs, formatMoneyParts } from '@saldo/i18n';
import { plural } from '@saldo/i18n/translate';
import type { IconName } from '@saldo/ui';
import { archiveCategoryView } from '../../../../src/features/categories/archiveView';
import {
  type CategoryRowView,
  categoriesView,
} from '../../../../src/features/categories/categoriesView';
import { categoryFormView } from '../../../../src/features/categories/formView';
import { categoryWriteErrors } from '../../../../src/features/categories/writeErrors';
import { categoryMessages } from '../../../../src/i18n/categoryMessages';
import { readPage } from '../../../../src/server/page/context';
import { AppLink as Link } from '../../../../src/ui/AppLink';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { Icon } from '../../../../src/ui/Icon';
import { IconBox } from '../../../../src/ui/IconBox';
import { ListRow } from '../../../../src/ui/ListRow';
import { Section } from '../../../../src/ui/Section';
import { ProfilePanel } from '../ProfilePanel';
import { ArchiveCategory } from './ArchiveCategory';
import { CategoryForm } from './CategoryForm';
import styles from './categories.module.css';
import { ReorderButtons } from './ReorderButtons';
import { RestoreCategory } from './RestoreCategory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/profile/categories';

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
  const { t, locale, currency, params } = page;
  const view = categoriesView(page.data);
  const catalog = catalogs[locale];

  // `?new` wins over `?c=`, which wins over `?archived`; an id that is not a live category opens nothing.
  const creating = params.new !== undefined;
  const wanted = typeof params.c === 'string' ? params.c : null;
  const form =
    creating || wanted !== null
      ? categoryFormView({
          data: page.data,
          currency,
          mode: creating ? 'new' : 'edit',
          id: creating ? null : wanted,
        })
      : null;
  const showArchived = form === null && params.archived !== undefined;
  const moneyParts = formatMoneyParts(0, currency, locale, 'never');
  const archive = form?.id == null ? null : archiveCategoryView(page.data, form.id);

  const saveErrors = categoryWriteErrors(catalog.web.categories, 'save');
  const restoreErrors = categoryWriteErrors(catalog.web.categories, 'restore');

  const row = (item: CategoryRowView) => (
    <div key={item.id} className={`${styles.line} ${item.depth === 1 ? styles.child : ''}`}>
      <ListRow
        href={`${PATH}?c=${item.id}`}
        selected={form?.id === item.id}
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
    <>
      {view.sections.map((section, index) => (
        <Section
          key={section.direction}
          open
          title={t(section.direction === 'expense' ? 'categories.expenses' : 'categories.income')}
          trailing={
            index === 0 ? (
              <Link className={styles.newCategory} href={`${PATH}?new`}>
                <Icon name="plus" size={16} />
                {t('categories.newCategory')}
              </Link>
            ) : null
          }
          more={
            index === view.sections.length - 1 && view.archived.length > 0 ? (
              <ListRow
                href={`${PATH}?archived`}
                selected={showArchived}
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

      {form === null ? null : (
        <ProfilePanel
          key="form"
          sheet
          bare
          title={t(form.mode === 'new' ? 'categories.newCategory' : 'categories.editCategory')}
          closeHref={PATH}
          closeLabel={t('common.close')}
        >
          <CategoryForm
            // A switch between «Nuova» and «Modifica», or between two categories, is a new form.
            key={`${form.mode}:${form.id ?? ''}`}
            view={form}
            decimalSeparator={moneyParts.decimalSeparator}
            symbol={moneyParts.symbol}
            symbolPosition={moneyParts.symbolPosition}
            messages={categoryMessages(catalog)}
            closeHref={PATH}
            afterSave={PATH}
            archive={
              archive === null ? undefined : (
                <ArchiveCategory
                  id={archive.id}
                  updatedAt={archive.updatedAt}
                  afterHref={PATH}
                  targets={
                    archive.uses === 0
                      ? []
                      : archive.targets.map((target) => ({
                          value: target.id,
                          label: target.name,
                          icon: target.icon as IconName,
                          colorIndex: target.colorIndex,
                        }))
                  }
                  strings={{
                    action: t('categories.archive'),
                    title: t('categories.archiveTitle'),
                    body: plural(t, locale, 'categories.archiveBody', archive.uses),
                    moveTo: t('categories.moveTo'),
                    noMove: t('categories.noParent'),
                    confirm: t('categories.archive'),
                    confirmMove: t('categories.moveAndArchive'),
                    cancel: t('common.cancel'),
                    busy: t('common.loading'),
                    errors: saveErrors,
                  }}
                />
              )
            }
          />
        </ProfilePanel>
      )}

      {showArchived ? (
        <ProfilePanel
          key="archived"
          sheet
          title={t('categories.archived')}
          closeHref={PATH}
          closeLabel={t('common.close')}
        >
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
        </ProfilePanel>
      ) : null}
    </>
  );
}
