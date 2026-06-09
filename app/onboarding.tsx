import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentProfile, listProfiles, followProfile, getFollowedProfiles, unfollowProfile, setProfileCreatorRole } from '@/src/lib/hoppin';
import { Profile } from '@/src/types/hoppin';
import { markOnboardingComplete, hasCompletedOnboarding } from '@/src/lib/onboarding';

export default function Onboarding() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  const load = async () => {
    const current = await getCurrentProfile();
    const [allProfiles, followed] = await Promise.all([listProfiles(), getFollowedProfiles(current.id)]);

    const suggestedCreators = allProfiles.filter((profile) => profile.id !== current.id);

    setMe(current);
    setCreators(suggestedCreators);
    setFollowedIds(followed.map((profile) => profile.id));
    setIsCreator(current.isCreator);
    setIsLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      try {
        const current = await getCurrentProfile();
        const hasProfileOnboarded = await hasCompletedOnboarding(current.id);
        if (!mounted) return;

        if (hasProfileOnboarded) {
          router.replace('/(tabs)');
          return;
        }

        await load();
      } catch {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initialize().catch(() => {
      if (mounted) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [router]);

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
    setSaving(true);
    try {
      if (isCreator !== me.isCreator) {
        const next = await setProfileCreatorRole(me.id, isCreator);
        setMe(next);
      }
      await markOnboardingComplete(me.id);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Could not continue', 'Please try again in a moment.');
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

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Welcome to Hoppin</Text>
      <Text style={styles.subtitle}>Who do you follow? Pick a few creators to shape your first feed.</Text>

      <TouchableOpacity
        style={[styles.toggleButton, isCreator ? styles.toggleButtonActive : styles.toggleButtonIdle]}
        onPress={() => {
          setIsCreator((current) => !current);
        }}
        disabled={saving}
      >
        <Text style={[styles.toggleText, isCreator ? styles.toggleTextActive : styles.toggleTextIdle]}>
          {isCreator ? 'Creator mode enabled' : 'Enable creator mode'}
        </Text>
      </TouchableOpacity>

      {creators.length === 0 ? (
        <Text style={styles.empty}>No other profiles found.</Text>
      ) : (
        <View style={styles.card}>
          {creators.map((profile) => {
            const selected = isFollowing(profile.id);
            return (
              <View key={profile.id} style={styles.profileRow}>
                <View>
                  <Text style={styles.profileName}>{profile.displayName}</Text>
                  <Text style={styles.profileHandle}>@{profile.username}</Text>
                  <Text style={styles.followState}>{selected ? 'Selected' : 'Not selected'}</Text>
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
        <Text style={styles.ctaText}>{saving ? 'Saving…' : 'Continue to Hoppin'}</Text>
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
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: '#071022',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 10,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#111b34',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  profileRow: {
    borderRadius: 12,
    backgroundColor: '#0b1220',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  followButtonText: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  cta: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    padding: 14,
    marginBottom: 12,
  },
  ctaText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  secondaryCta: {
    marginTop: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
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
  toggleButton: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#14b8a6',
  },
  toggleButtonIdle: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  toggleText: {
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#d1fae5',
  },
  toggleTextIdle: {
    color: '#94a3b8',
  },
});
