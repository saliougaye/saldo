/** The parameter that carries the selected row (§17.1.7). */
export const SELECTION_PARAM = 't';

/** `?new` opens «Nuova transazione»; `?t={id}&edit` turns the detail into the form (decision 8). */
export const NEW_PARAM = 'new';
export const EDIT_PARAM = 'edit';

/** The parameters that choose the panel and nothing else. */
const PANEL_PARAMS: ReadonlySet<string> = new Set([SELECTION_PARAM, NEW_PARAM, EDIT_PARAM]);

/** A URL that only resolves a path: the page's own links are all relative. */
const ORIGIN = 'http://panel.invalid';

export type PanelState =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; id: string };

/** What a URL opens, with the precedence the page always had: `?new`, then `?t=…&edit`, then `?t=`. */
export function panelFromSearch(search: URLSearchParams): PanelState {
  if (search.has(NEW_PARAM)) return { kind: 'new' };
  const id = search.get(SELECTION_PARAM);
  if (id === null || id === '') return { kind: 'none' };
  return search.has(EDIT_PARAM) ? { kind: 'edit', id } : { kind: 'detail', id };
}

/** The same panel: the same kind on the same row. */
export function samePanel(a: PanelState, b: PanelState): boolean {
  const rowOf = (panel: PanelState) => ('id' in panel ? panel.id : null);
  return a.kind === b.kind && rowOf(a) === rowOf(b);
}

/** Every parameter that is not the panel's, in an order that does not depend on the URL's. */
function listKey(search: URLSearchParams): string {
  return [...search]
    .filter(([key]) => !PANEL_PARAMS.has(key))
    .map((pair) => JSON.stringify(pair))
    .sort()
    .join(',');
}

/**
 * The panel `href` opens when going there changes nothing but the panel — the same path, the same
 * filters, the same period, no toast and no prefill left behind. Then the page already holds what
 * it needs, and the panel can change in the frame of the click. `null` for anything else, which is
 * a navigation.
 */
export function panelOnlyChange(
  current: { pathname: string; search: URLSearchParams },
  href: string,
): PanelState | null {
  const target = new URL(href, ORIGIN);
  if (target.pathname !== current.pathname) return null;
  if (listKey(target.searchParams) !== listKey(current.search)) return null;
  return panelFromSearch(target.searchParams);
}

/** The list's URL with `panel` open: the panel's parameters after the list's own. */
export function panelHref(base: string, panel: PanelState): string {
  const url = new URL(base, ORIGIN);
  if (panel.kind === 'new') url.searchParams.set(NEW_PARAM, '');
  if (panel.kind === 'detail' || panel.kind === 'edit')
    url.searchParams.set(SELECTION_PARAM, panel.id);
  if (panel.kind === 'edit') url.searchParams.set(EDIT_PARAM, '');
  const query = url.searchParams.toString();
  return query === '' ? url.pathname : `${url.pathname}?${query}`;
}
