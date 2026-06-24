import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowLeft, ArrowUp, Beer, MapPin, Pencil, Trash2 } from 'lucide-react-native';
import {
  checkinVisibilityLabel,
  deleteTrail,
  getCurrentProfile,
  getTrail,
  removeTrailItem,
  reorderTrailItems,
  updateTrail,
} from '@/src/lib/hoppin';
import { resolveProtectedRoute, shouldRouteErrorToAuth } from '@/src/lib/sessionRouting';
import { PrivacyLevel, Profile, Trail } from '@/src/types/hoppin';

const privacyOptions: PrivacyLevel[] = ['private', 'followers', 'public'];

function itemTitle(item: Trail['items'][number]): string {
  if (item.kind === 'checkin') return item.checkin?.beer.name ?? item.title ?? 'Stamped pour';
  return item.title ?? item.venue?.name ?? item.city?.city ?? 'Planned stop';
}

function itemMeta(item: Trail['items'][number]): string {
  if (item.kind === 'checkin') {
    const checkin = item.checkin;
    if (!checkin) {
      if (item.city) return `${item.city.city}, ${item.city.country}`;
      return item.checkedAt ? 'Stamped pour' : 'Stamp';
    }
    if (checkin.scope === 'venue' && checkin.venue) {
      return `${checkin.venue.name} - ${checkin.venue.city}`;
    }
    if (checkin.city) {
      return `${checkin.city.city}, ${checkin.city.country}`;
    }
    return 'Passport stamp';
  }

  if (item.venue) return `${item.venue.city}, ${item.venue.country}`;
  if (item.city) return `${item.city.city}, ${item.city.country}`;
  return 'Planned place';
}

export default function TrailDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const trailId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isMountedRef = useRef(false);
  const [trail, setTrail] = useState<Trail | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPrivacy, setDraftPrivacy] = useState<PrivacyLevel>('private');
  const [isRouteReady, setIsRouteReady] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    if (!trailId || !isRouteReady) return;
    setIsLoading(true);
    try {
      const [profile, nextTrail] = await Promise.all([getCurrentProfile(), getTrail(trailId)]);
      if (!isMountedRef.current) return;
      setMe(profile);
      setTrail(nextTrail);
      setDraftTitle(nextTrail?.title ?? '');
      setDraftDescription(nextTrail?.description ?? '');
      setDraftPrivacy(nextTrail?.privacy ?? 'private');
    } catch {
      if (isMountedRef.current) {
        setTrail(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isRouteReady, trailId]);

  useEffect(() => {
    isMountedRef.current = true;
    void load();
    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      setRouteError(false);
      try {
        const route = await resolveProtectedRoute();
        if (!mounted) return;

        if (route.status === 'redirect') {
          const returnTo = trailId ? `/trail/${trailId}` : '/passport';
          if (route.destination === '/onboarding') {
            router.replace({ pathname: '/onboarding', params: { returnTo } });
            return;
          }

          router.replace(route.destination === '/auth' ? { pathname: '/auth', params: { returnTo } } : route.destination);
          return;
        }

        setIsRouteReady(true);
      } catch {
        const shouldUseAuth = await shouldRouteErrorToAuth();
        if (!mounted) return;

        if (shouldUseAuth) {
          router.replace({ pathname: '/auth', params: { returnTo: trailId ? `/trail/${trailId}` : '/passport' } });
          return;
        }

        setRouteError(true);
        setIsLoading(false);
      }
    };

    void resolve();

    return () => {
      mounted = false;
    };
  }, [attempt, router, trailId]);

  const isOwner = Boolean(me && trail && me.id === trail.profileId);
  const hasChanges = useMemo(() => {
    if (!trail) return false;
    return (
      draftTitle.trim() !== trail.title ||
      draftDescription.trim() !== (trail.description ?? '') ||
      draftPrivacy !== trail.privacy
    );
  }, [draftDescription, draftPrivacy, draftTitle, trail]);

  const saveEdits = async () => {
    if (!trail || !isOwner || !hasChanges || isSaving) return;
    setIsSaving(true);
    try {
      const updated = await updateTrail(trail.id, {
        title: draftTitle,
        description: draftDescription,
        privacy: draftPrivacy,
      });
      setTrail(updated);
      setIsEditing(false);
    } catch {
      Alert.alert('Trail not updated', 'Could not save trail changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCurrentTrail = async () => {
    if (!trail || !isOwner) return;
    Alert.alert('Delete trail?', 'This removes the trail but keeps the original stamps.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteTrail(trail.id)
            .then(() => router.replace('/passport'))
            .catch(() => Alert.alert('Trail not deleted', 'Could not delete this trail.'));
        },
      },
    ]);
  };

  const removeItem = async (itemId: string) => {
    if (!trail || !isOwner) return;
    try {
      await removeTrailItem(trail.id, itemId);
      await load();
    } catch {
      Alert.alert('Item not removed', 'Could not remove this trail stop.');
    }
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    if (!trail || !isOwner) return;
    const next = [...trail.items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      const updated = await reorderTrailItems(trail.id, next.map((item) => item.id));
      setTrail(updated);
    } catch {
      Alert.alert('Order not saved', 'Could not reorder this trail.');
    }
  };

  if (routeError) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorTitle}>Could not load trail</Text>
        <Text style={styles.errorText}>Your session is active, but Hoppin could not load the trail state.</Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            setIsRouteReady(false);
            setRouteError(false);
            setIsLoading(true);
            setAttempt((current) => current + 1);
          }}
        >
          <Text style={styles.secondaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isRouteReady || isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.emptyTitle}>Trail not found.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/passport')}>
          <Text style={styles.secondaryButtonText}>Back to Trails</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <TouchableOpacity accessibilityLabel="Back" style={styles.iconButton} onPress={() => router.back()}>
          <ArrowLeft color="#cbd5e1" size={20} />
        </TouchableOpacity>
        {isOwner ? (
          <View style={styles.ownerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setIsEditing((value) => !value)}>
              <Pencil color="#7dd3fc" size={18} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={deleteCurrentTrail}>
              <Trash2 color="#fca5a5" size={18} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>{checkinVisibilityLabel(trail.privacy)} trail</Text>
        {isEditing ? (
          <>
            <TextInput value={draftTitle} onChangeText={setDraftTitle} style={styles.titleInput} />
            <TextInput
              value={draftDescription}
              onChangeText={setDraftDescription}
              placeholder="Description"
              placeholderTextColor="#64748b"
              style={[styles.input, styles.descriptionInput]}
              multiline
            />
            <View style={styles.privacyRow}>
              {privacyOptions.map((option) => {
                const active = draftPrivacy === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.privacyChip, active ? styles.privacyChipActive : undefined]}
                    onPress={() => setDraftPrivacy(option)}
                  >
                    <Text style={[styles.privacyChipText, active ? styles.privacyChipTextActive : undefined]}>
                      {checkinVisibilityLabel(option)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.saveButton, !hasChanges ? styles.disabledButton : undefined]} onPress={saveEdits} disabled={!hasChanges || isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save changes'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>{trail.title}</Text>
            {trail.description ? <Text style={styles.subtitle}>{trail.description}</Text> : null}
          </>
        )}
        <Text style={styles.ownerText}>
          {trail.owner?.displayName ?? (isOwner ? me?.displayName : 'Hoppin creator')} - {trail.itemCount} {trail.itemCount === 1 ? 'stop' : 'stops'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Stops</Text>
        {!trail.items.length ? (
          <Text style={styles.emptyText}>This trail is an empty private draft.</Text>
        ) : (
          trail.items.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemIndex}>
                <Text style={styles.itemIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.itemIcon}>
                {item.kind === 'checkin' ? <Beer color="#f59e0b" size={17} /> : <MapPin color="#38bdf8" size={17} />}
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{itemTitle(item)}</Text>
                <Text style={styles.itemMeta}>{itemMeta(item)}</Text>
                {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
              </View>
              {isOwner ? (
                <View style={styles.itemActions}>
                  <TouchableOpacity style={styles.smallIconButton} onPress={() => moveItem(index, -1)}>
                    <ArrowUp color="#94a3b8" size={15} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallIconButton} onPress={() => moveItem(index, 1)}>
                    <ArrowDown color="#94a3b8" size={15} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallIconButton} onPress={() => removeItem(item.id)}>
                    <Trash2 color="#fca5a5" size={15} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
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
    paddingBottom: 32,
    gap: 14,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#071022',
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
  },
  hero: {
    gap: 9,
  },
  kicker: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#172554',
    color: '#bae6fd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  ownerText: {
    color: '#94a3b8',
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: '#1f3a5f',
    backgroundColor: '#111b34',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
  },
  errorTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
  },
  errorText: {
    color: '#94a3b8',
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    lineHeight: 20,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
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
  itemIcon: {
    width: 28,
    alignItems: 'center',
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
  itemNote: {
    color: '#cbd5e1',
    marginTop: 6,
    lineHeight: 18,
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
  titleInput: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    backgroundColor: '#071022',
    color: '#f8fafc',
    paddingHorizontal: 12,
    fontSize: 24,
    fontWeight: '900',
  },
  descriptionInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  privacyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  privacyChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  privacyChipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#38bdf8',
  },
  privacyChipText: {
    color: '#cbd5e1',
    fontWeight: '900',
  },
  privacyChipTextActive: {
    color: '#082f49',
  },
  saveButton: {
    minHeight: 46,
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
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#7dd3fc',
    fontWeight: '900',
  },
});
