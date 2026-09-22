import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useSystemPermissions } from './systemPermissions';

let mockNotifications = { granted: false, canAskAgain: true };
let mockCamera = { granted: false, canAskAgain: false };

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => Promise.resolve(mockNotifications),
  requestPermissionsAsync: () => Promise.resolve(mockNotifications),
}));
jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: () => Promise.resolve(mockCamera),
  requestCameraPermissionsAsync: () => Promise.resolve(mockCamera),
}));

type ChangeHandler = (status: AppStateStatus) => void;
const handlers: ChangeHandler[] = [];

beforeEach(() => {
  mockNotifications = { granted: false, canAskAgain: true };
  mockCamera = { granted: false, canAskAgain: false };
  handlers.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    handlers.push(handler as ChangeHandler);
    return { remove: () => handlers.splice(handlers.indexOf(handler as ChangeHandler), 1) };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useSystemPermissions', () => {
  it('starts unknown, then maps what the OS reports', async () => {
    const { result } = await renderHook(() => useSystemPermissions());
    await waitFor(() => expect(result.current.states).not.toBeNull());
    expect(result.current.states).toEqual({ notifications: 'askable', camera: 'denied' });
  });

  it('reads again when the app comes back from the system settings', async () => {
    const { result } = await renderHook(() => useSystemPermissions());
    await waitFor(() => expect(result.current.states?.camera).toBe('denied'));
    mockCamera = { granted: true, canAskAgain: false };
    await act(async () => {
      for (const handler of handlers) handler('active');
    });
    await waitFor(() => expect(result.current.states?.camera).toBe('granted'));
  });
});
