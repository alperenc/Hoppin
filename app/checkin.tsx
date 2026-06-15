import { useCallback, useEffect, useRef, useState } from 'react';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Alert, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Beer, MapPin, ScanBarcode, Sparkles, Star, UsersRound, X } from 'lucide-react-native';
import { BeerStyle, LocationHint, PrivacyLevel } from '@/src/types/hoppin';
import { createCheckin, listNearbyVenueHints, listVenueOrCityHints, lookupBeerByBarcode } from '@/src/lib/hoppin';
import { resolveProtectedRoute, shouldRouteErrorToAuth } from '@/src/lib/sessionRouting';

const styleChoices: BeerStyle[] = ['ipa', 'lager', 'pilsner', 'wheat', 'stout', 'porter', 'amber', 'sour', 'experimental', 'other'];
const audienceOptions: Array<{ value: PrivacyLevel; label: string; caption: string }> = [
  { value: 'followers', label: 'Crew', caption: 'Followers see it' },
  { value: 'public', label: 'Open tap', caption: 'Anyone can discover it' },
  { value: 'private', label: 'Cellar', caption: 'Only you see it' },
];

const formatStyle = (style: BeerStyle) => {
  if (style === 'ipa') return 'IPA';
  return style.slice(0, 1).toUpperCase() + style.slice(1);
};

const samePlaceText = (left: string | undefined, right: string) =>
  left?.trim().toLowerCase() === right.trim().toLowerCase();

const normalizeScannedCode = (value: string) => value.replace(/[^0-9A-Za-z]/g, '').trim();

function inferBeerStyle(value: string): BeerStyle {
  const normalized = value.toLowerCase();
  if (/\b(ipa|i\.p\.a\.|pale ale|hazy|neipa|double ipa|dip[ao])\b/.test(normalized)) return 'ipa';
  if (/\b(pils|pilsner)\b/.test(normalized)) return 'pilsner';
  if (/\b(lager|helles|bock|maerzen|marzen|dunkel)\b/.test(normalized)) return 'lager';
  if (/\b(stout|imperial stout|milk stout|oatmeal stout)\b/.test(normalized)) return 'stout';
  if (/\b(porter)\b/.test(normalized)) return 'porter';
  if (/\b(wheat|weiss|weizen|witbier|hefe)\b/.test(normalized)) return 'wheat';
  if (/\b(amber|red ale)\b/.test(normalized)) return 'amber';
  if (/\b(sour|gose|lambic|berliner)\b/.test(normalized)) return 'sour';
  return 'other';
}

export default function Checkin() {
  const router = useRouter();
  const beerEditVersion = useRef(0);
  const locationEditVersion = useRef(0);
  const autoFilledVenue = useRef(false);
  const styleEditedManually = useRef(false);
  const scanLookupInFlight = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [beerName, setBeerName] = useState('');
  const [breweryName, setBreweryName] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('followers');
  const [style, setStyle] = useState<BeerStyle>('other');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [note, setNote] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [cityLatitude, setCityLatitude] = useState('');
  const [cityLongitude, setCityLongitude] = useState('');
  const [rating, setRating] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [locationHints, setLocationHints] = useState<LocationHint[]>([]);
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isRouteReady, setIsRouteReady] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedVenueProvider, setSelectedVenueProvider] = useState<LocationHint['provider']>();
  const [selectedVenueExternalId, setSelectedVenueExternalId] = useState<string>();
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannedBarcodeMatchedBeer, setScannedBarcodeMatchedBeer] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isResolvingBarcode, setIsResolvingBarcode] = useState(false);

  const clearSavedCoordinates = () => {
    setLatitude('');
    setLongitude('');
    setCityLatitude('');
    setCityLongitude('');
  };

  const clearSelectedVenueReference = () => {
    setSelectedVenueProvider(undefined);
    setSelectedVenueExternalId(undefined);
  };

  const clearScannedBeerReference = () => {
    if (scannedBarcode && scannedBarcodeMatchedBeer) {
      setScannedBarcode('');
      setScannedBarcodeMatchedBeer(false);
    }
  };

  const markBeerFieldsEdited = () => {
    beerEditVersion.current += 1;
    clearScannedBeerReference();
  };

  const bumpLocationEditVersion = () => {
    locationEditVersion.current += 1;
  };

  const markLocationFieldsEdited = () => {
    autoFilledVenue.current = false;
    bumpLocationEditVersion();
  };

  const openScanner = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Use the mobile app camera', 'Barcode scanning is available on iOS and Android builds.');
      return;
    }

    if (cameraPermission?.granted) {
      setIsScannerOpen(true);
      return;
    }

    const permission = await requestCameraPermission();
    if (permission.granted) {
      setIsScannerOpen(true);
      return;
    }

    Alert.alert('Camera blocked', 'Enable camera permission to scan a can or label.');
  };

  const applyScannedBarcode = async (result: BarcodeScanningResult) => {
    if (isResolvingBarcode || scanLookupInFlight.current) {
      return;
    }

    const barcode = normalizeScannedCode(result.data);
    if (!barcode) {
      return;
    }

    scanLookupInFlight.current = true;
    setScannedBarcode(barcode);
    setScannedBarcodeMatchedBeer(false);
    setIsScannerOpen(false);
    setIsResolvingBarcode(true);
    const lookupEditVersion = beerEditVersion.current;
    const shouldClearPriorMatchedBeer = scannedBarcodeMatchedBeer;

    try {
      const matchedBeer = await lookupBeerByBarcode(barcode);
      if (beerEditVersion.current !== lookupEditVersion) {
        return;
      }

      if (matchedBeer) {
        setScannedBarcodeMatchedBeer(true);
        setBeerName(matchedBeer.name);
        setStyle(matchedBeer.style);
        styleEditedManually.current = false;
        if (matchedBeer.brewery?.name) {
          setBreweryName(matchedBeer.brewery.name);
        }
      } else if (shouldClearPriorMatchedBeer) {
        setBeerName('');
        setBreweryName('');
        setStyle('other');
        styleEditedManually.current = false;
      }
    } catch {
      // A failed lookup should not block saving a new beer with the scanned code.
      if (beerEditVersion.current === lookupEditVersion && shouldClearPriorMatchedBeer) {
        setBeerName('');
        setBreweryName('');
        setStyle('other');
        styleEditedManually.current = false;
      }
    } finally {
      scanLookupInFlight.current = false;
      setIsResolvingBarcode(false);
    }
  };

  const applyHint = (hint: LocationHint) => {
    markLocationFieldsEdited();
    if (hint.venueName) {
      setVenueName(hint.venueName);
      setSelectedVenueProvider(hint.provider);
      setSelectedVenueExternalId(hint.externalId);
    } else {
      setVenueName('');
      clearSelectedVenueReference();
    }
    if (hint.city) {
      setCity(hint.city);
    }
    if (hint.country) {
      setCountry(hint.country);
    }
    if (hint.lat !== undefined && hint.lng !== undefined) {
      setLatitude(String(hint.lat));
      setLongitude(String(hint.lng));
      if (!hint.venueName) {
        setCityLatitude(String(hint.lat));
        setCityLongitude(String(hint.lng));
      } else {
        setCityLatitude('');
        setCityLongitude('');
      }
    } else {
      clearSavedCoordinates();
    }
    setLocationHints([]);
  };

  const applyCurrentLocation = useCallback(async (mode: 'manual' | 'silent' = 'manual') => {
    let locationEditSnapshot = locationEditVersion.current;

    try {
      setIsLocating(true);

      if (mode === 'silent') {
        const existingPermission = await Location.getForegroundPermissionsAsync();
        if (existingPermission.status !== 'granted') {
          return;
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location blocked', 'Enable location permissions to use your current city.');
          return;
        }
        bumpLocationEditVersion();
        locationEditSnapshot = locationEditVersion.current;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (locationEditVersion.current !== locationEditSnapshot) {
        return;
      }

      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));
      setCityLatitude(lat.toFixed(6));
      setCityLongitude(lng.toFixed(6));

      const nearbyHints = await listNearbyVenueHints(lat, lng);
      if (locationEditVersion.current !== locationEditSnapshot) {
        return;
      }

      if (nearbyHints.length) {
        setLocationHints(nearbyHints);
      }

      const bestVenue = nearbyHints.find((hint) => hint.venueName && hint.city && hint.country);
      const shouldApplyBestVenue = !venueName.trim() || autoFilledVenue.current;
      if (bestVenue && shouldApplyBestVenue) {
        autoFilledVenue.current = true;
        setVenueName(bestVenue.venueName ?? '');
        setSelectedVenueProvider(bestVenue.provider);
        setSelectedVenueExternalId(bestVenue.externalId);
        if (bestVenue.city) {
          setCity(bestVenue.city);
        }
        if (bestVenue.country) {
          setCountry(bestVenue.country);
        }
        if (bestVenue.lat !== undefined && bestVenue.lng !== undefined) {
          setLatitude(String(bestVenue.lat));
          setLongitude(String(bestVenue.lng));
        }
        return;
      }

      try {
        const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (locationEditVersion.current !== locationEditSnapshot) {
          return;
        }

        const first = places?.[0];
        if (first) {
          if (first.city && !city) {
            setCity(first.city);
          }
          if (first.country && !country) {
            setCountry(first.country);
          }
        }
      } catch {
        // Keep the successful GPS coordinates even when reverse geocoding is unavailable.
      }
    } catch (error) {
      if (mode === 'manual') {
        const message = error instanceof Error ? error.message : 'Could not read location.';
        Alert.alert('Location failed', message);
      }
    } finally {
      setIsLocating(false);
    }
  }, [city, country, venueName]);

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

        setIsRouteReady(true);
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

  useEffect(() => {
    if (!isRouteReady || city || country) {
      return;
    }

    void applyCurrentLocation('silent');
  }, [applyCurrentLocation, city, country, isRouteReady]);

  useEffect(() => {
    if (!isRouteReady) {
      return;
    }

    const query = `${venueName} ${city} ${country}`.trim();
    if (query.length < 2) {
      setLocationHints([]);
      return;
    }

    const handle = setTimeout(async () => {
      setIsLoadingHints(true);
      try {
        const hints = await listVenueOrCityHints(query);
        setLocationHints(hints);
      } catch {
        setLocationHints([]);
      } finally {
        setIsLoadingHints(false);
      }
    }, 250);

    return () => {
      clearTimeout(handle);
    };
  }, [city, country, isRouteReady, venueName]);

  const handleSubmit = async () => {
    if (isSaving) {
      return;
    }

    const normalizedCity = city.trim();
    const normalizedCountry = country.trim();
    const normalizedVenue = venueName.trim();
    const hasVenue = Boolean(normalizedVenue);

    if (!beerName.trim() || !normalizedCity || !normalizedCountry) {
      Alert.alert('Missing trail details', 'Add the beer plus at least a city and country.');
      return;
    }

    const rawRating = rating.trim();
    let parsedRating: number | undefined = undefined;

    if (rawRating) {
      parsedRating = Number(rawRating);
      if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        Alert.alert('Invalid rating', 'Rating must be a number between 1 and 5.');
        return;
      }
    }

    const rawLatitude = latitude.trim();
    const rawLongitude = longitude.trim();
    const rawCityLatitude = cityLatitude.trim();
    const rawCityLongitude = cityLongitude.trim();
    let parsedLatitude: number | undefined;
    let parsedLongitude: number | undefined;
    let parsedCityLatitude: number | undefined;
    let parsedCityLongitude: number | undefined;

    if (rawLatitude || rawLongitude) {
      if (!rawLatitude || !rawLongitude) {
        Alert.alert('Invalid location', 'Use current location again or clear the saved coordinates.');
        return;
      }

      parsedLatitude = Number(rawLatitude);
      parsedLongitude = Number(rawLongitude);

      if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
        Alert.alert('Invalid location', 'Saved coordinates are not valid numbers.');
        return;
      }

      if (parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180) {
        Alert.alert('Invalid location', 'Saved coordinates are outside the supported range.');
        return;
      }
    }

    if (hasVenue && (rawCityLatitude || rawCityLongitude)) {
      if (!rawCityLatitude || !rawCityLongitude) {
        Alert.alert('Invalid city location', 'Use your current place again or choose a city hint.');
        return;
      }

      parsedCityLatitude = Number(rawCityLatitude);
      parsedCityLongitude = Number(rawCityLongitude);

      if (Number.isNaN(parsedCityLatitude) || Number.isNaN(parsedCityLongitude)) {
        Alert.alert('Invalid city location', 'Saved city coordinates are not valid numbers.');
        return;
      }

      if (parsedCityLatitude < -90 || parsedCityLatitude > 90 || parsedCityLongitude < -180 || parsedCityLongitude > 180) {
        Alert.alert('Invalid city location', 'Saved city coordinates are outside the supported range.');
        return;
      }
    }

    if (!hasVenue) {
      parsedCityLatitude = parsedLatitude;
      parsedCityLongitude = parsedLongitude;
    }

    setIsSaving(true);

    const needsPlaceCoordinates = parsedLatitude === undefined || parsedLongitude === undefined;
    const needsCityCoordinates = hasVenue && (parsedCityLatitude === undefined || parsedCityLongitude === undefined);

    if (needsPlaceCoordinates || needsCityCoordinates) {
      if (needsPlaceCoordinates && Platform.OS === 'android') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location permission needed', 'Android requires location permission before mapping a typed place.');
          setIsSaving(false);
          return;
        }
      }

      if (needsPlaceCoordinates) {
        try {
          const geocodeTarget = hasVenue ? `${normalizedVenue}, ${normalizedCity}, ${normalizedCountry}` : `${normalizedCity}, ${normalizedCountry}`;
          const geocoded = await Location.geocodeAsync(geocodeTarget);
          const firstMatch = geocoded[0];
          if (firstMatch) {
            parsedLatitude = firstMatch.latitude;
            parsedLongitude = firstMatch.longitude;
          }
        } catch {
          parsedLatitude = undefined;
          parsedLongitude = undefined;
        }
      }

      if (needsCityCoordinates && (Platform.OS !== 'android' || needsPlaceCoordinates)) {
        try {
          const geocodedCity = await Location.geocodeAsync(`${normalizedCity}, ${normalizedCountry}`);
          const firstCityMatch = geocodedCity[0];
          if (firstCityMatch) {
            parsedCityLatitude = firstCityMatch.latitude;
            parsedCityLongitude = firstCityMatch.longitude;
          }
        } catch {
          parsedCityLatitude = undefined;
          parsedCityLongitude = undefined;
        }
      }

      if (hasVenue && (parsedCityLatitude === undefined || parsedCityLongitude === undefined)) {
        try {
          const cityHints = await listVenueOrCityHints(`${normalizedCity}, ${normalizedCountry}`);
          const cityHint = cityHints.find(
            (hint) =>
              !hint.venueName &&
              samePlaceText(hint.city, normalizedCity) &&
              samePlaceText(hint.country, normalizedCountry) &&
              hint.lat !== undefined &&
              hint.lng !== undefined
          );

          if (cityHint?.lat !== undefined && cityHint.lng !== undefined) {
            parsedCityLatitude = cityHint.lat;
            parsedCityLongitude = cityHint.lng;
          }
        } catch {
          parsedCityLatitude = undefined;
          parsedCityLongitude = undefined;
        }
      }
    }

    if (parsedLatitude === undefined || parsedLongitude === undefined) {
      Alert.alert('Map this place first', 'Use your current city or choose a place hint so this stamp lands on the passport map.');
      setIsSaving(false);
      return;
    }

    if (hasVenue && (parsedCityLatitude === undefined || parsedCityLongitude === undefined)) {
      Alert.alert('Map this city first', 'Choose a city hint or use current city so this venue rolls up to the right passport stamp.');
      setIsSaving(false);
      return;
    }

    try {
      await createCheckin({
        beerName,
        style,
        breweryName,
        barcode: scannedBarcode,
        scope: hasVenue ? 'venue' : 'city',
        privacy,
        note,
        rating: parsedRating,
        lat: parsedLatitude,
        lng: parsedLongitude,
        cityLat: hasVenue ? parsedCityLatitude : undefined,
        cityLng: hasVenue ? parsedCityLongitude : undefined,
        venueName: hasVenue ? normalizedVenue : undefined,
        city: normalizedCity,
        country: normalizedCountry,
        venueProvider: hasVenue ? selectedVenueProvider : undefined,
        venueExternalId: hasVenue ? selectedVenueExternalId : undefined,
      });
      router.replace('/home');
    } catch (error) {
      Alert.alert('Could not stamp this pour', 'Your beer memory could not be saved.');
      setIsSaving(false);
    }
  };

  const trimmedBeerName = beerName.trim();
  const trimmedVenueName = venueName.trim();
  const placePreview = city.trim() && country.trim() ? `${city.trim()}, ${country.trim()}` : 'Somewhere worth mapping';
  const audienceLabel = audienceOptions.find((option) => option.value === privacy)?.label ?? 'Crew';
  const locationStatus = trimmedVenueName && city && country
    ? `${trimmedVenueName} - ${city}, ${country}`
    : city && country
      ? `${city}, ${country}`
      : 'Use location for a best-guess venue, then edit if needed.';

  if (routeError) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorTitle}>Could not load check-in</Text>
        <Text style={styles.errorText}>Your session is active, but Hoppin could not load the profile state.</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setIsRouteReady(false);
            setRouteError(false);
            setAttempt((current) => current + 1);
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isRouteReady) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.kickerRow}>
          <Sparkles color="#f59e0b" size={15} />
          <Text style={styles.kicker}>New stamp</Text>
        </View>
        <TouchableOpacity accessibilityLabel="Close check-in" style={styles.closeButton} onPress={() => router.replace('/home')}>
          <X color="#e2e8f0" size={20} />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Stamp this pour.</Text>
      <Text style={styles.subtitle}>Start with beer and place. Everything else is optional.</Text>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Beer color="#f59e0b" size={22} />
          <View>
            <Text style={styles.panelTitle}>1. What are you drinking?</Text>
            <Text style={styles.panelMeta}>We infer the style, but you can override it.</Text>
          </View>
        </View>
        <TextInput
          placeholder="Cloud Lift IPA"
          placeholderTextColor="#64748b"
          style={styles.heroInput}
          value={beerName}
          onChangeText={(value) => {
            setBeerName(value);
            if (!styleEditedManually.current) {
              setStyle(inferBeerStyle(value));
            }
            markBeerFieldsEdited();
          }}
        />
        <View style={styles.typeHeader}>
          <Text style={styles.sectionLabel}>Beer type</Text>
          <Text style={styles.typeHint}>{styleEditedManually.current ? 'Picked by you' : 'Inferred from name'}</Text>
        </View>
        <View style={styles.chipRow}>
          {styleChoices.map((choice) => (
            <TouchableOpacity
              key={choice}
              style={[styles.chip, style === choice ? styles.chipActive : undefined]}
              onPress={() => {
                styleEditedManually.current = true;
                setStyle(choice);
                if (choice !== style) {
                  markBeerFieldsEdited();
                }
              }}
            >
              <Text style={[styles.chipText, style === choice ? styles.chipTextActive : undefined]}>{formatStyle(choice)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.scanStrip}>
          <TouchableOpacity style={styles.scanButton} onPress={openScanner} disabled={isResolvingBarcode}>
            <ScanBarcode color="#7dd3fc" size={18} />
            <Text style={styles.scanButtonText}>{isResolvingBarcode ? 'Checking code...' : 'Scan can or label'}</Text>
          </TouchableOpacity>
          {scannedBarcode ? (
            <View style={styles.barcodePill}>
              <Text style={styles.barcodeText}>{scannedBarcode}</Text>
              <TouchableOpacity
                accessibilityLabel="Clear scanned barcode"
                onPress={() => {
                  beerEditVersion.current += 1;
                  setScannedBarcode('');
                  setScannedBarcodeMatchedBeer(false);
                }}
              >
                <X color="#bae6fd" size={15} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        {isScannerOpen ? (
          <View style={styles.scannerPanel}>
            <CameraView
              style={styles.cameraView}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
              onBarcodeScanned={applyScannedBarcode}
            />
            <View style={styles.scannerOverlay}>
              <Text style={styles.scannerText}>Center the can code</Text>
              <TouchableOpacity style={styles.scannerClose} onPress={() => setIsScannerOpen(false)}>
                <Text style={styles.scannerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <MapPin color="#22c55e" size={22} />
          <View>
            <Text style={styles.panelTitle}>2. Where did it happen?</Text>
            <Text style={styles.panelMeta}>{locationStatus}</Text>
          </View>
        </View>
        <TextInput
          placeholder="Venue or taproom, if it matters"
          placeholderTextColor="#64748b"
          style={styles.input}
          value={venueName}
          onChangeText={(value) => {
            markLocationFieldsEdited();
            setVenueName(value);
            clearSavedCoordinates();
            clearSelectedVenueReference();
          }}
        />
        <View style={styles.inlineFields}>
          <TextInput
            placeholder="City"
            placeholderTextColor="#64748b"
            style={[styles.input, styles.inlineInput]}
            value={city}
            onChangeText={(value) => {
              markLocationFieldsEdited();
              setCity(value);
              clearSavedCoordinates();
              clearSelectedVenueReference();
            }}
          />
          <TextInput
            placeholder="Country"
            placeholderTextColor="#64748b"
            style={[styles.input, styles.inlineInput]}
            value={country}
            onChangeText={(value) => {
              markLocationFieldsEdited();
              setCountry(value);
              clearSavedCoordinates();
              clearSelectedVenueReference();
            }}
          />
        </View>
        {!!locationHints.length || isLoadingHints ? (
          <View style={styles.hintContainer}>
            {isLoadingHints ? <Text style={styles.hintLoading}>Finding matching places...</Text> : null}
            {!isLoadingHints &&
              locationHints.map((hint) => {
                const key = `${hint.provider ?? 'user'}-${hint.externalId ?? ''}-${hint.venueName ?? ''}-${hint.city ?? ''}-${hint.country ?? ''}`;
                const label = hint.venueName ? `${hint.venueName} - ${hint.city}, ${hint.country}` : `${hint.city}, ${hint.country}`;
                return (
                  <TouchableOpacity key={key} style={styles.hintItem} onPress={() => applyHint(hint)}>
                    <Text style={styles.hintItemText}>{label}</Text>
                    {hint.provider === 'google' ? <Text style={styles.hintSource}>Google Places</Text> : null}
                  </TouchableOpacity>
                );
              })}
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.ghostButton}
          onPress={() => applyCurrentLocation('manual')}
          disabled={isLocating}
        >
          <Text style={styles.ghostButtonText}>{isLocating ? 'Finding nearby places...' : 'Use my current place'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.preview}>
        <View style={styles.previewTop}>
          <Text style={styles.previewKicker}>Stamp preview</Text>
          <Text style={styles.previewBadge}>{trimmedVenueName ? 'Venue' : 'City'}</Text>
        </View>
        <Text style={styles.previewTitle}>{trimmedBeerName || 'Your next pour'}</Text>
        <View style={styles.previewPlaceRow}>
          <MapPin color="#86efac" size={16} />
          <Text style={styles.previewPlace}>{trimmedVenueName ? `${trimmedVenueName} - ${placePreview}` : placePreview}</Text>
        </View>
        <Text style={styles.previewMeta}>{formatStyle(style)}. {audienceLabel} audience.</Text>
      </View>

      <TouchableOpacity style={styles.detailsToggle} onPress={() => setShowDetails((current) => !current)}>
        <View style={styles.detailsCopy}>
          <Text style={styles.detailsTitle}>Fine-tune the memory</Text>
          <Text style={styles.detailsMeta}>Brewery, audience, rating, and tasting note.</Text>
        </View>
        <Text style={styles.detailsAction}>{showDetails ? 'Hide' : 'Add'}</Text>
      </TouchableOpacity>

      {showDetails ? (
        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>Maker</Text>
          <TextInput
            placeholder="Brewery, maker, or taproom"
            placeholderTextColor="#64748b"
            style={styles.input}
            value={breweryName}
            onChangeText={(value) => {
              setBreweryName(value);
              markBeerFieldsEdited();
            }}
          />

          <Text style={styles.sectionLabel}>Audience</Text>
          <View style={styles.audienceList}>
            {audienceOptions.map((option) => {
              const active = privacy === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.audienceRow, active ? styles.audienceRowActive : undefined]}
                  onPress={() => setPrivacy(option.value)}
                >
                  <UsersRound color={active ? '#071022' : '#38bdf8'} size={18} />
                  <View style={styles.audienceCopy}>
                    <Text style={[styles.audienceLabel, active ? styles.audienceLabelActive : undefined]}>{option.label}</Text>
                    <Text style={[styles.audienceCaption, active ? styles.audienceCaptionActive : undefined]}>{option.caption}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => {
              const active = rating === String(value);
              return (
                <TouchableOpacity key={value} style={styles.starButton} onPress={() => setRating(active ? '' : String(value))}>
                  <Star color={active ? '#facc15' : '#475569'} fill={active ? '#facc15' : 'transparent'} size={26} />
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            placeholder="What made this pour worth remembering?"
            placeholderTextColor="#64748b"
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
          />
        </View>
      ) : null}

      <TouchableOpacity style={[styles.save, isSaving ? styles.disabled : undefined]} onPress={handleSubmit} disabled={isSaving}>
        <Text style={styles.saveText}>{isSaving ? 'Stamping...' : 'Stamp this pour'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 22,
    paddingBottom: 32,
    backgroundColor: '#071022',
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#0b1220',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  hero: {
    marginBottom: 18,
    gap: 10,
  },
  loadingWrap: {
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
  kickerRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0b1220',
  },
  kicker: {
    color: '#facc15',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '900',
  },
  subtitle: {
    color: '#94a3b8',
    lineHeight: 22,
    fontSize: 15,
    marginBottom: 16,
  },
  preview: {
    borderWidth: 1,
    borderColor: '#34513d',
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
    gap: 9,
    backgroundColor: '#10251c',
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewKicker: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewBadge: {
    color: '#111827',
    backgroundColor: '#facc15',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
  },
  previewTitle: {
    color: '#f8fafc',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  previewPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewPlace: {
    color: '#bbf7d0',
    flex: 1,
    fontWeight: '800',
  },
  previewMeta: {
    color: '#a7f3d0',
    lineHeight: 20,
  },
  panel: {
    backgroundColor: '#111b34',
    borderColor: '#1f3a5f',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  panelTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
  },
  panelMeta: {
    color: '#94a3b8',
    marginTop: 2,
  },
  heroInput: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    color: '#f8fafc',
    padding: 14,
    backgroundColor: '#0b1220',
    fontSize: 18,
    fontWeight: '800',
  },
  scanStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  scanButton: {
    borderWidth: 1,
    borderColor: '#1e40af',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0b1220',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButtonText: {
    color: '#bfdbfe',
    fontWeight: '800',
  },
  barcodePill: {
    borderWidth: 1,
    borderColor: '#075985',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#082f49',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barcodeText: {
    color: '#e0f2fe',
    fontSize: 12,
    fontWeight: '900',
  },
  scannerPanel: {
    height: 260,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f3a5f',
    backgroundColor: '#020617',
  },
  cameraView: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  scannerText: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  scannerClose: {
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scannerCloseText: {
    color: '#082f49',
    fontWeight: '900',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    color: '#e2e8f0',
    padding: 12,
    backgroundColor: '#0f172a',
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineInput: {
    flex: 1,
  },
  typeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  typeHint: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0b1220',
  },
  chipActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#f59e0b',
  },
  chipText: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#111827',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: '#86efac',
    fontWeight: '800',
  },
  detailsToggle: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0b1220',
  },
  detailsTitle: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 16,
  },
  detailsMeta: {
    color: '#94a3b8',
    marginTop: 4,
  },
  detailsCopy: {
    flex: 1,
  },
  detailsAction: {
    color: '#38bdf8',
    fontWeight: '800',
    flexShrink: 0,
  },
  sectionLabel: {
    color: '#cbd5e1',
    fontWeight: '800',
  },
  audienceList: {
    gap: 8,
  },
  audienceRow: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0b1220',
  },
  audienceRowActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#e0f2fe',
  },
  audienceCopy: {
    flex: 1,
  },
  audienceLabel: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  audienceLabelActive: {
    color: '#071022',
  },
  audienceCaption: {
    color: '#94a3b8',
    marginTop: 2,
  },
  audienceCaptionActive: {
    color: '#334155',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  starButton: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  noteInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  save: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  saveText: {
    color: '#052e16',
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.6,
  },
  hintContainer: {
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    overflow: 'hidden',
  },
  hintLoading: {
    color: '#94a3b8',
    padding: 10,
    textAlign: 'center',
  },
  hintItem: {
    padding: 10,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  hintItemText: {
    color: '#cbd5e1',
    fontWeight: '700',
  },
  hintSource: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
});
