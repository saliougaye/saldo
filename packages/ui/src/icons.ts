import { type IconNode, parseIconMarkup } from './iconNodes';

// Copied verbatim from docs/design/Spese.dc.html lines 1726-1799 (object `P`), plus the icons
// noted below, taken from Lucide — the same set the design's own icons come from (24×24, stroke
// 1.5, round caps and joins), for affordances the prototype never drew.
export const iconMarkup = {
  house:
    '<path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z"/><path d="M9.5 21.5v-7h5v7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h9M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  wallet:
    '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5z"/><path d="M3 8.5V7a2 2 0 0 1 2-2h11"/><path d="M16.5 12.5h.01"/>',
  cart: '<circle cx="9" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/><path d="M2 3h2.2l2.4 11.2A1.8 1.8 0 0 0 8.4 15.6h9.4a1.8 1.8 0 0 0 1.8-1.4L21 7H5"/>',
  train:
    '<rect x="4.5" y="3" width="15" height="13.5" rx="2.5"/><path d="M4.5 10.5h15M9 21l-1.5-2.5M15 21l1.5-2.5M9.5 7h5"/>',
  zap: '<path d="M13.5 2 4 13.5h6l-1.5 8.5L20 10.5h-6z"/>',
  activity: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  utensils:
    '<path d="M3.5 2.5v6a3 3 0 0 0 6 0v-6M6.5 11.5v10M17 2.5c-1.4 1.2-2 3-2 5s.6 3.2 2 4.2v9.8"/>',
  monitor:
    '<rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M10.5 8l4.5 2.5-4.5 2.5zM8.5 20.5h7M12 16.5v4"/>',
  dumbbell: '<path d="M7 6.5v11M17 6.5v11M4 9.5v5M20 9.5v5M7 12h10"/>',
  bag: '<path d="M6.5 2.5 4.5 6.5v13A2 2 0 0 0 6.5 21.5h11a2 2 0 0 0 2-2v-13l-2-4z"/><path d="M4.5 6.5h15M15.5 10.5a3.5 3.5 0 0 1-7 0"/>',
  film: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M8 3.5v17M16 3.5v17M3.5 9h17M3.5 15h17"/>',
  drop: '<path d="M12 2.7 6.9 8a7.2 7.2 0 1 0 10.2 0z"/>',
  shield: '<path d="M12 21.5s7.5-3.8 7.5-9.5V5.2L12 2.5 4.5 5.2V12c0 5.7 7.5 9.5 7.5 9.5z"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  landmark:
    '<path d="M3 21.5h18M5 21.5V10M19 21.5V10M9.5 21.5V10M14.5 21.5V10M2.5 9.5 12 3l9.5 6.5z"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
  coins: '<circle cx="8.5" cy="8.5" r="5.5"/><path d="M14.8 6.2a5.5 5.5 0 1 1-6.6 8.6"/>',
  cap: '<path d="M2.5 8.5 12 4.5l9.5 4-9.5 4z"/><path d="M6.5 10.8V15c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-4.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  chevL: '<path d="m14.5 18-6-6 6-6"/>',
  chevR: '<path d="m9.5 18 6-6-6-6"/>',
  chevD: '<path d="m6 9.5 6 6 6-6"/>',
  /**
   * Lucide `chevrons-up-down`, kept at its own geometry rather than redrawn: the design has no
   * affordance for "this label opens a picker", and a plain down chevron would have been the
   * third chevron in a header that already has ‹ and ›. Two arrows read as a selector, not as
   * navigation.
   */
  chevUD: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  del: '<path d="M20 5H9l-6 7 6 7h11a1.5 1.5 0 0 0 1.5-1.5V6.5A1.5 1.5 0 0 0 20 5z"/><path d="M17 9.5 12 15M12 9.5l5 5.5"/>',
  camera:
    '<path d="M14.8 4.5H9.2L7.8 6.8H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2.8z"/><circle cx="12" cy="13.3" r="3.2"/>',
  repeat:
    '<path d="m17 2.5 4 4-4 4M21 6.5H7a4 4 0 0 0-4 4v1.5M7 21.5l-4-4 4-4M3 17.5h14a4 4 0 0 0 4-4V12"/>',
  cal: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10.5h17"/>',
  arrowDL: '<path d="M17 7 7 17"/><path d="M17 17H7V7"/>',
  arrowUR: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  check: '<path d="M20 6.5 9 17.5l-5-5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4 7l2.6 1.5M17.4 15.5 20 17M4 17l2.6-1.5M17.4 8.5 20 7"/>',
  cellular: '<path d="M2 20h2M8 16v4M14 11v9M20 6v14" stroke-width="2.4"/>',
  wifi: '<path d="M2 8.5a14 14 0 0 1 20 0M5.5 12.5a9 9 0 0 1 13 0M9 16.5a4.5 4.5 0 0 1 6 0M12 20.5h.01"/>',
  battery:
    '<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M21.5 11v2"/><rect x="4.5" y="9.5" width="11" height="5" rx="1" fill="currentColor" stroke="none"/>',
  inbox:
    '<path d="M3.5 12.5h4l1.5 3h6l1.5-3h4"/><path d="M5.6 4.5h12.8l3.1 8v6a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2v-6z"/>',
  arrowL: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  pencil:
    '<path d="m15.5 3.6 4.9 4.9M3.5 20.5l1.1-4.6L16.1 4.4a1.7 1.7 0 0 1 2.4 0l1.1 1.1a1.7 1.7 0 0 1 0 2.4L8.1 19.4z"/>',
  trash:
    '<path d="M4 6.5h16M9.5 6.5V4.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2v2.3"/><path d="m6.6 6.5.9 13.4a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-13.4M10 10.5v7M14 10.5v7"/>',
  grip: '<circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none"/>',
  archive:
    '<rect x="2.5" y="3.5" width="19" height="5" rx="1.5"/><path d="M4.5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V8.5M9.8 12.5h4.4"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.6" cy="9.6" r="1.7"/><path d="m3.8 17.4 5.2-4.6 4.4 3.9 3-2.5 4.4 3.8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.6M12 7.6h.01"/>',
  minus: '<path d="M5 12h14"/>',
  excl: '<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7"/>',
  key: '<circle cx="7.5" cy="15.5" r="4"/><path d="m10.6 12.4 8.2-8.2M15.8 7.2l2.3 2.3M18.8 4.2 21.2 6.6"/>',
  wrench:
    '<path d="M15.5 2.5a5.5 5.5 0 0 0-5 7.7L2.9 17.8a2.1 2.1 0 0 0 3 3l7.6-7.6a5.5 5.5 0 0 0 7-7l-3.1 3.1-2.8-.7-.7-2.8z"/>',
  bulb: '<path d="M9.5 18.5h5M10.5 21.5h3"/><path d="M12 2.5a6 6 0 0 0-3.4 10.9v2.1h6.8v-2.1A6 6 0 0 0 12 2.5z"/>',
  bed: '<path d="M3 20V6M3 12h15a3 3 0 0 1 3 3v5M3 16.5h18"/><path d="M6.5 12V9.5h4.5V12"/>',
  car: '<path d="M3.5 16.5v-4l2-5.5h13l2 5.5v4z"/><path d="M6 16.5V19H3.8v-2.5M20.2 16.5V19H18v-2.5M5.5 12.5h13"/><circle cx="7.6" cy="14.4" r=".9"/><circle cx="16.4" cy="14.4" r=".9"/>',
  bus: '<rect x="4" y="3.5" width="16" height="14" rx="2.5"/><path d="M4 12h16M7.5 21v-3.5M16.5 21v-3.5"/><circle cx="8" cy="14.8" r=".9"/><circle cx="16" cy="14.8" r=".9"/>',
  bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5 10 7.5h4.5l4 10M9 7.5h5"/>',
  plane:
    '<path d="M12 2.2c.8 0 1.4.9 1.4 2v5.4l7.6 4.2v2l-7.6-2.3v4l2.4 1.8v1.7L12 20l-3.8.9v-1.7l2.4-1.8v-4L3 15.8v-2l7.6-4.2V4.2c0-1.1.6-2 1.4-2z"/>',
  fuel: '<path d="M3.5 20.5h10M4.8 20.5V5.2A1.7 1.7 0 0 1 6.5 3.5h4.3a1.7 1.7 0 0 1 1.7 1.7v15.3M4.8 11h7.7"/><path d="m15.5 8.3 1.8 1.8V17a1.7 1.7 0 0 0 3.4 0V9.4L18 6.8"/>',
  coffee:
    '<path d="M3.5 8h13v5.5a5.5 5.5 0 0 1-5.5 5.5H9a5.5 5.5 0 0 1-5.5-5.5z"/><path d="M16.5 9.5H19a2.6 2.6 0 0 1 0 5.2h-2.5M6 3v2.2M9.8 2.6v2.2M13.6 3v2.2"/>',
  pizza:
    '<path d="M12 2.6 21.4 20a1.9 1.9 0 0 1-2.3 2.7 21.6 21.6 0 0 1-14.2 0A1.9 1.9 0 0 1 2.6 20z"/><circle cx="10" cy="12.6" r="1.1"/><circle cx="14.4" cy="16.6" r="1.1"/>',
  wine: '<path d="M8.2 21.5h7.6M12 15.6v5.9"/><path d="M6.6 3.5h10.8l-.7 6.2a5.1 5.1 0 0 1-9.4 0z"/>',
  apple:
    '<path d="M12 7.2C11.1 4.8 9 3.7 7 4.2 5.2 4.7 4 6.6 4 9.2c0 5 3.4 9.4 5.4 9.4 1 0 1.6-.6 2.6-.6s1.6.6 2.6.6c2 0 5.4-4.4 5.4-9.4 0-2.6-1.2-4.5-3-5-2-.5-4.1.6-5 3z"/><path d="M12 7.2V5c0-1.2.9-2.2 2.2-2.2"/>',
  pill: '<path d="m10.6 3.6-7 7a5 5 0 0 0 7 7l7-7a5 5 0 0 0-7-7z"/><path d="m7.1 7.1 7 7"/>',
  heart:
    '<path d="M12 20.6C10.6 19.4 3.5 14.9 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.3-7.1 9.8-8.5 11z"/>',
  cross: '<path d="M9.6 3.5h4.8v5.9h5.9v4.8h-5.9v5.9H9.6v-5.9H3.7V9.4h5.9z"/>',
  music:
    '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="15.6" r="3"/><path d="M9 18V5.6L21 3v12.6"/>',
  gamepad:
    '<path d="M7.2 9.5h9.6a4.4 4.4 0 0 1 4.3 5.3l-.6 2.9a2.5 2.5 0 0 1-4.5 1L14.4 17H9.6l-1.6 1.7a2.5 2.5 0 0 1-4.5-1l-.6-2.9a4.4 4.4 0 0 1 4.3-5.3z"/><path d="M7.4 12v3M5.9 13.5h3M16.2 12.6h.01M18.1 15h.01"/>',
  ticket:
    '<path d="M3.5 8.6V6.2a1.7 1.7 0 0 1 1.7-1.7h13.6a1.7 1.7 0 0 1 1.7 1.7v2.4a3.4 3.4 0 0 0 0 6.8v2.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7v-2.4a3.4 3.4 0 0 0 0-6.8z"/><path d="M13.4 5.2v2.6M13.4 11v2M13.4 16.2v2.6"/>',
  book: '<path d="M4 4.8A2.3 2.3 0 0 1 6.3 2.5h13.2v19H6.3A2.3 2.3 0 0 0 4 19.2z"/><path d="M4 17.4h15.5"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M10.4 18.4h3.2"/>',
  gift: '<rect x="2.8" y="8.4" width="18.4" height="4.6" rx="1.2"/><path d="M4.6 13v7.3a1.2 1.2 0 0 0 1.2 1.2h12.4a1.2 1.2 0 0 0 1.2-1.2V13M12 8.4v13.1"/><path d="M12 8.4S10.6 3 8.1 3a2.7 2.7 0 0 0 0 5.4zM12 8.4S13.4 3 15.9 3a2.7 2.7 0 0 1 0 5.4z"/>',
  tag: '<path d="M11.2 2.5H20a1.5 1.5 0 0 1 1.5 1.5v8.8l-9.6 9.6a1.6 1.6 0 0 1-2.3 0l-7.5-7.5a1.6 1.6 0 0 1 0-2.3z"/><circle cx="16.6" cy="7.4" r="1.3"/>',
  briefcase:
    '<rect x="2.5" y="7" width="19" height="13" rx="2.2"/><path d="M8.5 7V5.2A1.7 1.7 0 0 1 10.2 3.5h3.6A1.7 1.7 0 0 1 15.5 5.2V7M2.5 12.6h19"/>',
  piggy:
    '<path d="M17.5 9.2a6.5 6.5 0 0 1 2.4 3.3h1.6v3.5h-2a6.6 6.6 0 0 1-2 2.1v2.4h-3.4v-1.3H10v1.3H6.6v-2.6A6.5 6.5 0 0 1 4 12.6C4 8.9 7.3 6 11.3 6h3.3l3.4-2.5v3.9z"/><path d="M15.6 10.6h.01"/>',
} as const satisfies Record<string, string>;
export type IconName = keyof typeof iconMarkup;

export const ICON_NAMES = Object.keys(iconMarkup) as IconName[];

/** Attributes applied to every icon unless a node overrides them. */
export const iconDefaults = {
  viewBox: '0 0 24 24',
  size: 18,
  fill: 'none',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const iconNodes = Object.fromEntries(
  ICON_NAMES.map((name) => [name, parseIconMarkup(iconMarkup[name])]),
) as Record<IconName, IconNode[]>;

/** Icon picker groups for categories; `key` maps to i18n `icons.groups.<key>`. */
export const categoryIconGroups = [
  { key: 'home', icons: ['house', 'key', 'bed', 'bulb', 'wrench', 'zap', 'drop'] },
  { key: 'transport', icons: ['train', 'car', 'bus', 'bike', 'fuel', 'plane'] },
  { key: 'food', icons: ['cart', 'utensils', 'coffee', 'pizza', 'wine', 'apple'] },
  { key: 'health', icons: ['heart', 'pill', 'cross', 'activity', 'dumbbell'] },
  { key: 'leisure', icons: ['film', 'music', 'gamepad', 'ticket', 'book', 'gift'] },
  { key: 'work', icons: ['briefcase', 'monitor', 'cap', 'trend', 'phone', 'coins'] },
] as const satisfies readonly { key: string; icons: readonly IconName[] }[];

export const accountIconOptions = [
  'landmark',
  'card',
  'coins',
  'piggy',
  'trend',
  'phone',
  'briefcase',
  'shield',
] as const satisfies readonly IconName[];
