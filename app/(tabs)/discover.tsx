import { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import {
  followProfile,
  getCurrentProfile,
  getFollowedProfiles,
  listProfiles,
  getFollowers,
  unfollowProfile,
} from '@/src/lib/hoppin';
import { Profile } from '@/src/types/hoppin';

export default function Discover() {
  const [me, setMe] = useState<Profile | null>(null);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [explorers, setExplorers] = useState<Profile[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);

  const refreshRelationships = async () => {
    const currentProfile = await getCurrentProfile();
    const [followed, followers] = await Promise.all([
      getFollowedProfiles(currentProfile.id),
      getFollowers(currentProfile.id),
    ]);

    setFollowedIds(followed.map((profile) => profile.id));
    setFollowerIds(followers.map((profile) => profile.id));
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [currentProfile, allProfiles] = await Promise.all([
        getCurrentProfile(),
        listProfiles(),
      ]);
      const filteredProfiles = allProfiles.filter((p) => p.id !== currentProfile.id);
      const [followed, followers] = await Promise.all([
        getFollowedProfiles(currentProfile.id),
        getFollowers(currentProfile.id),
      ]);

      if (mounted) {
        setMe(currentProfile);
        setCreators(filteredProfiles.filter((p) => p.isCreator));
        setExplorers(filteredProfiles.filter((p) => !p.isCreator));
        setFollowedIds(followed.map((p) => p.id));
        setFollowerIds(followers.map((p) => p.id));
      }
    };

    load().catch(() => {
      if (mounted) {
        // no-op fallback for offline or malformed data
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const toggleFollow = async (id: string) => {
    if (!me) return;
    const currently = followedIds.includes(id);
    if (currently) {
      await unfollowProfile(me.id, id);
    } else {
      await followProfile(me.id, id);
    }
    await refreshRelationships();
  };

  const renderPerson = (profile: Profile) => {
    const isFollowed = followedIds.includes(profile.id);
    const isFollower = followerIds.includes(profile.id);
    const isMutual = isFollowed && isFollower;

    return (
      <View key={profile.id} style={styles.profileRow}>
        <Link href={`/user/${profile.username}`} asChild>
          <TouchableOpacity style={styles.profileInfo}>
            <View>
              <Text style={styles.profileName}>{profile.displayName}</Text>
              <Text style={styles.profileHandle}>
                @{profile.username} {profile.isCreator ? '• influencer' : '• explorer'}
              </Text>
              <Text style={styles.followState}>
                {isMutual ? 'Mutual' : isFollowed ? 'Following' : isFollower ? 'Follows you' : 'Not following'}
              </Text>
            </View>
          </TouchableOpacity>
        </Link>
        <TouchableOpacity
          onPress={() => toggleFollow(profile.id)}
          style={[
            styles.followButton,
            isFollowed ? styles.followingButton : styles.followButton,
          ]}
        >
          <Text style={styles.followButtonText}>
            {isMutual ? 'Unfollow' : isFollowed ? 'Following' : isFollower ? 'Follow back' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Discover Creators</Text>
      <Text style={styles.subtitle}>Follow creators to shape what appears in your stream.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Creator-led feed</Text>
        <Text style={styles.cardText}>
          You are following {followedIds.length} people.
          {'\n'}{followerIds.length} people follow you.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Suggested people</Text>
      {!creators.length && !explorers.length ? (
        <Text style={styles.empty}>No creators available in this workspace.</Text>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Suggested creators</Text>
          {creators.map(renderPerson)}
          {!!explorers.length && (
            <>
              <Text style={styles.sectionTitle}>Explore other profiles</Text>
              {explorers.map(renderPerson)}
            </>
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>Why following mode?</Text>
      <View style={styles.card}>
        <Text style={styles.cardText}>Public check-ins are visible to everyone. Followers-only check-ins are visible to your audience only. Private stays private.</Text>
      </View>

      <Text style={styles.sectionTitle}>Your account</Text>
      <View style={styles.card}>
        <Text style={styles.cardText}>Signed in as {me?.displayName ?? 'Unknown'}.</Text>
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
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#e2e8f0',
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#111b34',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    color: '#e2e8f0',
    marginBottom: 6,
    fontWeight: '700',
  },
  cardText: {
    color: '#94a3b8',
  },
  profileRow: {
    backgroundColor: '#111b34',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileHandle: {
    color: '#94a3b8',
    marginTop: 2,
  },
  followButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  followingButton: {
    borderColor: '#94a3b8',
  },
  followButtonText: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  followState: {
    color: '#94a3b8',
    marginTop: 2,
    fontSize: 12,
  },
  empty: {
    color: '#94a3b8',
  },
});
