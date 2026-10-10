import Link from 'next/link';
import type { ComponentProps } from 'react';
import { LinkPending } from './NavPending';

/**
 * `next/link` for every link that navigates. It reports its pending state to the bar in the layout.
 * Import `Link` from here, never from `next/link`, except in this file. No `'use client'`: a server
 * component renders it as well, and `LinkPending` is the client part.
 */
export function AppLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <LinkPending />
    </Link>
  );
}
