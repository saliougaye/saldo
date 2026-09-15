import { router, Stack, Tabs } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { enterTabs, startOver } from './history';

const page = (name: string) => () => <Text>{name}</Text>;

/** The shape of the app's navigators, with nothing inside the screens. */
const ROUTES = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: page('boot'),
  '(tabs)/_layout': () => <Tabs />,
  '(tabs)/index': page('home'),
  '(tabs)/accounts': page('accounts'),
  '(onboarding)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
  '(onboarding)/period': page('period'),
  '(onboarding)/categories': page('categories'),
  lock: page('lock'),
  profile: page('profile'),
};

/**
 * Renders the app at `initialUrl` and returns a reader for the root stack's route names, bottom
 * first.
 *
 * A reader rather than the render result: `renderRouter` hangs its getters on what RNTL's `render`
 * returns, which in RNTL 14 is a promise, and awaiting it — or returning it from an async function —
 * hands back the plain result without them.
 */
async function open(initialUrl: string): Promise<() => string[]> {
  const rendered = renderRouter(ROUTES, { initialUrl });
  await rendered;
  return () => rendered.getRouterState()?.routes[0]?.state?.routes.map((route) => route.name) ?? [];
}

async function run(navigate: () => void): Promise<void> {
  await act(async () => {
    navigate();
  });
}

describe('enterTabs', () => {
  it('goes back to the tabs underneath instead of stacking a second copy on them', async () => {
    const rootStack = await open('/(tabs)');
    await run(() => router.push('/profile'));
    // What relocking over a pushed screen used to leave behind.
    await run(() => router.replace('/lock'));
    expect(rootStack()).toEqual(['(tabs)', 'lock']);

    await run(() => enterTabs(router));

    expect(rootStack()).toEqual(['(tabs)']);
  });

  it('leaves nothing under the tabs at the end of onboarding', async () => {
    const rootStack = await open('/period');
    await run(() => router.push('/categories'));

    await run(() => enterTabs(router));

    expect(rootStack()).toEqual(['(tabs)']);
  });
});

describe('startOver', () => {
  it('leaves nothing under the lock screen for a swipe to uncover', async () => {
    const rootStack = await open('/(tabs)');
    await run(() => router.push('/profile'));

    await run(() => startOver(router, '/lock'));

    expect(rootStack()).toEqual(['lock']);
  });

  it('leaves none of the signed-in screens under the boot router', async () => {
    const rootStack = await open('/(tabs)');
    await run(() => router.push('/profile'));

    await run(() => startOver(router, '/'));

    expect(rootStack()).toEqual(['index']);
  });
});
