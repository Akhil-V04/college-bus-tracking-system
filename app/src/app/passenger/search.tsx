import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { fontWeight, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { apiRequest } from '@/lib/api';
import { RouteSummary } from '@/types/api';

type NearestStop = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  routes: Array<{
    id: number;
    routeNo: string;
    name: string;
    direction: string;
    scheduledTime: string;
  }>;
};

export default function SearchScreen() {
  const styles = useStyles();
  const { isDark, toggleTheme } = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isStopMode = mode === 'stop';

  const [filterText, setFilterText] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  // Request location automatically when user enters "Bus Stop Near Me" mode
  const requestLocation = async () => {
    try {
      setLocating(true);
      setLocationDenied(false);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        setLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setLocationDenied(true);
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (isStopMode) {
      requestLocation();
    }
  }, [isStopMode]);

  // Route search query (for route mode or fallback)
  const routesQuery = useQuery({
    queryKey: ['passenger-routes-search', filterText],
    queryFn: () =>
      apiRequest<RouteSummary[]>(
        `/passenger/routes${filterText ? `?q=${encodeURIComponent(filterText)}` : ''}`
      ),
    staleTime: 30_000,
  });

  // Nearest stops query (when in stop mode and coordinates are available)
  const nearestStopsQuery = useQuery({
    queryKey: ['nearest-stops', coords?.latitude, coords?.longitude],
    queryFn: () =>
      apiRequest<{ query: { radiusMeters: number }; stops: NearestStop[] }>(
        `/passenger/stops/nearest?latitude=${coords!.latitude}&longitude=${coords!.longitude}&radiusMeters=35000&limit=15`
      ),
    enabled: isStopMode && Boolean(coords),
    staleTime: 30_000,
  });

  const handleRouteClick = (routeNo: string) => {
    router.push(`/passenger/${encodeURIComponent(routeNo)}`);
  };

  // Filter nearest stops if user enters text
  const filteredStops = useMemo(() => {
    const list = nearestStopsQuery.data?.stops || [];
    if (!filterText.trim()) return list;
    const term = filterText.toLowerCase();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.routes.some((r) => r.routeNo.toLowerCase().includes(term) || r.name.toLowerCase().includes(term))
    );
  }, [nearestStopsQuery.data, filterText]);

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters}m away`;
    return `${(meters / 1000).toFixed(1)} km away`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/passenger');
            }}
            style={styles.backBtn}
            hitSlop={10}
            accessibilityLabel="Back"
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {isStopMode ? 'Bus Stop Near Me' : 'Search by Route Number'}
          </Text>
          <Pressable
            onPress={toggleTheme}
            style={({ pressed }) => [styles.themeBtn, pressed && { opacity: 0.7 }]}
            hitSlop={10}
            accessibilityLabel="Toggle Theme"
          >
            <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
          </Pressable>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={filterText}
            onChangeText={setFilterText}
            placeholder={
              isStopMode
                ? 'Search nearby stop or locality name...'
                : 'Search by route number, name, or stop...'
            }
            placeholderTextColor="#9CA3AF"
            autoFocus={!isStopMode}
          />
          <View style={styles.searchIconBox}>
            <AppIcon name={isStopMode ? 'pin' : 'search'} size={20} colorScheme="light" />
          </View>
        </View>
      </View>

      {/* GPS Location Status Banner in Stop Mode */}
      {isStopMode ? (
        <View style={styles.locationBanner}>
          {locating ? (
            <View style={styles.locationStatusRow}>
              <ActivityIndicator size="small" color="#EA580C" />
              <Text style={styles.locationStatusText}>Detecting your current location…</Text>
            </View>
          ) : coords ? (
            <View style={styles.locationStatusRow}>
              <Text style={styles.locationDot}>📍</Text>
              <Text style={styles.locationStatusSuccess}>
                Showing bus stops near your current location
              </Text>
              <Pressable onPress={requestLocation} style={styles.refreshLocBtn}>
                <Text style={styles.refreshLocText}>Refresh</Text>
              </Pressable>
            </View>
          ) : locationDenied ? (
            <View style={styles.locationDeniedBox}>
              <Text style={styles.locationDeniedText}>
                ⚠️ Location permission needed to sort stops by distance.
              </Text>
              <Pressable onPress={requestLocation} style={styles.enableLocBtn}>
                <Text style={styles.enableLocBtnText}>Turn On Location</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Results Header */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {isStopMode ? 'Nearby Bus Stops' : 'Available College Routes'}
        </Text>
        {isStopMode ? (
          nearestStopsQuery.data ? (
            <Text style={styles.resultCount}>{filteredStops.length} stops found</Text>
          ) : null
        ) : routesQuery.data ? (
          <Text style={styles.resultCount}>{routesQuery.data.length} routes</Text>
        ) : null}
      </View>

      {/* Loading & Error States */}
      {isStopMode ? (
        nearestStopsQuery.isPending && locating ? (
          <LoadingState label="Finding stops near your location..." />
        ) : nearestStopsQuery.isError ? (
          <ErrorState
            message={nearestStopsQuery.error.message}
            retry={() => nearestStopsQuery.refetch()}
          />
        ) : null
      ) : routesQuery.isPending ? (
        <LoadingState label="Searching routes..." />
      ) : routesQuery.isError ? (
        <ErrorState message={routesQuery.error.message} retry={() => routesQuery.refetch()} />
      ) : null}

      {/* Stop Mode List */}
      {isStopMode ? (
        <FlatList
          data={filteredStops}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !locating && !nearestStopsQuery.isPending ? (
              <EmptyState
                title="No nearby stops found"
                message={
                  filterText
                    ? `No bus stops matching "${filterText}". Try searching routes.`
                    : 'No scheduled college bus stops within 35 km of your location.'
                }
              />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.stopCard}>
              <View style={styles.stopCardHeader}>
                <View style={styles.stopTitleRow}>
                  <View style={styles.pinIconBox}>
                    <AppIcon name="pin" size={20} />
                  </View>
                  <Text style={styles.stopName}>{item.name}</Text>
                </View>
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>{formatDistance(item.distanceMeters)}</Text>
                </View>
              </View>

              <Text style={styles.passingRoutesLabel}>ROUTES PASSING THIS STOP:</Text>
              <View style={styles.routesChipsRow}>
                {item.routes.map((r, idx) => (
                  <Pressable
                    key={`${r.id}-${r.direction}-${idx}`}
                    onPress={() => handleRouteClick(r.routeNo)}
                    style={({ pressed }) => [styles.routeChip, pressed && styles.routeChipPressed]}
                  >
                    <Text style={styles.routeChipNumber}>Route {r.routeNo}</Text>
                    {r.scheduledTime ? (
                      <Text style={styles.routeChipTime}>• {r.scheduledTime}</Text>
                    ) : null}
                    <Text style={styles.routeChipArrow}>›</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        /* Route Mode List */
        <FlatList
          data={routesQuery.data || []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !routesQuery.isPending && !routesQuery.isError ? (
              <EmptyState
                title="No routes found"
                message={
                  filterText ? `No routes matching "${filterText}"` : 'No routes available.'
                }
              />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleRouteClick(item.routeNo)}
              style={({ pressed }) => [styles.routeItem, pressed && styles.routeItemPressed]}
            >
              <View style={styles.routeItemLeft}>
                <View style={styles.busIcon}>
                  <AppIcon name="bus" size={24} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeNumber}>Route {item.routeNo}</Text>
                  {item.name ? <Text style={styles.routeSubtitle}>{item.name}</Text> : null}
                  {item.areaCovered ? (
                    <Text style={styles.routeArea} numberOfLines={1}>
                      {item.areaCovered}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          backgroundColor: colors.accent,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: 20,
          gap: spacing.md,
        },
        headerTop: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        backBtn: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 20,
        },
        backIcon: { color: colors.white, fontSize: 24, fontWeight: fontWeight.bold },
        headerTitle: {
          fontSize: 18,
          fontWeight: fontWeight.bold,
          color: colors.white,
          letterSpacing: 0.3,
        },
        themeBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        themeIcon: { fontSize: 16 },
        searchContainer: { position: 'relative' },
        searchInput: {
          height: 48,
          paddingHorizontal: 16,
          paddingRight: 44,
          borderRadius: radius.sm,
          backgroundColor: colors.white,
          color: '#1F2937',
          fontSize: 15,
          fontWeight: fontWeight.normal,
        },
        searchIconBox: {
          position: 'absolute',
          right: 14,
          top: 14,
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        locationBanner: {
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          backgroundColor: colors.surfaceElevated,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        },
        locationStatusRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'space-between',
        },
        locationDot: { fontSize: 14 },
        locationStatusText: {
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: fontWeight.medium,
          flex: 1,
        },
        locationStatusSuccess: {
          color: colors.textPrimary,
          fontSize: 13,
          fontWeight: fontWeight.semibold,
          flex: 1,
        },
        refreshLocBtn: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 4,
          backgroundColor: colors.accentBg,
        },
        refreshLocText: {
          color: colors.accent,
          fontSize: 12,
          fontWeight: fontWeight.bold,
        },
        locationDeniedBox: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        },
        locationDeniedText: {
          color: colors.warning,
          fontSize: 12,
          flex: 1,
          fontWeight: fontWeight.medium,
        },
        enableLocBtn: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 4,
          backgroundColor: colors.accent,
        },
        enableLocBtnText: {
          color: colors.white,
          fontSize: 12,
          fontWeight: fontWeight.bold,
        },
        listHeader: {
          paddingHorizontal: 20,
          paddingVertical: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        listHeaderText: {
          fontSize: 13,
          fontWeight: fontWeight.bold,
          color: colors.textMuted,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        resultCount: { fontSize: 12, color: colors.textMuted },
        listContent: {
          backgroundColor: colors.surfaceElevated,
          paddingBottom: 24,
        },
        stopCard: {
          paddingHorizontal: 20,
          paddingVertical: 14,
          gap: 8,
        },
        stopCardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        stopTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
        pinIconBox: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        stopName: {
          fontSize: 16,
          fontWeight: fontWeight.bold,
          color: colors.textPrimary,
        },
        distanceBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 4,
          backgroundColor: colors.accentBg,
        },
        distanceText: {
          color: colors.accent,
          fontSize: 12,
          fontWeight: fontWeight.bold,
        },
        passingRoutesLabel: {
          fontSize: 11,
          fontWeight: fontWeight.bold,
          color: colors.textMuted,
          letterSpacing: 0.5,
          marginTop: 2,
        },
        routesChipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        routeChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: radius.sm,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        routeChipPressed: {
          backgroundColor: colors.accentBg,
          borderColor: colors.accent,
        },
        routeChipNumber: {
          fontSize: 13,
          fontWeight: fontWeight.bold,
          color: colors.accent,
        },
        routeChipTime: {
          fontSize: 12,
          color: colors.textSecondary,
        },
        routeChipArrow: {
          fontSize: 14,
          fontWeight: fontWeight.bold,
          color: colors.textMuted,
        },
        routeItem: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
        },
        routeItemPressed: { backgroundColor: colors.surface },
        routeItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
        busIcon: {
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
        },
        routeNumber: {
          fontSize: 17,
          fontWeight: fontWeight.medium,
          color: colors.textPrimary,
          letterSpacing: 0.3,
        },
        routeSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
        routeArea: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
        activeBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 4,
          backgroundColor: colors.accentBg,
        },
        activeBadgeText: {
          color: colors.accent,
          fontSize: 12,
          fontWeight: fontWeight.bold,
        },
        separator: { height: 1, backgroundColor: colors.border, marginHorizontal: 20 },
      }),
    [colors]
  );
};
