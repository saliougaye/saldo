import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { View } from 'react-native';
import migrations from '../../drizzle/migrations';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { db } from './client';
import { createKvStore, type KvStore } from './kv';
import { createRepositories, type Repositories } from './repositories';

export interface DatabaseValue {
  repos: Repositories;
  kv: KvStore;
}

const DatabaseContext = createContext<DatabaseValue | null>(null);

function CenteredMessage({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
        backgroundColor: theme.palette.bg,
      }}
    >
      <Text size="title" weight="semibold" tracking="tighter">
        {title}
      </Text>
      <Text color="textMuted" style={{ textAlign: 'center' }}>
        {body}
      </Text>
    </View>
  );
}

/**
 * Applies migrations before anything reads the database (§7). A failure blocks the app rather than
 * letting screens run against a half-migrated schema.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const value = useMemo<DatabaseValue>(
    () => ({ repos: createRepositories(db), kv: createKvStore(db) }),
    [],
  );
  if (error) return <CenteredMessage title="Saldo" body={error.message} />;
  if (!success) return null;
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseValue {
  const value = useContext(DatabaseContext);
  if (value === null) throw new Error('useDatabase must be used inside a DatabaseProvider');
  return value;
}

export function useRepositories(): Repositories {
  return useDatabase().repos;
}
