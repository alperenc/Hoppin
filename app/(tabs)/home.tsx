import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image as RNImage, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { Beer, Map as MapIcon, MapPin, Plus, Sparkles, Star } from 'lucide-react-native';
import { PassportMapPanel } from '@/src/components/PassportMapPanel';
import { useWebPullToRefresh } from '@/src/components/useWebPullToRefresh';
import {
  checkinVisibilityLabel,
  getCurrentProfile,
  getPassportSummary,
  listCityTrips,
  listForYouFeed,
  listPassportStamps,
} from '@/src/lib/hoppin';
import { CityStamp, CityVisit, FollowFeedItem, PassportSummary, Profile } from '@/src/types/hoppin';

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

const cityKey = (city: string, country: string) => `${city.toLowerCase()}-${country.toLowerCase()}`;

function reasonLabel(item: FollowFeedItem, me?: Profile | null): string {
  if (item.checkin.profileId === me?.id) return 'Your latest stamp';
  return 'Saved stamp';
}

function ratingLabel(rating?: number): string {
  if (!rating) return 'Unrated';
  return `${rating}/5`;
}

function stampCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'stamp' : 'stamps'}`;
}

type LeadRecommendation =
  | {
      kind: 'trail';
      trip: CityVisit;
    }
  | {
      kind: 'stamp';
      item: FollowFeedItem;
    };

export default function Home() {
  const [feed, setFeed] = useState<FollowFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<PassportSummary | null>(null);
  const [stamps, setStamps] = useState<CityStamp[]>([]);
  const [trips, setTrips] = useState<CityVisit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<CityVisit | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const profile = await getCurrentProfile();
      const [nextFeed, passportSummary, passportStamps, cityTrips] = await Promise.all([
        listForYouFeed(profile.id),
        getPassportSummary(profile.id),
        listPassportStamps(profile.id),
        listCityTrips(profile.id),
      ]);
      setMe(profile);
      setFeed(nextFeed.filter((item) => item.checkin.profileId === profile.id));
      setSummary(passportSummary);
      setStamps(passportStamps);
      setTrips(cityTrips);
      setSelectedVisit((current) => {
        if (current && cityTrips.some((trip) => trip.city === current.city && trip.country === current.country)) {
          return current;
        }
        return cityTrips[0] ?? null;
      });
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
          const [nextFeed, passportSummary, passportStamps, cityTrips] = await Promise.all([
            listForYouFeed(profile.id),
            getPassportSummary(profile.id),
            listPassportStamps(profile.id),
            listCityTrips(profile.id),
          ]);
          if (!active) return;
          setMe(profile);
          setFeed(nextFeed.filter((item) => item.checkin.profileId === profile.id));
          setSummary(passportSummary);
          setStamps(passportStamps);
          setTrips(cityTrips);
          setSelectedVisit((current) => {
            if (current && cityTrips.some((trip) => trip.city === current.city && trip.country === current.country)) {
              return current;
            }
            return cityTrips[0] ?? null;
          });
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

  const cityMapByKey = useMemo(() => {
    const index = new Map<string, CityVisit>();
    for (const trip of trips) {
      index.set(cityKey(trip.city, trip.country), trip);
    }
    return index;
  }, [trips]);

  const mapReadyStamps = useMemo<CityStamp[]>(() => {
    return stamps.filter((stamp) => Number.isFinite(stamp.lat) && Number.isFinite(stamp.lng));
  }, [stamps]);

  const refreshFeed = useCallback(() => {
    void load('refresh');
  }, [load]);
  const { refreshControl, webPullHandlers, webRefreshIndicator } = useWebPullToRefresh({
    onRefresh: refreshFeed,
    refreshing: isRefreshing,
    tintColor: '#86efac',
  });

  const leadItem = feed[0];
  const leadRecommendation = useMemo<LeadRecommendation | null>(() => {
    const trail = trips.find((trip) => trip.checkinCount > 1);
    if (trail) {
      return { kind: 'trail', trip: trail };
    }
    if (leadItem) {
      return { kind: 'stamp', item: leadItem };
    }
    return null;
  }, [leadItem, trips]);
  const userTrails = useMemo(() => trips.slice(0, 3), [trips]);

  const renderStamp = ({ item }: { item: FollowFeedItem }) => {
    const { checkin, author } = item;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              {author.avatarUrl ? (
                <RNImage source={{ uri: author.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{author.displayName.slice(0, 1).toUpperCase()}</Text>
              )}
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

        {checkin.media?.[0] ? <RNImage source={{ uri: checkin.media[0] }} style={styles.checkinPhoto} /> : null}
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
      {webRefreshIndicator}
      <View style={styles.hero}>
        <View style={styles.kickerRow}>
          <Sparkles color="#facc15" size={16} />
          <Text style={styles.kicker}>For you</Text>
        </View>
        <Text style={styles.title}>{me ? `${me.displayName}'s passport` : 'Your beer passport'}</Text>
        <Text style={styles.subtitle}>Every pour becomes a stamp on your map. Save the standouts into trails you can revisit or share.</Text>
        <View style={styles.heroActions}>
          <Link href="/checkin" asChild>
            <TouchableOpacity style={styles.primaryAction}>
              <Plus color="#052e16" size={18} />
              <Text style={styles.primaryActionText}>Stamp a pour</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/discover" asChild>
            <TouchableOpacity style={styles.secondaryAction}>
              <MapIcon color="#bae6fd" size={18} />
              <Text style={styles.secondaryActionText}>Explore trails</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      <View style={[styles.card, styles.mapCard]}>
        <PassportMapPanel
          cityMapByKey={cityMapByKey}
          selectedVisit={selectedVisit}
          stamps={mapReadyStamps}
          onSelectVisit={setSelectedVisit}
        />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{summary?.countriesCount ?? 0}</Text>
          <Text style={styles.statLabel}>countries</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{summary?.citiesCount ?? 0}</Text>
          <Text style={styles.statLabel}>cities</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{summary?.checkinsCount ?? 0}</Text>
          <Text style={styles.statLabel}>stamps</Text>
        </View>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {leadRecommendation ? (
        <View style={styles.lead}>
          <View style={styles.leadTopRow}>
            <Text style={styles.leadKicker}>Next worth opening</Text>
            <Text style={styles.leadType}>{leadRecommendation.kind === 'trail' ? 'Trail' : 'Stamp'}</Text>
          </View>
          <Text style={styles.leadTitle}>
            {leadRecommendation.kind === 'trail'
              ? `${leadRecommendation.trip.city} trail`
              : leadRecommendation.item.checkin.beer.name}
          </Text>
          <Text style={styles.leadMeta}>
            {leadRecommendation.kind === 'trail'
              ? `${stampCountLabel(leadRecommendation.trip.checkinCount)} in ${leadRecommendation.trip.country}`
              : `${locationLabel(leadRecommendation.item)} - ${reasonLabel(leadRecommendation.item, me)}`}
          </Text>
        </View>
      ) : null}

      {userTrails.length ? (
        <View style={styles.trailsBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your trails</Text>
            <Text style={styles.sectionMeta}>{userTrails.length} recent</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trailRow}
          >
            {userTrails.map((trail) => (
              <View key={`${trail.city}-${trail.country}`} style={styles.trailCard}>
                <Text style={styles.trailLabel}>Trail</Text>
                <Text style={styles.trailTitle}>{trail.city}</Text>
                <Text style={styles.trailMeta}>{stampCountLabel(trail.checkinCount)} - {trail.country}</Text>
                <Text style={styles.trailDate}>Updated {formatDate(trail.lastVisitedAt)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your latest stamps</Text>
        <Text style={styles.sectionMeta}>{feed.length} stamps</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <Sparkles color="#facc15" size={22} />
        <Text style={styles.loadingTitle}>Pouring your feed...</Text>
        <Text style={styles.loadingText}>Loading your stamps, map, and saved trail signals.</Text>
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
      refreshControl={refreshControl}
      {...webPullHandlers}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No stamps in your passport yet.</Text>
          <Text style={styles.emptyText}>Stamp a pour to start filling your map and shaping your first trail.</Text>
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
  leadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  leadKicker: {
    color: '#86efac',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  leadType: {
    color: '#052e16',
    backgroundColor: '#86efac',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '900',
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
  trailsBlock: {
    marginBottom: 16,
  },
  trailRow: {
    gap: 10,
    paddingRight: 4,
  },
  trailCard: {
    width: 164,
    minHeight: 118,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f3a5f',
    backgroundColor: '#0c1a2e',
    padding: 12,
  },
  trailLabel: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#172554',
    color: '#bae6fd',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  trailTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 10,
  },
  trailMeta: {
    color: '#cbd5e1',
    marginTop: 5,
    fontSize: 12,
  },
  trailDate: {
    color: '#7dd3fc',
    marginTop: 10,
    fontSize: 12,
    fontWeight: '800',
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
  mapCard: {
    padding: 6,
    marginBottom: 10,
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
    overflow: 'hidden',
  },
  avatarImage: {
    height: '100%',
    width: '100%',
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
  checkinPhoto: {
    width: '100%',
    aspectRatio: 1.55,
    borderRadius: 8,
    backgroundColor: '#071022',
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
