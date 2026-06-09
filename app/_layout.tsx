import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { isAuthAvailable, onAuthStateChange } from '@/src/lib/auth';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthAvailable) {
      return;
    }

    const subscription = onAuthStateChange((_event, state) => {
      if (!state.session) {
        router.replace('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export function AppErrorBoundary() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Something went wrong with Hoppin.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#9a3412',
    fontSize: 16,
  },
});
