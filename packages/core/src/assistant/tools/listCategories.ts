import { z } from 'zod';
import { childCategories, topLevelCategories } from '../../categories';
import { categoryDirectionSchema } from '../../entities';
import { rowVersionSchema } from '../schemas';
import { bySortOrder } from '../sort';
import { READ_ANNOTATIONS, type ReadTool } from '../types';

const input = z.object({
  includeArchived: z.boolean().default(false).describe('Also list archived categories.'),
});

const output = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      direction: categoryDirectionSchema,
      parentId: z.string().nullable(),
      archived: z.boolean(),
      updatedAt: rowVersionSchema,
    }),
  ),
});

export type ListCategoriesInput = z.infer<typeof input>;
export type ListCategoriesOutput = z.infer<typeof output>;

export const listCategoriesTool: ReadTool<ListCategoriesInput, ListCategoriesOutput> = {
  name: 'list_categories',
  title: 'Categories',
  description:
    'The categories, expense ones then income ones, each top-level category followed by its children (categories are two levels deep; `parentId` names the parent). Totals per category roll children up into their parent. Archived categories only with includeArchived.',
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, _ctx, { includeArchived }) {
    const tree = (['expense', 'income'] as const).flatMap((direction) =>
      topLevelCategories(data.categories, direction).flatMap((parent) => [
        parent,
        ...childCategories(data.categories, parent.id),
      ]),
    );
    const listed = new Set(tree.map((category) => category.id));
    // Whatever the tree did not reach: archived rows on request, and a live child whose parent is
    // archived, which `topLevelCategories` never walks into.
    const rest = data.categories
      .filter(
        (category) => !listed.has(category.id) && (includeArchived || category.archivedAt === null),
      )
      .sort(bySortOrder);
    return {
      categories: [...tree, ...rest].map((category) => ({
        id: category.id,
        name: category.name,
        direction: category.direction,
        parentId: category.parentId,
        archived: category.archivedAt !== null,
        updatedAt: category.updatedAt,
      })),
    };
  },
};
