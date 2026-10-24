import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StyleSheet, Text, View, FlatList, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingState, Pill } from '@/components/ui';
import { fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { createLiveSocket } from '@/lib/socket';

type AdminNotification = {
  id: number;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  targetType: 'GLOBAL' | 'ROUTE';
  publishedAt: string;
  expiresAt?: string | null;
  targetRouteNos?: string[];
  routesFormatted?: string;
  targetRoutes?: { routeServiceId: number; routeNo?: string; name?: string }[];
};

function NotificationCard({ item }: { item: AdminNotification }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isUrgent = item.priority === 'URGENT';
  const isImportant = item.priority === 'IMPORTANT';

  const accentColor = isUrgent ? colors.danger : isImportant ? colors.warning : colors.accent || '#EA580C';
  const cardBg = isUrgent ? colors.dangerBg : isImportant ? colors.warningBg : colors.surface;

  // Resolve target routes list
  const targetRoutesList = useMemo(() => {
    if (Array.isArray(item.targetRouteNos) && item.targetRouteNos.length > 0) {
      return item.targetRouteNos;
    }
    if (Array.isArray(item.targetRoutes) && item.targetRoutes.length > 0) {
      return item.targetRoutes.map((r) => r.routeNo).filter(Boolean) as string[];
    }
    return [];
  }, [item]);

  const formattedRoutes =
    item.routesFormatted ||
    (targetRoutesList.length > 0 ? targetRoutesList.map((r) => `Route ${r}`).join(', ') : 'Specific Routes');

  return (
    <View style={[styles.card, { borderColor: isUrgent || isImportant ? accentColor : colors.border, backgroundColor: cardBg }]}>
      {/* Target Route Header Tag */}
      {item.targetType === 'ROUTE' ? (
        <View style={[styles.routeHeader, { backgroundColor: colors.accentBg || 'rgba(234, 88, 12, 0.15)' }]}>
          <Text style={[styles.routeHeaderIcon]}>🚌</Text>
          <View style={styles.routeHeaderContent}>
            <Text style={[styles.routeHeaderLabel, { color: colors.textSecondary }]}>
              Applicable Routes:
            </Text>
            <View style={styles.routeChipsRow}>
              {targetRoutesList.length > 0 ? (
                targetRoutesList.map((routeNo) => (
                  <View key={routeNo} style={[styles.routeChip, { borderColor: colors.accent || '#EA580C', backgroundColor: colors.surface }]}>
                    <Text style={[styles.routeChipText, { color: colors.accent || '#EA580C' }]}>
                      Route {routeNo}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={[styles.routeChip, { borderColor: colors.accent || '#EA580C', backgroundColor: colors.surface }]}>
                  <Text style={[styles.routeChipText, { color: colors.accent || '#EA580C' }]}>
                    {formattedRoutes}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.globalHeader, { backgroundColor: colors.surfaceElevated || '#0E141C' }]}>
          <Text style={[styles.globalHeaderText, { color: colors.textSecondary }]}>
            📢 Campus-Wide Broadcast · All Routes
          </Text>
        </View>
      )}

      {/* Card Content */}
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.icon}>
              {isUrgent ? '🔴' : isImportant ? '🟡' : '📢'}
            </Text>
            <Text
              style={[
                styles.title,
                { color: isUrgent ? colors.danger : isImportant ? colors.warning : colors.textPrimary },
              ]}
            >
              {item.title}
            </Text>
          </View>
          <Text style={styles.time}>
            {new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <Text style={[styles.message, { color: colors.textPrimary }]}>{item.message}</Text>

        <View style={styles.cardFooter}>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            {new Date(item.publishedAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <Pill tone={isUrgent ? 'danger' : isImportant ? 'warning' : 'neutral'}>
            {item.priority}
          </Pill>
        </View>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<'ALL' | string>('ALL');

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => apiRequest<AdminNotification[]>('/admin-notifications'),
  });

  // Real-time socket listener for live broadcasts
  useEffect(() => {
    const socket = createLiveSocket();
    socket.connect();
    socket.on('broadcast:notification', () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  // Extract all unique route numbers from currently active notifications
  const availableRoutes = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.forEach((n) => {
      if (n.targetType === 'ROUTE') {
        const routes =
          n.targetRouteNos || (n.targetRoutes ? n.targetRoutes.map((r) => r.routeNo).filter(Boolean) : []);
        routes.forEach((r) => {
          if (r) set.add(String(r));
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [data]);

  // Filter list by selected route
  const filteredNotifications = useMemo(() => {
    if (!data) return [];
    if (selectedRouteFilter === 'ALL') return data;
    return data.filter((n) => {
      if (n.targetType === 'GLOBAL') return true; // Global notices are always visible
      const routes =
        n.targetRouteNos || (n.targetRoutes ? n.targetRoutes.map((r) => r.routeNo).filter(Boolean) : []);
      return routes.map(String).includes(selectedRouteFilter);
    });
  }, [data, selectedRouteFilter]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerTitle: 'Notifications',
          headerShown: true,
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              style={{ marginRight: 16 }}
            >
              <Text style={{ fontSize: 24, color: colors.textPrimary }}>‹</Text>
            </Pressable>
          ),
        }}
      />

      {/* Route Filter Pills Bar if route-specific notices exist */}
      {availableRoutes.length > 0 && (
        <View style={[styles.filterBarContainer, { borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <Pressable
              onPress={() => setSelectedRouteFilter('ALL')}
              style={[
                styles.filterPill,
                selectedRouteFilter === 'ALL'
                  ? [styles.filterPillActive, { backgroundColor: colors.accent || '#EA580C', borderColor: colors.accent || '#EA580C' }]
                  : [styles.filterPillInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: selectedRouteFilter === 'ALL' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                All ({data?.length || 0})
              </Text>
            </Pressable>

            {availableRoutes.map((routeNo) => {
              const isActive = selectedRouteFilter === routeNo;
              return (
                <Pressable
                  key={routeNo}
                  onPress={() => setSelectedRouteFilter(isActive ? 'ALL' : routeNo)}
                  style={[
                    styles.filterPill,
                    isActive
                      ? [styles.filterPillActive, { backgroundColor: colors.accent || '#EA580C', borderColor: colors.accent || '#EA580C' }]
                      : [styles.filterPillInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: isActive ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    Route {routeNo}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {isPending ? (
        <View style={styles.center}>
          <LoadingState label="Fetching notifications..." />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <ErrorState message={error?.message || 'Failed to load notifications'} retry={refetch} />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No Notifications"
              message={
                selectedRouteFilter === 'ALL'
                  ? 'There are no active broadcast announcements right now.'
                  : `No announcements matching Route ${selectedRouteFilter}.`
              }
            />
          }
          renderItem={({ item }) => <NotificationCard item={item} />}
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
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        center: {
          flex: 1,
          justifyContent: 'center',
          padding: spacing.xl,
        },
        filterBarContainer: {
          paddingVertical: 10,
          borderBottomWidth: 1,
          backgroundColor: colors.background,
        },
        filterScroll: {
          paddingHorizontal: spacing.md,
          gap: 8,
          alignItems: 'center',
        },
        filterPill: {
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 20,
          borderWidth: 1,
        },
        filterPillActive: {
          shadowColor: '#EA580C',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 2,
        },
        filterPillInactive: {},
        filterPillText: {
          fontSize: 12.5,
          fontWeight: fontWeight.bold,
        },
        list: {
          padding: spacing.md,
          gap: spacing.md,
        },
        card: {
          borderWidth: 1,
          borderRadius: radius.md,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 2,
        },
        routeHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(234, 88, 12, 0.25)',
          gap: 10,
        },
        routeHeaderIcon: {
          fontSize: 18,
        },
        routeHeaderContent: {
          flex: 1,
        },
        routeHeaderLabel: {
          fontSize: 11,
          fontWeight: fontWeight.bold,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 4,
        },
        routeChipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        },
        routeChip: {
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 6,
          borderWidth: 1,
        },
        routeChipText: {
          fontSize: 12,
          fontWeight: fontWeight.extrabold,
        },
        globalHeader: {
          paddingHorizontal: spacing.md,
          paddingVertical: 7,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        globalHeaderText: {
          fontSize: 11.5,
          fontWeight: fontWeight.bold,
        },
        cardBody: {
          padding: spacing.md,
        },
        cardHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.xs,
          gap: 8,
        },
        headerLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          flex: 1,
        },
        icon: {
          fontSize: 14,
        },
        title: {
          fontSize: 15.5,
          fontWeight: fontWeight.extrabold,
          flex: 1,
        },
        time: {
          fontSize: 11.5,
          color: colors.textMuted,
        },
        message: {
          fontSize: 14,
          lineHeight: 21,
          marginTop: 6,
        },
        cardFooter: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle || 'rgba(255,255,255,0.06)',
        },
        dateText: {
          fontSize: 11,
        },
      }),
    [colors]
  );
};
