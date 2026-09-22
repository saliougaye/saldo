import { useTranslation } from 'react-i18next';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { PERMISSION_ICONS } from '../../src/features/permissions/PermissionsList';
import {
  openSystemSettings,
  requestSystemPermission,
  SYSTEM_PERMISSIONS,
  useSystemPermissions,
} from '../../src/features/permissions/systemPermissions';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Profile → Permessi (§6.29): what onboarding's step 5 asked, afterwards. A permission never asked
 * is asked from here; a denied one can only come back from the system settings, so its row goes
 * there. The biometric lock is not here: it is the Profile's own toggle.
 */
export default function PermissionsSetting() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { states, refresh } = useSystemPermissions();

  return (
    <SettingScreen title={t('profile.permissions')} subtitle={t('profile.permissionsBody')}>
      {SYSTEM_PERMISSIONS.map((kind) => {
        const state = states?.[kind] ?? null;
        const trailing =
          state === null ? null : (
            <Text color={state === 'askable' ? 'text' : 'textMuted'}>
              {state === 'granted'
                ? t(`permissions.${kind}On`)
                : state === 'denied'
                  ? t(`permissions.${kind}Denied`)
                  : t('permissions.activate')}
            </Text>
          );
        const onPress =
          state === 'denied'
            ? openSystemSettings
            : state === 'askable'
              ? () => {
                  void requestSystemPermission(kind).then(refresh);
                }
              : undefined;
        return (
          <ListRow
            key={kind}
            testID={`profile-permission-${kind}`}
            title={t(`permissions.${kind}Title`)}
            subtitle={t(`permissions.${kind}Body`)}
            subtitleLines={2}
            leading={
              <IconBox name={PERMISSION_ICONS[kind]} colour={theme.palette.textMuted} small />
            }
            trailing={trailing}
            onPress={onPress}
            chevron={state === 'denied'}
          />
        );
      })}
    </SettingScreen>
  );
}
