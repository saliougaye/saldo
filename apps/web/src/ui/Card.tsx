import type { ReactNode } from 'react';
import { AppLink as Link } from './AppLink';
import styles from './Card.module.css';
import { Icon } from './Icon';
import { PanelLink } from './PanelNav';

interface CardProps {
  /** A card that opens something. Absent, the card is a box (it may hold links of its own). */
  href?: string;
  /** The card's whole panel key (`a:ID`), for a page whose panel lives in client state. */
  selectId?: string;
  /** No surface: «Non a budget», «Nessun obiettivo», «Nuovo conto». */
  ghost?: boolean;
  children: ReactNode;
}

/**
 * The §5.13 card of G2 (2026-10-11): a surface with a 1px inset border; on hover the border stays
 * and a shadow adds depth; a press scales to 0.96 (D11).
 */
export function Card({ href, selectId, ghost = false, children }: CardProps) {
  const className = `${styles.card} ${ghost ? styles.ghost : ''}`;
  if (href === undefined) return <div className={className}>{children}</div>;
  if (selectId !== undefined) {
    return (
      <PanelLink
        className={className}
        selectedClassName={styles.selected}
        selectId={selectId}
        href={href}
      >
        {children}
      </PanelLink>
    );
  }
  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

/** Three cards a row on a wide screen, two from 640px, one below. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

/** The card's first row: a ring or an icon box, the name, and a short figure at the end. */
export function CardHead({
  leading,
  name,
  meta,
  attention = false,
}: {
  leading?: ReactNode;
  name: string;
  meta?: string;
  attention?: boolean;
}) {
  return (
    <div className={styles.head}>
      {leading}
      <span className={styles.name}>{name}</span>
      {meta === undefined ? null : (
        <span className={`${styles.meta} ${attention ? styles.attention : ''}`}>{meta}</span>
      )}
    </div>
  );
}

/** A small label above a figure: «Uscite», «Non a budget». */
export function CardLabel({ children }: { children: ReactNode }) {
  return <span className={styles.label}>{children}</span>;
}

/** The line under the card's figure: «rimasti · 485,61 € spesi di 700,00 €». */
export function CardNote({ children }: { children: ReactNode }) {
  return <span className={styles.note}>{children}</span>;
}

/** The sentence at the foot of a target card: what to do. */
export function CardSentence({ children }: { children: ReactNode }) {
  return <p className={styles.sentence}>{children}</p>;
}

/** The action of a ghost card: a word and a chevron, the shape of «Tutte le transazioni». */
export function CardAction({ children }: { children: ReactNode }) {
  return (
    <span className={styles.action}>
      {children}
      <Icon name="chevR" size={16} />
    </span>
  );
}
