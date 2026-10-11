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
  /**
   * §17.1.4: a Server Action is refused when its `Origin` is not this deployment. Next compares
   * `Origin` with `Host`, which is right for a direct deployment and wrong behind a reverse proxy
   * that rewrites `Host` — so the origin is also named outright when `PUBLIC_URL` says what it is.
   *
   * Next 16.3.4's own types still nest `serverActions` under `experimental` (the plan's snippet has
   * it at the top level; `ExperimentalConfig` in `next/dist/server/config-shared.d.ts` says otherwise).
   */
  experimental: {
    serverActions: process.env.PUBLIC_URL
      ? { allowedOrigins: [new URL(process.env.PUBLIC_URL).host] }
      : undefined,
  },
  /**
   * The index pages of Profilo and Admin only redirect (`app/(app)/profile/page.tsx`,
   * `app/(app)/admin/page.tsx`). Under a `loading.tsx` that redirect streams after the shell and a
   * skeleton, with the status 200. Here it is a 307 before any render. The pages stay as the
   * fallback. A member still gets 404 for Admin: `/admin/accounts` answers it.
   */
  async redirects() {
    return [
      { source: '/profile', destination: '/profile/account', permanent: false },
      { source: '/admin', destination: '/admin/accounts', permanent: false },
    ];
  },
  async headers() {
    /**
     * React's development build uses `eval()` for its debugging features, so a policy without
     * `unsafe-eval` fills the console with a CSP violation on every page of `next dev`. Development
     * only: `next build` never needs it, and the header the Docker image serves is the strict one.
     */
    const scriptSrc =
      process.env.NODE_ENV === 'production'
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
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
        /**
         * §18: the app's own pages. Same shape as the `/auth` policy below, plus `form-action
         * 'self'`, which a Server Action's POST needs, and the fonts and images the pages load from
         * this origin. `/auth/**` keeps its stricter entry: both apply there, and the effective
         * policy is the intersection.
         */
        source: '/((?!api/).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              "connect-src 'self'",
              // §17.1.7: the service worker and the manifest. `default-src` already covers both;
              // naming them keeps installation working if `default-src` is ever tightened.
              "worker-src 'self'",
              "manifest-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'none'",
              "form-action 'self'",
            ].join('; '),
          },
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
              scriptSrc,
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
