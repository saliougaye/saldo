import { createI18n, deviceLanguages } from './index';

describe('createI18n', () => {
  it('starts in the resolved language and translates', async () => {
    const i18n = await createI18n('it', ['en-US']);
    expect(i18n.language).toBe('it');
    expect(i18n.t('tabs.home')).toBe('Home');
    expect(i18n.t('home.remaining')).toBe('Rimasto da spendere');
  });

  it('follows the device language when the preference is system', async () => {
    const i18n = await createI18n('system', ['en-GB', 'it-IT']);
    expect(i18n.language).toBe('en');
    expect(i18n.t('home.remaining')).toBe('Left to spend');
  });

  it('interpolates and pluralises', async () => {
    const i18n = await createI18n('it', []);
    expect(i18n.t('home.dayOf', { elapsed: 23, length: 31 })).toBe('giorno 23 di 31');
    expect(i18n.t('home.overPace', { count: 1 })).toBe('1 oltre il ritmo');
    expect(i18n.t('home.overPace', { count: 3 })).toBe('3 oltre il ritmo');
  });

  it('follows a regional device language to its base catalog', async () => {
    const i18n = await createI18n('system', ['de-AT']);
    expect(i18n.t('tabs.accounts')).toBe('Konten');
  });

  it('pluralises Portuguese the way Portugal does', async () => {
    const i18n = await createI18n('pt', []);
    expect(i18n.t('home.upcomingCount', { count: 0 })).toBe('0 movimentos');
    expect(i18n.t('home.upcomingCount', { count: 1 })).toBe('1 movimento');
    expect(i18n.t('tabs.accounts')).toBe('Contas');
  });

  it('never falls back to English for a round million', async () => {
    const i18n = await createI18n('fr', []);
    expect(i18n.t('home.upcomingCount', { count: 1_000_000 })).toBe('1000000 opérations');
  });

  it('reports device languages as a plain array', () => {
    expect(Array.isArray(deviceLanguages())).toBe(true);
  });
});
