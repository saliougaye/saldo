const fs = require('node:fs');
const path = require('node:path');
const { withStringsXml } = require('expo/config-plugins');

/**
 * Gives the Android default locale an entry for every key in `locales`, so `lintVitalRelease` stops
 * failing the release build.
 *
 * `locales` in `app.config.ts` is there for iOS, where it localises the `infoPlist` permission
 * prompts. Expo applies it to Android too, writing `res/values-b+en/strings.xml` and
 * `res/values-b+it/strings.xml`. Android reads none of it — it has no `NS…` permission strings, and
 * every user-visible string in the app comes from `@saldo/i18n` at runtime — but Android Lint sees
 * two translations of three strings that the default `res/values/strings.xml` never declares, and
 * reports each as `[ExtraTranslation]`. Lint treats that as fatal for a release build, so six errors
 * stopped `assembleRelease` before it could package anything.
 *
 * Declaring the same keys in the default locale is the fix that leaves Lint switched on. It costs
 * three strings in the APK that nothing reads. The alternatives were worse: disabling
 * `ExtraTranslation` (let alone `abortOnError false`) would blind the release build to the next real
 * resource mistake, and deleting the generated `values-b+*` directories cannot be done safely —
 * `setLocalesAsync` in `@expo/config-plugins` calls `writeXMLAsync` without awaiting it, so a later
 * mod that removes those directories races the write and the prebuild dies with `ENOENT … open
 * values-b+en/strings.xml`.
 *
 * The keys are read back out of the same JSON files the config points at, rather than repeated here,
 * so adding a fourth permission string to `locales/*.json` cannot quietly fail the next release
 * build.
 */

/** `locales` maps a language to a JSON file path, or to the object itself. */
function readLocale(projectRoot, value) {
  if (typeof value !== 'string') return value;
  return JSON.parse(fs.readFileSync(path.resolve(projectRoot, value), 'utf8'));
}

function withAndroidLocaleDefaults(config) {
  return withStringsXml(config, (stringsConfig) => {
    const locales = stringsConfig.locales ?? {};
    const { projectRoot } = stringsConfig.modRequest;

    /**
     * English is the default locale's text where there is a choice; any other language is only a
     * fallback so that a key present in one file and not in `en.json` still gets a default.
     */
    const preferred = ['en', ...Object.keys(locales).filter((lang) => lang !== 'en')];
    const defaults = new Map();
    for (const lang of preferred) {
      if (!(lang in locales)) continue;
      for (const [key, value] of Object.entries(readLocale(projectRoot, locales[lang]))) {
        if (!defaults.has(key)) defaults.set(key, value);
      }
    }

    const strings = stringsConfig.modResults.resources.string ?? [];
    for (const [key, value] of defaults) {
      if (strings.some((item) => item.$.name === key)) continue;
      // An unescaped apostrophe is a syntax error in an Android string resource, and Italian is
      // full of them. Nothing reads these values, but a malformed one would still fail the build.
      strings.push({ $: { name: key }, _: String(value).replace(/(['"])/g, '\\$1') });
    }
    stringsConfig.modResults.resources.string = strings;

    return stringsConfig;
  });
}

module.exports = withAndroidLocaleDefaults;
