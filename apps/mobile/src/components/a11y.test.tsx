import { fontSize, layout } from '@saldo/ui';
import { render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Insets, StyleSheet } from 'react-native';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AmountInput } from './AmountInput';
import { PrimaryButton } from './Button';
import { Calendar } from './Calendar';
import { CardHeader } from './CardHeader';
import { Chip } from './Chip';
import { ListRow } from './ListRow';
import { BackButton } from './ScreenHeader';
import { Segmented } from './Segmented';
import { Sheet } from './Sheet';
import { TabBar } from './TabBar';
import { Toggle } from './Toggle';

// `BackButton` asks the router whether there is anything behind it. Every component test in this
// app mocks expo-router, whose `standard-navigation` dependency ships ESM the transform misses.
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));

/** `Sheet` and `TabBar` both read the insets, and there is no provider in `jest.setup.js`. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const TODAY = '2026-09-11';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

function Host({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

type Element = ReturnType<typeof screen.getByLabelText>;

function size(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * The box a finger has to hit: what the style declares, grown by `hitSlop`.
 *
 * `Pressable` carries the slop itself but usually leaves the size to the view it wraps, so the
 * search walks down to the first descendant that declares one. Nothing lays out in jest, which is
 * why the controls pinned below are the ones that state their own size — a target sized by its
 * text is checked by its slop instead, further down.
 */
function touchTarget(element: Element): { width: number; height: number } {
  const style = StyleSheet.flatten(element.props.style) ?? {};
  const height = size(style.height ?? style.minHeight);
  const width = size(style.width ?? style.minWidth);
  if (height > 0 || width > 0) {
    const slop = insetsOf(element);
    return {
      width: width + size(slop.left) + size(slop.right),
      height: height + size(slop.top) + size(slop.bottom),
    };
  }
  const slop = insetsOf(element);
  for (const child of element.children) {
    if (typeof child === 'string') continue;
    const box = touchTarget(child);
    if (box.height > 0 || box.width > 0) {
      return {
        width: box.width + size(slop.left) + size(slop.right),
        height: box.height + size(slop.top) + size(slop.bottom),
      };
    }
  }
  return { width: 0, height: 0 };
}

function insetsOf(element: Element): Insets {
  const slop: unknown = element.props.hitSlop;
  if (typeof slop === 'number') return { top: slop, bottom: slop, left: slop, right: slop };
  return (slop as Insets | undefined) ?? {};
}

/**
 * How tall the slop makes a control whose height is only the line of text inside it. The sides
 * are left out: these rows span a card, so their width was never the problem.
 */
function slopHeight(element: Element, fontSize: number): number {
  const slop = insetsOf(element);
  return size(slop.top) + size(slop.bottom) + lineHeight(fontSize);
}

/**
 * iOS asks for 44pt, Android for 48dp; the token is the floor the app builds to. A control that
 * is shorter than this gets `hitSlop` — the design's spacing is not negotiable, the target is.
 */
const MIN = layout.minHitTarget;

/** A single line of text is roughly 1.2× its size, which is what the slop has to make up for. */
function lineHeight(fontSize: number): number {
  return Math.ceil(fontSize * 1.2);
}

describe('BackButton', () => {
  it('is named, since it is nothing but a chevron', async () => {
    await render(
      <Host>
        <BackButton />
      </Host>,
    );
    expect(screen.getByLabelText('Back')).toBeTruthy();
  });

  it('is big enough to hit', async () => {
    await render(
      <Host>
        <BackButton />
      </Host>,
    );
    const { width, height } = touchTarget(screen.getByLabelText('Back'));
    expect(width).toBeGreaterThanOrEqual(MIN);
    expect(height).toBeGreaterThanOrEqual(MIN);
  });
});

describe('Sheet', () => {
  async function showSheet() {
    await render(
      <Host>
        <Sheet visible onClose={jest.fn()} title="Appearance">
          <ListRow title="Camera" onPress={jest.fn()} />
        </Sheet>
      </Host>,
    );
  }

  it('names the scrim in the catalogue, not in English', async () => {
    await showSheet();
    // The scrim is the only way out of a sheet for anyone who cannot reach the gesture, so it is
    // a control — and a control's name is a user-visible string like any other.
    expect(screen.getByLabelText(i18n.t('common.close'))).toBeTruthy();
  });

  it('gives the scrim the whole screen above the sheet', async () => {
    await showSheet();
    const scrim = screen.getByLabelText(i18n.t('common.close'));
    // Content-sized rather than fixed, so `flex` is what says it fills what is left of the screen.
    expect(StyleSheet.flatten(scrim.props.style)?.flex).toBe(1);
  });
});

describe('Toggle', () => {
  async function showToggle() {
    await render(
      <Host>
        <Toggle value onChange={jest.fn()} accessibilityLabel="Repeat" />
      </Host>,
    );
    return screen.getByLabelText('Repeat');
  }

  it('announces itself as a switch that is on', async () => {
    const toggle = await showToggle();
    expect(toggle.props.accessibilityRole).toBe('switch');
    expect(toggle.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
  });

  it('is big enough to hit, though the track is not', async () => {
    const { width, height } = touchTarget(await showToggle());
    expect(width).toBeGreaterThanOrEqual(MIN);
    expect(height).toBeGreaterThanOrEqual(MIN);
  });
});

describe('Chip', () => {
  async function showChip() {
    await render(
      <Host>
        <Chip label="Today" active onPress={jest.fn()} />
      </Host>,
    );
    return screen.getByLabelText('Today');
  }

  it('says which filter it is and whether it is on', async () => {
    const chip = await showChip();
    expect(chip.props.accessibilityRole).toBe('button');
    expect(chip.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });

  it('is big enough to hit', async () => {
    expect(touchTarget(await showChip()).height).toBeGreaterThanOrEqual(MIN);
  });
});

describe('PrimaryButton', () => {
  it('carries its label and says when it is disabled', async () => {
    await render(
      <Host>
        <PrimaryButton label="Save" disabled onPress={jest.fn()} />
      </Host>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });

  it('is big enough to hit', async () => {
    await render(
      <Host>
        <PrimaryButton label="Save" onPress={jest.fn()} />
      </Host>,
    );
    expect(touchTarget(screen.getByRole('button', { name: 'Save' })).height).toBeGreaterThanOrEqual(
      MIN,
    );
  });
});

describe('ListRow', () => {
  async function showRow() {
    await render(
      <Host>
        <ListRow title="Groceries" subtitle="Revolut" onPress={jest.fn()} />
      </Host>,
    );
    return screen.getByRole('button', { name: /Groceries/ });
  }

  it('takes its name from the text it already shows', async () => {
    expect(await showRow()).toBeTruthy();
  });

  it('is big enough to hit', async () => {
    expect(touchTarget(await showRow()).height).toBeGreaterThanOrEqual(MIN);
  });
});

describe('CardHeader', () => {
  async function showHeader() {
    await render(
      <Host>
        <CardHeader title="Budgets" status="2 over pace" onPress={jest.fn()} />
      </Host>,
    );
    return screen.getByLabelText('Budgets, 2 over pace');
  }

  it('folds the status into the name, so one swipe says both', async () => {
    expect(await showHeader()).toBeTruthy();
  });

  it('has slop enough for a line of body text to clear the target', async () => {
    // The row is as tall as its text, which jest never measures, so the slop is what can be pinned.
    expect(slopHeight(await showHeader(), fontSize.body)).toBeGreaterThanOrEqual(MIN);
  });
});

describe('Segmented', () => {
  async function showSegmented() {
    await render(
      <Host>
        <Segmented
          accessibilityLabel="Kind"
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
          value="expense"
          onChange={jest.fn()}
        />
      </Host>,
    );
    return screen.getByRole('tab', { name: 'Expense' });
  }

  it('marks the chosen segment as selected', async () => {
    const tab = await showSegmented();
    expect(tab.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });

  it('is big enough to hit', async () => {
    expect(touchTarget(await showSegmented()).height).toBeGreaterThanOrEqual(MIN);
  });
});

describe('TabBar', () => {
  async function showTabBar() {
    await render(
      <Host>
        <TabBar
          state={{
            index: 0,
            routes: [
              { key: 'a', name: 'index' },
              { key: 'b', name: 'stats' },
            ],
          }}
          navigation={{ navigate: jest.fn() }}
          onFabPress={jest.fn()}
          label={(route) => route}
          fabLabel="New transaction"
        />
      </Host>,
    );
  }

  it('names the FAB, which is a plus and nothing else', async () => {
    await showTabBar();
    expect(screen.getByLabelText('New transaction')).toBeTruthy();
  });

  it('gives the FAB a target of its own', async () => {
    await showTabBar();
    const { width, height } = touchTarget(screen.getByLabelText('New transaction'));
    expect(width).toBeGreaterThanOrEqual(MIN);
    expect(height).toBeGreaterThanOrEqual(MIN);
  });
});

describe('Calendar', () => {
  async function showCalendar() {
    await render(
      <Host>
        <Calendar value={TODAY} today={TODAY} onSelect={jest.fn()} />
      </Host>,
    );
  }

  it('names the month arrows, which are chevrons alone', async () => {
    await showCalendar();
    expect(screen.getByLabelText('Previous month')).toBeTruthy();
    expect(screen.getByLabelText('Next month')).toBeTruthy();
  });

  it('gives the arrows and the days a target each', async () => {
    await showCalendar();
    const arrow = touchTarget(screen.getByLabelText('Previous month'));
    expect(arrow.width).toBeGreaterThanOrEqual(MIN);
    expect(arrow.height).toBeGreaterThanOrEqual(MIN);
    expect(touchTarget(screen.getByLabelText('September 11, 2026')).height).toBeGreaterThanOrEqual(
      MIN,
    );
  });
});

describe('AmountInput', () => {
  async function showAmount() {
    await render(
      <Host>
        <AmountInput
          buffer="12.34"
          onChange={jest.fn()}
          currency="EUR"
          locale="en"
          label="Amount"
          doneLabel="Done"
        />
      </Host>,
    );
  }

  it('names the field for what it holds, not for the key that dismisses it', async () => {
    await showAmount();
    expect(screen.getByLabelText('Amount').props.value).toBe('12.34');
  });

  it('leaves the field reachable through the box that focuses it', async () => {
    await showAmount();
    // The surrounding `Pressable` is a convenience for the sighted: a `Pressable` is accessible by
    // default, and one wrapped round a field swallows the field whole.
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Amount' })).toBeNull();
  });
});
