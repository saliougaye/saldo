import type { IconName } from '@saldo/ui';
import { Icon } from '../../../../src/ui/Icon';
import authStyles from '../../auth.module.css';
import styles from './consent.module.css';

/**
 * The consent page when there is nothing to authorize: refused («Accesso negato»), switched off
 * («MCP è disattivato») or a link that no longer reads. The mockup's `.center` with «Torna a Saldo».
 */
export function ConsentStop({
  icon,
  title,
  body,
  back,
}: {
  icon: IconName;
  title: string;
  body: string;
  back: string;
}) {
  return (
    <>
      <div className={styles.center}>
        <span className={authStyles.passkeyArt}>
          <Icon name={icon} size={28} />
        </span>
        <h1 className={authStyles.title}>{title}</h1>
        <p className={styles.lede}>{body}</p>
      </div>
      <a className={authStyles.secondaryLink} href="/">
        {back}
      </a>
    </>
  );
}
