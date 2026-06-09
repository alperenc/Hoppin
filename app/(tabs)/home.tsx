import { useEffect, useState } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { checkinVisibilityLabel, getCurrentProfile, listForYouFeed } from '@/src/lib/hoppin';
import { FollowFeedItem } from '@/src/types/hoppin';

export default function Home() {
  const [feed, setFeed] = useState<FollowFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState('Creator');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const profile = await getCurrentProfile();
      if (mounted) {
        setDisplayName(profile.displayName);
      }

      const nextFeed = await listForYouFeed(profile.id);
      if (mounted) {
        setFeed(nextFeed);
        setIsLoading(false);
      }
    };

    load().catch(() => {
      if (mounted) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Follow Feed</Text>
      <Text style={styles.subtitle}>{displayName} — personalized feed from followed creators + for-you matches</Text>
        {isLoading ? (
        <Text style={styles.loading}>Loading your for-you feed...</Text>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.checkin.id}
          renderItem={({ item }) => {
            const { checkin, author, followed } = item;
            return (
              <View style={styles.card}>
                <Text style={styles.cardHeader}>{author.displayName}</Text>
                <Text style={styles.cardTag}>{followed ? 'Following' : 'Global'}</Text>
                <Text style={styles.cardTitle}>{checkin.beer.name}</Text>
                <Text style={styles.cardMeta}>{checkin.scope} · {checkinVisibilityLabel(checkin.privacy)}</Text>
                {checkin.scope === 'venue' && checkin.venue ? (
                  <Text style={styles.cardMeta}>{checkin.venue.name} · {checkin.venue.city}</Text>
                ) : null}
                {checkin.city ? <Text style={styles.cardMeta}>{checkin.city.city}, {checkin.city.country}</Text> : null}
                {!!checkin.note ? <Text style={styles.note}>{checkin.note}</Text> : null}
              </View>
            );
          }}
          ListFooterComponent={
            <Link href="/checkin" asChild>
              <TouchableOpacity style={styles.cta}>
                <Text style={styles.ctaText}>Log a beer</Text>
              </TouchableOpacity>
            </Link>
          }
          ListEmptyComponent={<Text style={styles.empty}>No public or follower check-ins yet. Add your first one.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 16,
    backgroundColor: '#071022',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#111b34',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  cardTag: {
    color: '#60a5fa',
    marginTop: 4,
    marginBottom: 2,
    fontSize: 12,
  },
  cardTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    marginTop: 2,
  },
  cardMeta: {
    color: '#94a3b8',
    marginTop: 4,
  },
  note: {
    color: '#cbd5e1',
    marginTop: 8,
  },
  cta: {
    marginTop: 24,
    marginBottom: 24,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    padding: 12,
  },
  ctaText: {
    color: '#f8fafc',
    textAlign: 'center',
    fontWeight: '700',
  },
  empty: {
    color: '#94a3b8',
    padding: 24,
    textAlign: 'center',
  },
  loading: {
    color: '#94a3b8',
  },
});
