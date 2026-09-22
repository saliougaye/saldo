import { motion } from '@saldo/ui';
import { Stack } from 'expo-router';
import { OnboardingProvider } from '../../src/features/onboarding/state';

/**
 * The steps share one draft; nothing is written until "Inizia" (§6.29). They also share one
 * motion: the screen leaving dissolves in place — no push, the steps are not a place the user
 * walks through — and the one arriving builds itself block by block (`StepHeader`).
 */
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          // iOS only honours this for fade-type transitions, which is the one used here.
          animationDuration: motion.stepExitMs,
        }}
      />
    </OnboardingProvider>
  );
}
