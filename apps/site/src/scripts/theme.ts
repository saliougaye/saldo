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

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
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
