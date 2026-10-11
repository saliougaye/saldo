/**
 * Which query parameters choose a panel: a flag (`?new`) or a value (`?tag=ID`). When a URL carries
 * more than one, the first name of `order` wins; with no `order`, the flags win over the values.
 */
export interface PanelParams {
  readonly flags: readonly string[];
  readonly values: readonly string[];
  /**
   * The precedence the page already has, for a page that lets a value win over a flag (Conti lets
   * `?a=` win over `?archived`). Names that it leaves out come after it, flags first.
   */
  readonly order?: readonly string[];
}

/** A URL that only resolves a path: the page's own links are all relative. */
const ORIGIN = 'http://panel.invalid';

/** Every panel parameter, first the one that wins. */
const panelNames = (params: PanelParams): ReadonlySet<string> =>
  new Set([...(params.order ?? []), ...params.flags, ...params.values]);

/** What the query opens: a flag's name (`new`), `name:value` (`tag:ID`), or null for no panel. */
export function panelKeyFromSearch(search: URLSearchParams, params: PanelParams): string | null {
  for (const name of panelNames(params)) {
    if (params.flags.includes(name)) {
      if (search.has(name)) return name;
      continue;
    }
    const value = search.get(name);
    if (value !== null && value !== '') return `${name}:${value}`;
  }
  return null;
}

/**
 * Every parameter that is not the panel's, in an order that does not depend on the URL's. A key that
 * repeats compares as a set of pairs.
 */
function listKey(search: URLSearchParams, own: ReadonlySet<string>): string {
  return [...search]
    .filter(([name]) => !own.has(name))
    .map((pair) => JSON.stringify(pair))
    .sort()
    .join(',');
}

/**
 * The panel `href` opens when going there changes nothing but the panel: the same path, the same
 * filters. `null` for anything else, which is a navigation. So is a link to another origin, or with
 * a fragment: nothing pushes a URL that the panel would ignore.
 */
export function panelOnlyChange(
  current: { pathname: string; search: URLSearchParams },
  href: string,
  params: PanelParams,
): { key: string | null } | null {
  const target = new URL(href, ORIGIN);
  if (target.origin !== ORIGIN || target.hash !== '') return null;
  if (target.pathname !== current.pathname) return null;
  const own = panelNames(params);
  if (listKey(target.searchParams, own) !== listKey(current.search, own)) return null;
  return { key: panelKeyFromSearch(target.searchParams, params) };
}

/** `base` with the panel `key` open, after the base's own parameters. `null` drops every panel parameter. */
export function panelHrefFor(base: string, key: string | null, params: PanelParams): string {
  const url = new URL(base, ORIGIN);
  for (const name of panelNames(params)) url.searchParams.delete(name);
  if (key !== null) {
    const split = key.indexOf(':');
    if (split === -1) url.searchParams.set(key, '');
    else url.searchParams.set(key.slice(0, split), key.slice(split + 1));
  }
  const query = url.searchParams.toString();
  return query === '' ? url.pathname : `${url.pathname}?${query}`;
}
