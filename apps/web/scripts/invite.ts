import {
  createInvite,
  DEFAULT_INVITE_TTL_DAYS,
  listInvites,
  MAX_INVITE_TTL_DAYS,
  revokeInvite,
} from '../src/server/auth/invites';
import { closeDb, getDb } from '../src/server/db/client';

const USAGE = `Usage:
  pnpm --filter web invite new [--label "Marco"] [--days 7]
  pnpm --filter web invite list
  pnpm --filter web invite revoke <id>

Run this on the server, where DATABASE_URL points at Saldo's database. The first invite on a fresh
instance has to come from here: under REGISTRATION=invite nothing creates an account without a
code, and there is no account yet to mint one.`;

function flag(args: string[], name: string): string | null {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

async function main(): Promise<void> {
  const [command = '', ...args] = process.argv.slice(2);
  const db = getDb();
  const now = new Date();

  if (command === 'new') {
    const days = Number(flag(args, 'days') ?? DEFAULT_INVITE_TTL_DAYS);
    if (!Number.isInteger(days) || days < 1 || days > MAX_INVITE_TTL_DAYS) {
      throw new Error(`--days must be a whole number between 1 and ${MAX_INVITE_TTL_DAYS}`);
    }
    const { code, invite } = await createInvite(db, {
      label: flag(args, 'label'),
      ttlDays: days,
      // Nobody minted this: the CLI has no session, and on a fresh instance no account exists.
      createdBy: null,
      now,
    });
    console.log(`\n  ${code}\n`);
    console.log(`  id       ${invite.id}`);
    console.log(`  label    ${invite.label ?? '—'}`);
    console.log(`  expires  ${invite.expiresAt}`);
    console.log(
      '\nThis code is shown once: the server stores only its hash. Send it to the person',
    );
    console.log('you are inviting; they enter it under "Create account".\n');
    return;
  }

  if (command === 'list') {
    const rows = await listInvites(db, now);
    if (rows.length === 0) {
      console.log('No invites yet.');
      return;
    }
    for (const row of rows) {
      const label = row.label ?? '—';
      console.log(
        `${row.id}  ${row.status.padEnd(8)}  expires ${row.expiresAt}  ${label}${
          row.usedBy === null ? '' : `  used by ${row.usedBy}`
        }`,
      );
    }
    return;
  }

  if (command === 'revoke') {
    const id = args[0];
    if (id === undefined) throw new Error('Which invite? Pass its id (see `invite list`).');
    const revoked = await revokeInvite(db, id, now);
    console.log(revoked ? `Revoked ${id}.` : `No invite ${id} that was not already revoked.`);
    return;
  }

  console.log(USAGE);
  process.exitCode = command === '' ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
