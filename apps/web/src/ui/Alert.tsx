import styles from './Alert.module.css';
import { Icon } from './Icon';

interface Props {
  title: string;
  body: string;
}

/** `role="alert"`: it appears in answer to something the person just did, so it is announced. */
export function Alert({ title, body }: Props) {
  return (
    <div className={styles.alert} role="alert">
      <Icon name="info" size={18} className={styles.icon} />
      <div>
        <b className={styles.title}>{title}</b>
        {body}
      </div>
    </div>
  );
}
