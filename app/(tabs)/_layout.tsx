import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Compass, Map, Search, User } from 'lucide-react-native';
import { resolveProtectedRoute, shouldRouteErrorToAuth } from '@/src/lib/sessionRouting';

export default function TabLayout() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      setRouteError(false);
      try {
        const route = await resolveProtectedRoute();
        if (!mounted) return;

        if (route.status === 'redirect') {
          router.replace(route.destination);
          return;
        }

        setIsReady(true);
      } catch {
        const shouldUseAuth = await shouldRouteErrorToAuth();
        if (!mounted) return;

        if (shouldUseAuth) {
          router.replace('/auth');
          return;
        }

        setRouteError(true);
      }
    };

    void resolve();

    return () => {
      mounted = false;
    };
  }, [attempt, router]);

  if (routeError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load your passport</Text>
        <Text style={styles.errorText}>Your session is active, but the profile data did not load.</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setIsReady(false);
            setRouteError(false);
            setAttempt((current) => current + 1);
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0b1220',
          borderTopColor: '#1f2937',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Passport',
          tabBarIcon: ({ color }) => <Compass color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="passport"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <Map color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <Search color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={20} />,
        }}
      />
    </Tabs>
  );
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
