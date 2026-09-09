import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Socket } from 'socket.io-client';

import { AppHeader, Button, Card, EmptyState, ErrorState, LabelValue, LoadingState, Notice, Pill, Screen, SectionTitle } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { clearDriverToken, getDriverToken } from '@/lib/auth';
import { flushDriverLocationQueue, getBackgroundLocationStatus, startBackgroundDriverLocation, stopBackgroundDriverLocation } from '@/lib/backgroundLocation';
import { createLiveSocket } from '@/lib/socket';
import { DriverProfile, DriverTrip } from '@/types/api';

type TripResponse = { trip: DriverTrip | null };
type StartResponse = { tripId: number; resumed: boolean; routeNo: string };
type LocationAck = { ok: boolean; stored?: boolean; error?: string; timestamp?: string };

export default function DriverConsoleScreen() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [sharing, setSharing] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'background' | 'foreground' | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState({ queued: 0, dropped: 0 });
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const socket = useRef<Socket | null>(null);

  useEffect(() => { getDriverToken().then((stored) => { setToken(stored); if (!stored) router.replace('/driver/login'); }); }, []);

  const profile = useQuery({
    queryKey: ['driver-profile', token],
    queryFn: () => apiRequest<DriverProfile>('/auth/me', { token }),
    enabled: Boolean(token),
    retry: false,
  });
  const activeTrip = useQuery({
    queryKey: ['driver-active-trip', token],
    queryFn: () => apiRequest<TripResponse>('/trips/mine', { token }),
    enabled: Boolean(token),
    refetchInterval: 20_000,
  });

  const stopSharing = useCallback(async (clearQueue = false) => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    socket.current?.disconnect();
    socket.current = null;
    await stopBackgroundDriverLocation({ clearQueue }).catch(() => undefined);
    setSharing(false);
    setTrackingMode(null);
  }, []);

  useEffect(() => () => { void stopSharing(); }, [stopSharing]);
  useEffect(() => {
    if (!token) return undefined;
    const refresh = () => getBackgroundLocationStatus().then((status) => {
      setQueueStatus({ queued: status.queued, dropped: status.dropped });
      if (status.started) { setSharing(true); setTrackingMode('background'); }
    });
    void refresh();
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, [token]);
  useEffect(() => {
    if (activeTrip.isSuccess && !activeTrip.data.trip) void stopSharing(true);
  }, [activeTrip.isSuccess, activeTrip.data?.trip, stopSharing]);
  useEffect(() => {
    if (profile.error && 'status' in profile.error && profile.error.status === 401) {
      clearDriverToken().finally(() => router.replace('/driver/login'));
    }
  }, [profile.error]);

  const startTrip = useMutation({
    mutationFn: () => apiRequest<StartResponse>('/trips/start', { method: 'POST', token, body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] }),
  });
  const endTrip = useMutation({
    mutationFn: async (tripId: number) => {
      await flushDriverLocationQueue().catch(() => undefined);
      await stopSharing(true);
      return apiRequest('/trips/' + tripId + '/end', { method: 'POST', token });
    },
    onSuccess: () => { setLocationMessage(null); queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] }); },
  });

  const startForegroundFallback = async (trip: DriverTrip, driverToken: string) => {
    const liveSocket = createLiveSocket(driverToken);
    socket.current = liveSocket;
    liveSocket.connect();
    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 5_000, distanceInterval: 20 },
      (location) => liveSocket.emit('driver:location', {
        tripId: trip.id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        deviceTimestamp: new Date(location.timestamp).toISOString(),
        accuracyMeters: location.coords.accuracy ?? undefined,
        deviceSpeedKmh: location.coords.speed == null || location.coords.speed < 0 ? undefined : location.coords.speed * 3.6,
      }, (ack: LocationAck) => setLocationMessage(ack?.ok || ack?.stored
        ? 'Last GPS update sent at ' + new Date(ack.timestamp || Date.now()).toLocaleTimeString()
        : ack?.error || 'The server rejected this GPS update.'))
    );
    setTrackingMode('foreground');
    setSharing(true);
  };

  const beginLocationSharing = async () => {
    const trip = activeTrip.data?.trip;
    if (!trip || !token || sharing) return;
    setLocationMessage(null);
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      setLocationMessage('Location permission was denied. Open phone settings and allow precise location.');
      return;
    }

    if (Platform.OS !== 'web') {
      const proceed = await new Promise<boolean>((resolve) => Alert.alert(
        'Allow background location',
        'During a running trip, a persistent notification shows that this bus device is sharing location. Tracking stops when you pause or end the trip.',
        [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Continue', onPress: () => resolve(true) }],
        { cancelable: false }
      ));
      if (!proceed) return;
      const background = await Location.requestBackgroundPermissionsAsync();
      if (background.status === 'granted') {
        try {
          await startBackgroundDriverLocation(trip.id);
          const flushed = await flushDriverLocationQueue();
          setQueueStatus({ queued: flushed.queued, dropped: flushed.dropped });
          setTrackingMode('background');
          setSharing(true);
          setLocationMessage('Background GPS is active. You may lock the phone; keep the persistent trip notification enabled.');
          return;
        } catch (error) {
          setLocationMessage(error instanceof Error ? error.message : 'Background GPS could not start. Using foreground mode.');
        }
      } else {
        setLocationMessage('Background permission was not granted. GPS works only while this screen remains open.');
      }
    }

    try { await startForegroundFallback(trip, token); }
    catch (error) { setLocationMessage(error instanceof Error ? error.message : 'Could not start location sharing.'); }
  };

  const logout = async () => {
    await stopSharing(true);
    await clearDriverToken();
    queryClient.removeQueries({ queryKey: ['driver-profile'] });
    queryClient.removeQueries({ queryKey: ['driver-active-trip'] });
    router.replace('/');
  };

  if (token === undefined || profile.isPending) return <Screen><LoadingState label="Checking driver session..." /></Screen>;
  if (!token) return null;
  if (profile.isError) return <Screen><ErrorState message={profile.error.message} retry={() => profile.refetch()} /></Screen>;

  const driver = profile.data;
  const trip = activeTrip.data?.trip || null;
  return <Screen>
    <AppHeader eyebrow="Driver console" title={'Hello, ' + driver.name}
      subtitle={driver.assignedRoute ? 'Assigned to Route ' + driver.assignedRoute.routeNo : 'No route is currently assigned'}
      action={<Pill tone={trip ? 'success' : 'neutral'}>{trip ? 'Trip running' : 'Off trip'}</Pill>} />

    <Card><SectionTitle>Assignment</SectionTitle>{driver.assignedRoute ? <>
      <LabelValue label="Route" value={driver.assignedRoute.routeNo + ' - ' + driver.assignedRoute.name} />
      <LabelValue label="Area" value={driver.assignedRoute.areaCovered} />
      <LabelValue label="Capacity" value={driver.assignedRoute.capacity} />
    </> : <EmptyState title="No route assigned" message="Ask the transport administrator to assign this driver before starting a trip." />}</Card>

    {activeTrip.isError ? <Notice tone="danger" title="Trip status unavailable" message={activeTrip.error.message} /> : null}
    {!trip ? <Card><SectionTitle>Start morning trip</SectionTitle>
      <Text style={styles.help}>Starting creates the official trip record. GPS starts only after you explicitly approve location sharing.</Text>
      {startTrip.isError ? <Notice tone="danger" title="Could not start trip" message={startTrip.error.message} /> : null}
      <Button label="Start trip" onPress={() => startTrip.mutate()} loading={startTrip.isPending} disabled={!driver.assignedRoute} />
    </Card> : <Card>
      <View style={styles.row}><SectionTitle>Live trip</SectionTitle><Pill tone={sharing ? 'success' : 'warning'}>{sharing ? (trackingMode === 'background' ? 'Background GPS' : 'Foreground GPS') : 'GPS paused'}</Pill></View>
      <LabelValue label="Route" value={trip.routeService.routeNo + ' - ' + trip.routeService.name} />
      <LabelValue label="Started" value={new Date(trip.startTime).toLocaleTimeString()} />
      <LabelValue label="Progress" value={trip.currentStopIndex + ' of ' + trip.scheduleVersion.stops.length + ' stops reached'} />
      {locationMessage ? <Notice tone={sharing ? 'success' : 'warning'} title={sharing ? 'Location service' : 'Location not sharing'} message={locationMessage} /> : null}
      {sharing ? <Button label="Pause GPS sharing" variant="secondary" onPress={() => { void stopSharing(); }} /> : <Button label="Share live GPS" onPress={beginLocationSharing} />}
      <Notice tone={queueStatus.queued ? 'warning' : 'info'} title={queueStatus.queued ? queueStatus.queued + ' GPS updates waiting' : 'Offline queue ready'}
        message={'At most 200 unsent samples are retained and retried in order. ' + (queueStatus.dropped ? queueStatus.dropped + ' oldest samples were dropped after the safety limit.' : 'No samples have been dropped.')} />
      {endTrip.isError ? <Notice tone="danger" title="Could not end trip" message={endTrip.error.message} /> : null}
      <Button label="End trip" variant="danger" onPress={() => endTrip.mutate(trip.id)} loading={endTrip.isPending} />
    </Card>}
    <Button label="Log out" variant="ghost" onPress={logout} />
  </Screen>;
}

const styles = StyleSheet.create({
  help: { color: colors.muted, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
