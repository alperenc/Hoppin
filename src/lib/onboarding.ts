import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_STORAGE_VERSION = 'v1';

function onboardingKey(profileId: string): string {
  return `hoppin:onboarding-complete:${ONBOARDING_STORAGE_VERSION}:${profileId}`;
}

export async function hasCompletedOnboarding(profileId?: string): Promise<boolean> {
  if (!profileId) return true;
  const raw = await AsyncStorage.getItem(onboardingKey(profileId));
  return raw === '1';
}

export async function markOnboardingComplete(profileId?: string): Promise<void> {
  if (!profileId) return;
  await AsyncStorage.setItem(onboardingKey(profileId), '1');
}

export async function clearOnboardingState(profileId?: string): Promise<void> {
  if (!profileId) return;
  await AsyncStorage.removeItem(onboardingKey(profileId));
}
