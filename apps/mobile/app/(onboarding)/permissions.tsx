import {
  answerFromRequest,
  answerFromUnlock,
  mergeOsState,
  type PermissionAnswer,
  type PermissionKey,
  todayLocal,
} from '@saldo/core';
import { systemTimeZone } from '@saldo/i18n';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { db } from '../../src/db/client';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { finishOnboarding } from '../../src/features/onboarding/finish';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ONBOARDING_STEPS, useOnboarding } from '../../src/features/onboarding/state';
import { PermissionsList } from '../../src/features/permissions/PermissionsList';
import {
  openSystemSettings,
  requestSystemPermission,
  SYSTEM_PERMISSIONS,
  useSystemPermissions,
} from '../../src/features/permissions/systemPermissions';
import { enterTabs } from '../../src/navigation/history';
import { Text } from '../../src/theme/Text';

/**
 * §6.29 step 5, on both paths: notifications, camera and the app lock, one at a time. Our sentence
 * comes first and the system prompt only on «Attiva», because iOS shows it once per install and
 * the in-context requests rely on it for everyone who chose «Più tardi». «Inizia» writes
 * everything the steps collected.
 */
export default function PermissionsStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { repos, kv } = useDatabase();
  const { draft, setDraft } = useOnboarding();
  const system = useSystemPermissions();
  const [answers, setAnswers] = useState<Record<PermissionKey, PermissionAnswer>>({
    notifications: 'pending',
    camera: 'pending',
    appLock: draft.appLock ? 'granted' : 'pending',
  });
  // A ref, not state: two taps in one frame would both read a stale `false` and prompt twice.
  const asking = useRef(false);
  const [saving, setSaving] = useState(false);

  // What the OS already decided fills the rows, and a return from the settings may upgrade them.
  useEffect(() => {
    const states = system.states;
    if (states === null) return;
    setAnswers((current) => {
      let next = current;
      for (const kind of SYSTEM_PERMISSIONS) {
        const merged = mergeOsState(current[kind], states[kind]);
        if (merged !== current[kind]) next = { ...next, [kind]: merged };
      }
      return next;
    });
  }, [system.states]);

  const answer = (kind: PermissionKey, value: PermissionAnswer) =>
    setAnswers((current) => ({ ...current, [kind]: value }));

  const activate = async (kind: PermissionKey) => {
    if (asking.current) return;
    asking.current = true;
    try {
      if (kind === 'appLock') {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('permissions.appLockPrompt'),
          // As on the lock screen: the passcode keeps the app reachable without biometrics.
          disableDeviceFallback: false,
        });
        const value = answerFromUnlock(result);
        answer('appLock', value);
        if (value === 'granted') setDraft({ appLock: true });
      } else {
        answer(kind, answerFromRequest(await requestSystemPermission(kind)));
      }
    } finally {
      asking.current = false;
    }
  };

  const finish = () => {
    setSaving(true);
    finishOnboarding(db, repos, kv, {
      draft,
      translate: (key) => t(`seed.${key}`),
      today: todayLocal(),
      completedAt: new Date().toISOString(),
      timeZone: systemTimeZone(),
    });
    enterTabs(router);
  };

  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-start"
          label={t('common.start')}
          loading={saving}
          onPress={finish}
        />
      }
    >
      <StepHeader
        step={{ current: 5, total: ONBOARDING_STEPS }}
        title={t('onboarding.permissionsTitle')}
        body={t('onboarding.permissionsBody')}
      />
      {/* Nothing until the first OS read: a granted row must not open for a frame first. */}
      {system.states === null ? null : (
        <>
          <StepChunk>
            <PermissionsList
              answers={answers}
              onActivate={(kind) => {
                void activate(kind);
              }}
              onLater={(kind) => answer(kind, 'later')}
              onOpenSettings={openSystemSettings}
            />
          </StepChunk>
          <StepChunk index={CHUNK.content + 1}>
            <Text size="caption" color="textFaint" style={{ marginTop: 12 }}>
              {t('onboarding.permissionsNote')}
            </Text>
          </StepChunk>
        </>
      )}
    </Screen>
  );
}
