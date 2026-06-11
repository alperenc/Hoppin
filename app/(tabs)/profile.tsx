import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Share, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentProfile, getFollowCounts, getPassportSummary, setProfileCreatorRole, updateProfileIdentity } from '@/src/lib/hoppin';
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
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);

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
        setDisplayName(current.displayName);
        setUsername(current.username);
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

  const saveIdentity = async () => {
    if (!me) return;
    if (!displayName.trim() || !username.trim()) {
      Alert.alert('Profile incomplete', 'Add both a display name and handle.');
      return;
    }

    try {
      setSavingIdentity(true);
      const next = await updateProfileIdentity(me.id, { displayName, username });
      setMe(next);
      setDisplayName(next.displayName);
      setUsername(next.username);
      setIsEditingIdentity(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save your profile right now.';
      Alert.alert('Profile update failed', message);
    } finally {
      setSavingIdentity(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(me?.displayName ?? 'H').slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{me?.displayName ?? 'Hoppin profile'}</Text>
          <Text style={styles.subtitle}>@{me?.username ?? 'loading'} · {me?.isCreator ? 'creator' : 'explorer'}</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{checkins}</Text>
          <Text style={styles.metricLabel}>Check-ins</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{following}</Text>
          <Text style={styles.metricLabel}>Following</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{followers}</Text>
          <Text style={styles.metricLabel}>Followers</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Profile identity</Text>
          <TouchableOpacity
            style={styles.textButton}
            onPress={() => {
              if (isEditingIdentity && me) {
                setDisplayName(me.displayName);
                setUsername(me.username);
              }
              setIsEditingIdentity((current) => !current);
            }}
            disabled={savingIdentity}
          >
            <Text style={styles.textButtonLabel}>{isEditingIdentity ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
        {isEditingIdentity ? (
          <View style={styles.identityForm}>
            <TextInput
              autoCapitalize="words"
              editable={!savingIdentity}
              placeholder="Display name"
              placeholderTextColor="#64748b"
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
            />
            <View style={styles.handleRow}>
              <Text style={styles.handlePrefix}>@</Text>
              <TextInput
                autoCapitalize="none"
                editable={!savingIdentity}
                placeholder="handle"
                placeholderTextColor="#64748b"
                style={[styles.input, styles.handleInput]}
                value={username}
                onChangeText={setUsername}
              />
            </View>
            <TouchableOpacity style={[styles.cta, savingIdentity ? styles.disabled : undefined]} onPress={saveIdentity} disabled={savingIdentity}>
              <Text style={styles.ctaText}>{savingIdentity ? 'Saving…' : 'Save profile'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.identitySummary}>
            <Text style={styles.identityText}>{me?.displayName ?? 'Loading profile'}</Text>
            <Text style={styles.identityMuted}>@{me?.username ?? 'loading'}</Text>
          </View>
        )}
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
        <>
          <Text style={styles.emailText}>Local preview profile. Configure Supabase to create and sync real accounts.</Text>
          <TouchableOpacity style={[styles.cta, styles.secondary]} onPress={() => router.replace('/auth')}>
            <Text style={styles.ctaText}>Sign in or create account</Text>
          </TouchableOpacity>
        </>
      )}
      {isAuthAvailable && accountEmail ? (
        <>
          <TouchableOpacity
            style={[styles.cta, styles.secondary]}
            onPress={async () => {
              try {
                await signOutUser();
                router.replace('/');
              } catch {
                Alert.alert('Sign out failed', 'Please try again.');
              }
            }}
          >
            <Text style={styles.ctaText}>Sign out</Text>
          </TouchableOpacity>
        </>
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  avatarText: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 8,
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  metricCard: {
    backgroundColor: '#0f172a',
    borderColor: '#1f2937',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 72,
    padding: 10,
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  panel: {
    backgroundColor: '#0b1220',
    borderColor: '#1f2937',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 12,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  textButton: {
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textButtonLabel: {
    color: '#38bdf8',
    fontWeight: '800',
    textAlign: 'center',
  },
  identityForm: {
    gap: 10,
    marginTop: 12,
  },
  identitySummary: {
    gap: 4,
    marginTop: 12,
  },
  identityText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '800',
  },
  identityMuted: {
    color: '#94a3b8',
  },
  input: {
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
  cta: {
    backgroundColor: '#0ea5e9',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
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
