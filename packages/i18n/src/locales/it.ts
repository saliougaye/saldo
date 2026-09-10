// Source catalog. Copy strings verbatim from docs/design/Spese.dc.html.
// Every key added here must also be added to en.ts (enforced by locales.test.ts).
export const it = {
  common: {
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    edit: 'Modifica',
    undo: 'Annulla',
    done: 'Fatto',
    reset: 'Azzera',
    close: 'Chiudi',
    continue: 'Continua',
    back: 'Indietro',
    start: 'Inizia',
    restore: 'Ripristina',
    archive: 'Archivia',
    search: 'Cerca',
    and: 'e',
  },
  tabs: {
    home: 'Home',
    transactions: 'Transazioni',
    stats: 'Statistiche',
    accounts: 'Conti',
  },
  kinds: {
    expense: 'Uscita',
    income: 'Entrata',
    transfer: 'Trasferimento',
  },
  home: {
    remaining: 'Rimasto da spendere',
    leftover: 'Avanzato nel ciclo',
    income: 'Entrate',
    expenses: 'Uscite',
    budget: 'Budget',
    allBudgets: 'Tutti i budget',
    cycleTrend: 'Andamento del ciclo',
    upcoming: 'In arrivo',
    recent: 'Ultime transazioni',
    allTransactions: 'Tutte le transazioni',
    dayOf: 'giorno {{elapsed}} di {{length}}',
    closedCycle: 'ciclo chiuso',
    overPace_one: '{{count}} oltre il ritmo',
    overPace_other: '{{count}} oltre il ritmo',
    withinLimits: 'nei limiti',
    vsUsualAbove: '+{{amount}} rispetto al solito',
    vsUsualBelow: '−{{amount}} rispetto al solito',
    trendFooter: 'Giorno {{elapsed}} di {{length}} · media dei 3 cicli precedenti in grigio',
  },
};

export type Messages = typeof it;
