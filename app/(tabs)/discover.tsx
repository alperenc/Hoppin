import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { BadgeCheck, Beer, Compass, MapPin, Sparkles, UserPlus, UsersRound } from 'lucide-react-native';
import { useWebPullToRefresh } from '@/src/components/useWebPullToRefresh';
import {
  followProfile,
  getCurrentProfile,
  getFollowedProfiles,
  getFollowers,
  listForYouFeed,
  listProfiles,
  unfollowProfile,
} from '@/src/lib/hoppin';
import { FollowFeedItem, Profile } from '@/src/types/hoppin';

type PersonCardProps = {
  followedIds: string[];
  followerIds: string[];
  onToggleFollow: (id: string) => void;
  profile: Profile;
};

function relationshipLabel(profile: Profile, followedIds: string[], followerIds: string[]): string {
  const followed = followedIds.includes(profile.id);
  const follower = followerIds.includes(profile.id);
  if (followed && follower) return 'Mutual trail';
  if (followed) return 'In your crew';
  if (follower) return 'Follows you';
  return profile.isCreator ? 'Creator pick' : 'Explorer pick';
}

function PersonCard({ followedIds, followerIds, onToggleFollow, profile }: PersonCardProps) {
  const followed = followedIds.includes(profile.id);
  const follower = followerIds.includes(profile.id);
  const mutual = followed && follower;

  return (
    <View style={styles.personCard}>
      <Link href={`/user/${profile.username}`} asChild>
        <TouchableOpacity style={styles.personInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.displayName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.personCopy}>
            <View style={styles.personNameRow}>
              <Text style={styles.personName}>{profile.displayName}</Text>
              {profile.isCreator ? <BadgeCheck color="#38bdf8" size={16} /> : null}
            </View>
            <Text style={styles.personHandle}>@{profile.username}</Text>
            <Text style={styles.relationship}>{relationshipLabel(profile, followedIds, followerIds)}</Text>
          </View>
        </TouchableOpacity>
      </Link>
      <TouchableOpacity
        onPress={() => onToggleFollow(profile.id)}
        style={[styles.followButton, followed ? styles.followingButton : undefined]}
      >
        <Text style={[styles.followButtonText, followed ? styles.followingButtonText : undefined]}>
          {mutual ? 'Mutual' : followed ? 'Following' : follower ? 'Follow back' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function formatStyle(style: string): string {
  if (style === 'ipa') return 'IPA';
  return style.slice(0, 1).toUpperCase() + style.slice(1);
}

function stampLocationLabel(item: FollowFeedItem): string {
  const { checkin } = item;
  if (checkin.scope === 'venue' && checkin.venue) {
    return `${checkin.venue.name} - ${checkin.venue.city}`;
  }
  if (checkin.city) {
    return `${checkin.city.city}, ${checkin.city.country}`;
  }
  return 'Passport stamp';
}

export default function Discover() {
  const isMountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [me, setMe] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [feed, setFeed] = useState<FollowFeedItem[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyProfileId, setBusyProfileId] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const load = useCallback(async (mode: 'screen' | 'refresh' | 'mutation' = 'screen') => {
    const requestId = ++requestIdRef.current;

    if (mode === 'refresh') {
      setIsRefreshing(true);
    }

    try {
      const [currentProfile, allProfiles] = await Promise.all([getCurrentProfile(), listProfiles()]);
      const [followed, followers] = await Promise.all([
        getFollowedProfiles(currentProfile.id),
        getFollowers(currentProfile.id),
      ]);
      const discoveryFeed = await listForYouFeed(currentProfile.id);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setMe(currentProfile);
      setPeople(allProfiles.filter((profile) => profile.id !== currentProfile.id));
      setFeed(discoveryFeed.filter((item) => item.checkin.profileId !== currentProfile.id).slice(0, 6));
      setFollowedIds(followed.map((profile) => profile.id));
      setFollowerIds(followers.map((profile) => profile.id));
      setErrorMessage(undefined);
    } catch {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setErrorMessage('Could not refresh discovery right now.');
      }
      if (mode === 'mutation') {
        throw new Error('Could not refresh discovery right now.');
      }
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      void load();

      return () => {
        isMountedRef.current = false;
      };
    }, [load])
  );

  const creators = useMemo(() => people.filter((profile) => profile.isCreator), [people]);
  const explorers = useMemo(() => people.filter((profile) => !profile.isCreator), [people]);
  const trailMakerCount = creators.length;
  const refreshDiscover = useCallback(() => {
    void load('refresh');
  }, [load]);
  const { refreshControl, webPullHandlers, webRefreshIndicator } = useWebPullToRefresh({
    onRefresh: refreshDiscover,
    refreshing: isRefreshing,
    tintColor: '#38bdf8',
  });

  const toggleFollow = async (id: string) => {
    if (!me || busyProfileId) return;

    let didUpdateFollow = false;
    try {
      setBusyProfileId(id);
      if (followedIds.includes(id)) {
        await unfollowProfile(me.id, id);
      } else {
        await followProfile(me.id, id);
      }
      didUpdateFollow = true;
      await load('mutation');
      setErrorMessage(undefined);
    } catch {
      setErrorMessage(
        didUpdateFollow
          ? 'Follow updated, but discovery could not refresh right now.'
          : 'Could not update this follow yet.'
      );
    } finally {
      setBusyProfileId(undefined);
    }
  };

  const renderPerson = (profile: Profile) => (
    <PersonCard
      key={profile.id}
      followedIds={followedIds}
      followerIds={followerIds}
      onToggleFollow={busyProfileId ? () => undefined : toggleFollow}
      profile={profile}
    />
  );

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Finding people to follow...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={refreshControl}
      {...webPullHandlers}
    >
      {webRefreshIndicator}
      <View style={styles.hero}>
        <View style={styles.kickerRow}>
          <Sparkles color="#facc15" size={16} />
          <Text style={styles.kicker}>Discover</Text>
        </View>
        <Text style={styles.title}>Find stamps worth turning into trails.</Text>
        <Text style={styles.subtitle}>Browse public pours, follow trail makers, and save the creators whose routes match your taste.</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <UsersRound color="#86efac" size={18} />
          <Text style={styles.statValue}>{followedIds.length}</Text>
          <Text style={styles.statLabel}>following</Text>
        </View>
        <View style={styles.statCard}>
          <UserPlus color="#bae6fd" size={18} />
          <Text style={styles.statValue}>{followerIds.length}</Text>
          <Text style={styles.statLabel}>followers</Text>
        </View>
        <View style={styles.statCard}>
          <Compass color="#facc15" size={18} />
          <Text style={styles.statValue}>{trailMakerCount}</Text>
          <Text style={styles.statLabel}>creators</Text>
        </View>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {feed.length ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Public stamps</Text>
            <Text style={styles.sectionMeta}>{feed.length} pours</Text>
          </View>
          <View style={styles.stampGrid}>
            {feed.map((item) => (
              <Link href={`/user/${item.author.username}`} key={item.checkin.id} asChild>
                <TouchableOpacity style={styles.stampCard}>
                  <Text style={styles.stampAuthor}>{item.author.displayName}</Text>
                  <Text style={styles.stampBeer}>{item.checkin.beer.name}</Text>
                  <View style={styles.stampMetaRow}>
                    <Beer color="#f59e0b" size={15} />
                    <Text style={styles.stampMeta}>{formatStyle(item.checkin.beer.style)}</Text>
                  </View>
                  <View style={styles.stampMetaRow}>
                    <MapPin color="#86efac" size={15} />
                    <Text style={styles.stampMeta}>{stampLocationLabel(item)}</Text>
                  </View>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </>
      ) : null}

      {creators.length ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trail makers</Text>
            <Text style={styles.sectionMeta}>{creators.length} people</Text>
          </View>
          {creators.map(renderPerson)}
        </>
      ) : null}

      {explorers.length ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>People with overlap</Text>
            <Text style={styles.sectionMeta}>{explorers.length} people</Text>
          </View>
          {explorers.map(renderPerson)}
        </>
      ) : null}

      {!people.length && !feed.length ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No stamps or trails to discover yet.</Text>
          <Text style={styles.emptyText}>Public pours and trail makers will appear here as Hoppin grows.</Text>
        </View>
      ) : null}
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
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071022',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 10,
  },
  hero: {
    gap: 12,
    marginBottom: 14,
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
    fontWeight: '900',
    fontSize: 12,
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1f3a5f',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#111b34',
    gap: 6,
  },
  statValue: {
    color: '#f8fafc',
    fontWeight: '900',
    fontSize: 20,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontWeight: '900',
    fontSize: 18,
  },
  sectionMeta: {
    color: '#94a3b8',
  },
  errorText: {
    color: '#fca5a5',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#2f1116',
    textAlign: 'center',
  },
  stampGrid: {
    gap: 10,
    marginBottom: 14,
  },
  stampCard: {
    borderWidth: 1,
    borderColor: '#1f3a5f',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#0f172a',
    gap: 8,
  },
  stampAuthor: {
    color: '#7dd3fc',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  stampBeer: {
    color: '#f8fafc',
    fontWeight: '900',
    fontSize: 18,
    lineHeight: 22,
  },
  stampMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stampMeta: {
    color: '#cbd5e1',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  personCard: {
    borderWidth: 1,
    borderColor: '#1f3a5f',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#111b34',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
  },
  avatarText: {
    color: '#111827',
    fontWeight: '900',
  },
  personCopy: {
    flex: 1,
  },
  personNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personName: {
    color: '#f8fafc',
    fontWeight: '900',
  },
  personHandle: {
    color: '#94a3b8',
    marginTop: 2,
    fontSize: 12,
  },
  relationship: {
    color: '#bae6fd',
    marginTop: 4,
    fontWeight: '800',
    fontSize: 12,
  },
  followButton: {
    borderRadius: 8,
    backgroundColor: '#22c55e',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  followingButton: {
    backgroundColor: '#102036',
    borderWidth: 1,
    borderColor: '#1f3a5f',
  },
  followButtonText: {
    color: '#052e16',
    fontWeight: '900',
  },
  followingButtonText: {
    color: '#bae6fd',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#34513d',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#10251c',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#f8fafc',
    fontWeight: '900',
    fontSize: 18,
  },
  emptyText: {
    color: '#a7f3d0',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
});
