import { useTranslation } from 'react-i18next';
import { NotFoundScreen } from '../src/components/NotFoundScreen';

/**
 * A link that matches no screen (`saldo://does-not-exist`). Without this route Expo Router shows
 * its own «Unmatched Route» page: unthemed, in English, with a «Sitemap» link the app has no use
 * for. «Go back» leaves the same way as on a record that is gone, and lands on Home when the link
 * opened the app with nothing behind it.
 */
export default function UnknownLink() {
  const { t } = useTranslation();
  return <NotFoundScreen title={t('common.unknownLinkTitle')} body={t('common.unknownLinkBody')} />;
}
