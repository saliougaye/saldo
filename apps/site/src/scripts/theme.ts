/**
 * Spec 0.8a §08 (D47): the toggle cycles System, Light, Dark. The inline script in `Base.astro`
 * already applied the stored choice before the first paint and defined `paintTheme`.
 */
export {};

declare global {
  interface Window {
    paintTheme(theme: string | null): void;
  }
}

const KEY = 'saldo-site-theme';
const cycle = { system: 'light', light: 'dark', dark: 'system' } as const;
type Choice = keyof typeof cycle;

/** The attribute, not the storage: it is right in private mode too. */
function current(): Choice {
  const theme = document.documentElement.dataset.theme;
  return theme === 'light' || theme === 'dark' ? theme : 'system';
}

const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
const label = (button: HTMLButtonElement, choice: Choice) =>
  button.setAttribute('aria-label', button.getAttribute(`data-label-${choice}`) ?? choice);

for (const button of buttons) {
  label(button, current());
  button.addEventListener('click', () => {
    const choice = cycle[current()];
    window.paintTheme(choice);
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    for (const each of buttons) label(each, choice);
  });
}
