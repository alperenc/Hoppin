import { useEffect, useMemo, useRef, useState } from 'react';
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

type GoogleLatLngLiteral = {
  lat: number;
  lng: number;
};

type GoogleMapsNamespace = {
  ControlPosition: {
    RIGHT_BOTTOM: number;
  };
  LatLngBounds: new () => {
    extend(position: GoogleLatLngLiteral): void;
  };
  Map: new (
    element: HTMLElement,
    options: {
      center: GoogleLatLngLiteral;
      clickableIcons?: boolean;
      controlSize?: number;
      disableDefaultUI?: boolean;
      fullscreenControl?: boolean;
      gestureHandling?: string;
      mapTypeControl?: boolean;
      restriction?: {
        latLngBounds: {
          north: number;
          south: number;
          east: number;
          west: number;
        };
        strictBounds: boolean;
      };
      streetViewControl?: boolean;
      styles?: unknown[];
      zoom: number;
      zoomControl?: boolean;
      zoomControlOptions?: {
        position: number;
      };
    }
  ) => {
    fitBounds(bounds: unknown, padding?: number): void;
    panTo(position: GoogleLatLngLiteral): void;
    setCenter(position: GoogleLatLngLiteral): void;
    setZoom(zoom: number): void;
  };
  Marker: new (options: {
    clickable?: boolean;
    icon?: unknown;
    label?: {
      color: string;
      fontSize: string;
      fontWeight: string;
      text: string;
    };
    map: unknown;
    position: GoogleLatLngLiteral;
    title?: string;
    zIndex?: number;
  }) => {
    addListener(eventName: string, callback: () => void): void;
    setMap(map: unknown | null): void;
  };
  SymbolPath: {
    CIRCLE: number;
  };
};

type GoogleMapsWindow = Window & {
  google?: {
    maps?: GoogleMapsNamespace;
  };
  __hoppinGoogleMapsLoaded?: () => void;
  __hoppinGoogleMapsPromise?: Promise<GoogleMapsNamespace>;
};

const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY?.trim();
const cityKey = (city: string, country: string) => `${city.toLowerCase()}-${country.toLowerCase()}`;
const scriptId = 'hoppin-google-maps-js';
const googleMapsCallbackName = '__hoppinGoogleMapsLoaded';

const mapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#020617' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#082f49' }] },
];

const markerIcon = (maps: GoogleMapsNamespace, selected: boolean) => ({
  path: maps.SymbolPath.CIRCLE,
  scale: selected ? 16 : 13,
  fillColor: selected ? '#f59e0b' : '#22c55e',
  fillOpacity: 1,
  strokeColor: selected ? '#fef3c7' : '#bbf7d0',
  strokeWeight: 3,
});

const resolveVisit = (cityMapByKey: Map<string, CityVisit>, stamp: CityStamp): CityVisit =>
  cityMapByKey.get(cityKey(stamp.city, stamp.country)) ?? {
    city: stamp.city,
    country: stamp.country,
    firstVisitedAt: stamp.lastVisitedAt,
    lastVisitedAt: stamp.lastVisitedAt,
    checkinCount: stamp.count,
  };

const loadGoogleMaps = () => {
  if (!googleMapsKey || typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Maps key is not configured.'));
  }

  const targetWindow = window as GoogleMapsWindow;
  if (targetWindow.google?.maps) {
    return Promise.resolve(targetWindow.google.maps);
  }

  if (targetWindow.__hoppinGoogleMapsPromise) {
    return targetWindow.__hoppinGoogleMapsPromise;
  }

  targetWindow.__hoppinGoogleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    const settleIfReady = () => {
      if (targetWindow.google?.maps) {
        resolve(targetWindow.google.maps);
        return true;
      }
      return false;
    };

    if (settleIfReady()) {
      return;
    }

    targetWindow.__hoppinGoogleMapsLoaded = () => {
      if (!settleIfReady()) {
        reject(new Error('Google Maps did not initialize.'));
      }
    };

    const script =
      existingScript ??
      Object.assign(document.createElement('script'), {
        async: true,
        defer: true,
        id: scriptId,
        src: `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsKey)}&v=weekly&loading=async&callback=${googleMapsCallbackName}`,
      });

    script.addEventListener('load', () => {
      settleIfReady();
    });
    script.addEventListener('error', () => {
      reject(new Error('Google Maps failed to load.'));
    });

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });

  return targetWindow.__hoppinGoogleMapsPromise;
};

export function CityPassportMap({
  cityMapByKey,
  region,
  selectedVisit,
  stamps,
  onSelectVisit,
}: CityPassportMapProps) {
  const mapElementRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<InstanceType<GoogleMapsNamespace['Map']> | null>(null);
  const markersRef = useRef<Array<InstanceType<GoogleMapsNamespace['Marker']>>>([]);
  const [maps, setMaps] = useState<GoogleMapsNamespace | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const selectedStamp = useMemo(() => {
    if (!selectedVisit) {
      return stamps[0];
    }
    return stamps.find((stamp) => stamp.city === selectedVisit.city && stamp.country === selectedVisit.country) ?? stamps[0];
  }, [selectedVisit, stamps]);

  useEffect(() => {
    let mounted = true;

    if (!googleMapsKey) {
      setLoadFailed(true);
      return;
    }

    loadGoogleMaps()
      .then((loadedMaps) => {
        if (!mounted) {
          return;
        }
        setMaps(loadedMaps);
        setLoadFailed(false);
      })
      .catch(() => {
        if (mounted) {
          setLoadFailed(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!maps || !mapElementRef.current || mapRef.current) {
      return;
    }

    mapRef.current = new maps.Map(mapElementRef.current, {
      center: { lat: region.latitude, lng: region.longitude },
      clickableIcons: false,
      controlSize: 26,
      disableDefaultUI: true,
      fullscreenControl: false,
      gestureHandling: 'cooperative',
      mapTypeControl: false,
      restriction: {
        latLngBounds: { north: 85, south: -85, east: 180, west: -180 },
        strictBounds: false,
      },
      streetViewControl: false,
      styles: mapStyles,
      zoom: 2,
      zoomControl: true,
      zoomControlOptions: {
        position: maps.ControlPosition.RIGHT_BOTTOM,
      },
    });
  }, [maps, region.latitude, region.longitude]);

  useEffect(() => {
    if (!maps || !mapRef.current) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (!stamps.length) {
      mapRef.current.setCenter({ lat: region.latitude, lng: region.longitude });
      mapRef.current.setZoom(2);
      return;
    }

    const bounds = new maps.LatLngBounds();

    markersRef.current = stamps.map((stamp) => {
      const selected = selectedVisit?.city === stamp.city && selectedVisit?.country === stamp.country;
      const position = { lat: stamp.lat, lng: stamp.lng };
      bounds.extend(position);

      const marker = new maps.Marker({
        clickable: true,
        icon: markerIcon(maps, selected),
        label: {
          color: selected ? '#451a03' : '#052e16',
          fontSize: '12px',
          fontWeight: '800',
          text: String(Math.max(1, stamp.count)),
        },
        map: mapRef.current,
        position,
        title: `${stamp.city}, ${stamp.country}`,
        zIndex: selected ? 2 : 1,
      });

      marker.addListener('click', () => {
        onSelectVisit(resolveVisit(cityMapByKey, stamp));
      });

      return marker;
    });

    if (stamps.length === 1) {
      mapRef.current.panTo({ lat: stamps[0].lat, lng: stamps[0].lng });
      mapRef.current.setZoom(9);
      return;
    }

    mapRef.current.fitBounds(bounds, 56);
  }, [cityMapByKey, maps, onSelectVisit, region.latitude, region.longitude, selectedVisit, stamps]);

  if (loadFailed || !googleMapsKey) {
    return (
      <View style={styles.map}>
        <View style={styles.emptyState}>
          <Text style={styles.mapKicker}>{stamps.length} city stamps</Text>
          <Text style={styles.mapTitle}>Map unavailable</Text>
          <Text style={styles.mapMeta}>Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY to render the passport map.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.map}>
      <View
        ref={(element) => {
          mapElementRef.current = element as unknown as HTMLElement | null;
        }}
        style={styles.mapCanvas}
      />

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
    minHeight: 336,
    borderRadius: 10,
    backgroundColor: '#071426',
    overflow: 'hidden',
  },
  mapCanvas: {
    height: 258,
    minHeight: 258,
  },
  emptyState: {
    minHeight: 258,
    justifyContent: 'center',
    padding: 16,
  },
  mapCopy: {
    margin: 12,
    marginTop: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(7, 16, 34, 0.9)',
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
