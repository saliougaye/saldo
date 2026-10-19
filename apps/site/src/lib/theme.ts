/** Spec 0.8a §08 (D47): the theme follows the system unless the visitor forces light or dark. */
export const THEME_KEY = 'saldo-site-theme';

export type ThemeChoice = 'system' | 'light' | 'dark';

export function readChoice(stored: string | null): ThemeChoice {
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** System → Light → Dark → System. */
export function nextTheme(current: ThemeChoice): ThemeChoice {
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  return 'system';
}

/**
 * Runs inline in `<head>`, before the first paint. Plain script, no module and no import: a module
 * is deferred and would run after the paint, and the page would flash.
 */
export const THEME_INIT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
