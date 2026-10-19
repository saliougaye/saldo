import type { Translate } from '@saldo/i18n';

/**
 * The two messages the server sends (§17.1.4, 0.3f-3 decision 4). Plain text: what this is, the link
 * alone on its own line so a mail client makes it one tap, how long it lasts, and that ignoring it is
 * safe. The caller picks the language — `t` is already the recipient's.
 */
export interface MessageDetails {
  /** The instance's name, as the admin set it. */
  instance: string;
  /** The host of `PUBLIC_URL`, so the reader can see which server this is. */
  host: string;
  /** The link. Never logged. */
  url: string;
}

export interface Message {
  subject: string;
  text: string;
}

/** A subject is one line: an instance name with line breaks must not add headers of its own. */
const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

function compose(
  t: Translate,
  kind: 'verification' | 'recovery' | 'emailChange',
  details: MessageDetails,
): Message {
  const vars = { instance: oneLine(details.instance), host: details.host };
  return {
    subject: t(`mail.${kind}.subject`, vars),
    text: [
      t(`mail.${kind}.intro`, vars),
      '',
      details.url,
      '',
      t(`mail.${kind}.expires`),
      '',
      t('mail.ignore'),
    ].join('\n'),
  };
}

export const verificationMessage = (t: Translate, details: MessageDetails): Message =>
  compose(t, 'verification', details);

export const recoveryMessage = (t: Translate, details: MessageDetails): Message =>
  compose(t, 'recovery', details);

export const emailChangeMessage = (t: Translate, details: MessageDetails): Message =>
  compose(t, 'emailChange', details);

/**
 * The notice to the address an account has just left (0.3f change of address). No link: nothing in
 * it can be opened by somebody who is not the owner. The new address is shown masked.
 */
export function emailChangedMessage(
  t: Translate,
  details: { instance: string; host: string; newEmail: string },
): Message {
  const vars = {
    instance: oneLine(details.instance),
    host: details.host,
    newEmail: details.newEmail,
  };
  return {
    subject: t('mail.emailChanged.subject', vars),
    text: [t('mail.emailChanged.intro', vars), '', t('mail.emailChanged.warning', vars)].join('\n'),
  };
}
