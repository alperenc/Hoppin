import { StyleSheet, Text, View } from 'react-native';
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

export function CityPassportMap({ stamps }: CityPassportMapProps) {
  return (
    <View style={styles.webMapFallback}>
      <Text style={styles.emptyText}>Map view is not available in this environment.</Text>
      <Text style={styles.emptyText}>City stamps: {stamps.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webMapFallback: {
    borderRadius: 8,
    backgroundColor: '#0b1220',
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 12,
  },
});
