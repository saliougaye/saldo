// Monorepo Metro config: watch the workspace root so changes in packages/* reload,
// and resolve modules from both the app and the hoisted pnpm store.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Hierarchical lookup stays ON. It is disabled in Yarn/npm monorepos where everything is hoisted,
// but pnpm gives each package its own node_modules, so walking up is exactly how a dependency
// finds its own dependencies — turning it off makes expo-router fail to resolve
// @expo/metro-runtime.

// drizzle-kit's expo output imports the migration files as source, so Metro must treat .sql as a
// source extension (§7).
config.resolver.sourceExts.push('sql');

module.exports = config;
