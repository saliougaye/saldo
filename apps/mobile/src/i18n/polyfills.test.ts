/**
 * Node has the whole of `Intl`, so these tests take away what Hermes on iOS lacks before loading the
 * polyfills — the release build crashed on launch for exactly this, and no other test could see it.
 */
const native = { PluralRules: Intl.PluralRules, Locale: Intl.Locale };

function withoutHermesIntl<T>(run: () => T): T {
  const intl = Intl as unknown as Record<string, unknown>;
  delete intl.PluralRules;
  delete intl.Locale;
  try {
    let result: T | undefined;
    jest.isolateModules(() => {
      require('./polyfills');
      result = run();
    });
    return result as T;
  } finally {
    intl.PluralRules = native.PluralRules;
    intl.Locale = native.Locale;
  }
}

describe('Intl polyfills', () => {
  it('give an engine without Intl.PluralRules the CLDR rules of every catalog', () => {
    const categories = withoutHermesIntl(() =>
      ['it', 'en', 'fr', 'de', 'sv', 'es', 'pt-PT'].map((locale) => {
        const rules = new Intl.PluralRules(locale);
        return [locale, rules.select(0), rules.select(1), rules.select(2)].join(' ');
      }),
    );
    expect(categories).toEqual([
      'it other one other',
      'en other one other',
      'fr one one other',
      'de other one other',
      'sv other one other',
      'es other one other',
      // Portugal, not Brazil: zero is plural. `pt-PT` is the code i18next runs Portuguese under.
      'pt-PT other one other',
    ]);
  });

  it('let plural() of @saldo/i18n count, which is what crashed the budget card', () => {
    const keys = withoutHermesIntl(() => {
      const { plural } = require('@saldo/i18n') as typeof import('@saldo/i18n');
      const t = (key: string) => key;
      return [plural(t, 'it', 'budgets.overPace', 1), plural(t, 'fr', 'budgets.overPace', 0)];
    });
    expect(keys).toEqual(['budgets.overPace_one', 'budgets.overPace_one']);
  });

  it('leave a native Intl.PluralRules alone', () => {
    require('./polyfills');
    expect(Intl.PluralRules).toBe(native.PluralRules);
  });
});
