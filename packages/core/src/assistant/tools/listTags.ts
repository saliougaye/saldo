import { z } from 'zod';
import { binary } from '../sort';
import { READ_ANNOTATIONS, type ReadTool } from '../types';

const input = z.object({});

const output = z.object({
  tags: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type ListTagsInput = z.infer<typeof input>;
export type ListTagsOutput = z.infer<typeof output>;

export const listTagsTool: ReadTool<ListTagsInput, ListTagsOutput> = {
  name: 'list_tags',
  title: 'Tags',
  description:
    "The user's tags by name. A transaction can carry several tags or none, so tags are not a split of the spending: never present tag totals as shares of a whole.",
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data) {
    return {
      tags: [...data.tags]
        .sort((a, b) => binary(a.name, b.name))
        .map((tag) => ({ id: tag.id, name: tag.name })),
    };
  },
};
