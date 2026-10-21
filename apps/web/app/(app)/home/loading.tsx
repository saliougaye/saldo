import { SkeletonPending } from '../../../src/ui/NavPending';
import styles from './loading.module.css';

/**
 * H10, Loading: the four blocks of the Home in their places, with shapes and no data. A change of
 * tab shows the shell and this at once, while the server renders the page.
 */
export default function Loading() {
  return (
    <div className={styles.page} aria-hidden="true" data-skeleton="">
      <div className={`${styles.sk} ${styles.title}`} />
      <div className={`${styles.box} ${styles.summary}`}>
        <div>
          <div className={`${styles.sk} ${styles.label}`} />
          <div className={`${styles.sk} ${styles.figure}`} />
          <div className={styles.stats}>
            <div className={`${styles.sk} ${styles.stat}`} />
            <div className={`${styles.sk} ${styles.stat}`} />
            <div className={`${styles.sk} ${styles.stat}`} />
          </div>
        </div>
        <div className={`${styles.sk} ${styles.chart}`} />
      </div>
      <div className={styles.box}>
        <div className={`${styles.sk} ${styles.label}`} />
        <div className={styles.rings}>
          <div className={`${styles.sk} ${styles.ring}`} />
          <div className={`${styles.sk} ${styles.ring}`} />
          <div className={`${styles.sk} ${styles.ring}`} />
          <div className={`${styles.sk} ${styles.ring}`} />
        </div>
      </div>
      <div className={styles.box}>
        <div className={`${styles.sk} ${styles.label}`} />
        <div className={`${styles.sk} ${styles.line}`} />
        <div className={`${styles.sk} ${styles.line}`} />
        <div className={`${styles.sk} ${styles.line}`} />
      </div>
      <div className={styles.box}>
        <div className={`${styles.sk} ${styles.label}`} />
        <div className={`${styles.sk} ${styles.line}`} />
      </div>
      <SkeletonPending />
    </div>
  );
}
