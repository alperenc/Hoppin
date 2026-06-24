import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowLeft, ArrowUp, MapPin, Plus, Route, Trash2 } from 'lucide-react-native';
import {
  checkinVisibilityLabel,
  createTrail,
  getCurrentProfile,
  listProfileCheckins,
  listVenueOrCityHints,
} from '@/src/lib/hoppin';
import { Checkin, CreateTrailItemInput, LocationHint, PrivacyLevel, Profile, Venue } from '@/src/types/hoppin';

type DraftTrailItem = {
  key: string;
  input: CreateTrailItemInput;
  label: string;
  meta: string;
};

const privacyOptions: Array<{ value: PrivacyLevel; label: string; detail: string }> = [
  { value: 'private', label: 'Private', detail: 'Draft only you can see' },
  { value: 'followers', label: 'Followers', detail: 'Share with people following you' },
  { value: 'public', label: 'Public', detail: 'Eligible for Discover' },
];

function checkinPlace(checkin: Checkin): string {
  if (checkin.scope === 'venue' && checkin.venue) {
    return `${checkin.venue.name} - ${checkin.venue.city}`;
  }
  if (checkin.city) {
    return `${checkin.city.city}, ${checkin.city.country}`;
  }
  return 'Passport stamp';
}

function checkinDraft(checkin: Checkin): DraftTrailItem {
  return {
    key: `checkin-${checkin.id}`,
    input: { kind: 'checkin', checkinId: checkin.id },
    label: checkin.beer.name,
    meta: `${checkinPlace(checkin)} - ${checkinVisibilityLabel(checkin.privacy)}`,
  };
}

function hintDraft(hint: LocationHint): DraftTrailItem {
  const title = hint.venueName ?? (hint.city && hint.country ? `${hint.city}, ${hint.country}` : 'Planned stop');
  let venue: Venue | undefined;
  if (hint.venueName && hint.city && hint.country && hint.lat !== undefined && hint.lng !== undefined) {
    venue = {
      id: hint.externalId ?? `planned-${hint.venueName}-${hint.city}`,
      name: hint.venueName,
      city: hint.city,
      country: hint.country,
      provider: hint.provider ?? 'google',
      externalId: hint.externalId,
      lat: hint.lat,
      lng: hint.lng,
    };
  }

  return {
    key: `place-${hint.externalId ?? title}-${Date.now()}`,
    input: {
      kind: 'place',
      title,
      venue,
      city: !venue && hint.city && hint.country && hint.lat !== undefined && hint.lng !== undefined
        ? {
            city: hint.city,
            country: hint.country,
            lat: hint.lat,
            lng: hint.lng,
          }
        : undefined,
    },
    label: title,
    meta: hint.city && hint.country ? `${hint.city}, ${hint.country}` : 'Planned place',
  };
}

export default function NewTrail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ checkinId?: string }>();
  const checkinId = Array.isArray(params.checkinId) ? params.checkinId[0] : params.checkinId;
  const [me, setMe] = useState<Profile | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [items, setItems] = useState<DraftTrailItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('private');
  const [placeQuery, setPlaceQuery] = useState('');
  const [hints, setHints] = useState<LocationHint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const seededCheckinRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const profile = await getCurrentProfile();
        const stamps = await listProfileCheckins(profile.id);
        if (!mounted) return;
        setMe(profile);
        setCheckins(stamps);
        if (!title && stamps[0]) {
          setTitle(`${stamps[0].beer.name} trail`);
        }
      } catch {
        Alert.alert('Trail unavailable', 'Could not load your stamps for the composer.');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [title]);

  useEffect(() => {
    if (!checkinId || seededCheckinRef.current || !checkins.length) return;
    const checkin = checkins.find((item) => item.id === checkinId);
    if (!checkin) return;
    seededCheckinRef.current = true;
    setItems([checkinDraft(checkin)]);
    setTitle((current) => current || `${checkin.beer.name} trail`);
  }, [checkinId, checkins]);

  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 2) {
      setHints([]);
      return;
    }

    setIsSearching(true);
    const handle = setTimeout(() => {
      listVenueOrCityHints(query)
        .then(setHints)
        .catch(() => setHints([]))
        .finally(() => setIsSearching(false));
    }, 250);

    return () => {
      clearTimeout(handle);
    };
  }, [placeQuery]);

  const canSave = useMemo(() => Boolean(title.trim()) && !isSaving, [isSaving, title]);

  const addCheckin = useCallback((checkin: Checkin) => {
    setItems((current) => {
      if (current.some((item) => item.input.kind === 'checkin' && item.input.checkinId === checkin.id)) {
        return current;
      }
      return [...current, checkinDraft(checkin)];
    });
  }, []);

  const addPlace = useCallback((hint: LocationHint) => {
    setItems((current) => [...current, hintDraft(hint)]);
    setPlaceQuery('');
    setHints([]);
  }, []);

  const addManualPlace = useCallback(() => {
    const value = placeQuery.trim();
    if (!value) return;
    setItems((current) => [
      ...current,
      {
        key: `manual-${Date.now()}`,
        input: { kind: 'place', title: value },
        label: value,
        meta: 'Planned stop',
      },
    ]);
    setPlaceQuery('');
    setHints([]);
  }, [placeQuery]);

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeItem = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
  };

  const saveTrail = async () => {
    if (!me || !canSave) return;
    setIsSaving(true);
    try {
      const trail = await createTrail({
        profileId: me.id,
        title,
        description,
        privacy,
        items: items.map((item, index) => ({ ...item.input, position: index })),
      });
      router.replace(`/trail/${trail.id}`);
    } catch {
      Alert.alert('Trail not saved', 'Could not save this trail right now.');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <TouchableOpacity accessibilityLabel="Close trail composer" style={styles.iconButton} onPress={() => router.back()}>
          <ArrowLeft color="#cbd5e1" size={20} />
        </TouchableOpacity>
        <View style={styles.kickerRow}>
          <Route color="#facc15" size={16} />
          <Text style={styles.kicker}>New trail</Text>
        </View>
      </View>

      <Text style={styles.title}>Create a trail</Text>
      <Text style={styles.subtitle}>Collect stamped pours and planned stops into a route you can keep private or share.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Weekend lager crawl"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Why this route is worth saving"
          placeholderTextColor="#64748b"
          style={[styles.input, styles.multilineInput]}
          multiline
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Visibility</Text>
        <View style={styles.privacyRow}>
          {privacyOptions.map((option) => {
            const active = privacy === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.privacyButton, active ? styles.privacyButtonActive : undefined]}
                onPress={() => setPrivacy(option.value)}
              >
                <Text style={[styles.privacyLabel, active ? styles.privacyLabelActive : undefined]}>{option.label}</Text>
                <Text style={styles.privacyDetail}>{option.detail}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trail items</Text>
          <Text style={styles.sectionMeta}>{items.length} stops</Text>
        </View>
        {!items.length ? (
          <Text style={styles.emptyText}>Start empty, add a stamped pour, or add a planned place.</Text>
        ) : (
          items.map((item, index) => (
            <View key={item.key} style={styles.itemRow}>
              <View style={styles.itemIndex}>
                <Text style={styles.itemIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{item.label}</Text>
                <Text style={styles.itemMeta}>{item.meta}</Text>
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity style={styles.smallIconButton} onPress={() => moveItem(index, -1)}>
                  <ArrowUp color="#94a3b8" size={16} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallIconButton} onPress={() => moveItem(index, 1)}>
                  <ArrowDown color="#94a3b8" size={16} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallIconButton} onPress={() => removeItem(item.key)}>
                  <Trash2 color="#fca5a5" size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add stamped pour</Text>
        {checkins.length ? (
          checkins.slice(0, 8).map((checkin) => (
            <TouchableOpacity key={checkin.id} style={styles.addRow} onPress={() => addCheckin(checkin)}>
              <Plus color="#86efac" size={18} />
              <View style={styles.addCopy}>
                <Text style={styles.addTitle}>{checkin.beer.name}</Text>
                <Text style={styles.addMeta}>{checkinPlace(checkin)}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>Stamp a pour first, or add a planned place below.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add planned place</Text>
        <TextInput
          value={placeQuery}
          onChangeText={setPlaceQuery}
          placeholder="Search venue or city"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        {isSearching ? <ActivityIndicator size="small" color="#38bdf8" /> : null}
        {hints.map((hint) => (
          <TouchableOpacity key={`${hint.externalId ?? hint.venueName ?? hint.city}-${hint.country}`} style={styles.addRow} onPress={() => addPlace(hint)}>
            <MapPin color="#38bdf8" size={18} />
            <View style={styles.addCopy}>
              <Text style={styles.addTitle}>{hint.venueName ?? hint.city}</Text>
              <Text style={styles.addMeta}>{hint.city && hint.country ? `${hint.city}, ${hint.country}` : 'Place result'}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {placeQuery.trim() ? (
          <TouchableOpacity style={styles.manualButton} onPress={addManualPlace}>
            <Text style={styles.manualButtonText}>Add "{placeQuery.trim()}" as a planned stop</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity style={[styles.saveButton, !canSave ? styles.disabledButton : undefined]} onPress={saveTrail} disabled={!canSave}>
        <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save trail'}</Text>
      </TouchableOpacity>
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
    paddingBottom: 32,
    gap: 12,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071022',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickerRow: {
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
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderColor: '#1f3a5f',
    backgroundColor: '#111b34',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#071022',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '800',
  },
  multilineInput: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '900',
  },
  sectionMeta: {
    color: '#94a3b8',
  },
  privacyRow: {
    gap: 8,
  },
  privacyButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    backgroundColor: '#0b1220',
  },
  privacyButtonActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#082f49',
  },
  privacyLabel: {
    color: '#f8fafc',
    fontWeight: '900',
  },
  privacyLabelActive: {
    color: '#7dd3fc',
  },
  privacyDetail: {
    color: '#94a3b8',
    marginTop: 3,
    fontSize: 12,
  },
  emptyText: {
    color: '#94a3b8',
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    backgroundColor: '#0b1220',
    padding: 10,
  },
  itemIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#172554',
  },
  itemIndexText: {
    color: '#bae6fd',
    fontWeight: '900',
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    color: '#f8fafc',
    fontWeight: '900',
  },
  itemMeta: {
    color: '#94a3b8',
    marginTop: 3,
    fontSize: 12,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  smallIconButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#0b1220',
  },
  addCopy: {
    flex: 1,
  },
  addTitle: {
    color: '#f8fafc',
    fontWeight: '900',
  },
  addMeta: {
    color: '#94a3b8',
    marginTop: 3,
    fontSize: 12,
  },
  manualButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    padding: 10,
  },
  manualButtonText: {
    color: '#7dd3fc',
    fontWeight: '900',
    textAlign: 'center',
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#052e16',
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
});
