import { type IconNode, parseIconMarkup } from './iconNodes';

// Copied verbatim from docs/design/Spese.dc.html lines 1726-1799 (object `P`), plus the icons
// noted below, taken from Lucide — the same set the design's own icons come from (24×24, stroke
// 1.5, round caps and joins), for affordances the prototype never drew. The block at the end comes
// from lucide-static 1.47.0 with `line`/`polyline` rewritten as `path`, which is all
// `parseIconMarkup` reads. Licences: THIRD-PARTY.md.
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
  // Lucide 1.47.0 additions for the category and account pickers, grouped as in `categoryIconGroups`.
  sofa: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M4 18v2"/><path d="M20 18v2"/><path d="M12 4v9"/>',
  bath: '<path d="M10 4 8 6"/><path d="M17 19v2"/><path d="M2 12h20"/><path d="M7 19v2"/><path d="M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
  lamp: '<path d="M12 12v6"/><path d="M4.077 10.615A1 1 0 0 0 5 12h14a1 1 0 0 0 .923-1.385l-3.077-7.384A2 2 0 0 0 15 2H9a2 2 0 0 0-1.846 1.23Z"/><path d="M8 20a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"/>',
  hammer:
    '<path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
  flame:
    '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  plug: '<path d="M12 22v-5"/><path d="M15 8V2"/><path d="M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"/><path d="M9 8V2"/>',
  showerHead:
    '<path d="m4 4 2.5 2.5"/><path d="M13.5 6.5a4.95 4.95 0 0 0-7 7"/><path d="M15 5 5 15"/><path d="M14 17v.01"/><path d="M10 16v.01"/><path d="M13 13v.01"/><path d="M16 10v.01"/><path d="M11 20v.01"/><path d="M17 14v.01"/><path d="M20 11v.01"/>',
  ship: '<path d="M12 2v2"/><path d="M12 9.189V13"/><path d="M19 12V6a2 2 0 00-2-2H7a2 2 0 00-2 2v6"/><path d="M19.38 19A11.6 11.6 0 0021 13l-8.188-3.639a2 2 0 00-1.624 0L3 13.001a11.6 11.6 0 002.81 7.76"/><path d="M2 20c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  truck:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  tramFront:
    '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>',
  circleParking: '<circle cx="12" cy="12" r="10"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  sailboat:
    '<path d="M10 2v15"/><path d="M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z"/><path d="M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z"/>',
  beer: '<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>',
  cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>',
  croissant:
    '<path d="M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487"/><path d="M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132"/><path d="M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42"/><path d="M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14"/><path d="M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676"/>',
  iceCreamCone:
    '<path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11"/><path d="M17 7A5 5 0 0 0 7 7"/><path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4"/>',
  sandwich:
    '<path d="m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777"/><path d="M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25"/><path d="M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9"/><path d="m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2"/><rect width="20" height="4" x="2" y="11" rx="1"/>',
  salad:
    '<path d="M7 21h10"/><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1"/><path d="m13 12 4-4"/><path d="M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2"/>',
  cookie:
    '<path d="M11 17h.01"/><path d="M11.496 2c.324-.016.558.292.529.615a4 4 0 004.235 4.368.713.713 0 01.758.757 4 4 0 004.366 4.237c.323-.03.63.204.614.527a10 10 0 01-2.915 6.566A1 1 0 114.93 4.918 10 10 0 0111.496 2"/><path d="M12 12h.01"/><path d="M16 16h.01"/><path d="M16 3h.01"/><path d="M21 4h.01"/><path d="M21 8h.01"/><path d="M7 14h.01"/><path d="M9 8h.01"/>',
  stethoscope:
    '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
  syringe:
    '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>',
  bandage:
    '<path d="M10 10.01h.01"/><path d="M10 14.01h.01"/><path d="M14 10.01h.01"/><path d="M14 14.01h.01"/><path d="M18 6v12"/><path d="M6 6v12"/><rect x="2" y="6" width="20" height="12" rx="2"/>',
  glasses:
    '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>',
  baby: '<path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M15 12h.01"/><path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/><path d="M9 12h.01"/>',
  tent: '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>',
  mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  popcorn:
    '<path d="M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4"/><path d="M10 22 9 8"/><path d="m14 22 1-14"/><path d="M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.7 1-1.2 1H7c-.6 0-1.1-.4-1.2-1L3.2 9c-.1-.6.3-1 .8-1Z"/>',
  dice5:
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>',
  palette:
    '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
  guitar:
    '<path d="m11.9 12.1 4.514-4.514"/><path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z"/><path d="m6 16 2 2"/><path d="M8.23 9.85A3 3 0 0 1 11 8a5 5 0 0 1 5 5 3 3 0 0 1-1.85 2.77l-.92.38A2 2 0 0 0 12 18a4 4 0 0 1-4 4 6 6 0 0 1-6-6 4 4 0 0 1 4-4 2 2 0 0 0 1.85-1.23z"/>',
  partyPopper:
    '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
  trophy:
    '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
  umbrella:
    '<path d="M12 13v7a2 2 0 0 0 4 0"/><path d="M12 2v2"/><path d="M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z"/>',
  dog: '<path d="M11.25 16.25h1.5L12 17z"/><path d="M16 14v.5"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"/><path d="M8 14v.5"/><path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/>',
  cat: '<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/>',
  pawPrint:
    '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  leaf: '<path d="M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"/><path d="M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"/>',
  flower2:
    '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>',
  treePalm:
    '<path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/>',
  shirt:
    '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  watch:
    '<path d="M12 10v2.2l1.6 1"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/><circle cx="12" cy="12" r="6"/>',
  gem: '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>',
  store:
    '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
  package:
    '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="M3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  shoppingBasket:
    '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  scissors:
    '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  laptop:
    '<path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"/><path d="M20.054 15.987H3.946"/>',
  headphones:
    '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  printer:
    '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  tv: '<path d="m17 2-5 5-5-5"/><rect width="20" height="15" x="2" y="7" rx="2"/>',
  router:
    '<rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6.01 18H6"/><path d="M10.01 18H10"/><path d="M15 10v4"/><path d="M17.84 7.17a4 4 0 0 0-5.66 0"/><path d="M20.66 4.34a8 8 0 0 0-11.31 0"/>',
  banknote:
    '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  receipt:
    '<path d="M12 17V7"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  percent:
    '<path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  handCoins:
    '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 16 6 6"/><circle cx="16" cy="9" r="2.9"/><circle cx="6" cy="5" r="3"/>',
  circleDollarSign:
    '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  vault:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/><path d="m7.9 7.9 2.7 2.7"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/><path d="m13.4 10.6 2.7-2.7"/><circle cx="7.5" cy="16.5" r=".5" fill="currentColor"/><path d="m7.9 16.1 2.7-2.7"/><circle cx="16.5" cy="16.5" r=".5" fill="currentColor"/><path d="m13.4 13.4 2.7 2.7"/><circle cx="12" cy="12" r="2"/>',
  calculator:
    '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6L16 6"/><path d="M16 14L16 18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  bitcoin:
    '<path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"/>',
  // Lucide 1.47.0 `eye` / `eye-off`, for hidden mode (2026-09-22 plan).
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  // Lucide 1.47.0 `bell` / `scan-face`, for the onboarding permissions step (2026-09-22 plan).
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  scanFace:
    '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  // Lucide 1.47.0 `merge`, for merging one tag into another (2026-09-22 tag edit plan).
  merge:
    '<path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22"/><path d="m20 22-5-5"/>',
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
  {
    key: 'home',
    icons: [
      'house',
      'key',
      'bed',
      'bulb',
      'wrench',
      'zap',
      'drop',
      'sofa',
      'bath',
      'lamp',
      'hammer',
      'flame',
      'plug',
      'showerHead',
    ],
  },
  {
    key: 'transport',
    icons: [
      'train',
      'car',
      'bus',
      'bike',
      'fuel',
      'plane',
      'ship',
      'truck',
      'tramFront',
      'circleParking',
      'sailboat',
    ],
  },
  {
    key: 'food',
    icons: [
      'cart',
      'utensils',
      'coffee',
      'pizza',
      'wine',
      'apple',
      'beer',
      'cake',
      'croissant',
      'iceCreamCone',
      'sandwich',
      'salad',
      'cookie',
    ],
  },
  {
    key: 'health',
    icons: [
      'heart',
      'pill',
      'cross',
      'activity',
      'dumbbell',
      'stethoscope',
      'syringe',
      'bandage',
      'glasses',
      'baby',
    ],
  },
  {
    key: 'leisure',
    icons: [
      'film',
      'music',
      'gamepad',
      'ticket',
      'book',
      'gift',
      'tent',
      'mountain',
      'popcorn',
      'dice5',
      'palette',
      'guitar',
      'partyPopper',
      'trophy',
      'umbrella',
    ],
  },
  { key: 'work', icons: ['briefcase', 'monitor', 'cap', 'trend', 'phone', 'coins'] },
  { key: 'nature', icons: ['dog', 'cat', 'pawPrint', 'leaf', 'flower2', 'treePalm'] },
  {
    key: 'shopping',
    icons: [
      'bag',
      'tag',
      'shirt',
      'watch',
      'gem',
      'store',
      'package',
      'shoppingBasket',
      'scissors',
    ],
  },
  { key: 'tech', icons: ['laptop', 'headphones', 'printer', 'tv', 'router'] },
  {
    key: 'finance',
    icons: [
      'banknote',
      'receipt',
      'percent',
      'handCoins',
      'circleDollarSign',
      'vault',
      'calculator',
      'bitcoin',
    ],
  },
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
  'banknote',
  'vault',
  'handCoins',
  'circleDollarSign',
  'bitcoin',
] as const satisfies readonly IconName[];
