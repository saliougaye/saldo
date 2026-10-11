import styles from './PageSkeleton.module.css';

/** The shape of a page while the server works: a title line, then blocks. It says nothing about the content. */
export function PageSkeleton({ blocks = 4 }: { blocks?: number }) {
  return (
    <div className={styles.page} aria-hidden="true">
      <div className={`${styles.line} ${styles.title}`} />
      {Array.from({ length: blocks }, (_, index) => (
        // The blocks never change order: the index is the identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={index} className={`${styles.line} ${styles.block}`} />
      ))}
    </div>
  );
}
