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
 * Runs inline in `<head>`, before the first paint, and after the `theme-color` metas. Plain script,
 * no module and no import: a module is deferred and would run after the paint, and the page would
 * flash. A forced theme also sets both `theme-color` metas to its colour, because their `media`
 * queries follow the system only. `scripts/theme.ts` does the same on a press.
 */
export const THEME_INIT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);var m=document.querySelectorAll('meta[name="theme-color"]'),c=null,i;for(i=0;i<m.length;i++)if(m[i].getAttribute('data-scheme')===t)c=m[i].getAttribute('data-color');if(c)for(i=0;i<m.length;i++)m[i].setAttribute('content',c);}}catch(e){}})();`;
