import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Beer, Compass, MapPinned, Sparkles, Trophy, UsersRound } from 'lucide-react-native';
import {
  getCurrentProfile,
  getPassportSummary,
  listCityTrips,
  listProfiles,
  listPassportStamps,
  followProfile,
  getFollowedProfiles,
  unfollowProfile,
  setProfileCreatorRole,
  updateProfileIdentity,
} from '@/src/lib/hoppin';
import type { CityVisit, PassportSummary, Profile } from '@/src/types/hoppin';
import { markOnboardingComplete } from '@/src/lib/onboarding';
import { resolveAppDestination, shouldRouteErrorToAuth } from '@/src/lib/sessionRouting';

const roleOptions = [
  {
    key: false,
    label: 'Explorer',
    caption: 'Track trips, save beers, follow locals.',
  },
  {
    key: true,
    label: 'Creator',
    caption: 'Build an audience around your beer trail.',
  },
] as const;

const formatBeerStyle = (style: string) => style.slice(0, 1).toUpperCase() + style.slice(1);
const allowedPostOnboardingRoutes = new Set(['/checkin', '/home', '/discover', '/profile', '/passport']);

const normalizeReturnTo = (value: string | string[] | undefined) => {
  const destination = Array.isArray(value) ? value[0] : value;
  if (destination && (destination === '/trail/new' || /^\/trail\/[^/]+$/.test(destination))) {
    return destination;
  }
  return destination && allowedPostOnboardingRoutes.has(destination) ? destination : '/home';
};

export default function Onboarding() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const postOnboardingDestination = normalizeReturnTo(params.returnTo);
  const [me, setMe] = useState<Profile | null>(null);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [summary, setSummary] = useState<PassportSummary | null>(null);
  const [latestTrip, setLatestTrip] = useState<CityVisit | null>(null);
  const [stampCount, setStampCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [routeError, setRouteError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = async (currentProfile?: Profile) => {
    const current = currentProfile ?? await getCurrentProfile();
    setMe(current);
    setIsCreator(current.isCreator);
    setDisplayName(current.displayName);
    setUsername(current.username);

    try {
      const [allProfiles, followed] = await Promise.all([listProfiles(), getFollowedProfiles(current.id)]);
      setCreators(allProfiles.filter((profile) => profile.id !== current.id));
      setFollowedIds(followed.map((profile) => profile.id));
    } catch {
      setCreators([]);
      setFollowedIds([]);
    }

    try {
      const [passportSummary, trips, stamps] = await Promise.all([
        getPassportSummary(current.id),
        listCityTrips(current.id),
        listPassportStamps(current.id),
      ]);
      setSummary(passportSummary);
      setLatestTrip(trips[0] ?? null);
      setStampCount(stamps.length);
    } catch {
      setSummary(null);
      setLatestTrip(null);
      setStampCount(0);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      setRouteError(false);
      setIsLoading(true);
      try {
        const destination = await resolveAppDestination();
        if (!mounted) return;

        if (destination !== '/onboarding') {
          router.replace(destination === '/home' ? postOnboardingDestination : destination);
          return;
        }

        await load();
      } catch {
        const shouldUseAuth = await shouldRouteErrorToAuth();
        if (!mounted) return;

        if (shouldUseAuth) {
          router.replace('/auth');
          return;
        }

        setRouteError(true);
        setIsLoading(false);
      }
    };

    initialize().catch(async () => {
      const shouldUseAuth = await shouldRouteErrorToAuth();
      if (!mounted) return;

      if (shouldUseAuth) {
        router.replace('/auth');
        return;
      }

      setRouteError(true);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [attempt, postOnboardingDestination, router]);

  const retryRouteLoad = () => {
    setRouteError(false);
    setIsLoading(true);
    setAttempt((current) => current + 1);
  };

  const isFollowing = (id: string) => followedIds.includes(id);

  const toggleFollow = async (id: string) => {
    if (!me) return;
    const currently = isFollowing(id);
    try {
      if (currently) {
        await unfollowProfile(me.id, id);
      } else {
        await followProfile(me.id, id);
      }
      const refreshed = await getFollowedProfiles(me.id);
      setFollowedIds(refreshed.map((profile) => profile.id));
    } catch {
      Alert.alert('Follow failed', 'Could not update follow state.');
    }
  };

  const completeOnboarding = async () => {
    if (!me) return;
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Add the name people will see on your Hoppin profile.');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Handle required', 'Add a handle for your public profile link.');
      return;
    }

    setSaving(true);
    try {
      let nextProfile = await updateProfileIdentity(me.id, { displayName, username });
      if (isCreator !== me.isCreator) {
        nextProfile = await setProfileCreatorRole(me.id, isCreator);
      }
      setMe(nextProfile);
      await markOnboardingComplete(me.id);
      router.replace(postOnboardingDestination);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again in a moment.';
      Alert.alert('Could not continue', message);
      setSaving(false);
    }
  };

  const shareWithFriends = () => {
    const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : 'hoppin://';
    if (!inviteUrl) return;
    Linking.canOpenURL(inviteUrl)
      .then((supported) => {
        if (!supported) {
          return;
        }
        Linking.openURL(inviteUrl);
      })
      .catch(() => undefined);
  };

  const previewCity = latestTrip?.city ?? 'No trail yet';
  const previewCountry = latestTrip?.country;
  const previewStops = latestTrip?.checkinCount ?? summary?.checkinsCount ?? 0;
  const previewStopsLabel = previewStops > 0 ? `${previewStops} ${previewStops === 1 ? 'stop' : 'stops'}` : 'No stops yet';
  const highlightItems = [
    { label: `${stampCount} city ${stampCount === 1 ? 'stamp' : 'stamps'}`, Icon: MapPinned, color: '#22c55e' },
    { label: `${summary?.checkinsCount ?? 0} beer ${summary?.checkinsCount === 1 ? 'check-in' : 'check-ins'}`, Icon: Beer, color: '#f59e0b' },
    { label: `${followedIds.length} ${followedIds.length === 1 ? 'person' : 'people'} followed`, Icon: UsersRound, color: '#38bdf8' },
  ];

  if (routeError) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorTitle}>Could not load onboarding</Text>
        <Text style={styles.errorText}>Your session is active, but Hoppin could not load your starting state.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={retryRouteLoad}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.kickerRow}>
            <Sparkles color="#f59e0b" size={16} />
            <Text style={styles.kicker}>Beer passport starts here</Text>
          </View>
          <Text style={styles.title}>Turn every pour into a place worth revisiting.</Text>
          <Text style={styles.subtitle}>
            Pick your first people to follow, collect city stamps, and build a feed around beer trips you actually want to take.
          </Text>
        </View>

        <View style={styles.passportPreview}>
          <View style={styles.passportHeader}>
            <View>
              <Text style={styles.previewLabel}>{latestTrip ? 'Latest city trail' : 'Next city trail'}</Text>
              <Text style={styles.previewTitle}>{previewCity}</Text>
            </View>
            <View style={styles.previewBadge}>
              <Trophy color="#f8fafc" size={16} />
              <Text style={styles.previewBadgeText}>{previewStopsLabel}</Text>
            </View>
          </View>
          <View style={styles.routeLine}>
            <View style={[styles.routeDot, styles.routeDotActive]} />
            <View style={styles.routeSegment} />
            <View style={styles.routeDot} />
            <View style={styles.routeSegment} />
            <View style={[styles.routeDot, styles.routeDotFinal]} />
          </View>
          <View style={styles.previewFooter}>
            <Text style={styles.previewMeta}>{previewCountry ? `${previewCity}, ${previewCountry}` : 'Stamp your first pour'}</Text>
            <Text style={styles.previewMeta}>{summary?.topStyles[0] ? `Top style: ${formatBeerStyle(summary.topStyles[0].style)}` : 'No style yet'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.highlightRow}>
        {highlightItems.map(({ label, Icon, color }) => (
          <View key={label} style={styles.highlightCard}>
            <Icon color={color} size={20} />
            <Text style={styles.highlightText}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Claim your profile</Text>
      <View style={styles.identityCard}>
        <TextInput
          autoCapitalize="words"
          editable={!saving}
          placeholder="Display name"
          placeholderTextColor="#64748b"
          style={styles.identityInput}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <View style={styles.handleRow}>
          <Text style={styles.handlePrefix}>@</Text>
          <TextInput
            autoCapitalize="none"
            editable={!saving}
            placeholder="handle"
            placeholderTextColor="#64748b"
            style={[styles.identityInput, styles.handleInput]}
            value={username}
            onChangeText={setUsername}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Choose your starting lane</Text>
      <View style={styles.roleGrid}>
        {roleOptions.map((option) => {
          const active = isCreator === option.key;
          return (
            <TouchableOpacity
              key={option.label}
              style={[styles.roleCard, active ? styles.roleCardActive : undefined]}
              onPress={() => {
                setIsCreator(option.key);
              }}
              disabled={saving}
            >
              <View style={[styles.roleIconWrap, active ? styles.roleIconWrapActive : undefined]}>
                {option.key ? <UsersRound color={active ? '#071022' : '#38bdf8'} size={20} /> : <Compass color={active ? '#071022' : '#22c55e'} size={20} />}
              </View>
              <Text style={[styles.roleLabel, active ? styles.roleLabelActive : undefined]}>{option.label}</Text>
              <Text style={[styles.roleCaption, active ? styles.roleCaptionActive : undefined]}>{option.caption}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Seed your feed</Text>
          <Text style={styles.sectionSubtitle}>{followedIds.length} selected</Text>
        </View>
        <View style={styles.progressPill}>
          <UsersRound color="#38bdf8" size={16} />
          <Text style={styles.progressText}>{followedIds.length} / {Math.max(1, creators.length)}</Text>
        </View>
      </View>

      {creators.length === 0 ? (
        <Text style={styles.empty}>No other profiles found.</Text>
      ) : (
        <View style={styles.creatorList}>
          {creators.map((profile) => {
            const selected = isFollowing(profile.id);
            return (
              <View key={profile.id} style={[styles.profileRow, selected ? styles.profileRowSelected : undefined]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{profile.displayName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{profile.displayName}</Text>
                  <Text style={styles.profileHandle}>@{profile.username}</Text>
                  <Text style={styles.followState}>{profile.isCreator ? 'Creator' : 'Explorer'} | {selected ? 'in your first feed' : 'available to follow'}</Text>
                </View>
                <TouchableOpacity style={styles.followButton} onPress={() => toggleFollow(profile.id)} disabled={saving}>
                  <Text style={styles.followButtonText}>{selected ? 'Following' : 'Follow'}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={[styles.cta, saving ? styles.disabled : undefined]} onPress={completeOnboarding} disabled={saving}>
        <Text style={styles.ctaText}>{saving ? 'Saving...' : 'Start my passport'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.secondaryCta]} onPress={shareWithFriends}>
        <Text style={styles.secondaryText}>Invite friends</Text>
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
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: '#071022',
    alignItems: 'center',
    justifyContent: 'center',
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
  hero: {
    gap: 16,
    marginBottom: 16,
  },
  heroCopy: {
    gap: 10,
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
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
  },
  passportPreview: {
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f3a5f',
  },
  passportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  previewLabel: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  previewTitle: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#166534',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewBadgeText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  routeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#38bdf8',
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  routeDotActive: {
    backgroundColor: '#f59e0b',
  },
  routeDotFinal: {
    backgroundColor: '#22c55e',
  },
  routeSegment: {
    flex: 1,
    height: 3,
    backgroundColor: '#334155',
  },
  previewFooter: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  previewMeta: {
    color: '#cbd5e1',
    backgroundColor: '#172554',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    fontSize: 12,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  highlightCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    justifyContent: 'center',
    padding: 10,
    gap: 8,
  },
  highlightText: {
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 12,
  },
  identityCard: {
    borderRadius: 8,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 10,
    marginBottom: 18,
    marginTop: 10,
    padding: 12,
  },
  identityInput: {
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    color: '#f8fafc',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  handleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  handlePrefix: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '900',
    width: 18,
  },
  handleInput: {
    flex: 1,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 17,
  },
  sectionSubtitle: {
    color: '#94a3b8',
    marginTop: 4,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 18,
  },
  roleCard: {
    flex: 1,
    minHeight: 124,
    borderRadius: 8,
    backgroundColor: '#111b34',
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    gap: 8,
  },
  roleCardActive: {
    backgroundColor: '#f8fafc',
    borderColor: '#f8fafc',
  },
  roleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: '#dbeafe',
  },
  roleLabel: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 16,
  },
  roleLabelActive: {
    color: '#071022',
  },
  roleCaption: {
    color: '#94a3b8',
    lineHeight: 18,
  },
  roleCaptionActive: {
    color: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  progressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  progressText: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  creatorList: {
    marginBottom: 16,
    gap: 10,
  },
  profileRow: {
    borderRadius: 8,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#172554',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileRowSelected: {
    borderColor: '#38bdf8',
    backgroundColor: '#0f1f38',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 20,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  profileHandle: {
    color: '#94a3b8',
    marginTop: 4,
  },
  followState: {
    color: '#94a3b8',
    marginTop: 6,
    fontSize: 12,
  },
  followButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: 'center',
  },
  followButtonText: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  cta: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    alignItems: 'center',
    padding: 14,
    marginBottom: 12,
  },
  ctaText: {
    color: '#052e16',
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.6,
  },
  secondaryCta: {
    marginTop: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
  },
  secondaryText: {
    color: '#e2e8f0',
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
});
