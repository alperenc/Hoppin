import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { Beer, MapPin, Plus, Sparkles, Star, UsersRound } from 'lucide-react-native';
import { checkinVisibilityLabel, getCurrentProfile, listForYouFeed } from '@/src/lib/hoppin';
import { FollowFeedItem, Profile } from '@/src/types/hoppin';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

function formatStyle(style: string): string {
  if (style === 'ipa') return 'IPA';
  return style.slice(0, 1).toUpperCase() + style.slice(1);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function locationLabel(item: FollowFeedItem): string {
  const { checkin } = item;
  if (checkin.scope === 'venue' && checkin.venue) {
    return `${checkin.venue.name} - ${checkin.venue.city}`;
  }
  if (checkin.city) {
    return `${checkin.city.city}, ${checkin.city.country}`;
  }
  return 'Passport stamp';
}

function reasonLabel(item: FollowFeedItem, me?: Profile | null): string {
  if (item.checkin.profileId === me?.id) return 'Your latest stamp';
  if (item.followed) return 'From your crew';
  return 'Open tap';
}

function ratingLabel(rating?: number): string {
  if (!rating) return 'Unrated';
  return `${rating}/5`;
}

export default function Home() {
  const [feed, setFeed] = useState<FollowFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const profile = await getCurrentProfile();
      const nextFeed = await listForYouFeed(profile.id);
      setMe(profile);
      setFeed(nextFeed);
      setErrorMessage(undefined);
    } catch {
      setErrorMessage('Could not refresh your tap trail.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refresh = async () => {
        try {
          const profile = await getCurrentProfile();
          const nextFeed = await listForYouFeed(profile.id);
          if (!active) return;
          setMe(profile);
          setFeed(nextFeed);
          setErrorMessage(undefined);
        } catch {
          if (active) {
            setErrorMessage('Could not refresh your tap trail.');
          }
        } finally {
          if (active) {
            setIsLoading(false);
            setIsRefreshing(false);
          }
        }
      };

      void refresh();

      return () => {
        active = false;
      };
    }, [])
  );

  const feedStats = useMemo(() => {
    const followed = feed.filter((item) => item.followed).length;
    const countries = new Set(
      feed
        .map((item) => item.checkin.city?.country ?? item.checkin.venue?.country)
        .filter((country): country is string => Boolean(country))
    );
    const creators = new Set(feed.map((item) => item.author.id));
    return {
      followed,
      countries: countries.size,
      creators: creators.size,
    };
  }, [feed]);

  const leadItem = feed[0];

  const renderStamp = ({ item }: { item: FollowFeedItem }) => {
    const { checkin, author } = item;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{author.displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.authorCopy}>
              <Text style={styles.authorName}>{author.displayName}</Text>
              <Text style={styles.authorMeta}>@{author.username} - {formatDate(checkin.checkedAt)}</Text>
            </View>
          </View>
          <Text style={[styles.reasonPill, item.followed ? styles.reasonPillCrew : styles.reasonPillOpen]}>
            {reasonLabel(item, me)}
          </Text>
        </View>

        <Text style={styles.beerName}>{checkin.beer.name}</Text>
        <View style={styles.metaRow}>
          <Beer color="#f59e0b" size={16} />
          <Text style={styles.metaText}>{formatStyle(checkin.beer.style)}</Text>
        </View>
        <View style={styles.metaRow}>
          <MapPin color="#86efac" size={16} />
          <Text style={styles.metaText}>{locationLabel(item)}</Text>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerMetric}>
            <Star color="#facc15" fill={checkin.rating ? '#facc15' : 'transparent'} size={16} />
            <Text style={styles.footerMetricText}>{ratingLabel(checkin.rating)}</Text>
          </View>
          <Text style={styles.visibility}>{checkinVisibilityLabel(checkin.privacy)}</Text>
        </View>
        {!!checkin.note ? <Text style={styles.note}>{checkin.note}</Text> : null}
      </View>
    );
  };

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.kickerRow}>
          <Sparkles color="#facc15" size={16} />
          <Text style={styles.kicker}>For you</Text>
        </View>
        <Text style={styles.title}>{me ? `${me.displayName}'s tap trail` : 'Your tap trail'}</Text>
        <Text style={styles.subtitle}>Fresh pours from your crew first, then public stamps that match where and what you like.</Text>
        <View style={styles.heroActions}>
          <Link href="/checkin" asChild>
            <TouchableOpacity style={styles.primaryAction}>
              <Plus color="#052e16" size={18} />
              <Text style={styles.primaryActionText}>Stamp a pour</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/discover" asChild>
            <TouchableOpacity style={styles.secondaryAction}>
              <UsersRound color="#bae6fd" size={18} />
              <Text style={styles.secondaryActionText}>Find your crew</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{feed.length}</Text>
          <Text style={styles.statLabel}>stamps</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{feedStats.followed}</Text>
          <Text style={styles.statLabel}>from crew</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{feedStats.countries}</Text>
          <Text style={styles.statLabel}>countries</Text>
        </View>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {leadItem ? (
        <View style={styles.lead}>
          <Text style={styles.leadKicker}>Next worth opening</Text>
          <Text style={styles.leadTitle}>{leadItem.checkin.beer.name}</Text>
          <Text style={styles.leadMeta}>{locationLabel(leadItem)} - {reasonLabel(leadItem, me)}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Latest stamps</Text>
        <Text style={styles.sectionMeta}>{feedStats.creators} people</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <Sparkles color="#facc15" size={22} />
        <Text style={styles.loadingTitle}>Pouring your feed...</Text>
        <Text style={styles.loadingText}>Finding stamps from your crew and nearby beer trails.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={feed}
      keyExtractor={(item) => item.checkin.id}
      renderItem={renderStamp}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load('refresh')} tintColor="#86efac" />}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No stamps in your trail yet.</Text>
          <Text style={styles.emptyText}>Follow a creator or stamp a pour to wake up the feed.</Text>
          <Link href="/checkin" asChild>
            <TouchableOpacity style={styles.emptyAction}>
              <Text style={styles.emptyActionText}>Start with a pour</Text>
            </TouchableOpacity>
          </Link>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#071022',
  },
  content: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 48,
    paddingBottom: 32,
    backgroundColor: '#071022',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#071022',
  },
  loadingTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
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
  heroActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryActionText: {
    color: '#052e16',
    fontWeight: '900',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#1f3a5f',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#102036',
  },
  secondaryActionText: {
    color: '#bae6fd',
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1f3a5f',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#111b34',
  },
  statValue: {
    color: '#f8fafc',
    fontWeight: '900',
    fontSize: 20,
  },
  statLabel: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 12,
  },
  lead: {
    borderWidth: 1,
    borderColor: '#34513d',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#10251c',
  },
  leadKicker: {
    color: '#86efac',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  leadTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
  },
  leadMeta: {
    color: '#bbf7d0',
    marginTop: 6,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  card: {
    borderWidth: 1,
    borderColor: '#1f3a5f',
    backgroundColor: '#111b34',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    gap: 9,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  authorRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
  },
  avatarText: {
    color: '#111827',
    fontWeight: '900',
  },
  authorCopy: {
    flex: 1,
  },
  authorName: {
    color: '#f8fafc',
    fontWeight: '900',
  },
  authorMeta: {
    color: '#94a3b8',
    marginTop: 2,
    fontSize: 12,
  },
  reasonPill: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
  },
  reasonPillCrew: {
    color: '#052e16',
    backgroundColor: '#86efac',
  },
  reasonPillOpen: {
    color: '#082f49',
    backgroundColor: '#bae6fd',
  },
  beerName: {
    color: '#f8fafc',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaText: {
    color: '#cbd5e1',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  footerMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerMetricText: {
    color: '#e2e8f0',
    fontWeight: '800',
  },
  visibility: {
    color: '#94a3b8',
    fontSize: 12,
  },
  note: {
    color: '#cbd5e1',
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: '#1f3a5f',
    paddingTop: 9,
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
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAction: {
    borderRadius: 8,
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: '#052e16',
    fontWeight: '900',
  },
});
