/**
 * A copy of `catalog` in which every `key_other` also answers as `key_many`.
 *
 * CLDR gives Italian, French, Spanish and Portuguese a `many` plural category for round millions
 * (`1000000`), and i18next then asks for `key_many`; missing, it falls back to the *English*
 * string. In all four languages `many` reads exactly like `other`, so the catalogs write
 * `_one`/`_other` only — which keeps the parity test simple — and this fills in the third form.
 */
export function withManyPlurals<T extends object>(catalog: T): T {
  return copy(catalog) as T;
}

function copy(node: object): object {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'object' && value !== null) {
      out[key] = copy(value);
      continue;
    }
    out[key] = value;
    if (key.endsWith('_other')) {
      const many = `${key.slice(0, -'_other'.length)}_many`;
      if (!(many in node)) out[many] = value;
    }
  }
  return out;
}
