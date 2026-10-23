// Design tokens taken from the design prototype and its inline styles. The prototype is not part of
// this repository, so this file is the source of truth for the values.
// Renderer-agnostic: plain values only, no React / React Native / CSS-in-JS.

export type ThemeName = 'dark' | 'light';

/**
 * Saldo's accent is **neutral**, not chromatic: `accent` is the high-contrast grey of the theme
 * (near-white on dark, near-black on light) and `barGrey` the low-contrast one. Every place the
 * spec says "accent when over pace, grey otherwise" therefore reads as a brightness contrast
 * rather than a hue contrast, and `positive` (green) stays the only chromatic signal.
 * `onAccent` is the colour that stays legible **on** `accent`, so the two must always invert.
 */
export interface Palette {
  page: string;
  bg: string;
  surface: string;
  raised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  positive: string;
  onAccent: string;
  barGrey: string;
  /** Ghost layers of an empty state: the shape of what is missing (§13, empty states). */
  ghost: string;
  ghostEdge: string;
  ghostInk: string;
  ghostInkSoft: string;
  track: string;
  heatmap: readonly [string, string, string, string, string];
  segments: readonly [string, string, string, string, string];
  segmentOther: string;
  scrim: string;
  dialogScrim: string;
  shadow: string;
  /**
   * A QR code is dark on light in **both** themes — an inverted one is not read by every scanner —
   * so these two are the same in `dark` and `light` (the web's invite panel draws with them).
   */
  qrDark: string;
  qrLight: string;
  /** The camera island in the status bar of a phone screen drawn on the marketing site (D48): black in both themes. */
  deviceIsland: string;
}

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    page: '#050505',
    bg: '#0A0A0A',
    surface: '#121212',
    raised: '#1A1A1A',
    border: 'rgba(255,255,255,0.07)',
    borderStrong: 'rgba(255,255,255,0.12)',
    text: '#EDEDED',
    textMuted: '#8C8C8C',
    textFaint: '#5C5C5C',
    accent: '#C7C7C7',
    positive: '#5FBF7F',
    onAccent: '#0A0A0A',
    barGrey: '#3A3A3A',
    // One step up from surface/border: at those values the stack vanished into #0A0A0A.
    ghost: '#1A1A1A',
    ghostEdge: 'rgba(255,255,255,0.12)',
    ghostInk: '#3A3A3A',
    ghostInkSoft: '#2A2A2A',
    track: '#1E1E1E',
    heatmap: ['#151515', '#333333', '#4F4F4F', '#757575', '#A8A8A8'],
    segments: ['#EDEDED', '#B8B8B8', '#8C8C8C', '#606060', '#454545'],
    segmentOther: '#2A2A2A',
    scrim: 'rgba(0,0,0,0.55)',
    dialogScrim: 'rgba(0,0,0,0.6)',
    shadow: 'rgba(0,0,0,0.5)',
    qrDark: '#000000',
    qrLight: '#FFFFFF',
    deviceIsland: '#000000',
  },
  light: {
    page: '#E9E9E7',
    bg: '#FFFFFF',
    surface: '#FAFAF9',
    raised: '#F1F1EF',
    border: 'rgba(0,0,0,0.08)',
    borderStrong: 'rgba(0,0,0,0.18)',
    text: '#171717',
    textMuted: '#6E6E6E',
    textFaint: '#9A9A9A',
    accent: '#4A4A46',
    positive: '#2E8A50',
    onAccent: '#FFFFFF',
    barGrey: '#C9C9C6',
    ghost: '#FAFAF9',
    ghostEdge: 'rgba(0,0,0,0.08)',
    ghostInk: '#C9C9C6',
    ghostInkSoft: '#EDEDEB',
    track: '#EDEDEB',
    heatmap: ['#F0F0EE', '#D8D8D4', '#B2B2AD', '#8A8A85', '#57574F'],
    segments: ['#3A3A37', '#5C5C58', '#7E7E79', '#A0A09B', '#BFBFBA'],
    segmentOther: '#DCDCD8',
    scrim: 'rgba(0,0,0,0.55)',
    dialogScrim: 'rgba(0,0,0,0.6)',
    shadow: 'rgba(0,0,0,0.5)',
    qrDark: '#000000',
    qrLight: '#FFFFFF',
    deviceIsland: '#000000',
  },
};

/**
 * Category and account colours; entities store an index 0-23. Never reorder or remove one: the
 * index is what is stored and synced, so only appending keeps old rows their colour.
 */
export const categoryColors = [
  '#C57B4E',
  '#B4894A',
  '#8F9152',
  '#63926F',
  '#4F8D8B',
  '#5A82A6',
  '#7A79AC',
  '#A06FA0',
  '#AF6B7B',
  '#8A8A8A',
  '#B5584F',
  '#D0806A',
  '#C9A048',
  '#78934A',
  '#4A8560',
  '#5FA890',
  '#5B9BC0',
  '#4F6FB0',
  '#6461A8',
  '#8E5C93',
  '#B36FA8',
  '#B35878',
  '#8A6A55',
  '#6B7785',
] as const;

/**
 * The i18n key under `colors.*` for each swatch above, in the same order — a picker whose whole
 * job is choosing by appearance cannot offer ten hex codes to anyone who cannot see them.
 *
 * Each name says what the colour *is*, never what it is for. A user puts the orange on groceries
 * and the next user puts it on the car, so "Spesa" would be wrong for almost everybody by their
 * second account.
 */
export const categoryColorNames = [
  'terracotta',
  'ochre',
  'olive',
  'sage',
  'teal',
  'denim',
  'periwinkle',
  'mauve',
  'dustyRose',
  'grey',
  'brick',
  'coral',
  'amber',
  'moss',
  'forest',
  'mint',
  'sky',
  'cobalt',
  'indigo',
  'plum',
  'orchid',
  'raspberry',
  'coffee',
  'slate',
] as const;

/**
 * Accent choices offered in Profile. The neutral grey is the default (see the `accent` tokens);
 * the design's orange and the blue/green options remain available.
 */
export const accentOptions = ['#C7C7C7', '#E8823C', '#7C9CC4', '#5FBF7F'] as const;

export const radii = {
  iconBox: 8,
  chipSmall: 9,
  input: 10,
  toggle: 11,
  button: 12,
  card: 14,
  sheet: 14,
  dialog: 16,
  fab: 18,
  pill: 999,
} as const;

export const fontFamily = {
  primary: 'Geist',
  fallback: 'Inter Tight',
} as const;

export const fontSize = {
  caption: 11,
  footnote: 13,
  body: 15,
  headline: 17,
  amountKey: 22,
  title: 24,
  amountMd: 28,
  amountLg: 32,
  display: 34,
  amountXl: 38,
  hero: 44,
  /** The one figure a wide web page leads with: «Rimasto da spendere», Patrimonio (§17.1.7). */
  heroWeb: 56,
  /** H5: the cents and the currency beside `heroWeb`, 45% of its size (56 × 0.45 = 25.2). */
  heroWebCents: 25.2,
  /** The marketing site's headline at full width (spec 0.8a, D48). Never in the app. */
  siteDisplay: 72,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
} as const;

/** Letter-spacing in em, as in the design. Convert with `trackingPx`. */
export const tracking = {
  tight: -0.01,
  tighter: -0.02,
  tightest: -0.03,
} as const;

export function trackingPx(em: number, size: number): number {
  return Math.round(em * size * 100) / 100;
}

export const layout = {
  screenPaddingX: 16,
  cardPadding: 16,
  cardGap: 10,
  iconBox: 32,
  iconBoxSmall: 26,
  /** The icon of an explanation (§6.40–§6.42): the intro's rows, the ⓘ sheet, a Guida page. */
  iconBoxLarge: 44,
  headerButton: 34,
  tabBarHeight: 78,
  fabSize: 56,
  fabLift: 16,
  toastBottom: 92,
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,
  toggleWidth: 38,
  toggleHeight: 22,
  toggleKnob: 16,
  keypadKeyHeight: 52,
  keypadSaveWidth: 80,
  /** The keypad of §5.1: three digit columns plus the action column, 6pt apart. */
  keypadGap: 6,
  keypadPaddingX: 12,
  keypadPaddingY: 8,
  /** The sign in front of the digits: a 38pt line needs a 30×40 tile beside it. */
  signTileWidth: 30,
  signTileHeight: 40,
  progressHeight: 4,
  /** The onboarding progress: one 2px segment per step (§6.29). */
  stepSegmentHeight: 2,
  stepSegmentGap: 6,
  paceTickOverhang: 3,
  /** The featured item of a target card (§5.13): twice a row's bar, with a longer pace tick. */
  progressHeightThick: 8,
  paceTickOverhangThick: 4,
  /** Progress rings of a target card: an event row's (icon box size) and the «Tutti …» preview. */
  targetRing: 36,
  targetRingSmall: 28,
  minHitTarget: 44,
  /** Web (H1, 2026-10-20): the top bar, on every width. */
  topbarHeight: 56,
  /** Web (H2): the one column every page sits in. The inner part of the top bar has the same width. */
  contentColumn: 1040,
  /** Web (H2): the padding on each side of the column, at and above `shellBreakpoint`. */
  columnPadding: 32,
  /**
   * Web (H1): the top bar shows the destinations and «New transaction» at and above this width;
   * below it, the phone's tab bar does. A media query cannot read a custom property, so the web
   * writes 760 in its `@media` rules with a comment naming this token.
   */
  shellBreakpoint: 760,
  /** Web: the widest a page's content grows, and its inline margin. */
  contentWide: 1120,
  /** Web: the widest a page's content grows beside the sidebar, so a large screen has no empty band on the right. */
  contentWideSidebar: 1600,
  pagePaddingWeb: 48,
  /** Web: a top-bar or sub-navigation item. */
  navItemHeight: 36,
  /** Web: between open sections, and between the two columns of Home and Statistiche. */
  sectionGapWeb: 56,
  columnGapWeb: 72,
  /** Web (W1, 2026-10-21): the centred dialog where a detail opens. */
  dialogDetailWidth: 440,
  /** Web (W1): the centred dialog where a form opens. */
  dialogFormWidth: 480,
  searchWidth: 320,
  /** Web (palette spec 2026-10-23, §07): the width of the command palette. */
  paletteWidth: 640,
  /**
   * Web (redesign H1): the top bar shows «Search» at and above this width. A media query cannot read
   * a custom property, so the web writes 1000 in its `@media` rule with a comment naming this token.
   */
  searchBreakpoint: 1000,
  /** Web (W10, 2026-10-21): the menu of Profile, which Admin shares. */
  subnavWidth: 220,
  /** Web: the sidebar that replaces the top bar at and above `wideBreakpoint` (G2, 2026-10-11). */
  sidebarWidth: 232,
  /** Web: the column of the sign-in and registration pages. */
  authWidth: 380,
  /** Web: a confirmation dialog. */
  dialogWidth: 400,
  /**
   * Web: top bar and panels at and above this width, the phone's tab bar below. A media query cannot
   * read a custom property, so the web writes this number in its `@media` rules with a comment
   * naming the token.
   */
  wideBreakpoint: 1024,
} as const;

export const motion = {
  /** cubic-bezier control points used by sheets, swipes and progress bars */
  easing: [0.32, 0.72, 0, 1] as const,
  /**
   * Instant feedback: a press, a colour, anything the user triggers many times a day. Anything
   * longer here reads as lag, because the user is looking straight at it when it starts.
   */
  pressMs: 120,
  /** A number rolling from its old value to its new one, long enough to read as a change. */
  countMs: 420,
  /** Between staggered siblings. Short: a list that takes a second to arrive is a slow list. */
  staggerMs: 40,
  sheetMs: 280,
  tallSheetMs: 300,
  fadeMs: 200,
  dialogFadeMs: 160,
  toggleMs: 180,
  snapBackMs: 240,
  progressMs: 300,
  /**
   * Onboarding steps (§6.29, "Fuoco"): the old step dissolves in place, the new one arrives chunk
   * by chunk — segments, title, body, content — and the title word by word. Seen once, so the
   * entrance may take its time; the exit never does.
   */
  stepEnterMs: 400,
  stepExitMs: 150,
  stepChunkStaggerMs: 100,
  stepWordStaggerMs: 80,
  /** How far a chunk rises while fading in. */
  stepEnterOffset: 12,
  /**
   * The onboarding permissions list (2026-09-22 plan): one row open at a time. The row grows over
   * `expandMs`, its body fades in `revealDelayMs` later, so the text never appears in a row that is
   * still too short for it.
   */
  expandMs: 300,
  revealDelayMs: 80,
  /**
   * A status replacing the buttons that produced it (better-ui swap): from `swapFromScale` and
   * transparent, the icon from `swapIconFromScale`, on this curve.
   */
  swapEasing: [0.2, 0, 0, 1] as const,
  swapFromScale: 0.96,
  swapIconFromScale: 0.25,
  toastMs: 4000,
  undoToastMs: 5000,
} as const;

/**
 * The "nothing yet" stack: three ghosts of the missing row, tilted and fanned. Each ghost is a
 * sibling view with its own perspective — React Native has no `preserve-3d`, so nesting them
 * would flatten on Android. Layers run front (0) to back (2).
 */
export const emptyState = {
  stackWidth: 184,
  stackHeight: 112,
  ghostTop: 44,
  ghostHeight: 46,
  perspective: 520,
  /** degrees */
  tiltX: 46,
  tiltZ: -15,
  layers: [
    { translateY: 0, scale: 1, enterFromY: 10, pressY: 3 },
    { translateY: -20, scale: 0.93, enterFromY: 4, pressY: 8 },
    { translateY: -38, scale: 0.86, enterFromY: -2, pressY: 13 },
  ],
  /** Per theme: dark keeps the back layers stronger, since #0A0A0A swallows them. */
  opacity: {
    dark: [1, 0.72, 0.42],
    light: [1, 0.6, 0.32],
  },
  enterFromScale: 0.9,
  pressScale: 0.02,
  enterMs: 520,
  staggerMs: 60,
  paddingY: 56,
  paddingX: 24,
  bodyMaxWidth: 280,
} as const;

/**
 * Rocky (§13 *Mascot*, D26). Sizes in pt. He peeks from a window clipped at an edge: `…Window`
 * is how much of him shows above it, and he rises `peekFromRatio` of his height to get there.
 */
export const mascot = {
  /**
   * Transparent margin above the coin on his head, cut away. `success` catches him mid-hop, so its
   * coin sits highest (2.3% of the kit's canvas); `idle` keeps a sliver more above it.
   */
  trimTop: 0.02,
  /** Over the back of the ghost stack: from his coin to below his chin. */
  emptySize: 95,
  emptyWindow: 60,
  /**
   * How far the window runs into the stack's box. The tilt puts the ghosts' visible top edge well
   * below the box's top, so this is measured on device, not derived.
   */
  emptyOverlap: 41,
  /** Starts while the back ghosts settle; lands after the whole stack (`enterMs` + 2 staggers). */
  emptyDelayMs: 240,
  /** Over a reached goal's card, near its trailing corner. */
  cardSize: 76,
  cardWindow: 48,
  cardInset: 18,
  peekFromRatio: 0.62,
  peekMs: 520,
  /** Whole, in the close sheet of a reached goal. */
  celebrateSize: 124,
  celebrateMs: 560,
  celebrateFromScale: 0.9,
  celebrateFromY: 14,
  /** Waving above the welcome's title (§6.29 step 0). */
  welcomeSize: 120,
  /** Asleep in place of the lock screen's icon (§6.32). */
  lockSize: 136,
  /** Waiting in place of the spinner of a long, labelled load. */
  loadingSize: 104,
  /** Above a failed import's or restore's message: small, the words carry it. */
  errorSize: 64,
  /** The app's only overshoot, kept for the one moment worth celebrating. */
  overshootEasing: [0.34, 1.36, 0.64, 1] as const,
} as const;

export const gestures = {
  swipeActionThreshold: 70,
  swipeMaxTravel: 120,
  tapSlop: 5,
} as const;

/** Appends an alpha channel to a `#RRGGBB` colour, e.g. category tints. */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new RangeError(`Expected #RRGGBB colour, got ${hex}`);
  const clamped = Math.min(1, Math.max(0, alpha));
  const channel = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${hex.toUpperCase()}${channel}`;
}
