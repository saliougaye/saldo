import type { ReactNode } from 'react';
import styles from './Alert.module.css';
import { Icon } from './Icon';

interface Props {
  /** A one-line alert has no title: the body is the whole message. */
  title?: string;
  body: string;
  /**
   * There on load, not in answer to something the person did («MCP è disattivato»): no
   * `role="alert"`, so a screen reader does not interrupt the page to read it.
   */
  quiet?: boolean;
  /** Under the body: a link that acts on the message («Apri Admin › MCP»). */
  children?: ReactNode;
}

/** `role="alert"` unless `quiet`: it appears in answer to something the person just did, so it is announced. */
export function Alert({ title, body, quiet = false, children }: Props) {
  return (
    <div className={styles.alert} role={quiet ? undefined : 'alert'}>
      <Icon name="info" size={18} className={styles.icon} />
      <div>
        {title === undefined ? null : <b className={styles.title}>{title}</b>}
        {body}
        {children === undefined ? null : <div className={styles.action}>{children}</div>}
      </div>
    </div>
  );
}
