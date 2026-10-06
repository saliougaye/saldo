import { describe, expect, it } from 'vitest';
import { ICON_NAMES, iconNodes } from './icons';

/**
 * Arc commands are left out: their flags are legally written glued to the next number
 * (`a2 2 0 00-2-2`), which no small tokenizer can split without the full grammar.
 */
const ARGUMENTS_PER_COMMAND: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  z: 0,
};
const PATH_TOKEN = /[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

/** The command letters with the number of arguments each of their runs is short or long by. */
function malformedCommands(d: string): string[] {
  const tokens = d.match(PATH_TOKEN) ?? [];
  const problems: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined) break;
    index += 1;
    if (!/[A-Za-z]/.test(token)) {
      problems.push(`${token} is not a command`);
      continue;
    }
    let count = 0;
    while (index < tokens.length && !/[A-Za-z]/.test(tokens[index] ?? '')) {
      count += 1;
      index += 1;
    }
    const arity = ARGUMENTS_PER_COMMAND[token.toLowerCase()];
    if (arity === undefined || arity === 0) continue;
    if (count === 0 || count % arity !== 0) problems.push(`${token} takes ${count}`);
  }
  return problems;
}

describe('icon geometry', () => {
  // react-native-svg's parser walks a malformed `d` off the end of the string and the app dies
  // with `NSInvalidArgumentException: -[__NSCFString characterAtIndex:]`, in a `Pressable` far
  // from the icon. A bad Lucide `polyline` → `path` rewrite is all it takes.
  it('gives every path command the arguments it takes', () => {
    for (const name of ICON_NAMES) {
      for (const node of iconNodes[name]) {
        if (node.tag !== 'path') continue;
        expect(malformedCommands(node.attrs.d ?? ''), name).toEqual([]);
      }
    }
  });
});
