import { ReactElement, ReactNode, useCallback, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  ScrollViewProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type WebPullToRefreshOptions = {
  enabled?: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  tintColor: string;
};

type WebPullToRefresh = {
  refreshControl?: ReactElement;
  webPullHandlers: Partial<ScrollViewProps>;
  webRefreshIndicator: ReactNode;
};

const pullThreshold = 64;

type WebTouchPoint = {
  clientY?: number;
  pageY?: number;
};

type WebTouchNativeEvent = GestureResponderEvent['nativeEvent'] & {
  changedTouches?: WebTouchPoint[];
  touches?: WebTouchPoint[];
};

function eventPageY(event: GestureResponderEvent): number | undefined {
  const nativeEvent = event.nativeEvent as WebTouchNativeEvent;
  return (
    nativeEvent.pageY ??
    nativeEvent.touches?.[0]?.pageY ??
    nativeEvent.changedTouches?.[0]?.pageY ??
    nativeEvent.touches?.[0]?.clientY ??
    nativeEvent.changedTouches?.[0]?.clientY
  );
}

export function useWebPullToRefresh({ enabled = true, onRefresh, refreshing, tintColor }: WebPullToRefreshOptions): WebPullToRefresh {
  const isWeb = Platform.OS === 'web';
  const scrollOffsetYRef = useRef(0);
  const startYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetYRef.current = event.nativeEvent.contentOffset?.y ?? 0;
  }, []);

  const onTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (!isWeb || refreshing || scrollOffsetYRef.current > 1) {
        startYRef.current = null;
        return;
      }

      startYRef.current = eventPageY(event) ?? null;
    },
    [isWeb, refreshing]
  );

  const onTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!isWeb || refreshing || startYRef.current === null || scrollOffsetYRef.current > 1) {
        return;
      }

      const pageY = eventPageY(event);
      if (pageY === undefined) {
        return;
      }

      const nextPullDistance = Math.max(0, pageY - startYRef.current);
      pullDistanceRef.current = nextPullDistance;
      setPullDistance(nextPullDistance);
    },
    [isWeb, refreshing]
  );

  const finishPull = useCallback(() => {
    if (!isWeb) {
      return;
    }

    const shouldRefresh = pullDistanceRef.current >= pullThreshold && !refreshing;
    startYRef.current = null;
    pullDistanceRef.current = 0;
    setPullDistance(0);

    if (shouldRefresh) {
      onRefresh();
    }
  }, [isWeb, onRefresh, refreshing]);

  if (!enabled) {
    return {
      refreshControl: undefined,
      webPullHandlers: {},
      webRefreshIndicator: null,
    };
  }

  if (!isWeb) {
    return {
      refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tintColor} />,
      webPullHandlers: {},
      webRefreshIndicator: null,
    };
  }

  const showIndicator = refreshing || pullDistance > 10;
  const label = refreshing ? 'Refreshing...' : pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull to refresh';

  return {
    refreshControl: undefined,
    webPullHandlers: {
      onScroll,
      onTouchCancel: finishPull,
      onTouchEnd: finishPull,
      onTouchMove,
      onTouchStart,
      scrollEventThrottle: 16,
    },
    webRefreshIndicator: showIndicator ? (
      <View style={[styles.indicator, { borderColor: tintColor }]}>
        <Text style={[styles.indicatorText, { color: tintColor }]}>{label}</Text>
      </View>
    ) : null,
  };
}

const styles = StyleSheet.create({
  indicator: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
    paddingVertical: 9,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
