import styles from './EmptyState.module.css';

/** What a section says when it has nothing: one line, never a blank space (§6.39). */
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <p className={styles.empty}>
      <b className={styles.title}>{title}</b>
      {body === undefined ? null : <span className={styles.body}>{body}</span>}
    </p>
  );
}
