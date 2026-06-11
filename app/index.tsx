import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AppDestination, resolveAppDestination, shouldRouteErrorToAuth } from '@/src/lib/sessionRouting';

export default function IndexRoute() {
  const [destination, setDestination] = useState<AppDestination | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      setRouteError(false);
      try {
        const nextDestination = await resolveAppDestination();
        if (mounted) {
          setDestination(nextDestination);
        }
      } catch {
        const shouldUseAuth = await shouldRouteErrorToAuth();
        if (!mounted) return;

        if (shouldUseAuth) {
          setDestination('/auth');
          return;
        }

        setRouteError(true);
      }
    };

    void resolve();

    return () => {
      mounted = false;
    };
  }, [attempt]);

  if (routeError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load your session</Text>
        <Text style={styles.errorText}>Your account is signed in, but Hoppin could not load the profile state.</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setDestination(null);
            setRouteError(false);
            setAttempt((current) => current + 1);
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!destination) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return <Redirect href={destination} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071022',
    padding: 16,
  },
  errorTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryText: {
    color: '#f8fafc',
    fontWeight: '800',
  },
});
