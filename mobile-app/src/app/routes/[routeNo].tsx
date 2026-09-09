import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import RouteMap from '@/components/route-map';
import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LabelValue,
  LoadingState,
  Notice,
  Pill,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { createLiveSocket } from '@/lib/socket';
import { BusUpdate, EtaResult, RouteDetail, RouteRoster } from '@/types/api';

function etaTone(status?: string): 'info' | 'warning' | 'danger' | 'success' {
  if (['PASSED', 'POSSIBLY_SKIPPED', 'TRIP_ENDED'].includes(status || '')) return 'danger';
  if (['NO_LIVE_DATA', 'NOT_STARTED', 'GPS_UNRELIABLE', 'STALE_LOCATION', 'OFF_ROUTE', 'NOT_MOVING'].includes(status || '')) return 'warning';
  if (['AT_STOP', 'ARRIVING', 'ROUTE_COMPLETED'].includes(status || '')) return 'success';
  return 'info';
}

function etaTitle(eta?: EtaResult | null) {
  if (!eta) return 'Select a stop to calculate ETA';
  if (eta.status === 'PASSED') return 'Bus missed - this stop was already passed';
  if (eta.status === 'POSSIBLY_SKIPPED') return 'Bus may have already passed this stop';
  if (eta.status === 'AT_STOP') return 'Bus is at this stop';
  if (eta.status === 'NO_LIVE_DATA') return 'Live location unavailable';
  if (eta.status === 'NOT_STARTED') return 'Trip has not started';
  if (eta.status === 'GPS_UNRELIABLE') return 'GPS signal is unreliable';
  if (eta.status === 'STALE_LOCATION') return 'Last bus location is stale';
  if (eta.status === 'OFF_ROUTE') return 'Bus appears to be off the configured route';
  if (eta.status === 'NOT_MOVING') return 'Bus is currently not moving';
  if (eta.status === 'ROUTE_COMPLETED') return 'Bus completed this route';
  if (eta.status === 'TRIP_ENDED') return 'Trip has ended';
  if (eta.etaRangeMinutes) {
    return 'Estimated arrival: ' + eta.etaRangeMinutes.min + '-' + eta.etaRangeMinutes.max + ' minutes';
  }
  return eta.message || 'ETA is being calculated';
}

export default function RouteDetailsScreen() {
  const params = useLocalSearchParams<{ routeNo: string | string[] }>();
  const routeNo = Array.isArray(params.routeNo) ? params.routeNo[0] : params.routeNo;
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);
  const [showRoster, setShowRoster] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [connectionState, setConnectionState] = useState<'waiting' | 'connected' | 'reconnecting'>('waiting');
  const [busUpdate, setBusUpdate] = useState<BusUpdate | null>(null);

  const route = useQuery({
    queryKey: ['passenger-route', routeNo],
    queryFn: () => apiRequest<RouteDetail>('/passenger/routes/' + encodeURIComponent(routeNo)),
    enabled: Boolean(routeNo),
    refetchInterval: 30_000,
  });

  const roster = useQuery({
    queryKey: ['passenger-roster', routeNo],
    queryFn: () => apiRequest<RouteRoster>('/passenger/routes/' + encodeURIComponent(routeNo) + '/roster'),
    enabled: Boolean(routeNo && showRoster),
  });

  const activeTripId = route.data?.activeTrip?.id || null;
  const eta = useQuery({
    queryKey: ['eta', activeTripId, selectedStopId],
    queryFn: () => apiRequest<EtaResult>(
      '/passenger/trips/' + activeTripId + '/eta/' + selectedStopId
    ),
    enabled: Boolean(activeTripId && selectedStopId),
    refetchInterval: 15_000,
  });

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
    return () => {
      socket.disconnect();
    };
  }, [activeTripId]);

  const stops = route.data?.schedule?.stops || [];
  const mapStops = useMemo(
    () => stops.map((entry) => ({
      id: entry.stop.id,
      name: entry.stop.name,
      latitude: entry.stop.latitude,
      longitude: entry.stop.longitude,
    })),
    [stops]
  );

  if (route.isPending) {
    return <Screen><LoadingState label="Loading route details..." /></Screen>;
  }
  if (route.isError) {
    return (
      <Screen>
        <ErrorState message={route.error.message} retry={() => route.refetch()} />
      </Screen>
    );
  }
  if (!route.data) {
    return <Screen><EmptyState title="Route not found" message="Ask the transport office to verify the route number." /></Screen>;
  }

  const detail = route.data;

  return (
    <Screen>
      <AppHeader
        eyebrow={'Route ' + detail.routeNo}
        title={detail.name}
        subtitle={detail.areaCovered}
      />

      <Card>
        <View style={styles.summaryGrid}>
          <LabelValue label="Driver" value={detail.driver?.name || 'Not assigned'} />
          <LabelValue
            label="Assigned capacity"
            value={detail.assignedPassengerCount + ' / ' + detail.capacity}
          />
          <LabelValue label="Academic year" value={detail.roster?.academicYear || 'Not published'} />
        </View>
      </Card>

      {!detail.activeTrip ? (
        <Notice
          tone="warning"
          title="Trip has not started"
          message="Scheduled times are shown below. Live location and ETA will appear after the driver starts the trip."
        />
      ) : busUpdate ? (
        <Notice tone="success" title="Live bus tracking connected" message={'Last update: ' + new Date(busUpdate.timestamp).toLocaleTimeString()} />
      ) : (
        <Notice tone={connectionState === 'reconnecting' ? 'warning' : 'info'}
          title={connectionState === 'reconnecting' ? 'Reconnecting to live tracking' : 'Waiting for live GPS'}
          message="Scheduled information remains available while the app waits for a fresh bus location." />
      )}

      <Button label={showMap ? 'Hide live bus map' : 'Track bus'} onPress={() => setShowMap((value) => !value)} />
      {showMap ? <Card>
        <SectionTitle>Live route map</SectionTitle>
        <RouteMap stops={mapStops} bus={busUpdate ? { latitude: busUpdate.latitude, longitude: busUpdate.longitude } : null} />
      </Card> : null}

      <Card>
        <SectionTitle>Ask estimated time</SectionTitle>
        <Text style={styles.help}>
          Select your boarding stop. A passed stop never shows a negative ETA; it is clearly marked as already passed.
        </Text>
        <View style={styles.stopChoices}>
          {stops.map((entry) => {
            const passed = (busUpdate?.currentStopIndex ?? detail.activeTrip?.currentStopIndex ?? 0) > entry.sequenceOrder;
            const selected = selectedStopId === entry.stop.id;
            return (
              <Pressable
                key={entry.stop.id}
                onPress={() => setSelectedStopId(entry.stop.id)}
                style={[
                  styles.stopChoice,
                  selected && styles.stopChoiceSelected,
                  passed && styles.stopChoicePassed,
                ]}
              >
                <Text style={[styles.stopChoiceText, selected && styles.stopChoiceTextSelected]}>
                  {entry.sequenceOrder + 1}. {entry.stop.name}
                </Text>
                <Text style={styles.stopTime}>{entry.scheduledTime}</Text>
              </Pressable>
            );
          })}
        </View>

        {eta.isFetching ? <LoadingState label="Calculating from live movement..." /> : null}
        {eta.isError ? <Notice tone="danger" title="ETA unavailable" message={eta.error.message} /> : null}
        {!eta.isFetching && !eta.isError ? (
          <Notice
            tone={etaTone(eta.data?.status)}
            title={etaTitle(eta.data)}
            message={eta.data?.message}
          />
        ) : null}
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <SectionTitle>Boarding timeline</SectionTitle>
          <Pill tone="info">{stops.length} stops</Pill>
        </View>
        {stops.length === 0 ? (
          <Text style={styles.help}>No published schedule is available.</Text>
        ) : stops.map((entry, index) => (
          <View key={entry.id} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={styles.timelineDot} />
              {index < stops.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineName}>{entry.stop.name}</Text>
              <Text style={styles.timelineTime}>Scheduled {entry.scheduledTime}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Button
        label={showRoster ? 'Hide passenger list' : 'View passenger list'}
        variant="secondary"
        onPress={() => setShowRoster((value) => !value)}
      />

      {showRoster && roster.isPending ? <LoadingState label="Loading assigned passengers..." /> : null}
      {showRoster && roster.isError ? (
        <ErrorState message={roster.error.message} retry={() => roster.refetch()} />
      ) : null}
      {showRoster && roster.data ? (
        <Card>
          <View style={styles.sectionHeader}>
            <SectionTitle>Assigned passengers</SectionTitle>
            <Pill>{roster.data.total}</Pill>
          </View>
          {roster.data.stops.map((stop) => (
            <View key={stop.stopId} style={styles.rosterStop}>
              <View style={styles.sectionHeader}>
                <Text style={styles.rosterStopName}>{stop.stopName}</Text>
                <Text style={styles.stopTime}>{stop.scheduledTime}</Text>
              </View>
              {stop.passengers.length === 0 ? (
                <Text style={styles.help}>No passengers assigned at this stop.</Text>
              ) : stop.passengers.map((passenger, index) => (
                <View key={passenger.name + index} style={styles.passengerRow}>
                  <Text style={styles.passengerName}>{passenger.name}</Text>
                  <Pill tone={passenger.passengerType === 'STUDENT' ? 'info' : 'success'}>
                    {passenger.passengerType === 'STUDENT' ? 'Student' : 'Faculty'}
                  </Pill>
                </View>
              ))}
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryGrid: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  help: { color: colors.muted, lineHeight: 20 },
  stopChoices: { gap: spacing.sm },
  stopChoice: {
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
  stopChoiceSelected: { borderColor: colors.teal, backgroundColor: colors.mint },
  stopChoicePassed: { opacity: 0.55 },
  stopChoiceText: { flex: 1, color: colors.navy, fontWeight: '700' },
  stopChoiceTextSelected: { color: colors.tealDark },
  stopTime: { color: colors.muted, fontWeight: '700' },
  timelineRow: { minHeight: 58, flexDirection: 'row', gap: spacing.sm },
  timelineRail: { width: 18, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.teal, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 3 },
  timelineContent: { flex: 1, paddingBottom: spacing.md },
  timelineName: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  timelineTime: { color: colors.muted, marginTop: 3 },
  rosterStop: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
  rosterStopName: { color: colors.navy, fontWeight: '800' },
  passengerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  passengerName: { flex: 1, color: colors.text },
});
