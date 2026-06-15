import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { CityStamp, CityVisit } from '@/src/types/hoppin';

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type CityPassportMapProps = {
  cityMapByKey: Map<string, CityVisit>;
  region: MapRegion;
  selectedVisit: CityVisit | null;
  stamps: CityStamp[];
  onSelectVisit: (visit: CityVisit) => void;
};

const cityKey = (city: string, country: string) => `${city.toLowerCase()}-${country.toLowerCase()}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const projectStamp = (stamp: CityStamp) => ({
  left: `${clamp(((stamp.lng + 180) / 360) * 100, 4, 96)}%` as DimensionValue,
  top: `${clamp(((90 - stamp.lat) / 180) * 100, 8, 92)}%` as DimensionValue,
});

export function CityPassportMap({
  cityMapByKey,
  selectedVisit,
  stamps,
  onSelectVisit,
}: CityPassportMapProps) {
  const selectedStamp = selectedVisit
    ? stamps.find((stamp) => stamp.city === selectedVisit.city && stamp.country === selectedVisit.country)
    : stamps[0];

  return (
    <View style={styles.map}>
      <View style={styles.oceanGlow} />
      <View style={[styles.landMass, styles.landNorthAmerica]} />
      <View style={[styles.landMass, styles.landSouthAmerica]} />
      <View style={[styles.landMass, styles.landEuropeAfrica]} />
      <View style={[styles.landMass, styles.landAsia]} />
      <View style={[styles.landMass, styles.landAustralia]} />
      <View style={[styles.gridLine, styles.gridLineOne]} />
      <View style={[styles.gridLine, styles.gridLineTwo]} />
      <View style={[styles.gridLineVertical, styles.gridLineThree]} />
      <View style={[styles.gridLineVertical, styles.gridLineFour]} />

      {stamps.map((stamp) => {
        const position = projectStamp(stamp);
        const matchedVisit = cityMapByKey.get(cityKey(stamp.city, stamp.country));
        const selected = selectedVisit?.city === stamp.city && selectedVisit?.country === stamp.country;

        return (
          <TouchableOpacity
            accessibilityLabel={`Select ${stamp.city}, ${stamp.country}`}
            key={`${stamp.city}-${stamp.country}`}
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
            style={[
              styles.marker,
              selected ? styles.markerSelected : undefined,
              {
                left: position.left,
                top: position.top,
              },
            ]}
          >
            <Text style={styles.markerText}>{Math.max(1, stamp.count)}</Text>
          </TouchableOpacity>
        );
      })}

      <View style={styles.mapCopy}>
        <Text style={styles.mapKicker}>{stamps.length} city stamps</Text>
        <Text style={styles.mapTitle}>
          {selectedStamp ? `${selectedStamp.city}, ${selectedStamp.country}` : 'Your beer map is waiting'}
        </Text>
        <Text style={styles.mapMeta}>
          {selectedStamp
            ? `${selectedStamp.count} check-ins saved here`
            : 'Stamp a pour with a city to light up the passport.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    minHeight: 260,
    borderRadius: 10,
    backgroundColor: '#071426',
    overflow: 'hidden',
    position: 'relative',
  },
  oceanGlow: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '8%',
    bottom: '8%',
    borderRadius: 10,
    backgroundColor: '#0f2744',
    opacity: 0.72,
  },
  landMass: {
    position: 'absolute',
    backgroundColor: '#173b36',
    borderColor: '#2dd4bf',
    borderWidth: 1,
    opacity: 0.62,
  },
  landNorthAmerica: {
    left: '10%',
    top: '24%',
    width: '22%',
    height: '24%',
    borderRadius: 42,
    transform: [{ rotate: '-14deg' }],
  },
  landSouthAmerica: {
    left: '28%',
    top: '52%',
    width: '12%',
    height: '28%',
    borderRadius: 36,
    transform: [{ rotate: '18deg' }],
  },
  landEuropeAfrica: {
    left: '48%',
    top: '31%',
    width: '18%',
    height: '36%',
    borderRadius: 44,
    transform: [{ rotate: '8deg' }],
  },
  landAsia: {
    left: '63%',
    top: '27%',
    width: '27%',
    height: '26%',
    borderRadius: 46,
    transform: [{ rotate: '-5deg' }],
  },
  landAustralia: {
    left: '76%',
    top: '66%',
    width: '12%',
    height: '10%',
    borderRadius: 28,
    transform: [{ rotate: '12deg' }],
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1e3a5f',
  },
  gridLineOne: {
    top: '35%',
  },
  gridLineTwo: {
    top: '65%',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#1e3a5f',
  },
  gridLineThree: {
    left: '33%',
  },
  gridLineFour: {
    left: '66%',
  },
  marker: {
    position: 'absolute',
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderColor: '#bbf7d0',
    borderWidth: 2,
  },
  markerSelected: {
    backgroundColor: '#f59e0b',
    borderColor: '#fef3c7',
    transform: [{ scale: 1.12 }],
  },
  markerText: {
    color: '#052e16',
    fontWeight: '800',
    fontSize: 12,
  },
  mapCopy: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(7, 16, 34, 0.84)',
    borderColor: '#1e3a5f',
    borderWidth: 1,
    padding: 12,
  },
  mapKicker: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  mapTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 3,
  },
  mapMeta: {
    color: '#94a3b8',
    marginTop: 4,
  },
});
