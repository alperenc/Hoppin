import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { CityStamp, CityVisit } from '@/src/types/hoppin';

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type CityPassportMapProps = {
  cityMapByKey: Map<string, CityVisit>;
  emptyMapMeta?: string;
  emptyMapTitle?: string;
  region: MapRegion;
  selectedVisit: CityVisit | null;
  stamps: CityStamp[];
  onSelectVisit: (visit: CityVisit) => void;
};

const cityKey = (city: string, country: string) => `${city.toLowerCase()}-${country.toLowerCase()}`;

export function CityPassportMap({
  cityMapByKey,
  region,
  selectedVisit,
  stamps,
  onSelectVisit,
}: CityPassportMapProps) {
  const regionKey = [
    region.latitude.toFixed(3),
    region.longitude.toFixed(3),
    region.latitudeDelta.toFixed(3),
    region.longitudeDelta.toFixed(3),
  ].join(':');

  return (
    <MapView key={regionKey} style={styles.map} initialRegion={region}>
      {stamps.map((stamp) => {
        const matchedVisit = cityMapByKey.get(cityKey(stamp.city, stamp.country));
        const selected = selectedVisit?.city === stamp.city && selectedVisit?.country === stamp.country;

        return (
          <Marker
            key={`${stamp.city}-${stamp.country}`}
            coordinate={{
              latitude: stamp.lat,
              longitude: stamp.lng,
            }}
            title={`${stamp.city}, ${stamp.country}`}
            description={`${stamp.count} check-ins`}
            pinColor={selected ? '#60a5fa' : '#0ea5e9'}
            onPress={() => {
              onSelectVisit(
                matchedVisit ?? {
                  city: stamp.city,
                  country: stamp.country,
                  firstVisitedAt: stamp.lastVisitedAt,
                  lastVisitedAt: stamp.lastVisitedAt,
                  checkinCount: stamp.count,
                },
              );
            }}
          />
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 280,
    borderRadius: 10,
  },
});
