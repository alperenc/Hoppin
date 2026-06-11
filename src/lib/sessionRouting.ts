import { isAuthAvailable, hasAuthenticatedSession } from '@/src/lib/auth';
import { getCurrentProfile } from '@/src/lib/hoppin';
import { hasCompletedOnboarding } from '@/src/lib/onboarding';

export type AppDestination = '/home' | '/auth' | '/onboarding';
export type ProtectedRouteResolution =
  | { status: 'ready' }
  | { status: 'redirect'; destination: Exclude<AppDestination, '/home'> };

export async function resolveAppDestination(): Promise<AppDestination> {
  if (isAuthAvailable) {
    const isSignedIn = await hasAuthenticatedSession();
    if (!isSignedIn) {
      return '/auth';
    }
  }

  const current = await getCurrentProfile();
  const onboardingDone = await hasCompletedOnboarding(current.id);
  return onboardingDone ? '/home' : '/onboarding';
}

export async function resolveProtectedRoute(): Promise<ProtectedRouteResolution> {
  const destination = await resolveAppDestination();
  if (destination === '/home') {
    return { status: 'ready' };
  }

  return { status: 'redirect', destination };
}

export async function shouldRouteErrorToAuth(): Promise<boolean> {
  if (!isAuthAvailable) {
    return false;
  }

  return !(await hasAuthenticatedSession());
}
