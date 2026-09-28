import styles from './Brand.module.css';

/** The wordmark, and the instance's own name beside it (`WEBAUTHN_RP_NAME`) so a person with an
 * invite can see whose server they are on. */
export function Brand({ instanceName }: { instanceName?: string }) {
  return (
    <div className={styles.brand}>
      <span className={styles.mark}>S</span>
      <span className={styles.name}>Saldo</span>
      {instanceName === undefined ? null : (
        <span className={styles.instance}>· {instanceName}</span>
      )}
    </div>
  );
}

/** §17.1.1: the version and the host live at the foot of the sign-in page. */
export function AuthFooter({ version, host }: { version: string; host: string }) {
  return (
    <div className={styles.footer}>
      <span>Saldo {version}</span>
      <span>·</span>
      <span>{host}</span>
    </div>
  );
}
