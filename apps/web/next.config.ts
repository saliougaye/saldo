import type { NextConfig } from 'next';

/**
 * §14: a standalone build is what the Docker image runs, and the workspace packages ship as
 * TypeScript source (`exports: './src/index.ts'`), so Next has to transpile them itself.
 */
const nextConfig: NextConfig = {
  // Next writes its own AGENTS.md/CLAUDE.md into this directory on every dev start, which would
  // shadow the repository's AGENTS.md for anything under apps/web.
  agentRules: false,
  // Standalone is for the Docker image, which runs `node server.js` against a traced copy of the
  // workspace. Vercel builds its own functions and has no use for it, so it is left off there:
  // `VERCEL` is set in every Vercel build, and nowhere else.
  output: process.env.VERCEL ? undefined : 'standalone',
  outputFileTracingRoot: `${import.meta.dirname}/../..`,
  transpilePackages: ['@saldo/core', '@saldo/i18n', '@saldo/ui'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        // §18: the auth pages run a WebAuthn ceremony and nothing else. No third-party origin is
        // needed, so everything but this origin is denied outright.
        source: '/auth/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'none'",
              "form-action 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
