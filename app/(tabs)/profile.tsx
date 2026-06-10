import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentProfile, getFollowCounts, getPassportSummary, setProfileCreatorRole } from '@/src/lib/hoppin';
import { getAuthUserEmail, isAuthAvailable, signOut as signOutUser } from '@/src/lib/auth';
import type { Profile as HoppinProfile } from '@/src/types/hoppin';

export default function Profile() {
  const router = useRouter();
  const [me, setMe] = useState<HoppinProfile | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [checkins, setCheckins] = useState(0);
  const [accountEmail, setAccountEmail] = useState<string>();
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const current = await getCurrentProfile();
      const [counts, summary] = await Promise.all([
        getFollowCounts(current.id),
        getPassportSummary(current.id),
      ]);
      const email = await getAuthUserEmail();

      if (mounted) {
        setMe(current);
        setFollowers(counts.followers);
        setFollowing(counts.following);
        setCheckins(summary.checkinsCount);
        setAccountEmail(email);
      }
    };

    load().catch(() => {
      if (mounted) {
        Alert.alert('Profile load failed', 'Could not load profile data right now.');
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const shareProfile = useCallback(async () => {
    if (!me) return;
    const profileLink = typeof window !== 'undefined' ? `${window.location.origin}/user/${me.username}` : `hoppin://user/${me.username}`;

    try {
      await Share.share({
        message: `Check out ${me.displayName} on Hoppin: ${profileLink}`,
      });
    } catch {
      Alert.alert('Share unavailable', 'Unable to open the share sheet right now.');
    }
  }, [me]);

  const toggleCreatorRole = async () => {
    if (!me) return;
    try {
      setSavingRole(true);
      const next = await setProfileCreatorRole(me.id, !me.isCreator);
      setMe(next);
    } catch {
      Alert.alert('Role update failed', 'Could not update your creator role right now.');
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{me?.displayName ?? 'Creator'}</Text>
      <Text style={styles.subtitle}>@{me?.username ?? 'loading'} · {me?.isCreator ? 'influencer profile' : 'explorer profile'}</Text>

      <View style={styles.metrics}>
        <Text style={styles.metricLabel}>Check-ins: {checkins}</Text>
        <Text style={styles.metricLabel}>Following: {following}</Text>
        <Text style={styles.metricLabel}>Followers: {followers}</Text>
      </View>

      <TouchableOpacity style={styles.cta} onPress={shareProfile}>
        <Text style={styles.ctaText}>Share public profile</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.cta, styles.secondary, savingRole ? styles.disabled : undefined]}
        onPress={toggleCreatorRole}
        disabled={savingRole}
      >
        <Text style={styles.ctaText}>
          {savingRole ? 'Saving…' : me?.isCreator ? 'Set as explorer profile' : 'Set as creator profile'}
        </Text>
      </TouchableOpacity>
      {isAuthAvailable ? (
        <>
          <Text style={styles.emailText}>
            {accountEmail ? `Synced as ${accountEmail}` : 'Sync enabled, authentication required for shared profile data'}
          </Text>
          {!accountEmail ? (
            <TouchableOpacity style={[styles.cta, styles.secondary]} onPress={() => router.replace('/auth')}>
              <Text style={styles.ctaText}>Sign in to sync</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : (
        <Text style={styles.emailText}>Local mode: seeded profile data is used.</Text>
      )}
      {isAuthAvailable && accountEmail ? (
        <>
          <TouchableOpacity
            style={[styles.cta, styles.secondary]}
            onPress={async () => {
              try {
                await signOutUser();
                router.replace('/auth');
              } catch {
                Alert.alert('Sign out failed', 'Please try again.');
              }
            }}
          >
            <Text style={styles.ctaText}>Sign out</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
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
  metricLabel: {
    color: '#e2e8f0',
    marginBottom: 4,
  },
  cta: {
    marginTop: 24,
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  ctaText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  secondary: {
    marginTop: 12,
    backgroundColor: '#334155',
  },
  emailText: {
    marginTop: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});
