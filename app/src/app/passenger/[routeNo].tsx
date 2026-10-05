import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, ErrorState, LabelValue, LoadingState, Notice, Pill, SectionTitle } from '@/components/ui';
import { fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { createLiveSocket } from '@/lib/socket';
import { BusUpdate, EtaResult, RouteDetail, RouteRoster } from '@/types/api';
import { useTheme } from "@/contexts/ThemeContext";

type TabType = 'MY ROUTE' | 'FULL ROUTE' | 'BUS INFO';

function etaTone(status?: string): 'info' | 'warning' | 'danger' | 'success' {
  if (['PASSED', 'POSSIBLY_SKIPPED', 'TRIP_ENDED'].includes(status || '')) return 'danger';
  if (['NO_LIVE_DATA', 'NOT_STARTED', 'GPS_UNRELIABLE', 'STALE_LOCATION', 'OFF_ROUTE', 'NOT_MOVING'].includes(status || '')) return 'warning';
  if (['AT_STOP', 'ARRIVING', 'ROUTE_COMPLETED'].includes(status || '')) return 'success';
  return 'info';
}

function etaTitle(eta?: EtaResult | null) {
  if (!eta) return 'Select a stop to calculate ETA';
  if (eta.status === 'PASSED') return 'Bus missed — this stop was already passed';
  if (eta.status === 'POSSIBLY_SKIPPED') return 'Bus may have already passed this stop';
  if (eta.status === 'AT_STOP') return 'Bus is at this stop';
  if (eta.status === 'NO_LIVE_DATA') return 'Live location unavailable';
  if (eta.status === 'NOT_STARTED') return 'Trip has not started';
  if (eta.status === 'GPS_UNRELIABLE') return 'GPS signal is unreliable';
  if (eta.status === 'STALE_LOCATION') return 'Last bus location is stale';
  if (eta.status === 'OFF_ROUTE') return 'Bus appears off route';
  if (eta.status === 'NOT_MOVING') return 'Bus is currently not moving';
  if (eta.status === 'ROUTE_COMPLETED') return 'Bus completed this route';
  if (eta.status === 'TRIP_ENDED') return 'Trip has ended';
  if (eta.etaRangeMinutes) {
    return `Estimated arrival: ${eta.etaRangeMinutes.min}–${eta.etaRangeMinutes.max} minutes`;
  }
  return eta.message || 'ETA is being calculated';
}

export default function RouteDetailsScreen() {
    const { colors } = useTheme();
    const styles = useStyles();
  const params = useLocalSearchParams<{ routeNo: string }>();
  const routeNo = Array.isArray(params.routeNo) ? params.routeNo[0] : params.routeNo;
  const [activeTab, setActiveTab] = useState<TabType>('MY ROUTE');
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);
  const [showRoster, setShowRoster] = useState(false);
  const [busUpdate, setBusUpdate] = useState<BusUpdate | null>(null);
  const [connectionState, setConnectionState] = useState<'waiting' | 'connected' | 'reconnecting'>('waiting');

  const route = useQuery({
    queryKey: ['passenger-route', routeNo],
    queryFn: () => apiRequest<RouteDetail>(`/passenger/routes/${encodeURIComponent(routeNo)}`),
    enabled: Boolean(routeNo),
    refetchInterval: 30_000,
  });

  const roster = useQuery({
    queryKey: ['passenger-roster', routeNo],
    queryFn: () => apiRequest<RouteRoster>(`/passenger/routes/${encodeURIComponent(routeNo)}/roster`),
    enabled: Boolean(routeNo && showRoster),
  });

  const activeTripId = route.data?.activeTrip?.id || null;

  const eta = useQuery({
    queryKey: ['eta', activeTripId, selectedStopId],
    queryFn: () => apiRequest<EtaResult>(`/passenger/trips/${activeTripId}/eta/${selectedStopId}`),
    enabled: Boolean(activeTripId && selectedStopId),
    refetchInterval: 15_000,
  });

  // Socket.IO live tracking
  useEffect(() => {
    if (!activeTripId) {
      setBusUpdate(null);
      return;
    }
    const socket = createLiveSocket();
    socket.connect();
    socket.on('connect', () => {
      setConnectionState('connected');
      socket.emit('join:trip', { tripId: activeTripId });
    });
    socket.on('disconnect', () => setConnectionState('reconnecting'));
    socket.on('connect_error', () => setConnectionState('reconnecting'));
    socket.on('bus:update', (update: BusUpdate) => {
      if (update.tripId === activeTripId) setBusUpdate(update);
    });
    return () => { socket.disconnect(); };
  }, [activeTripId]);

  const stops = route.data?.schedule?.stops || [];
  const currentStopIndex = busUpdate?.currentStopIndex ?? route.data?.activeTrip?.currentStopIndex ?? 0;

  if (route.isPending) return <SafeAreaView style={styles.container}><LoadingState label="Loading route..." /></SafeAreaView>;
  if (route.isError) return <SafeAreaView style={styles.container}><ErrorState message={route.error.message} retry={() => route.refetch()} /></SafeAreaView>;
  if (!route.data) return <SafeAreaView style={styles.container}><EmptyState title="Route not found" message="Check the route number." /></SafeAreaView>;

  const detail = route.data;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Route {detail.routeNo}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{detail.name}</Text>
        </View>
        <View style={styles.headerRight}>
          {detail.activeTrip && (
            <View style={styles.livePulse}>
              <View style={styles.livePulseDot} />
            </View>
          )}
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['MY ROUTE', 'FULL ROUTE', 'BUS INFO'] as TabType[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Trip Status Banner */}
        {!detail.activeTrip ? (
          <Notice
            tone="warning"
            title="Trip has not started"
            message="Scheduled times are shown below. Live tracking activates after the driver starts."
          />
        ) : busUpdate ? (
          <Notice
            tone="success"
            title="Live bus tracking connected"
            message={`Last update: ${new Date(busUpdate.timestamp).toLocaleTimeString()}`}
          />
        ) : (
          <Notice
            tone={connectionState === 'reconnecting' ? 'warning' : 'info'}
            title={connectionState === 'reconnecting' ? 'Reconnecting...' : 'Waiting for live GPS'}
            message="Scheduled information remains available."
          />
        )}

        {/* MY ROUTE Tab */}
        {activeTab === 'MY ROUTE' && (
          <>
            {/* ETA Section */}
            <Card>
              <SectionTitle>Ask estimated time</SectionTitle>
              <Text style={styles.helpText}>
                Select your boarding stop below. ETA is calculated from live GPS data.
              </Text>
              <View style={styles.stopChoices}>
                {stops.map((entry) => {
                  const passed = currentStopIndex > entry.sequenceOrder;
                  const selected = selectedStopId === entry.stop.id;
                  return (
                    <Pressable
                      key={entry.stop.id}
                      onPress={() => setSelectedStopId(entry.stop.id)}
                      style={[
                        styles.stopChip,
                        selected && styles.stopChipSelected,
                        passed && styles.stopChipPassed,
                      ]}
                    >
                      <Text style={[styles.stopChipText, selected && styles.stopChipTextSelected]}>
                        {entry.sequenceOrder + 1}. {entry.stop.name}
                      </Text>
                      <Text style={styles.stopChipTime}>{entry.scheduledTime}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {eta.isFetching && <LoadingState label="Calculating from live movement..." />}
              {eta.isError && <Notice tone="danger" title="ETA unavailable" message={eta.error.message} />}
              {!eta.isFetching && !eta.isError && (
                <Notice
                  tone={etaTone(eta.data?.status)}
                  title={etaTitle(eta.data)}
                  message={eta.data?.message}
                />
              )}
            </Card>
          </>
        )}

        {/* FULL ROUTE Tab */}
        {activeTab === 'FULL ROUTE' && (
          <Card>
            <View style={styles.sectionHeader}>
              <SectionTitle>Stop Timeline</SectionTitle>
              <Pill tone="info">{stops.length} stops</Pill>
            </View>
            {stops.length === 0 ? (
              <Text style={styles.helpText}>No published schedule available.</Text>
            ) : (
              stops.map((entry, index) => {
                const isPassed = currentStopIndex > entry.sequenceOrder;
                const isLive = currentStopIndex === entry.sequenceOrder && detail.activeTrip;
                return (
                  <View key={entry.id} style={styles.timelineRow}>
                    {/* Rail */}
                    <View style={styles.timelineRail}>
                      {isLive ? (
                        <View style={styles.timelineLiveDot}>
                          <Text style={styles.timelineLiveIcon}>🚌</Text>
                        </View>
                      ) : isPassed ? (
                        <View style={styles.timelineDotPassed} />
                      ) : (
                        <View style={styles.timelineDot} />
                      )}
                      {index < stops.length - 1 && (
                        <View style={[
                          styles.timelineLine,
                          isPassed && styles.timelineLinePassed,
                        ]} />
                      )}
                    </View>
                    {/* Content */}
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineNameRow}>
                        <Text style={styles.timelineName}>{entry.stop.name}</Text>
                        {isLive && (
                          <View style={styles.liveNowBadge}>
                            <Text style={styles.liveNowText}>LIVE NOW</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.timelineTimes}>
                        <Text style={[styles.timelineTime, isPassed && styles.timelineTimePassed]}>
                          ➔ {entry.scheduledTime}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        )}

        {/* BUS INFO Tab */}
        {activeTab === 'BUS INFO' && (
          <>
            <Card>
              <SectionTitle>Route Information</SectionTitle>
              <LabelValue label="Route" value={`${detail.routeNo} — ${detail.name}`} />
              <LabelValue label="Area" value={detail.areaCovered} />
              <LabelValue label="Capacity" value={`${detail.assignedPassengerCount} / ${detail.capacity}`} />
              <LabelValue label="Driver" value={detail.driver?.name || 'Not assigned'} />
              <LabelValue label="Academic Year" value={detail.roster?.academicYear || 'Not published'} />
            </Card>

            <Card>
              <SectionTitle>Trip Status</SectionTitle>
              {detail.activeTrip ? (
                <>
                  <View style={styles.tripStatusRow}>
                    <Text style={styles.tripStatusLabel}>Status</Text>
                    <Pill tone="success">Running</Pill>
                  </View>
                  <LabelValue label="Started at" value={new Date(detail.activeTrip.startTime).toLocaleTimeString()} />
                  <LabelValue label="Progress" value={`${detail.activeTrip.currentStopIndex} of ${stops.length} stops reached`} />
                </>
              ) : (
                <View style={styles.tripStatusRow}>
                  <Text style={styles.tripStatusLabel}>Status</Text>
                  <Pill tone="neutral">Not started</Pill>
                </View>
              )}
            </Card>

            {/* Roster toggle */}
            <Pressable
              onPress={() => setShowRoster((v) => !v)}
              style={({ pressed }) => [styles.rosterToggle, pressed && styles.rosterTogglePressed]}
            >
              <Text style={styles.rosterToggleText}>
                {showRoster ? 'Hide passenger list' : 'View passenger list'}
              </Text>
              <Text style={styles.rosterToggleChevron}>{showRoster ? '▲' : '▼'}</Text>
            </Pressable>

            {showRoster && roster.isPending && <LoadingState label="Loading passengers..." />}
            {showRoster && roster.isError && <ErrorState message={roster.error.message} retry={() => roster.refetch()} />}
            {showRoster && roster.data && (
              <Card>
                <View style={styles.sectionHeader}>
                  <SectionTitle>Assigned Passengers</SectionTitle>
                  <Pill>{String(roster.data.total)}</Pill>
                </View>
                {roster.data.stops.map((stop) => (
                  <View key={stop.stopId} style={styles.rosterStop}>
                    <View style={styles.rosterStopHeader}>
                      <Text style={styles.rosterStopName}>{stop.stopName}</Text>
                      <Text style={styles.rosterStopTime}>{stop.scheduledTime}</Text>
                    </View>
                    {stop.passengers.length === 0 ? (
                      <Text style={styles.helpText}>No passengers at this stop.</Text>
                    ) : (
                      stop.passengers.map((p, idx) => (
                        <View key={p.name + idx} style={styles.passengerRow}>
                          <Text style={styles.passengerName}>{p.name}</Text>
                          <Pill tone={p.passengerType === 'STUDENT' ? 'info' : 'success'}>
                            {p.passengerType === 'STUDENT' ? 'Student' : 'Faculty'}
                          </Pill>
                        </View>
                      ))
                    )}
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {/* Bottom footer */}
        <View style={styles.footerDock}>
          <View style={styles.footerLeft}>
            {detail.activeTrip && (
              <>
                <View style={styles.footerLiveDot} />
                <Text style={styles.footerBusLabel}>Route {detail.routeNo}</Text>
              </>
            )}
          </View>
          {busUpdate && (
            <Text style={styles.footerEta}>
              <Text style={{ color: colors.success }}>Live</Text> · {new Date(busUpdate.timestamp).toLocaleTimeString()}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: colors.white, fontSize: 24, fontWeight: fontWeight.bold },
  headerCenter: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 20, fontWeight: fontWeight.bold, color: colors.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerRight: { width: 40, alignItems: 'center', justifyContent: 'center' },
  livePulse: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  tabBar: {
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    flexDirection: 'row',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tabTextActive: { color: colors.accent },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  helpText: { color: colors.textSecondary, lineHeight: 20, fontSize: 13 },
  stopChoices: { gap: spacing.sm },
  stopChip: {
    minHeight: 48,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stopChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  stopChipPassed: { opacity: 0.5 },
  stopChipText: { flex: 1, color: colors.textPrimary, fontWeight: fontWeight.bold, fontSize: 14 },
  stopChipTextSelected: { color: colors.accent },
  stopChipTime: { color: colors.textMuted, fontWeight: fontWeight.bold, fontSize: 13 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  timelineRow: { minHeight: 58, flexDirection: 'row', gap: spacing.sm },
  timelineRail: { width: 28, alignItems: 'center' },
  timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: colors.textMuted, backgroundColor: colors.surfaceElevated, marginTop: 4 },
  timelineDotPassed: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: colors.success, backgroundColor: colors.surfaceElevated, marginTop: 4 },
  timelineLiveDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  timelineLiveIcon: { fontSize: 14 },
  timelineLine: { flex: 1, width: 3, backgroundColor: colors.border, marginVertical: 3, borderRadius: 1 },
  timelineLinePassed: { backgroundColor: colors.success },
  timelineContent: { flex: 1, paddingBottom: spacing.md },
  timelineNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineName: { color: colors.textPrimary, fontWeight: fontWeight.extrabold, fontSize: 14 },
  liveNowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.accentBgStrong,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  liveNowText: { color: colors.accent, fontSize: 10, fontWeight: fontWeight.extrabold, letterSpacing: 0.5 },
  timelineTimes: { flexDirection: 'row', gap: spacing.lg, marginTop: 4 },
  timelineTime: { color: colors.textMuted, fontSize: 13, fontFamily: 'monospace' },
  timelineTimePassed: { color: colors.success, fontWeight: fontWeight.medium },
  tripStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripStatusLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: fontWeight.bold },
  rosterToggle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rosterTogglePressed: { backgroundColor: colors.accentBg },
  rosterToggleText: { color: colors.accent, fontWeight: fontWeight.bold, fontSize: 15 },
  rosterToggleChevron: { color: colors.accent, fontSize: 14 },
  rosterStop: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
  rosterStopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rosterStopName: { color: colors.textPrimary, fontWeight: fontWeight.extrabold, fontSize: 14 },
  rosterStopTime: { color: colors.textMuted, fontWeight: fontWeight.bold, fontSize: 13 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  passengerName: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  footerDock: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  footerBusLabel: { color: colors.textPrimary, fontWeight: fontWeight.bold, fontSize: 14 },
  footerEta: { color: colors.textSecondary, fontSize: 12, fontWeight: fontWeight.medium },
}), [colors]);
};
