import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { CityPassportMap, MapRegion } from '@/src/components/CityPassportMap';
import { useWebPullToRefresh } from '@/src/components/useWebPullToRefresh';
import { CityVisit, CityVisitor, CityStamp, PassportSummary, Profile } from '@/src/types/hoppin';
import {
  getCurrentProfile,
  getPassportSummary,
  listCityTrips,
  listPassportStamps,
  listPublicCityVisitors,
} from '@/src/lib/hoppin';

const ALL_COUNTRIES = 'All';

const dateOptions: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

const DEFAULT_REGION: MapRegion = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 120,
  longitudeDelta: 160,
};

const USER_REGION_DELTA = 0.14;

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
  const isMountedRef = useRef(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<PassportSummary | null>(null);
  const [stamps, setStamps] = useState<CityStamp[]>([]);
  const [trips, setTrips] = useState<CityVisit[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>(ALL_COUNTRIES);
  const [selectedVisit, setSelectedVisit] = useState<CityVisit | null>(null);
  const [visitors, setVisitors] = useState<CityVisitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingVisitors, setIsLoadingVisitors] = useState(false);
  const [isLocatingMap, setIsLocatingMap] = useState(false);
  const [userRegion, setUserRegion] = useState<MapRegion | null>(null);
  const [locationPromptMessage, setLocationPromptMessage] = useState<string>();
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
      const [passportSummary, passportStamps, cityTrips] = await Promise.all([
        getPassportSummary(currentProfile.id),
        listPassportStamps(currentProfile.id),
        listCityTrips(currentProfile.id),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      const discoveredCountries = Array.from(new Set(cityTrips.map((trip) => trip.country))).sort();

      setMe(currentProfile);
      setSummary(passportSummary);
      setStamps(passportStamps);
      setTrips(cityTrips);
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

  useEffect(() => {
    isMountedRef.current = true;
    void loadPassport();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadPassport]);

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

  const requestMapLocation = useCallback(async () => {
    try {
      setIsLocatingMap(true);
      setLocationPromptMessage(undefined);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPromptMessage('Location access was not granted.');
        Alert.alert('Location blocked', 'Enable location permission to center the passport map near you.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserRegion({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: USER_REGION_DELTA,
        longitudeDelta: USER_REGION_DELTA,
      });
      setLocationPromptMessage('Map centered near your current area.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read location.';
      setLocationPromptMessage(message);
      Alert.alert('Location failed', message);
    } finally {
      setIsLocatingMap(false);
    }
  }, []);

  const region = useMemo<MapRegion>(() => {
    const mapPrimary = visibleMapStamps[0];
    if (!mapPrimary) {
      return userRegion ?? DEFAULT_REGION;
    }

    const spanLat = visibleMapStamps.length > 1 ? Math.min(120, Math.max(20, Math.abs(mapPrimary.lat))) : 40;
    const spanLng = visibleMapStamps.length > 1 ? Math.min(180, Math.max(20, Math.abs(mapPrimary.lng))) : 80;

    return {
      latitude: mapPrimary.lat,
      longitude: mapPrimary.lng,
      latitudeDelta: Math.max(20, spanLat),
      longitudeDelta: Math.max(20, spanLng),
    };
  }, [userRegion, visibleMapStamps]);

  const shouldPromptForMapLocation = visibleMapStamps.length === 0 && !userRegion;

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
      <Text style={styles.title}>Passport</Text>
      <Text style={styles.subtitle}>Your country chips, city trips, and social discovery.</Text>
      <Text style={styles.handle}>{me ? me.displayName : 'Unknown'}</Text>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

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
          <Text style={styles.metricLabel}>Check-ins</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>City map</Text>
      <View style={[styles.card, styles.mapCard]}>
        {shouldPromptForMapLocation ? (
          <View style={styles.locationPrompt}>
            <View style={styles.locationIcon}>
              <MapPin color="#071022" size={22} />
            </View>
            <Text style={styles.locationKicker}>Nearby start</Text>
            <Text style={styles.locationTitle}>Center the passport near you</Text>
            <Text style={styles.locationCopy}>
              Use your current area as the first map view, then pin cities as you stamp pours.
            </Text>
            <TouchableOpacity
              style={[styles.locationButton, isLocatingMap ? styles.disabledButton : undefined]}
              onPress={requestMapLocation}
              disabled={isLocatingMap}
            >
              <Text style={styles.locationButtonText}>{isLocatingMap ? 'Finding your area...' : 'Use my location'}</Text>
            </TouchableOpacity>
            {locationPromptMessage ? <Text style={styles.locationMessage}>{locationPromptMessage}</Text> : null}
          </View>
        ) : (
          <CityPassportMap
            cityMapByKey={cityMapByKey}
            emptyMapMeta={
              userRegion && visibleMapStamps.length === 0
                ? 'Stamp a pour with a city to pin it near this area.'
                : undefined
            }
            emptyMapTitle={userRegion && visibleMapStamps.length === 0 ? 'Map centered near you' : undefined}
            region={region}
            selectedVisit={selectedVisit}
            stamps={visibleMapStamps}
            onSelectVisit={setSelectedVisit}
          />
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

      <Text style={styles.sectionTitle}>Travel timeline</Text>
      <View style={styles.card}>
        {!filteredTrips.length ? (
          <Text style={styles.emptyText}>No trips in this view yet.</Text>
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
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <Text style={styles.sectionTitle}>Who checked in here</Text>
      <View style={styles.card}>
        {!selectedVisit ? (
          <Text style={styles.emptyText}>Pick a city card or marker to see social overlap.</Text>
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
  locationPrompt: {
    minHeight: 336,
    borderRadius: 10,
    backgroundColor: '#071426',
    borderColor: '#1e3a5f',
    borderWidth: 1,
    justifyContent: 'center',
    padding: 18,
  },
  locationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    marginBottom: 14,
  },
  locationKicker: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  locationTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  locationCopy: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  locationButton: {
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#22c55e',
    marginTop: 16,
    paddingVertical: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  locationButtonText: {
    color: '#052e16',
    fontWeight: '800',
  },
  locationMessage: {
    color: '#94a3b8',
    marginTop: 10,
    textAlign: 'center',
  },
  timelineCard: {
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
