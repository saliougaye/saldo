import type { ReactNode } from 'react';
import styles from './ChartFrame.module.css';

/** A chart's title row (name, then its figure), the chart, and its foot. Home's §5.6 frame. */
export function ChartFrame({
  title,
  value,
  foot,
  children,
}: {
  title: string;
  value?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <div className={styles.head}>
        <span>{title}</span>
        {value}
      </div>
      {children}
      {foot === undefined ? null : <div className={styles.foot}>{foot}</div>}
    </div>
  );
}
