import { describe, expect, it } from 'vitest';
import { exited, followed, type PanelRules, type PanelView, went } from './panelView';

type State = 'none' | 'new' | 'detail';

/** Transazioni's rule: the new form is spent when another state takes its place. */
const RULES: PanelRules<State> = {
  same: (a, b) => a === b,
  isNone: (state) => state === 'none',
  none: 'none',
  spends: (previous, next) => previous === 'new' && next !== 'new',
};

const openNew: PanelView<State> = { panel: 'new', closing: false, instant: false, epoch: 0 };

describe('the draft of the new form', () => {
  it('is spent when the exit of a close has played: the next opening is a new draft', () => {
    const closing = went(openNew, 'none', false, RULES);
    expect(closing).toMatchObject({ panel: 'new', closing: true, epoch: 0 });
    expect(exited(closing, 'new', RULES)).toMatchObject({ panel: 'none', epoch: 1 });
  });

  // Regression: the first controller decided the draft before `setView`, from the committed view.
  // N pressed 1 ms before the 150 ms exit timer reopened the form, and then the timer, which read
  // a committed view that was still closing, started a new draft in the form on screen.
  it('regression: N 1 ms before the exit timer keeps the draft', () => {
    const closing = went(openNew, 'none', false, RULES);
    const reopened = went(closing, 'new', true, RULES);
    expect(reopened).toMatchObject({ panel: 'new', closing: false, epoch: 0 });
    // The timer of the exit still fires, with the panel that it was closing.
    expect(exited(reopened, 'new', RULES)).toBe(reopened);
  });

  it('is spent when another panel takes its place, by a click or by a navigation', () => {
    expect(went(openNew, 'detail', false, RULES)).toMatchObject({ panel: 'detail', epoch: 1 });
    expect(followed(openNew, 'detail', RULES)).toMatchObject({
      panel: 'detail',
      instant: true,
      epoch: 1,
    });
  });

  it('is not spent by a navigation to the URL that is already on screen', () => {
    expect(followed(openNew, 'new', RULES)).toBe(openNew);
  });
});
