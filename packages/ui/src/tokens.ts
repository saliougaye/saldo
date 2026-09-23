// Design tokens from docs/design/Spese.dc.html lines 14-41 and inline styles.
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
