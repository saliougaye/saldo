/**
 * Hermes on iOS ships `Intl` without `PluralRules` or `Locale` (Android's has both, through ICU). Both
 * i18next and `plural()` of `@saldo/i18n` ask `Intl.PluralRules` which suffix a count takes: without
 * it `plural()` threw at render — a Home with an over-limit budget crashed the release build on
 * launch — and i18next fell back to a `count === 1` rule that is wrong for French and Portuguese at
 * zero.
 *
 * `polyfill.js` installs itself only where the engine lacks the API, so Android and Jest keep their
 * native implementations. `intl-locale` comes first because the plural polyfill's locale matcher
 * builds `Intl.Locale`s. The locale data is one file per catalog, plus `pt-PT`: that is the code
 * i18next runs Portuguese under (`i18nextLanguage`), and its rules differ from `pt`'s at zero.
 */
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/de.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/es.js';
import '@formatjs/intl-pluralrules/locale-data/fr.js';
import '@formatjs/intl-pluralrules/locale-data/it.js';
import '@formatjs/intl-pluralrules/locale-data/pt.js';
import '@formatjs/intl-pluralrules/locale-data/pt-PT.js';
import '@formatjs/intl-pluralrules/locale-data/sv.js';
