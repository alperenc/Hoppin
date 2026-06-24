import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { PassportMapPanel } from '@/src/components/PassportMapPanel';
import { useWebPullToRefresh } from '@/src/components/useWebPullToRefresh';
import { CityVisit, CityVisitor, CityStamp, PassportSummary, Profile, Trail } from '@/src/types/hoppin';
import {
  checkinVisibilityLabel,
  createTrailFromCityVisit,
  getCurrentProfile,
  getPassportSummary,
  listCityTrips,
  listMyTrails,
  listPassportStamps,
  listPublicCityVisitors,
} from '@/src/lib/hoppin';

const ALL_COUNTRIES = 'All';

const dateOptions: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

const asSafeDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, dateOptions);
};

const visitRangeLabel = (visit: CityVisit): string => {
  if (visit.firstVisitedAt === visit.lastVisitedAt) {
    return asSafeDate(visit.lastVisitedAt);
  }
  return `${asSafeDate(visit.firstVisitedAt)} → ${asSafeDate(visit.lastVisitedAt)}`;
};

const cityKey = (city: string, country: string) => `${city.toLowerCase()}-${country.toLowerCase()}`;

export default function Passport() {
  const router = useRouter();
  const isMountedRef = useRef(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<PassportSummary | null>(null);
  const [stamps, setStamps] = useState<CityStamp[]>([]);
  const [trips, setTrips] = useState<CityVisit[]>([]);
  const [savedTrails, setSavedTrails] = useState<Trail[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>(ALL_COUNTRIES);
  const [selectedVisit, setSelectedVisit] = useState<CityVisit | null>(null);
  const [visitors, setVisitors] = useState<CityVisitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingVisitors, setIsLoadingVisitors] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const loadPassport = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(undefined);

    try {
      const currentProfile = await getCurrentProfile();
      const [passportSummary, passportStamps, cityTrips, explicitTrails] = await Promise.all([
        getPassportSummary(currentProfile.id),
        listPassportStamps(currentProfile.id),
        listCityTrips(currentProfile.id),
        listMyTrails(currentProfile.id),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      const discoveredCountries = Array.from(new Set(cityTrips.map((trip) => trip.country))).sort();

      setMe(currentProfile);
      setSummary(passportSummary);
      setStamps(passportStamps);
      setTrips(cityTrips);
      setSavedTrails(explicitTrails);
      setCountries(discoveredCountries);

      const nextSelection = cityTrips[0] ?? null;
      setSelectedCountry((previous) => {
        if (previous !== ALL_COUNTRIES && discoveredCountries.includes(previous)) {
          return previous;
        }
        return ALL_COUNTRIES;
      });
      setSelectedVisit((previous) => {
        if (!cityTrips.length) {
          return null;
        }

        if (previous && cityTrips.some((trip) => trip.city === previous.city && trip.country === previous.country)) {
          return previous;
        }

        return nextSelection;
      });
    } catch {
      if (isMountedRef.current) {
        setErrorMessage('Could not load passport data.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      void loadPassport();

      return () => {
        isMountedRef.current = false;
      };
    }, [loadPassport])
  );

  const refreshPassport = useCallback(() => {
    void loadPassport('refresh');
  }, [loadPassport]);
  const { refreshControl, webPullHandlers, webRefreshIndicator } = useWebPullToRefresh({
    onRefresh: refreshPassport,
    refreshing: isRefreshing,
    tintColor: '#60a5fa',
  });

  const filteredTrips = useMemo<CityVisit[]>(() => {
    if (selectedCountry === ALL_COUNTRIES) {
      return trips;
    }
    return trips.filter((trip) => trip.country === selectedCountry);
  }, [selectedCountry, trips]);

  useEffect(() => {
    let mounted = true;

    if (!filteredTrips.length) {
      setSelectedVisit(null);
      setVisitors([]);
      setIsLoadingVisitors(false);
      return;
    }

    const effectiveSelection =
      selectedVisit && filteredTrips.some((trip) => trip.city === selectedVisit.city && trip.country === selectedVisit.country)
        ? selectedVisit
        : filteredTrips[0];

    setSelectedVisit((current) => {
      if (current && filteredTrips.some((trip) => trip.city === current.city && trip.country === current.country)) {
        return current;
      }
      return filteredTrips[0]!;
    });

    if (!me) {
      return;
    }

    setIsLoadingVisitors(true);

    const refreshVisitors = async () => {
      if (!effectiveSelection) {
        setVisitors([]);
        setIsLoadingVisitors(false);
        return;
      }

      const peerVisitors = await listPublicCityVisitors(effectiveSelection.city, effectiveSelection.country, me.id);
      if (!mounted) {
        return;
      }
      setVisitors(peerVisitors);
      setIsLoadingVisitors(false);
    };

    void refreshVisitors();

    return () => {
      mounted = false;
    };
  }, [filteredTrips, me, selectedCountry, selectedVisit]);

  const cityMapByKey = useMemo(() => {
    const index = new Map<string, CityVisit>();
    for (const trip of trips) {
      index.set(cityKey(trip.city, trip.country), trip);
    }
    return index;
  }, [trips]);

  const mapReadyStamps = useMemo<CityStamp[]>(() => {
    return stamps.filter((stamp) => Number.isFinite(stamp.lat) && Number.isFinite(stamp.lng));
  }, [stamps]);

  const visibleMapStamps = useMemo<CityStamp[]>(() => {
    if (selectedCountry === ALL_COUNTRIES) {
      return mapReadyStamps;
    }
    return mapReadyStamps.filter((stamp) => stamp.country === selectedCountry);
  }, [mapReadyStamps, selectedCountry]);

  const saveSuggestedTrail = async (trip: CityVisit) => {
    if (!me) return;
    try {
      const trail = await createTrailFromCityVisit(me.id, trip.city, trip.country);
      setSavedTrails((current) => [trail, ...current.filter((savedTrail) => savedTrail.id !== trail.id)]);
      router.push(`/trail/${trail.id}`);
    } catch {
      Alert.alert('Trail not saved', 'Could not save this passport suggestion as a trail.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (errorMessage && !summary && trips.length === 0 && stamps.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Text style={styles.subtitle}>Try again from the check-in screen after adding data.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={refreshControl}
      {...webPullHandlers}
    >
      {webRefreshIndicator}
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Trails</Text>
          <Text style={styles.subtitle}>Build beer routes from individual stamps, then share the best runs with followers.</Text>
          <Text style={styles.handle}>{me ? me.displayName : 'Unknown'}</Text>
        </View>
        <Link href="/trail/new" asChild>
          <TouchableOpacity style={styles.createButton}>
            <Text style={styles.createButtonText}>Create trail</Text>
          </TouchableOpacity>
        </Link>
      </View>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={[styles.card, styles.mapCard]}>
        <PassportMapPanel
          cityMapByKey={cityMapByKey}
          selectedVisit={selectedVisit}
          storageScopeId={me?.id ?? 'anonymous'}
          stamps={visibleMapStamps}
          onSelectVisit={setSelectedVisit}
        />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{summary?.countriesCount ?? 0}</Text>
          <Text style={styles.metricLabel}>Countries</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{summary?.citiesCount ?? 0}</Text>
          <Text style={styles.metricLabel}>Cities</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{summary?.checkinsCount ?? 0}</Text>
          <Text style={styles.metricLabel}>Stamps</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your trails</Text>
        <Text style={styles.sectionMeta}>{savedTrails.length} saved</Text>
      </View>
      <View style={styles.card}>
        {savedTrails.length ? (
          savedTrails.map((trail) => (
            <Link href={`/trail/${trail.id}`} key={trail.id} asChild>
              <TouchableOpacity style={styles.savedTrailCard}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineCity}>{trail.title}</Text>
                  <Text style={styles.timelineCount}>{trail.itemCount} stops</Text>
                </View>
                <Text style={styles.timelineMeta}>{checkinVisibilityLabel(trail.privacy)} - updated {asSafeDate(trail.updatedAt)}</Text>
              </TouchableOpacity>
            </Link>
          ))
        ) : (
          <View style={styles.emptyTrailState}>
            <Text style={styles.emptyTrailTitle}>Create your first trail.</Text>
            <Text style={styles.emptyText}>Start with an empty private draft or save a passport suggestion below.</Text>
            <Link href="/trail/new" asChild>
              <TouchableOpacity style={styles.emptyTrailAction}>
                <Text style={styles.emptyTrailActionText}>Create trail</Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Country filters</Text>
      <ScrollView
        horizontal
        contentContainerStyle={styles.chipRow}
        showsHorizontalScrollIndicator={false}
      >
        <TouchableOpacity
          key={ALL_COUNTRIES}
          style={[styles.chip, selectedCountry === ALL_COUNTRIES ? styles.chipActive : styles.chipIdle]}
          onPress={() => {
            setSelectedCountry(ALL_COUNTRIES);
          }}
        >
          <Text style={selectedCountry === ALL_COUNTRIES ? styles.chipTextActive : styles.chipTextIdle}>{ALL_COUNTRIES}</Text>
        </TouchableOpacity>
        {countries.map((country) => {
          const active = selectedCountry === country;
          return (
            <TouchableOpacity
              key={country}
              style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
              onPress={() => {
                setSelectedCountry(country);
              }}
            >
              <Text style={active ? styles.chipTextActive : styles.chipTextIdle}>{country}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionTitle}>Suggested from your passport</Text>
      <View style={styles.card}>
        {!filteredTrips.length ? (
          <Text style={styles.emptyText}>No passport suggestions in this view yet.</Text>
        ) : (
          filteredTrips.map((trip) => {
            const selected = selectedVisit?.city === trip.city && selectedVisit?.country === trip.country;
            return (
              <TouchableOpacity
                key={cityKey(trip.city, trip.country)}
                style={[styles.timelineCard, selected && styles.timelineCardActive]}
                onPress={() => setSelectedVisit(trip)}
              >
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineCity}>{trip.city}</Text>
                  <Text style={styles.timelineCount}>{trip.checkinCount} check-ins</Text>
                </View>
                <Text style={styles.timelineMeta}>{trip.country}</Text>
                <Text style={styles.timelineMeta}>{visitRangeLabel(trip)}</Text>
                <TouchableOpacity style={styles.saveTrailButton} onPress={() => saveSuggestedTrail(trip)}>
                  <Text style={styles.saveTrailButtonText}>Save as trail</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <Text style={styles.sectionTitle}>Who stamped this stop</Text>
      <View style={styles.card}>
        {!selectedVisit ? (
          <Text style={styles.emptyText}>Pick a trail stop or marker to see social overlap.</Text>
        ) : (
          <>
            <Text style={styles.visitorHeader}>
              {selectedVisit.city}, {selectedVisit.country}
            </Text>
            {isLoadingVisitors ? (
              <ActivityIndicator size="small" color="#60a5fa" />
            ) : visitors.length === 0 ? (
              <Text style={styles.emptyText}>No other public check-ins in this city.</Text>
            ) : (
              <View style={styles.visitorList}>
                {visitors.map((visitor) => (
                  <Link href={`/user/${visitor.username}`} key={visitor.profileId} asChild>
                    <TouchableOpacity style={styles.visitorItem}>
                      <Text style={styles.visitorName}>{visitor.displayName}</Text>
                      <Text style={styles.visitorHandle}>@{visitor.username}</Text>
                    </TouchableOpacity>
                  </Link>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071022',
  },
  content: {
    padding: 16,
    paddingTop: 48,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071022',
    padding: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 8,
  },
  handle: {
    color: '#9ca3af',
    marginTop: 8,
    marginBottom: 8,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
  },
  createButton: {
    borderRadius: 8,
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  createButtonText: {
    color: '#052e16',
    fontWeight: '900',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#111b34',
    padding: 12,
    alignItems: 'center',
  },
  metricValue: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 18,
  },
  metricLabel: {
    marginTop: 4,
    color: '#94a3b8',
  },
  sectionTitle: {
    color: '#f8fafc',
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '700',
    fontSize: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionMeta: {
    color: '#94a3b8',
  },
  chipRow: {
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#38bdf8',
  },
  chipIdle: {
    backgroundColor: '#111b34',
    borderColor: '#334155',
  },
  chipTextActive: {
    color: '#082f49',
    fontWeight: '700',
  },
  chipTextIdle: {
    color: '#e2e8f0',
  },
  card: {
    backgroundColor: '#111b34',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  mapCard: {
    padding: 6,
  },
  timelineCard: {
    borderRadius: 10,
    backgroundColor: '#0f172a',
    padding: 12,
    marginBottom: 8,
  },
  savedTrailCard: {
    borderRadius: 10,
    backgroundColor: '#0f172a',
    padding: 12,
    marginBottom: 8,
  },
  timelineCardActive: {
    borderWidth: 1,
    borderColor: '#38bdf8',
    backgroundColor: '#082f49',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineCity: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
  },
  timelineCount: {
    color: '#94a3b8',
    fontSize: 12,
  },
  timelineMeta: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 13,
  },
  saveTrailButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  saveTrailButtonText: {
    color: '#7dd3fc',
    fontWeight: '900',
    fontSize: 12,
  },
  emptyTrailState: {
    alignItems: 'center',
    padding: 8,
  },
  emptyTrailTitle: {
    color: '#f8fafc',
    fontWeight: '900',
    fontSize: 16,
  },
  emptyTrailAction: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  emptyTrailActionText: {
    color: '#082f49',
    fontWeight: '900',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 12,
  },
  visitorHeader: {
    color: '#f8fafc',
    fontWeight: '700',
    marginBottom: 4,
  },
  visitorList: {
    gap: 8,
  },
  visitorItem: {
    backgroundColor: '#0b1220',
    borderRadius: 8,
    padding: 10,
  },
  visitorName: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  visitorHandle: {
    color: '#94a3b8',
    marginTop: 2,
  },
  errorText: {
    color: '#fca5a5',
    marginBottom: 10,
    textAlign: 'center',
  },
});
