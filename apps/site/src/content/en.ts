import type { CurrencyCode, LocalDate } from '@saldo/core';
import type { AppLocale } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';

/**
 * The English content of the site (spec 0.8a §04, D43): the site copy and the sample data the phone
 * screens show. App strings are not here: the screens read them from `@saldo/i18n` (`appText`).
 *
 * Money is integer cents. Dates are LocalDate strings. Totals that more than one screen shows
 * (left to spend, net worth, the card's debt, the recap net) are calculated in `src/lib/sample.ts`,
 * never typed twice. The month is one September, day 13 of 30, as in `docs/screenshots/`.
 */
const locale: AppLocale = 'en';
const currency: CurrencyCode = 'EUR';

interface Category {
  name: string;
  icon: IconName;
  /** Index into `categoryColors` of `@saldo/ui`, as the app stores it. */
  color: number;
}

const categories = {
  groceries: { name: 'Groceries', icon: 'cart', color: 0 },
  transport: { name: 'Transport', icon: 'train', color: 2 },
  restaurants: { name: 'Restaurants', icon: 'utensils', color: 4 },
  shopping: { name: 'Shopping', icon: 'bag', color: 7 },
  leisure: { name: 'Leisure', icon: 'film', color: 8 },
  education: { name: 'Education', icon: 'cap', color: 6 },
  home: { name: 'Home', icon: 'house', color: 1 },
  utilities: { name: 'Utilities', icon: 'zap', color: 12 },
  subscriptions: { name: 'Subscriptions', icon: 'monitor', color: 18 },
  health: { name: 'Health', icon: 'heart', color: 5 },
  salary: { name: 'Salary', icon: 'landmark', color: 23 },
} satisfies Record<string, Category>;

export type CategoryKey = keyof typeof categories;

interface Entry {
  title: string;
  category: CategoryKey;
  /** Signed cents: negative is an expense. */
  amount: number;
  date: LocalDate;
  excluded?: boolean;
}

interface Day {
  date: LocalDate;
  entries: Entry[];
}

interface CashflowBar {
  start: LocalDate;
  income: number;
  expenses: number;
  current?: boolean;
  forecast?: { min: number; max: number };
}

interface Goal {
  name: string;
  icon: IconName;
  color: number;
  saved: number;
  target: number;
  start: LocalDate;
  deadline: LocalDate | null;
  /** What the plan says to set aside each month, in cents; 0 for a reached goal. */
  perMonth: number;
  reached: LocalDate | null;
}

interface Recurring {
  title: string;
  category: CategoryKey;
  amount: number;
  cadence: 'weekly' | 'monthly';
  next: LocalDate;
}

/** Types an array literal without widening or narrowing it: every item is checked against `T`. */
const list = <T>(items: T[]): T[] => items;

interface Account {
  name: string;
  /** The bank, or the account type when there is no bank (the app shows one or the other). */
  subtitle: string;
  icon: IconName;
  color: number;
  balance: number;
}

/** The credit card: what the statement holds and what accrued since it closed (account detail). */
const card = { accrued: 18840, statement: 22395 };

export const en = {
  locale,
  currency,
  meta: {
    title: 'Saldo — personal finance that stays on your phone',
    description:
      'Open-source, local-first personal finance. Budgets, goals and a forecast that work offline, with no account. Sync through a server you run.',
    ogAlt: 'Saldo: personal finance that stays on your phone.',
  },
  ui: {
    skip: 'Skip to content',
    nav: { features: 'Features', selfHost: 'Self-hosting', screens: 'Screens', faq: 'FAQ' },
    navLabel: 'Sections',
    docs: 'Docs',
    github: 'GitHub',
    themeLabel: { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' },
    copyDocker: 'Copy the Docker commands',
    copyMcp: 'Copy the MCP command',
    copied: 'Copied',
    copyFailed: 'Copy failed. The text is selected.',
    previous: 'Previous screen',
    next: 'Next screen',
    carousel: 'App screens',
    slide: (n: number, total: number, name: string) => `${n} of ${total}: ${name}`,
    footerLine: 'MIT licensed · No telemetry',
    footerLabel: 'Footer',
    footer: {
      github: 'GitHub',
      docs: 'Docs',
      guide: 'Self-hosting',
      security: 'Security',
      contributing: 'Contributing',
      licence: 'Licence',
    },
  },
  docs: {
    title: 'Docs',
    description:
      'The guides of Saldo: how the app thinks, how to run your own server, how to build the app, and how the project works.',
    groups: {
      app: { label: 'Use the app', about: 'How Saldo thinks, one idea at a time.' },
      selfHost: {
        label: 'Self-host',
        about: 'Run the server with Docker or on Vercel, and let people in.',
      },
      build: {
        label: 'Build the app',
        about: 'Build and sign the app from source, for Android or iOS.',
      },
      project: { label: 'Project', about: 'Report a vulnerability, or help to build Saldo.' },
    },
    guideDescription:
      'The Guide of the app: periods, accounts, budgets, goals, the forecast and your data, in a few lines each.',
  },
  hero: {
    pill: 'Open source · Local-first · Self-hostable',
    title: 'Personal finance that stays on your phone.',
    lede: 'Saldo tracks spending period by period, with budgets, goals and a forecast. It works offline, with no account. When you want sync, it uses a server you run.',
    ctaRepo: 'View the code on GitHub',
    ctaGuide: 'Read the self-hosting guide',
    facts: ['No telemetry', 'No bank connection', 'Android and iOS, built from source'],
  },
  what: {
    eyebrow: 'What it is',
    title: 'A finance app that needs nobody’s cloud.',
    items: [
      {
        icon: 'phone',
        title: 'Local-first',
        body: 'Everything lives in a database on your phone. Saldo opens offline, and nothing waits for a network.',
      },
      {
        icon: 'server',
        title: 'Your server, if you want one',
        body: 'Sign in with a passkey to a Saldo server you run. Every device on the account converges, offline edits included.',
      },
      {
        icon: 'eyeOff',
        title: 'Nothing reported',
        body: 'No telemetry, no analytics, no crash reporting. The code is MIT licensed, and all of it is on GitHub.',
      },
    ] satisfies { icon: IconName; title: string; body: string }[],
  },
  features: {
    eyebrow: 'Features',
    title: 'Budgets, goals and a forecast. Built in, not upsold.',
    lede: 'Every feature works on the phone alone. Nothing sits behind a subscription.',
    budgets: {
      title: 'Budgets that know the pace',
      body: 'A tick on each bar marks where today falls in the period. Ahead of it, the bar turns dark, and Saldo says what you can still spend each day.',
    },
    goals: {
      title: 'Goals inside your accounts',
      body: 'Set money aside towards a figure and, if you like, a date.',
    },
    forecast: {
      title: 'A forecast you can check',
      body: 'Three periods ahead, from your recurring entries and the median of the last six.',
    },
    recurring: {
      title: 'Recurring, done properly',
      body: 'Change one occurrence, this one and the following, or all of them.',
    },
    periods: {
      title: 'Periods you choose',
      body: 'A calendar month, a week, a pay cycle from payday, a year, or a range you pick.',
    },
    import: {
      title: 'Bring your Spendee history',
      body: 'Import the CSV that Spendee exports. Saldo detects the format, shows a preview, and skips the rows it already has. Other apps work with a column mapping.',
    },
    export: {
      title: 'Leave whenever you want',
      body: 'Export everything, any time. Restore a backup onto a phone.',
    },
    /** The column names of a Spendee CSV export, as Spendee writes them. */
    spendeeColumns: ['Date', 'Wallet', 'Category name', 'Labels'],
    importRows: { total: 1248, duplicates: 12, errors: 0 },
  },
  screens: {
    eyebrow: 'Screens',
    title: 'Every screen, as the app draws it.',
    lede: 'Sample data for one September. Swipe or use the arrows.',
    shots: [
      {
        key: 'home',
        name: 'Home',
        caption:
          'What is left to spend this period, what is coming up, and how each budget is doing.',
      },
      {
        key: 'transactions',
        name: 'Transactions',
        caption: 'The period’s list, with search, filter chips and day totals.',
      },
      {
        key: 'newTransaction',
        name: 'New transaction',
        caption:
          'Expense, income or transfer: the amount, the account, the date and the categories you use most.',
      },
      {
        key: 'stats',
        name: 'Statistics',
        caption: 'Cashflow for the last periods and three ahead, then where the money went.',
      },
      {
        key: 'budgets',
        name: 'Budgets',
        caption: 'One card per budget: what you spent, the pace and the days left.',
      },
      {
        key: 'goals',
        name: 'Goals',
        caption: 'Money set aside inside an account, towards a figure and, if you like, a date.',
      },
      {
        key: 'accounts',
        name: 'Accounts',
        caption: 'Net worth, the spendable total, and savings and investments kept apart.',
      },
      {
        key: 'card',
        name: 'Credit card',
        caption: 'What you owe, the statement so far, and when the next charge comes.',
      },
      {
        key: 'recurring',
        name: 'Recurring',
        caption: 'Rent, salary and subscriptions, and what they cost per month.',
      },
      {
        key: 'recap',
        name: 'Period recap',
        caption: 'When a period ends: the net, the categories and how each budget closed.',
      },
    ],
    webTitle: 'On the web and in your AI client',
    web: {
      name: 'Web app',
      caption:
        'The same data in a browser on your own server: the list, with the detail beside it.',
    },
    mcp: {
      terminalPath: 'terminal',
      name: 'MCP',
      caption:
        'Claude Code, Cursor or any MCP client: you sign in with your passkey and choose what it may do.',
    },
    host: 'saldo.example.com',
  },
  selfHost: {
    eyebrow: 'Self-hosting',
    title: 'Run the server. Keep the keys.',
    lede: 'The Saldo server is a web app and a Postgres database, in Docker. It adds sync between your devices, a web app for the big screen, and an MCP endpoint for your AI client.',
    checks: [
      { lead: 'Passkeys, no passwords.', rest: 'The client never receives your passkey.' },
      {
        lead: 'Invite-only.',
        rest: 'After the first account, nobody gets in without a single-use code.',
      },
      {
        lead: 'MCP for Claude Code, Cursor and others.',
        rest: 'Read only, or read and write. Revoke it from Profile.',
      },
    ],
    steps: [
      {
        title: 'Start it with Docker',
        body: 'One compose file runs the server and Postgres. Put Caddy in front for HTTPS.',
      },
      {
        title: 'Open /setup',
        body: 'The first account becomes the admin. After that, registration needs an invite code.',
      },
      {
        title: 'Connect the phone',
        body: 'Choose “With your Saldo server” on the first screen, or later from Profile → Server and sync.',
      },
    ],
    terminalPath: '~/saldo',
    /** The Docker block of docs/self-hosting.md, line for line. Change both together. */
    commands: [
      '# from docs/self-hosting.md',
      'git clone https://github.com/saliougaye/saldo.git',
      'cd saldo',
      'export PUBLIC_URL=https://saldo.example.com',
      'export WEBAUTHN_RP_ID=saldo.example.com',
      'export JWT_SECRET="$(openssl rand -base64 48)"',
      'export SETTINGS_ENCRYPTION_KEY="$(openssl rand -base64 32)"',
      'export POSTGRES_PASSWORD="$(openssl rand -base64 24)"',
      'docker compose -f apps/web/docker/docker-compose.yml \\',
      '  up -d --build',
    ],
    mcpCommands: ['claude mcp add --transport http saldo \\', '  https://saldo.example.com/mcp'],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions, before you build it.',
    items: [
      {
        q: 'Do I need a server?',
        a: 'No. Choose “Only on this phone” on the first screen: no account, nothing to set up. You can connect a server later from Profile, without losing anything.',
      },
      {
        q: 'Can I bring my Spendee history?',
        a: 'Yes. Export your transactions from Spendee as CSV and import the file. Saldo detects the Spendee format, shows a preview, and skips the rows it already has.',
      },
      {
        q: 'Is there an App Store or Play Store build?',
        a: 'Not yet. You build the app and sideload it, with the guides for Android and iOS. On iOS with a free Apple ID, the app stops opening after seven days until you install it again.',
      },
      {
        q: 'Does it connect to my bank?',
        a: 'No. You enter transactions, or you import them from a CSV.',
      },
      {
        q: 'What happens when my server is down?',
        a: 'The app keeps working on the phone. It syncs again when the server answers. Edits made offline merge, and the last write wins.',
      },
      {
        q: 'What does it send home?',
        a: 'Nothing. There is no telemetry, no analytics and no crash reporting. Your server talks only to your devices.',
      },
    ],
  },
  final: {
    title: 'Keep your spending history where you can see it.',
    lede: 'Saldo is free and open source. Read the code, build the app, and add a server when you need one.',
  },

  /* ── The sample month ─────────────────────────────────────────────── */
  sample: {
    initials: 'AL',
    period: { start: '2026-09-01', end: '2026-09-30', today: '2026-09-13' },
    categories,
    income: list<Entry>([
      { title: 'Salary', category: 'salary', amount: 218000, date: '2026-09-01' },
      { title: 'Travel refund', category: 'salary', amount: 13000, date: '2026-09-12' },
    ]),
    /** What each category spent so far this period, in cents. The order is the Statistics order. */
    spent: {
      home: 78000,
      groceries: 19560,
      utilities: 15919,
      transport: 11780,
      restaurants: 5720,
      shopping: 3990,
      subscriptions: 1299,
      leisure: 350,
    } satisfies Partial<Record<CategoryKey, number>>,
    /** Change against the median of past periods, in percent (Statistics). */
    spentChange: { home: 0, groceries: -27, utilities: 4 } satisfies Partial<
      Record<CategoryKey, number>
    >,
    budgets: list<{ category: CategoryKey; limit: number }>([
      { category: 'groceries', limit: 42000 },
      { category: 'transport', limit: 25000 },
      { category: 'restaurants', limit: 20000 },
      { category: 'shopping', limit: 10000 },
      { category: 'leisure', limit: 12000 },
    ]),
    upcoming: {
      count: 20,
      total: -70183,
      first: list<Entry>([
        { title: 'Fuel stop', category: 'transport', amount: -4500, date: '2026-09-14' },
        { title: 'Corner Café', category: 'restaurants', amount: -420, date: '2026-09-15' },
        { title: 'Fresh Market', category: 'groceries', amount: -5630, date: '2026-09-16' },
        { title: 'Language course', category: 'education', amount: -9000, date: '2026-09-17' },
        { title: 'Car insurance', category: 'transport', amount: -7800, date: '2026-09-18' },
      ]),
    },
    days: list<Day>([
      {
        date: '2026-09-13',
        entries: [
          { title: 'Corner Café', category: 'restaurants', amount: -260, date: '2026-09-13' },
        ],
      },
      {
        date: '2026-09-12',
        entries: [
          { title: 'Travel refund', category: 'salary', amount: 13000, date: '2026-09-12' },
          {
            title: 'Dentist',
            category: 'health',
            amount: -9000,
            date: '2026-09-12',
            excluded: true,
          },
        ],
      },
      {
        date: '2026-09-11',
        entries: [
          { title: 'Train tickets', category: 'transport', amount: -960, date: '2026-09-11' },
        ],
      },
      {
        date: '2026-09-10',
        entries: [
          { title: 'Fresh Market', category: 'groceries', amount: -3140, date: '2026-09-10' },
          { title: 'Pizza Napoli', category: 'restaurants', amount: -1585, date: '2026-09-10' },
        ],
      },
    ]),
    newTransaction: {
      amount: 420,
      accountIndex: 0,
      where: 'Corner Café',
      category: 'restaurants',
      mostUsed: [
        'groceries',
        'transport',
        'restaurants',
        'home',
        'utilities',
        'shopping',
        'subscriptions',
      ],
    } satisfies {
      amount: number;
      accountIndex: number;
      where: string;
      category: CategoryKey;
      mostUsed: CategoryKey[];
    },
    /** Cashflow (Statistics): three periods, then three forecast periods with their min–max band. */
    cashflow: list<CashflowBar>([
      { start: '2026-07-01', income: 218000, expenses: 284100 },
      { start: '2026-08-01', income: 231000, expenses: 186608 },
      { start: '2026-09-01', income: 231000, expenses: 136618, current: true },
      {
        start: '2026-10-01',
        income: 218000,
        expenses: 176800,
        forecast: { min: 158000, max: 201000 },
      },
      {
        start: '2026-11-01',
        income: 218000,
        expenses: 179200,
        forecast: { min: 160000, max: 205000 },
      },
      {
        start: '2026-12-01',
        income: 218000,
        expenses: 190400,
        forecast: { min: 167000, max: 228000 },
      },
    ]),
    forecastEnd: { date: '2026-12-31', balance: 295500 },
    accounts: {
      spending: list<Account>([
        { name: 'Everyday', subtitle: 'City Bank', icon: 'landmark', color: 0, balance: 207989 },
        { name: 'Bills', subtitle: 'Bank', icon: 'landmark', color: 0, balance: 0 },
        {
          name: 'Amex Gold',
          subtitle: 'Credit card',
          icon: 'card',
          color: 1,
          balance: -(card.accrued + card.statement),
        },
        { name: 'Travel', subtitle: 'Debit card', icon: 'card', color: 2, balance: 79974 },
        { name: 'Cash', subtitle: 'Wallet', icon: 'coins', color: 14, balance: 11310 },
      ]),
      savings: list<Account>([
        { name: 'Savings', subtitle: 'City Bank', icon: 'shield', color: 4, balance: 650000 },
        { name: 'Index funds', subtitle: 'Investments', icon: 'trend', color: 5, balance: 1248035 },
      ]),
    },
    card: {
      accountIndex: 2,
      ...card,
      chargeDate: '2026-10-01',
      closeDay: 25,
      chargeDay: 1,
      payFrom: 'Everyday',
      /** What the card owed at the end of each of the last eight months, in cents. */
      history: [38000, 45500, 29000, 51200, 39800, 34400, 47000, 41235],
      recent: list<Entry>([
        { title: 'Sushi Bar', category: 'restaurants', amount: -2240, date: '2026-09-07' },
        { title: 'Online order', category: 'shopping', amount: -3990, date: '2026-09-06' },
        { title: 'Streaming', category: 'subscriptions', amount: -1299, date: '2026-09-03' },
      ]),
    },
    goals: list<Goal>([
      {
        name: 'Summer holiday',
        icon: 'plane',
        color: 16,
        saved: 120000,
        target: 300000,
        start: '2026-01-15',
        deadline: '2027-06-30',
        perMonth: 19000,
        reached: null,
      },
      {
        name: 'New laptop',
        icon: 'laptop',
        color: 17,
        saved: 96000,
        target: 160000,
        start: '2026-06-01',
        deadline: '2026-12-20',
        perMonth: 20000,
        reached: null,
      },
      {
        name: 'Bike',
        icon: 'bike',
        color: 14,
        saved: 90000,
        target: 90000,
        start: '2026-03-01',
        deadline: null,
        perMonth: 0,
        reached: '2026-09-02',
      },
    ]),
    recurring: list<Recurring>([
      {
        title: 'Swimming pool',
        category: 'leisure',
        amount: -650,
        cadence: 'weekly',
        next: '2026-09-16',
      },
      {
        title: 'Language course',
        category: 'education',
        amount: -9000,
        cadence: 'monthly',
        next: '2026-09-17',
      },
      {
        title: 'Car insurance',
        category: 'transport',
        amount: -7800,
        cadence: 'monthly',
        next: '2026-09-18',
      },
      {
        title: 'Salary',
        category: 'salary',
        amount: 218000,
        cadence: 'monthly',
        next: '2026-09-27',
      },
      { title: 'Rent', category: 'home', amount: -78000, cadence: 'monthly', next: '2026-10-01' },
      {
        title: 'Streaming',
        category: 'subscriptions',
        amount: -1299,
        cadence: 'monthly',
        next: '2026-10-03',
      },
      {
        title: 'Electricity & gas',
        category: 'utilities',
        amount: -15919,
        cadence: 'monthly',
        next: '2026-10-10',
      },
    ]),
    recap: {
      period: { start: '2026-08-01', end: '2026-08-31' },
      income: 231000,
      /** August by category, in cents; the recap shows the first three and sums the rest. */
      spent: {
        home: 78000,
        groceries: 40210,
        transport: 26840,
        utilities: 15919,
        restaurants: 14000,
        shopping: 6490,
        subscriptions: 1299,
        leisure: 3850,
      } satisfies Partial<Record<CategoryKey, number>>,
      aboveUsual: { home: 0, groceries: 8, transport: 21 } satisfies Partial<
        Record<CategoryKey, number>
      >,
      previousNet: -66100,
      usualNet: 31000,
      incomeChange: 6,
      expensesChange: -34,
      budgets: list<{ category: CategoryKey; limit: number; carried: number }>([
        { category: 'groceries', limit: 42000, carried: 0 },
        { category: 'transport', limit: 25000, carried: 0 },
        { category: 'restaurants', limit: 20000, carried: 6000 },
      ]),
      biggest: { title: 'Rent', amount: 78000, date: '2026-08-01' },
      netWorth: 2111681,
    },
  },
};
