import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BeerStyle, CheckinScope, PrivacyLevel } from '@/src/types/hoppin';
import { createCheckin, listVenueOrCityHints } from '@/src/lib/hoppin';

const styleChoices: BeerStyle[] = ['ipa', 'pilsner', 'lager', 'porter', 'stout', 'wheat', 'amber', 'sour', 'experimental', 'other'];
type LocationHint = { venueName?: string; city?: string; country?: string };

export default function Checkin() {
  const router = useRouter();
  const [beerName, setBeerName] = useState('');
  const [breweryName, setBreweryName] = useState('');
  const [scope, setScope] = useState<CheckinScope>('venue');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('followers');
  const [style, setStyle] = useState<BeerStyle>('ipa');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [note, setNote] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [rating, setRating] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [locationHints, setLocationHints] = useState<LocationHint[]>([]);
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const query = `${scope === 'venue' ? venueName : ''} ${city} ${country}`.trim();
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
  }, [city, country, venueName, scope]);

  const applyHint = (hint: LocationHint) => {
    if (hint.venueName) {
      setVenueName(hint.venueName);
    }
    if (hint.city) {
      setCity(hint.city);
    }
    if (hint.country) {
      setCountry(hint.country);
    }
    setLocationHints([]);
  };

  const handleSubmit = async () => {
    if (!beerName.trim() || !city.trim() || !country.trim()) {
      Alert.alert('Missing details', 'Beer and city/country are required.');
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
    let parsedLatitude: number | undefined;
    let parsedLongitude: number | undefined;

    if (rawLatitude || rawLongitude) {
      if (!rawLatitude || !rawLongitude) {
        Alert.alert('Invalid location', 'Enter both latitude and longitude or leave both blank.');
        return;
      }

      parsedLatitude = Number(rawLatitude);
      parsedLongitude = Number(rawLongitude);

      if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
        Alert.alert('Invalid location', 'Latitude and longitude must be valid numbers.');
        return;
      }

      if (parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180) {
        Alert.alert('Invalid location', 'Latitude must be between -90 and 90 and longitude between -180 and 180.');
        return;
      }
    }

    try {
      setIsSaving(true);
      await createCheckin({
        beerName,
        style,
        breweryName,
        scope,
        privacy,
        note,
        rating: parsedRating,
        lat: parsedLatitude ?? 0,
        lng: parsedLongitude ?? 0,
        venueName,
        city,
        country,
      });
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Could not save', 'Your check-in could not be created.');
      setIsSaving(false);
    }
  };

  const applyCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location blocked', 'Enable location permissions to use your current location.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));

      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const first = places?.[0];
      if (first) {
        if (first.city && !city) {
          setCity(first.city);
        }
        if (first.country && !country) {
          setCountry(first.country);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read location.';
      Alert.alert('Location failed', message);
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Log a beer</Text>
      <Text style={styles.subtitle}>City, venue, privacy, and style are all part of your passport.</Text>

      <TextInput
        placeholder="Beer name"
        placeholderTextColor="#64748b"
        style={styles.input}
        value={beerName}
        onChangeText={setBeerName}
      />
      <TextInput
        placeholder="Brewery (optional)"
        placeholderTextColor="#64748b"
        style={styles.input}
        value={breweryName}
        onChangeText={setBreweryName}
      />

      <Text style={styles.sectionLabel}>Scope</Text>
      <View style={styles.segmentGroup}>
        <TouchableOpacity style={[styles.segmentButton, scope === 'venue' ? styles.segmentButtonActive : undefined]} onPress={() => setScope('venue')}>
          <Text style={styles.segmentText}>Venue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segmentButton, scope === 'city' ? styles.segmentButtonActive : undefined]} onPress={() => setScope('city')}>
          <Text style={styles.segmentText}>City</Text>
        </TouchableOpacity>
      </View>

      {scope === 'venue' ? (
        <TextInput
          placeholder="Venue name"
          placeholderTextColor="#64748b"
          style={styles.input}
          value={venueName}
          onChangeText={setVenueName}
        />
      ) : null}

      <TextInput
        placeholder="City"
        placeholderTextColor="#64748b"
        style={styles.input}
        value={city}
        onChangeText={setCity}
      />
      <TextInput
        placeholder="Country"
        placeholderTextColor="#64748b"
        style={styles.input}
        value={country}
        onChangeText={setCountry}
      />
      {!!locationHints.length || isLoadingHints ? (
        <View style={styles.hintContainer}>
          {isLoadingHints ? <Text style={styles.hintLoading}>Loading nearby locations…</Text> : null}
          {!isLoadingHints &&
            locationHints.map((hint) => {
              const key = `${hint.venueName ?? ''}-${hint.city ?? ''}-${hint.country ?? ''}`;
              const label = hint.venueName ? `${hint.venueName} — ${hint.city}, ${hint.country}` : `${hint.city}, ${hint.country}`;
              return (
                <TouchableOpacity key={key} style={styles.hintItem} onPress={() => applyHint(hint)}>
                  <Text style={styles.hintItemText}>{label}</Text>
                </TouchableOpacity>
              );
            })}
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Style</Text>
      <View style={styles.segmentGroup}>
        {styleChoices.slice(0, 5).map((choice) => (
          <TouchableOpacity
            key={choice}
            style={[styles.segmentButton, style === choice ? styles.segmentButtonActive : undefined]}
            onPress={() => setStyle(choice)}
          >
            <Text style={styles.segmentText}>{choice.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Privacy</Text>
      <View style={styles.segmentGroup}>
        {(['public', 'followers', 'private'] as PrivacyLevel[]).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.segmentButton, privacy === value ? styles.segmentButtonActive : undefined]}
            onPress={() => setPrivacy(value)}
          >
            <Text style={styles.segmentText}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        keyboardType="numeric"
        placeholder="Rating 1-5"
        placeholderTextColor="#64748b"
        style={styles.input}
        value={rating}
        onChangeText={setRating}
      />
      <TextInput
        placeholder="Notes"
        placeholderTextColor="#64748b"
        style={styles.input}
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
      />
      <TextInput
        keyboardType="numeric"
        placeholder="Latitude (optional)"
        placeholderTextColor="#64748b"
        style={styles.input}
        value={latitude}
        onChangeText={setLatitude}
      />
      <TextInput
        keyboardType="numeric"
        placeholder="Longitude (optional)"
        placeholderTextColor="#64748b"
        style={styles.input}
        value={longitude}
        onChangeText={setLongitude}
      />
      <TouchableOpacity
        style={[styles.save, styles.locationButton]}
        onPress={applyCurrentLocation}
        disabled={isLocating}
      >
        <Text style={styles.saveText}>{isLocating ? 'Reading location…' : 'Use current location'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.save} onPress={handleSubmit} disabled={isSaving}>
        <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save check-in'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#071022',
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 8,
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#cbd5e1',
    marginBottom: 8,
    marginTop: 8,
  },
  segmentGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  segmentButton: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  segmentButtonActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#422006',
  },
  segmentText: {
    color: '#e2e8f0',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    color: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#0f172a',
  },
  save: {
    marginTop: 12,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#111827',
    fontWeight: '700',
  },
  locationButton: {
    marginBottom: 12,
    backgroundColor: '#22c55e',
  },
  hintContainer: {
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 12,
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
  },
});
