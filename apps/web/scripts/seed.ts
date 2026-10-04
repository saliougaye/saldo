/**
 * Dev seed: fills an onboarded account with a few months of believable data — accounts, tags,
 * transactions, budgets, goals, recurrences and two future one-off expenses — through the server's
 * own write functions, so every row passes the same rules and lands in the sync log like a form's.
 *
 *   pnpm --filter web seed [userId] [--force]
 *
 * Without a userId it picks the only account in the database. Refuses when the account already has
 * transactions, unless --force.
 */
import { addDays, newId } from '@saldo/core';
import { user } from '../src/server/db/authSchema';
import { closeDb, getDb } from '../src/server/db/client';
import { env } from '../src/server/env';
import { readUserData } from '../src/server/userData/read';
import { todayFor } from '../src/server/userData/today';
import { saveAccount } from '../src/server/write/accounts';
import { saveBudget } from '../src/server/write/budgets';
import { saveGoal } from '../src/server/write/goals';
import { createTag } from '../src/server/write/tags';
import { saveTransaction } from '../src/server/write/transactions';
import { type EntityWrite, writeChanges } from '../src/server/write/writeChanges';

const C = {
  supermarket: 'seed-category-supermarket',
  bakery: 'seed-category-bakery',
  restaurants: 'seed-category-restaurants',
  health: 'seed-category-health',
  sport: 'seed-category-sport',
  shopping: 'seed-category-shopping',
  leisure: 'seed-category-leisure',
  subscriptions: 'seed-category-subscriptions',
  education: 'seed-category-education',
  salary: 'seed-category-salary',
  refunds: 'seed-category-refunds',
  gifts: 'seed-category-gifts',
  rent: 'seed-category-rent',
  maintenance: 'seed-category-maintenance',
  fuel: 'seed-category-fuel',
  publicTransport: 'seed-category-publicTransport',
  utilities: 'seed-category-utilities',
  groceries: 'seed-category-groceries',
  transport: 'seed-category-transport',
} as const;

/** Deterministic, so two runs on two fresh databases give the same ledger. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = prng(20261004);
const between = (min: number, max: number): number => min + rand() * (max - min);
const euros = (value: number): string => value.toFixed(2);
const pick = <T>(items: readonly T[]): T => {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error('pick from an empty list');
  return item;
};

function fail(what: string, result: unknown): never {
  throw new Error(`${what} refused: ${JSON.stringify(result)}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const db = getDb();
  const now = new Date();

  const explicit = args.find((arg) => !arg.startsWith('--'));
  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const target = explicit ?? (users.length === 1 ? users[0]?.id : undefined);
  if (target === undefined) {
    throw new Error(`Pass a userId: the database has ${users.length} accounts.`);
  }

  const data = await readUserData(db, target);
  if (data.settings === null || data.settings.onboardingCompletedAt === null) {
    throw new Error('Finish onboarding first: the seed builds on its accounts and categories.');
  }
  if (data.transactions.some((row) => row.deletedAt === null) && !force) {
    throw new Error('The account already has transactions. Re-run with --force to add more.');
  }
  const main = data.accounts.find((row) => row.deletedAt === null && row.type === 'checking');
  if (main === undefined) throw new Error('No checking account to seed around.');

  // --- accounts ---------------------------------------------------------------------------
  const account = async (name: string, type: 'savings' | 'cash', icon: string, buffer: string) => {
    const result = await saveAccount(
      db,
      target,
      {
        id: null,
        name,
        institution: '',
        type,
        buffer,
        includeInSpendable: type === 'cash',
        colorIndex: type === 'cash' ? 7 : 3,
        icon,
        creditCloseDay: null,
        creditChargeDay: null,
        creditPaymentAccountId: null,
      },
      now,
    );
    if (!result.ok) fail(`account ${name}`, result);
    return result.id;
  };
  const savings = await account('Risparmi', 'savings', 'piggy', '4200.00');
  const cash = await account('Contanti', 'cash', 'wallet', '80.00');

  // --- tags -------------------------------------------------------------------------------
  const tag = async (name: string) => {
    const result = await createTag(db, target, name, now);
    if (!result.ok) fail(`tag ${name}`, result);
    return result.tag.id;
  };
  const work = await tag('Lavoro');
  const holidays = await tag('Vacanze');
  const family = await tag('Famiglia');

  // --- transactions -----------------------------------------------------------------------
  let written = 0;
  const tx = async (
    date: string,
    kind: 'expense' | 'income' | 'transfer',
    amount: number,
    description: string,
    categoryId: string | null,
    options: { accountId?: string; toAccountId?: string; tagIds?: string[] } = {},
  ) => {
    const result = await saveTransaction(
      db,
      target,
      {
        id: null,
        kind,
        buffer: euros(amount),
        date,
        accountId: options.accountId ?? main.id,
        toAccountId: kind === 'transfer' ? (options.toAccountId ?? null) : null,
        categoryId: kind === 'transfer' ? null : categoryId,
        description,
        tagIds: options.tagIds ?? [],
        excludeFromTotals: false,
      },
      now,
    );
    if (!result.ok) fail(`transaction ${date} ${description}`, result);
    written += 1;
  };

  const { today } = todayFor(data.settings, env().defaultTimeZone, now);
  const start = '2026-06-27';
  const supermarkets = ['Esselunga', 'Coop', 'Conad', 'Lidl', 'Carrefour'];
  const restaurants = [
    'Trattoria da Mario',
    'Pizzeria Napoli',
    'Sushi Ko',
    'Osteria del Ponte',
    'Bar Centrale',
  ];
  const shops = ['Zara', 'Decathlon', 'Amazon', 'IKEA', 'Feltrinelli'];

  for (let day = start; day <= today; day = addDays(day, 1)) {
    const dom = Number(day.slice(8, 10));
    const month = day.slice(0, 7);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const august = month === '2026-08';

    if (dom === 27) await tx(day, 'income', 2350, 'Stipendio', C.salary, { tagIds: [work] });
    if (dom === 1) await tx(day, 'expense', 750, 'Affitto', C.rent);
    if (dom === 2) await tx(day, 'expense', 35, 'Abbonamento ATM', C.publicTransport);
    if (dom === 3) await tx(day, 'expense', 45, 'Palestra', C.sport);
    if (dom === 5) await tx(day, 'expense', 12.99, 'Netflix', C.subscriptions);
    if (dom === 12) await tx(day, 'expense', 10.99, 'Spotify', C.subscriptions);
    if (dom === 10) await tx(day, 'expense', between(55, 95), 'Bolletta luce e gas', C.utilities);
    if (dom === 28) {
      await tx(day, 'transfer', 300, 'Risparmio mensile', null, { toAccountId: savings });
    }
    if (dom === 15 && rand() < 0.7) {
      await tx(day, 'transfer', 100, 'Prelievo', null, { toAccountId: cash });
    }

    // Groceries twice a week, bread on Saturdays, cash for the bakery.
    if (weekday === 2 || weekday === 6) {
      await tx(day, 'expense', between(28, 95), pick(supermarkets), C.supermarket, {
        tagIds: rand() < 0.3 ? [family] : [],
      });
    }
    if (weekday === 6) {
      await tx(day, 'expense', between(3.5, 8.5), 'Panificio', C.bakery, { accountId: cash });
    }
    // Eating out: more often in August, tagged as holidays then.
    if ((weekday === 5 && rand() < 0.75) || (august && rand() < 0.25)) {
      await tx(day, 'expense', between(18, 68), pick(restaurants), C.restaurants, {
        tagIds: august ? [holidays] : [],
      });
    }
    if (dom % 14 === 6) await tx(day, 'expense', between(52, 74), 'Rifornimento', C.fuel);
    if (rand() < 0.06) await tx(day, 'expense', between(20, 140), pick(shops), C.shopping);
    if (rand() < 0.05) {
      await tx(day, 'expense', between(8, 35), 'Cinema e uscite', C.leisure, {
        tagIds: august ? [holidays] : [],
      });
    }
  }
  // A few one-offs that make the summaries less regular.
  await tx('2026-07-19', 'expense', 89, 'Visita oculistica', C.health);
  await tx('2026-08-08', 'expense', 420, 'Volo Palermo', C.leisure, { tagIds: [holidays] });
  await tx('2026-08-14', 'expense', 360, 'B&B Cefalù', C.leisure, { tagIds: [holidays] });
  await tx('2026-08-29', 'income', 89, 'Rimborso assicurazione oculista', C.refunds);
  await tx('2026-09-13', 'income', 100, 'Regalo di compleanno dalla nonna', C.gifts, {
    tagIds: [family],
  });
  await tx('2026-09-14', 'expense', 65, 'Regalo compleanno Luca', C.shopping, { tagIds: [family] });
  await tx('2026-09-22', 'expense', 149, 'Corso online di fotografia', C.education);
  await tx('2026-09-25', 'expense', 120, 'Idraulico', C.maintenance);
  // Future one-off expenses (they show up in list_upcoming next to the recurrences).
  await tx(addDays(today, 11), 'expense', 420, 'Assicurazione auto', C.transport);
  await tx(addDays(today, 16), 'expense', 120, 'Dentista', C.health);

  // The main account started at 0 at onboarding; give it a believable current balance (the form
  // keeps the history and moves the opening balance).
  const balanced = await saveAccount(
    db,
    target,
    {
      id: main.id,
      name: main.name,
      institution: main.institution ?? '',
      type: main.type,
      buffer: '2650.00',
      includeInSpendable: main.includeInSpendable,
      colorIndex: main.colorIndex,
      icon: main.icon,
      creditCloseDay: main.creditCloseDay,
      creditChargeDay: main.creditChargeDay,
      creditPaymentAccountId: main.creditPaymentAccountId,
    },
    now,
  );
  if (!balanced.ok) fail('main account balance', balanced);

  // --- budgets ----------------------------------------------------------------------------
  const budget = async (name: string, categoryIds: string[], buffer: string, icon: string) => {
    const result = await saveBudget(
      db,
      target,
      {
        id: null,
        name,
        categoryIds,
        buffer,
        period: 'period',
        alertThreshold: 90,
        rollover: false,
        icon,
      },
      now,
    );
    if (!result.ok) fail(`budget ${name}`, result);
  };
  await budget('Spesa', [C.groceries], '450.00', 'cart');
  await budget('Ristoranti', [C.restaurants], '180.00', 'utensils');
  await budget('Trasporti', [C.transport], '200.00', 'car');

  // --- goals ------------------------------------------------------------------------------
  const goal = async (
    name: string,
    icon: string,
    target_: string,
    saved: string,
    deadline: string | null,
  ) => {
    const result = await saveGoal(
      db,
      target,
      {
        id: null,
        name,
        icon,
        colorIndex: 11,
        buffer: target_,
        deadline,
        parentAccountId: savings,
        savedBuffer: saved,
      },
      now,
    );
    if (!result.ok) fail(`goal ${name}`, result);
  };
  await goal('Viaggio in Giappone', 'plane', '3500.00', '900.00', '2027-05-01');
  await goal('Fondo emergenza', 'target', '6000.00', '1800.00', null);

  // --- recurrences (from the next occurrence on, so no past row is owed) --------------------
  const recurrence = (
    startDate: string,
    kind: 'expense' | 'income',
    amountMinor: number,
    description: string,
    categoryId: string,
    tagIds: string[] = [],
  ): EntityWrite => {
    const id = newId();
    return {
      entity: 'recurrence',
      id,
      data: {
        id,
        createdAt: now.toISOString(),
        deletedAt: null,
        frequency: 'monthly',
        interval: 1,
        startDate,
        endDate: null,
        template: {
          kind,
          amount: amountMinor,
          accountId: main.id,
          toAccountId: null,
          categoryId,
          description,
          tagIds,
          excludeFromTotals: false,
        },
      },
    };
  };
  const nextDay = (dom: number): string => {
    const candidate = `${today.slice(0, 8)}${String(dom).padStart(2, '0')}`;
    if (candidate > today) return candidate;
    const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    return `${next}-${String(dom).padStart(2, '0')}`;
  };
  await writeChanges(
    db,
    target,
    [
      recurrence(nextDay(27), 'income', 235000, 'Stipendio', C.salary, [work]),
      recurrence(nextDay(1), 'expense', 75000, 'Affitto', C.rent),
      recurrence(nextDay(5), 'expense', 1299, 'Netflix', C.subscriptions),
      recurrence(nextDay(12), 'expense', 1099, 'Spotify', C.subscriptions),
      recurrence(nextDay(3), 'expense', 4500, 'Palestra', C.sport),
    ],
    now,
  );

  console.log(
    `Seeded ${target}: 2 accounts, 3 tags, ${written} transactions, 3 budgets, 2 goals, 5 recurrences.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
