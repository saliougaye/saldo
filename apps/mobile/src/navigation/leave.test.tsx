import { router, Stack, Tabs } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { type Gone, showsGone, useLeaveGone } from './leave';

const page = (name: string) => () => <Text>{name}</Text>;

/** The editor under test hands its `leave` out, so a test can call it the way a button would. */
let leave: (gone: Gone) => void = () => {
  throw new Error('no editor rendered');
};
function Editor() {
  leave = useLeaveGone();
  return <Text>editor</Text>;
}

/** The root stack's screens that show a row, with nothing inside them. */
const ROUTES = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/_layout': () => <Tabs />,
  '(tabs)/index': page('home'),
  '(tabs)/stats': page('stats'),
  'settings/categories': page('categories'),
  'category/[id]': page('category'),
  'category/edit/[id]': Editor,
  'transaction/[id]': page('transaction'),
  'transaction/edit/[id]': Editor,
};

/** Same reader as `history.test.tsx`: the root stack's routes, bottom first. */
async function open(initialUrl: string): Promise<() => string[]> {
  const rendered = renderRouter(ROUTES, { initialUrl });
  await rendered;
  return () =>
    rendered.getRouterState()?.routes[0]?.state?.routes.map((route) => {
      const params = route.params as { id?: string } | undefined;
      return params?.id === undefined ? route.name : `${route.name}:${params.id}`;
    }) ?? [];
}

async function run(navigate: () => void): Promise<void> {
  await act(async () => {
    navigate();
  });
}

describe('showsGone', () => {
  const gone: Gone = { kind: 'category', ids: ['a', 'b'] };

  it('matches the detail and the editor of a gone row', () => {
    expect(showsGone({ name: 'category/[id]', params: { id: 'a' } }, gone)).toBe(true);
    expect(showsGone({ name: 'category/edit/[id]', params: { id: 'b' } }, gone)).toBe(true);
  });

  it('leaves other rows, other kinds and screens without an id alone', () => {
    expect(showsGone({ name: 'category/[id]', params: { id: 'c' } }, gone)).toBe(false);
    expect(showsGone({ name: 'transaction/[id]', params: { id: 'a' } }, gone)).toBe(false);
    expect(showsGone({ name: 'settings/categories' }, gone)).toBe(false);
  });
});

describe('useLeaveGone', () => {
  it('returns to the list the row was opened from, not to its detail', async () => {
    const rootStack = await open('/(tabs)');
    await run(() => router.push('/settings/categories'));
    await run(() => router.push('/category/a'));
    await run(() => router.push('/category/edit/a'));

    await run(() => leave({ kind: 'category', ids: ['a'] }));

    expect(rootStack()).toEqual(['(tabs)', 'settings/categories']);
  });

  it('removes a copy of the row further down, so a swipe back cannot reach it', async () => {
    const rootStack = await open('/(tabs)');
    await run(() => router.push('/category/a'));
    await run(() => router.push('/transaction/t1'));
    await run(() => router.push('/category/a'));
    await run(() => router.push('/category/edit/a'));

    await run(() => leave({ kind: 'category', ids: ['a'] }));

    expect(rootStack()).toEqual(['(tabs)', 'transaction/[id]:t1']);
  });

  it('removes the screens of every row that went with it', async () => {
    const rootStack = await open('/(tabs)');
    await run(() => router.push('/category/child'));
    await run(() => router.push('/category/parent'));
    await run(() => router.push('/category/edit/parent'));

    await run(() => leave({ kind: 'category', ids: ['parent', 'child'] }));

    expect(rootStack()).toEqual(['(tabs)']);
  });

  it('keeps screens of other rows', async () => {
    const rootStack = await open('/(tabs)');
    await run(() => router.push('/category/b'));
    await run(() => router.push('/transaction/t1'));
    await run(() => router.push('/transaction/edit/t1'));

    await run(() => leave({ kind: 'transaction', ids: ['t1'] }));

    expect(rootStack()).toEqual(['(tabs)', 'category/[id]:b']);
  });

  it('falls back to the tabs when the editor was all there was', async () => {
    const rootStack = await open('/category/edit/a');

    await run(() => leave({ kind: 'category', ids: ['a'] }));

    expect(rootStack()).toEqual(['(tabs)']);
  });
});
