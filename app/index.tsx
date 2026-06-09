import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { isAuthAvailable, hasAuthenticatedSession } from '@/src/lib/auth';
import { getCurrentProfile } from '@/src/lib/hoppin';
import { hasCompletedOnboarding } from '@/src/lib/onboarding';

type Destination = '/(tabs)' | '/auth' | '/onboarding';

export default function IndexRoute() {
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    const resolve = async () => {
      try {
        if (isAuthAvailable) {
          const isSignedIn = await hasAuthenticatedSession();
          if (!isSignedIn) {
            setDestination('/auth');
            return;
          }
        }

        const current = await getCurrentProfile();
        const onboardingDone = await hasCompletedOnboarding(current.id);
        setDestination(onboardingDone ? '/(tabs)' : '/onboarding');
      } catch {
        if (isAuthAvailable) {
          setDestination('/auth');
          return;
        }
        const current = await getCurrentProfile();
        const onboardingDone = await hasCompletedOnboarding(current.id);
        setDestination(onboardingDone ? '/(tabs)' : '/onboarding');
      }
    };

    void resolve();
  }, []);

  if (!destination) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#071022' }}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return <Redirect href={destination} />;
}
