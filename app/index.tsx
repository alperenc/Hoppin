import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Beer, ChevronRight, MapPinned, Sparkles, UsersRound } from 'lucide-react-native';
import { AppDestination, resolveAppDestination, shouldRouteErrorToAuth } from '@/src/lib/sessionRouting';

export default function IndexRoute() {
  const router = useRouter();
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

  if (destination === '/auth') {
    return (
      <ScrollView style={styles.guestScreen} contentContainerStyle={styles.guestContent}>
        <View style={styles.guestHero}>
          <View style={styles.kickerRow}>
            <Sparkles color="#f59e0b" size={16} />
            <Text style={styles.kicker}>Hoppin Passport</Text>
          </View>
          <Text style={styles.guestTitle}>Turn tonight's pour into a place on your map.</Text>
          <Text style={styles.guestSubtitle}>
            Start with one beer, one venue, or one city. Hoppin turns the memory into a passport stamp you can revisit, share, and build into a trail.
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/auth')}>
              <Text style={styles.primaryActionText}>Start stamping</Text>
              <ChevronRight color="#052e16" size={18} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/auth')}>
              <Text style={styles.secondaryActionText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.emptyPassport}>
          <View style={styles.passportTop}>
            <View>
              <Text style={styles.passportLabel}>Your first stamp</Text>
              <Text style={styles.passportTitle}>Waiting for a pour</Text>
            </View>
            <View style={styles.zeroBadge}>
              <Text style={styles.zeroBadgeText}>0</Text>
            </View>
          </View>
          <View style={styles.routeLine}>
            <View style={[styles.routeDot, styles.routeDotStart]} />
            <View style={styles.routeSegment} />
            <View style={styles.routeDot} />
            <View style={styles.routeSegment} />
            <View style={[styles.routeDot, styles.routeDotEnd]} />
          </View>
          <View style={styles.emptyMetaRow}>
            <Text style={styles.emptyMeta}>Beer</Text>
            <Text style={styles.emptyMeta}>Place</Text>
            <Text style={styles.emptyMeta}>Memory</Text>
          </View>
        </View>

        <View style={styles.featureGrid}>
          <View style={styles.featureCard}>
            <Beer color="#f59e0b" size={22} />
            <Text style={styles.featureTitle}>Stamp the glass</Text>
            <Text style={styles.featureText}>Save the beer, style, rating, and note without filling a long form.</Text>
          </View>
          <View style={styles.featureCard}>
            <MapPinned color="#22c55e" size={22} />
            <Text style={styles.featureTitle}>Build the map</Text>
            <Text style={styles.featureText}>Turn venues and cities into a beer passport that grows trip by trip.</Text>
          </View>
          <View style={styles.featureCard}>
            <UsersRound color="#38bdf8" size={22} />
            <Text style={styles.featureTitle}>Follow the trail</Text>
            <Text style={styles.featureText}>Find creators and friends whose stamps make the next stop easier to choose.</Text>
          </View>
        </View>
      </ScrollView>
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
  guestScreen: {
    flex: 1,
    backgroundColor: '#071022',
  },
  guestContent: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 980,
    padding: 16,
    paddingBottom: 32,
    paddingTop: 48,
    width: '100%',
  },
  guestHero: {
    gap: 12,
  },
  kickerRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0b1220',
    borderColor: '#334155',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  kicker: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  guestTitle: {
    color: '#f8fafc',
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 44,
  },
  guestSubtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#052e16',
    fontWeight: '900',
  },
  secondaryAction: {
    alignItems: 'center',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: '#e2e8f0',
    fontWeight: '800',
  },
  emptyPassport: {
    backgroundColor: '#0f172a',
    borderColor: '#1f3a5f',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  passportTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  passportLabel: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  passportTitle: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  zeroBadge: {
    alignItems: 'center',
    backgroundColor: '#172554',
    borderColor: '#38bdf8',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  zeroBadgeText: {
    color: '#bae6fd',
    fontSize: 20,
    fontWeight: '900',
  },
  routeLine: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 18,
  },
  routeDot: {
    backgroundColor: '#38bdf8',
    borderColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    width: 16,
  },
  routeDotStart: {
    backgroundColor: '#f59e0b',
  },
  routeDotEnd: {
    backgroundColor: '#22c55e',
  },
  routeSegment: {
    backgroundColor: '#334155',
    flex: 1,
    height: 3,
  },
  emptyMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyMeta: {
    backgroundColor: '#172554',
    borderRadius: 999,
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featureGrid: {
    gap: 10,
  },
  featureCard: {
    backgroundColor: '#0b1220',
    borderColor: '#1f2937',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minHeight: 132,
    padding: 14,
  },
  featureTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
  },
  featureText: {
    color: '#94a3b8',
    lineHeight: 20,
  },
});
