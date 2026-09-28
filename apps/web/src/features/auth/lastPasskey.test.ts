import { describe, expect, it } from 'vitest';
import { lastPasskeyId, rememberPasskey } from './lastPasskey';

/** The two methods these functions use, so the test needs no DOM. */
function fakeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe('the passkey that signed this browser in', () => {
  it('remembers the credential the ceremony used', () => {
    const storage = fakeStorage();
    rememberPasskey('credential-1', storage);
    expect(lastPasskeyId(storage)).toBe('credential-1');
  });

  it('is null before anything signed in here', () => {
    expect(lastPasskeyId(fakeStorage())).toBeNull();
  });

  it('is null, never a throw, when the browser refuses storage', () => {
    const refusing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => rememberPasskey('credential-1', refusing)).not.toThrow();
    expect(lastPasskeyId(refusing)).toBeNull();
  });
});
