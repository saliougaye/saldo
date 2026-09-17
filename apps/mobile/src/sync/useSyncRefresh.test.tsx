import { act, renderHook } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../i18n';
import type { Scheduler, SyncStatus } from './scheduler';
import { useSyncRefresh } from './useSyncRefresh';

const mockShow = jest.fn();
let mockScheduler: Scheduler | null = null;
let mockCanSync = true;

jest.mock('../components/Toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('./syncContext', () => ({
  useSync: () => ({ scheduler: mockScheduler, canSync: mockCanSync }),
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockShow.mockClear();
  mockCanSync = true;
});

function wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/** A scheduler whose one cycle ends, in `ending`, only when the test says so. */
function schedulerEndingIn(ending: SyncStatus) {
  let status: SyncStatus = { kind: 'syncing' };
  let finish = () => {};
  const scheduler: Scheduler = {
    start: jest.fn(),
    stop: jest.fn(),
    requestSync: jest.fn(),
    exclusive: (task) => task(),
    subscribe: () => () => undefined,
    status: () => status,
    syncNow: jest.fn(
      () =>
        new Promise<null>((resolve) => {
          finish = () => {
            status = ending;
            resolve(null);
          };
        }),
    ),
  };
  return { scheduler, finish: () => finish() };
}

describe('useSyncRefresh', () => {
  it('offers no pull on a build with nothing to sync with', async () => {
    mockScheduler = null;
    const { result } = await renderHook(() => useSyncRefresh(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('offers no pull while signed out', async () => {
    mockScheduler = schedulerEndingIn({ kind: 'idle', lastSyncAt: 1 }).scheduler;
    mockCanSync = false;
    const { result } = await renderHook(() => useSyncRefresh(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('spins from the pull until the cycle is over, and says nothing when it worked', async () => {
    const fake = schedulerEndingIn({ kind: 'idle', lastSyncAt: 1 });
    mockScheduler = fake.scheduler;
    const { result } = await renderHook(() => useSyncRefresh(), { wrapper });

    await act(async () => result.current?.onRefresh());
    expect(result.current?.refreshing).toBe(true);
    expect(fake.scheduler.syncNow).toHaveBeenCalledTimes(1);

    await act(async () => fake.finish());
    expect(result.current?.refreshing).toBe(false);
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('says it could not sync when the server was out of reach', async () => {
    const fake = schedulerEndingIn({
      kind: 'error',
      code: 'network_error',
      message: 'offline',
      retryAt: 5,
    });
    mockScheduler = fake.scheduler;
    const { result } = await renderHook(() => useSyncRefresh(), { wrapper });

    await act(async () => result.current?.onRefresh());
    await act(async () => fake.finish());

    expect(mockShow).toHaveBeenCalledWith(
      'Could not sync. Everything stays on this phone until it can.',
    );
    expect(result.current?.refreshing).toBe(false);
  });
});
