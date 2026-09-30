import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState, Pill } from '@/components/ui';
import { colors, fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { RouteSummary } from '@/types/api';

function RouteCard({ route }: { route: RouteSummary }) {
  const full = route.assignedPassengerCount >= route.capacity;
  return (
    <Pressable
      onPress={() => router.push(`/passenger/${encodeURIComponent(route.routeNo)}`)}
      style={({ pressed }) => [styles.routeCard, pressed && styles.routeCardPressed]}
    >
      <View style={styles.routeHeader}>
        <View style={styles.routeIdentity}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>{route.routeNo}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
            <Text style={styles.routeArea} numberOfLines={1}>{route.areaCovered}</Text>
          </View>
        </View>
        <Pill tone={full ? 'warning' : 'success'}>
          {route.assignedPassengerCount}/{route.capacity}
        </Pill>
      </View>

      <View style={styles.routeMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>DRIVER</Text>
          <Text style={styles.metaValue}>{route.driver?.name || 'Not assigned'}</Text>
        </View>
        <Text style={styles.viewRoute}>View route →</Text>
      </View>

      {route.hasActiveTrip && (
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Trip is live</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function PassengerDashboard() {
  const routes = useQuery({
    queryKey: ['passenger-routes'],
    queryFn: () => apiRequest<RouteSummary[]>('/passenger/routes'),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconEmoji}>🚌</Text>
          </View>
          <Text style={styles.headerTitle}>Campus Transit</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Menu */}
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/passenger/search')}
        >
          <View style={styles.menuIconBox}>
            <Text style={styles.menuIconEmoji}>🔍</Text>
          </View>
          <Text style={styles.menuLabel}>Search by Route Number</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/passenger/search')}
        >
          <View style={styles.menuIconBox}>
            <Text style={styles.menuIconEmoji}>📍</Text>
          </View>
          <Text style={styles.menuLabel}>Bus Stop Near Me</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/passenger/emergency')}
        >
          <View style={styles.menuIconBox}>
            <Text style={styles.menuIconEmoji}>🚨</Text>
          </View>
          <Text style={styles.menuLabel}>Emergency / SOS</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/passenger/report-issue')}
        >
          <View style={styles.menuIconBox}>
            <Text style={styles.menuIconEmoji}>⚠️</Text>
          </View>
          <Text style={styles.menuLabel}>Report an Issue</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/passenger/assistant')}
        >
          <View style={styles.menuIconBox}>
            <Text style={styles.menuIconEmoji}>💬</Text>
          </View>
          <Text style={styles.menuLabel}>Transport Assistant</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        {/* Routes Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Routes</Text>
          <Pill tone="accent">{routes.data?.length || 0} routes</Pill>
        </View>

        {routes.isPending && <LoadingState label="Loading college routes..." />}
        {routes.isError && (
          <ErrorState message={routes.error.message} retry={() => routes.refetch()} />
        )}
        {routes.data?.length === 0 && (
          <EmptyState
            title="No routes published"
            message="The transport administrator has not added route services yet."
          />
        )}
        {routes.data?.map((route) => <RouteCard key={route.id} route={route} />)}

        {/* Privacy Notice */}
        <View style={styles.privacyBox}>
          <Text style={styles.privacyTitle}>🔒 Privacy by design</Text>
          <Text style={styles.privacyText}>
            No account is required. Driver and passenger phone numbers are never shown in passenger mode.
          </Text>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={() => router.push('/driver/login')}
          >
            <Text style={styles.actionBtnText}>🔐 Driver Login</Text>
          </Pressable>
        </View>

        {/* Branding */}
        <View style={styles.footerBrand}>
          <Text style={styles.footerPowered}>Powered by</Text>
          <Text style={styles.footerBrandName}>CAMPUS<Text style={styles.footerBrandAccent}>Transit</Text></Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconEmoji: { fontSize: 22 },
  headerTitle: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: 12,
  },
  menuItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuItemPressed: { borderColor: colors.borderAccent, backgroundColor: colors.surfaceHover },
  menuIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconEmoji: { fontSize: 22 },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  menuChevron: { fontSize: 24, color: colors.textMuted, fontWeight: fontWeight.bold },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: fontWeight.extrabold, color: colors.textPrimary },
  routeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
  },
  routeCardPressed: { borderColor: colors.borderAccent, transform: [{ scale: 0.99 }] },
  routeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  routeIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.accentBgStrong,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  routeBadgeText: { color: colors.accent, fontSize: 13, fontWeight: fontWeight.extrabold, letterSpacing: 0.5 },
  routeName: { fontSize: 17, fontWeight: fontWeight.extrabold, color: colors.textPrimary },
  routeArea: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  routeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  metaItem: { gap: 2 },
  metaLabel: { color: colors.textMuted, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
  metaValue: { color: colors.textPrimary, fontSize: 14, fontWeight: fontWeight.bold },
  viewRoute: { color: colors.accent, fontWeight: fontWeight.extrabold, fontSize: 13 },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successBg,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 12, fontWeight: fontWeight.bold },
  privacyBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.sm,
  },
  privacyTitle: { color: colors.textPrimary, fontWeight: fontWeight.extrabold, fontSize: 14 },
  privacyText: { color: colors.textSecondary, lineHeight: 20, fontSize: 13 },
  bottomActions: { gap: 12, marginTop: spacing.sm },
  actionBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnPressed: { backgroundColor: colors.accentBg },
  actionBtnText: { color: colors.accent, fontSize: 15, fontWeight: fontWeight.bold },
  footerBrand: { alignItems: 'center', marginTop: spacing.md, gap: 2 },
  footerPowered: { color: colors.textMuted, fontSize: 13 },
  footerBrandName: { color: colors.accentLight, fontSize: 16, fontWeight: fontWeight.black, letterSpacing: 2 },
  footerBrandAccent: { color: colors.accent, fontWeight: fontWeight.bold },
});
