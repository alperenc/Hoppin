import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { MapPin } from 'lucide-react-native';
import { CityPassportMap, MapRegion } from '@/src/components/CityPassportMap';
import { CityStamp, CityVisit } from '@/src/types/hoppin';

type PassportMapPanelProps = {
  cityMapByKey: Map<string, CityVisit>;
  selectedVisit: CityVisit | null;
  stamps: CityStamp[];
  onSelectVisit: (visit: CityVisit) => void;
};

const DEFAULT_REGION: MapRegion = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 120,
  longitudeDelta: 160,
};

const USER_REGION_DELTA = 0.14;

export function PassportMapPanel({
  cityMapByKey,
  selectedVisit,
  stamps,
  onSelectVisit,
}: PassportMapPanelProps) {
  const [isLocatingMap, setIsLocatingMap] = useState(false);
  const [userRegion, setUserRegion] = useState<MapRegion | null>(null);
  const [locationPromptMessage, setLocationPromptMessage] = useState<string>();

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
    const mapPrimary = stamps[0];
    if (!mapPrimary) {
      return userRegion ?? DEFAULT_REGION;
    }

    const spanLat = stamps.length > 1 ? Math.min(120, Math.max(20, Math.abs(mapPrimary.lat))) : 40;
    const spanLng = stamps.length > 1 ? Math.min(180, Math.max(20, Math.abs(mapPrimary.lng))) : 80;

    return {
      latitude: mapPrimary.lat,
      longitude: mapPrimary.lng,
      latitudeDelta: Math.max(20, spanLat),
      longitudeDelta: Math.max(20, spanLng),
    };
  }, [stamps, userRegion]);

  if (stamps.length === 0 && !userRegion) {
    return (
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
    );
  }

  return (
    <CityPassportMap
      cityMapByKey={cityMapByKey}
      emptyMapMeta={userRegion && stamps.length === 0 ? 'Stamp a pour with a city to pin it near this area.' : undefined}
      emptyMapTitle={userRegion && stamps.length === 0 ? 'Map centered near you' : undefined}
      region={region}
      selectedVisit={selectedVisit}
      stamps={stamps}
      onSelectVisit={onSelectVisit}
    />
  );
}

const styles = StyleSheet.create({
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
});
