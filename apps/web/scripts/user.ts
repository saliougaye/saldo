import {
  deleteUser,
  listAccounts,
  promoteUser,
  restoreUser,
  revokeUser,
} from '../src/server/auth/admin';
import { closeDb, getDb } from '../src/server/db/client';

const USAGE = `Usage:
  pnpm --filter web user list
  pnpm --filter web user revoke  <id> [--reason "left the household"]
  pnpm --filter web user restore <id>
  pnpm --filter web user promote <id>
  pnpm --filter web user delete  <id>

revoke  stops the account at once — its sessions are deleted and its bearer is refused — and keeps
        everything it wrote, so it can be restored.
delete  removes the account and, through the foreign keys, every row it ever synced. Irreversible.
promote makes the account an admin. This is the way back in if the owner's phone is lost.`;

function flag(args: string[], name: string): string | null {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function requireId(args: string[]): string {
  const id = args[0];
  if (id === undefined || id.startsWith('--')) {
    throw new Error('Which account? Pass its id (see `user list`).');
  }
  return id;
}

async function main(): Promise<void> {
  const [command = '', ...args] = process.argv.slice(2);
  const db = getDb();

  if (command === 'list') {
    const rows = await listAccounts(db);
    if (rows.length === 0) {
      console.log('No accounts yet. Mint an invite with `pnpm --filter web invite new`.');
      return;
    }
    for (const row of rows) {
      const state = row.revoked
        ? `revoked${row.revokedReason === null ? '' : `: ${row.revokedReason}`}`
        : 'active';
      console.log(`${row.id}  ${row.role.padEnd(5)}  ${state.padEnd(20)}  ${row.displayName}`);
    }
    return;
  }

  if (command === 'revoke') {
    const id = requireId(args);
    const done = await revokeUser(db, id, flag(args, 'reason'), new Date());
    console.log(
      done
        ? `Revoked ${id}. Their sessions are gone and their bearer is refused.`
        : `No account ${id}.`,
    );
    return;
  }

  if (command === 'restore') {
    const id = requireId(args);
    console.log((await restoreUser(db, id)) ? `Restored ${id}.` : `No account ${id}.`);
    return;
  }

  if (command === 'promote') {
    const id = requireId(args);
    console.log((await promoteUser(db, id)) ? `${id} is now an admin.` : `No account ${id}.`);
    return;
  }

  if (command === 'delete') {
    const id = requireId(args);
    console.log(
      (await deleteUser(db, id))
        ? `Deleted ${id} and everything it had synced.`
        : `No account ${id}.`,
    );
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
