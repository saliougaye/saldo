import { nextTheme, readChoice, THEME_KEY, type ThemeChoice } from '../lib/theme';

/**
 * Spec 0.8a §08: the toggle. The inline script in `Base.astro` already applied the stored choice
 * before the first paint; this only handles presses.
 */
function current(): ThemeChoice {
  try {
    return readChoice(localStorage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

/** The `theme-color` metas follow `prefers-color-scheme` only; a forced theme sets them by hand. */
function paintBrowserBar(choice: ThemeChoice): void {
  const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  const forced = metas.find((meta) => meta.dataset.scheme === choice)?.dataset.color;
  for (const meta of metas) meta.content = forced ?? meta.dataset.color ?? meta.content;
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  paintBrowserBar(choice);
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    button.setAttribute('aria-label', button.getAttribute(`data-label-${choice}`) ?? choice);
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
  button.setAttribute('aria-label', button.getAttribute(`data-label-${current()}`) ?? '');
  button.addEventListener('click', () => apply(nextTheme(current())));
}
