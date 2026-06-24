import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { checkinVisibilityLabel, followProfile, getCurrentProfile, getFollowCounts, getFollowedProfiles, getProfileByUsernameOrId, listDiscoverTrails, listMyTrails, listPublicProfileCheckins, unfollowProfile } from '@/src/lib/hoppin';
import { Checkin, Profile, Trail } from '@/src/types/hoppin';

export default function PublicProfile() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [isFollowingProfile, setIsFollowingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const load = async () => {
      if (!slug) {
        throw new Error('Missing profile slug.');
      }

      const [targetProfile, currentProfile] = await Promise.all([getProfileByUsernameOrId(slug), getCurrentProfile()]);
      if (!targetProfile) {
        throw new Error('Profile not found.');
      }

      const [countSet, publicFeed, followed, profileTrails] = await Promise.all([
        getFollowCounts(targetProfile.id),
        listPublicProfileCheckins(targetProfile.id),
        targetProfile.id !== currentProfile.id ? getFollowedProfiles(currentProfile.id) : Promise.resolve([]),
        targetProfile.id === currentProfile.id
          ? listMyTrails(targetProfile.id)
          : listDiscoverTrails(currentProfile.id).then((items) => items.filter((trail) => trail.profileId === targetProfile.id)),
      ]);

      if (!isMounted.current) return;
      const nextIsFollowing = targetProfile.id !== currentProfile.id && followed.some((entry) => entry.id === targetProfile.id);

      setProfile(targetProfile);
      setMe(currentProfile);
      setFollowers(countSet.followers);
      setFollowing(countSet.following);
      setCheckins(publicFeed);
      setTrails(profileTrails.filter((trail) => trail.privacy === 'public' || trail.profileId === currentProfile.id));
      setIsFollowingProfile(nextIsFollowing);
      setLoading(false);
    };

    load().catch(() => {
      if (isMounted.current) {
        router.replace('/discover');
      }
    });

    return () => {
      isMounted.current = false;
    };
  }, [slug, router]);

  const toggleFollow = async () => {
    if (!me || !profile || me.id === profile.id) return;

    const nextFollowing = !isFollowingProfile;
    try {
      if (nextFollowing) {
        await followProfile(me.id, profile.id);
      } else {
        await unfollowProfile(me.id, profile.id);
      }

      const [updatedCounts, followed] = await Promise.all([
        getFollowCounts(profile.id),
        getFollowedProfiles(me.id),
      ]);
      if (isMounted.current) {
        setFollowers(updatedCounts.followers);
        setFollowing(updatedCounts.following);
        setIsFollowingProfile(followed.some((entry) => entry.id === profile.id));
      }
    } catch {
      Alert.alert('Follow failed', 'Please try again in a moment.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.empty}>Profile not found.</Text>
      </View>
    );
  }

  const isOwnProfile = me?.id === profile.id;

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          {profile.avatarUrl ? (
            <RNImage source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{profile.displayName.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.title}>{profile.displayName}</Text>
          <Text style={styles.subtitle}>
            @{profile.username} · {profile.isCreator ? 'influencer profile' : 'explorer profile'}
          </Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <Text style={styles.metricLabel}>Followers: {followers}</Text>
        <Text style={styles.metricLabel}>Following: {following}</Text>
        <Text style={styles.metricLabel}>Check-ins: {checkins.length}</Text>
      </View>

      {!isOwnProfile ? (
        <TouchableOpacity
          onPress={toggleFollow}
          style={[styles.cta, isFollowingProfile ? styles.followingButton : styles.secondary]}
        >
          <Text style={styles.ctaText}>{isFollowingProfile ? 'Following' : 'Follow'}</Text>
        </TouchableOpacity>
      ) : null}

      {trails.length ? (
        <View style={styles.trailList}>
          <Text style={styles.sectionTitle}>Public trails</Text>
          {trails.map((trail) => (
            <TouchableOpacity key={trail.id} style={styles.card} onPress={() => router.push(`/trail/${trail.id}`)}>
              <Text style={styles.cardHeader}>{trail.title}</Text>
              <Text style={styles.cardTag}>{checkinVisibilityLabel(trail.privacy)} · {trail.itemCount} stops</Text>
              {trail.description ? <Text style={styles.note}>{trail.description}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Public check-ins</Text>
      {checkins.length === 0 ? (
        <Text style={styles.empty}>No public check-ins to show yet.</Text>
      ) : (
        <FlatList
          data={checkins}
          keyExtractor={(item) => item.id}
          renderItem={({ item: checkin }) => (
            <View style={styles.card}>
              {checkin.media?.[0] ? <RNImage source={{ uri: checkin.media[0] }} style={styles.checkinPhoto} /> : null}
              <Text style={styles.cardHeader}>{checkin.beer.name}</Text>
              <Text style={styles.cardTag}>
                {checkin.scope === 'venue' ? 'Venue' : 'City'} · {checkinVisibilityLabel(checkin.privacy)}
              </Text>
              <Text style={styles.cardMeta}>
                {checkin.scope === 'venue' && checkin.venue ? `${checkin.venue.name} · ${checkin.venue.city}` : `${checkin.city?.city}, ${checkin.city?.country}`}
              </Text>
              {!!checkin.rating ? <Text style={styles.cardMeta}>Rating: {checkin.rating}/5</Text> : null}
              {!!checkin.note ? <Text style={styles.note}>{checkin.note}</Text> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071022',
    padding: 16,
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#071022',
    padding: 16,
    paddingTop: 48,
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  profileCopy: {
    flex: 1,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 58,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarText: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 8,
  },
  metrics: {
    marginTop: 16,
    gap: 4,
  },
  trailList: {
    gap: 10,
  },
  metricLabel: {
    color: '#e2e8f0',
    marginBottom: 4,
  },
  cta: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondary: {
    marginTop: 20,
    backgroundColor: '#334155',
  },
  followingButton: {
    backgroundColor: '#0f766e',
  },
  ctaText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 6,
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 18,
  },
  card: {
    backgroundColor: '#111b34',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  checkinPhoto: {
    width: '100%',
    aspectRatio: 1.55,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#071022',
  },
  cardHeader: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 18,
  },
  cardTag: {
    color: '#60a5fa',
    marginTop: 6,
    marginBottom: 2,
  },
  cardMeta: {
    color: '#94a3b8',
    marginTop: 4,
  },
  note: {
    color: '#cbd5e1',
    marginTop: 8,
  },
});
