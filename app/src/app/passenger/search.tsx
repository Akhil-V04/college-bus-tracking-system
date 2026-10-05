import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { colors, fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { RouteSummary } from '@/types/api';

export default function SearchScreen() {
  const [filterText, setFilterText] = useState('');

  const routes = useQuery({
    queryKey: ['passenger-routes-search', filterText],
    queryFn: () => apiRequest<RouteSummary[]>(`/passenger/routes${filterText ? `?q=${encodeURIComponent(filterText)}` : ''}`),
    staleTime: 30_000,
  });

  const handleRouteClick = (routeNo: string) => {
    router.push(`/passenger/${encodeURIComponent(routeNo)}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Search by Route Number</Text>
          <View style={styles.backBtn} /> {/* spacer */}
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={filterText}
            onChangeText={setFilterText}
            placeholder="Search by route number, name, or stop..."
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
          <Text style={styles.searchIcon}>🔍</Text>
        </View>
      </View>

      {/* Results */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>Route Number</Text>
        {routes.data && (
          <Text style={styles.resultCount}>{routes.data.length} results</Text>
        )}
      </View>

      {routes.isPending && <LoadingState label="Searching routes..." />}
      {routes.isError && (
        <ErrorState message={routes.error.message} retry={() => routes.refetch()} />
      )}

      <FlatList
        data={routes.data || []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !routes.isPending && !routes.isError ? (
            <EmptyState
              title="No routes found"
              message={filterText ? `No routes matching "${filterText}"` : 'No routes available.'}
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
                <Text style={styles.busIconEmoji}>🚌</Text>
              </View>
              <View>
                <Text style={styles.routeNumber}>{item.routeNo}</Text>
                {item.name && <Text style={styles.routeSubtitle}>{item.name}</Text>}
              </View>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Bottom Indicator */}
      <View style={styles.bottomIndicator}>
        <View style={styles.indicatorBar} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  searchIcon: {
    position: 'absolute',
    right: 14,
    top: 12,
    fontSize: 20,
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
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  resultCount: { fontSize: 12, color: colors.textMuted },
  listContent: {
    backgroundColor: colors.surfaceElevated,
    paddingBottom: 20,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  routeItemPressed: { backgroundColor: colors.surface },
  routeItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  busIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busIconEmoji: { fontSize: 22 },
  routeNumber: {
    fontSize: 17,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  routeSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
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
  bottomIndicator: { paddingVertical: 12, alignItems: 'center' },
  indicatorBar: {
    width: 140,
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
});
