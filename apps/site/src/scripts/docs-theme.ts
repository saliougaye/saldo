/**
 * Spec 0.8b §06 (D57): the theme toggle of the docs pages. It shares `saldo-site-theme` with the
 * landing page (spec 0.8a §08). `ThemeProvider.astro` already applied the choice before the first
 * paint. Starlight needs `data-theme` to be `light` or `dark`, so «System» follows the media query.
 */
export {};

const KEY = 'saldo-site-theme';
const cycle = { system: 'light', light: 'dark', dark: 'system' } as const;
type Choice = keyof typeof cycle;

const root = document.documentElement;
const light = matchMedia('(prefers-color-scheme: light)');

const current = (): Choice => {
  const choice = root.dataset.themeChoice;
  return choice === 'light' || choice === 'dark' ? choice : 'system';
};

const buttons = document.querySelectorAll<HTMLButtonElement>('[data-docs-theme]');

function apply(choice: Choice): void {
  root.dataset.themeChoice = choice;
  root.dataset.theme = choice === 'system' ? (light.matches ? 'light' : 'dark') : choice;
  for (const button of buttons) {
    button.setAttribute('aria-label', button.getAttribute(`data-label-${choice}`) ?? choice);
  }
}

apply(current());
light.addEventListener('change', () => {
  if (current() === 'system') apply('system');
});

for (const button of buttons) {
  button.addEventListener('click', () => {
    const choice = cycle[current()];
    apply(choice);
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  });
}
