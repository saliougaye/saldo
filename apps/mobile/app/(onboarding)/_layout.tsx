import { Stack } from 'expo-router';
import { OnboardingProvider } from '../../src/features/onboarding/state';

/** The three steps share one draft; nothing is written until "Inizia" (§6.29). */
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}
