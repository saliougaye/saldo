/**
 * Reanimated 4 reaches its runtime through `*.native.ts` files that expect a real native module, so
 * `import Animated` throws under Jest. Worklets ships a resolver that fixes this by dropping the
 * `.native` extension for its own files — but it decides "its own" with a bare
 * `basedir.includes('react-native-worklets')`, and under pnpm every package that merely has
 * Worklets as a peer lives in a directory named after it:
 *
 *     node_modules/.pnpm/expo-modules-core@57.0.17_react-native-worklets@0.10.1_…/node_modules/expo-modules-core
 *
 * That substring test therefore also strips `.native` from expo-modules-core, expo-image and
 * friends, which then load their web implementations and fail on `requireNativeViewManager`.
 *
 * So the delegation stays, but the question becomes "is this really the Worklets package?" — a path
 * segment rather than a substring.
 */
const WORKLETS = 'react-native-worklets';

const isWorklets = (request, basedir) =>
  request === WORKLETS ||
  request.startsWith(`${WORKLETS}/`) ||
  basedir.includes(`/node_modules/${WORKLETS}/`) ||
  basedir.endsWith(`/node_modules/${WORKLETS}`);

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) => {
  if (!isWorklets(request, options.basedir)) return options.defaultResolver(request, options);
  return options.defaultResolver(request, {
    ...options,
    extensions: options.extensions?.filter((ext) => !ext.includes('native')),
  });
};
