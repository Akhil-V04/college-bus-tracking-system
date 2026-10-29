import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { Socket } from 'socket.io-client';

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
import { fontWeight, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { apiRequest } from '@/lib/api';
import { clearDriverToken, getDriverToken } from '@/lib/auth';
import {
  flushDriverLocationQueue,
  getBackgroundLocationStatus,
  startBackgroundDriverLocation,
  stopBackgroundDriverLocation,
} from '@/lib/backgroundLocation';
import { createLiveSocket } from '@/lib/socket';
import {
  BreakdownAlertPayload,
  DriverProfile,
  DriverTrip,
  NearbyBus,
  NearbyBusesResponse,
} from '@/types/api';

type TripResponse = { trip: DriverTrip | null };
type StartResponse = { tripId: number; resumed: boolean; routeNo: string };
type LocationAck = { ok: boolean; stored?: boolean; error?: string; timestamp?: string };

export default function DriverConsoleScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [selectedDirection, setSelectedDirection] = useState<'TO_COLLEGE' | 'FROM_COLLEGE'>('TO_COLLEGE');
  const [sharing, setSharing] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'background' | 'foreground' | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState({ queued: 0, dropped: 0 });
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const socket = useRef<Socket | null>(null);

  // Incoming Breakdown Alert (Received from other nearby driver)
  const [incomingAlert, setIncomingAlert] = useState<BreakdownAlertPayload | null>(null);
  const alertSocketRef = useRef<Socket | null>(null);

  // Bus Breakdown Reporting State
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyBuses, setNearbyBuses] = useState<NearbyBus[]>([]);
  const [breakdownReason, setBreakdownReason] = useState('Engine breakdown - stopped on road');
  const [submittingBreakdown, setSubmittingBreakdown] = useState(false);
  const [breakdownReported, setBreakdownReported] = useState(false);
  const [reportedInfo, setReportedInfo] = useState<{ count: number; routeNo: string } | null>(null);

  useEffect(() => {
    getDriverToken().then((stored) => {
      setToken(stored);
      if (!stored) router.replace('/driver/login');
    });
  }, []);

  // Dedicated socket connection to receive incoming breakdown notifications from other drivers
  useEffect(() => {
    if (!token) return undefined;
    const alertSocket = createLiveSocket(token);
    alertSocketRef.current = alertSocket;
    alertSocket.connect();

    alertSocket.on('driver:breakdown_alert', (payload: BreakdownAlertPayload) => {
      setIncomingAlert(payload);
      if (Platform.OS !== 'web') {
        try {
          Vibration.vibrate([0, 500, 200, 500]);
        } catch {
          // ignore
        }
      }
    });

    return () => {
      alertSocket.disconnect();
      alertSocketRef.current = null;
    };
  }, [token]);

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
    const refresh = () =>
      getBackgroundLocationStatus().then((status) => {
        setQueueStatus({ queued: status.queued, dropped: status.dropped });
        if (status.started) { setSharing(true); setTrackingMode('background'); }
      });
    void refresh();
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, [token]);

  useEffect(() => {
    if (activeTrip.isSuccess && !activeTrip.data.trip) {
      void stopSharing(true);
      setBreakdownReported(false);
      setReportedInfo(null);
    }
  }, [activeTrip.isSuccess, activeTrip.data?.trip, stopSharing]);

  useEffect(() => {
    if (profile.error && 'status' in profile.error && profile.error.status === 401) {
      clearDriverToken().finally(() => router.replace('/driver/login'));
    }
  }, [profile.error]);

  const startTrip = useMutation({
    mutationFn: (direction?: 'TO_COLLEGE' | 'FROM_COLLEGE') =>
      apiRequest<StartResponse>('/trips/start', {
        method: 'POST',
        token,
        body: JSON.stringify({ tripDirection: direction || selectedDirection }),
      }),
    onSuccess: () => {
      setBreakdownReported(false);
      setReportedInfo(null);
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] });
    },
  });

  const endTrip = useMutation({
    mutationFn: async (tripId: number) => {
      await flushDriverLocationQueue().catch(() => undefined);
      await stopSharing(true);
      return apiRequest('/trips/' + tripId + '/end', { method: 'POST', token });
    },
    onSuccess: () => {
      setLocationMessage(null);
      setBreakdownReported(false);
      setReportedInfo(null);
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] });
    },
  });

  const startForegroundFallback = async (trip: DriverTrip, driverToken: string) => {
    const liveSocket = createLiveSocket(driverToken);
    socket.current = liveSocket;
    liveSocket.connect();
    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 5_000, distanceInterval: 20 },
      (location) =>
        liveSocket.emit(
          'driver:location',
          {
            tripId: trip.id,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            deviceTimestamp: new Date(location.timestamp).toISOString(),
            accuracyMeters: location.coords.accuracy ?? undefined,
            deviceSpeedKmh:
              location.coords.speed == null || location.coords.speed < 0
                ? undefined
                : location.coords.speed * 3.6,
          },
          (ack: LocationAck) =>
            setLocationMessage(
              ack?.ok || ack?.stored
                ? 'Last GPS update sent at ' + new Date(ack.timestamp || Date.now()).toLocaleTimeString()
                : ack?.error || 'The server rejected this GPS update.'
            )
        )
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
      const proceed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          'Allow background location',
          'During a running trip, a persistent notification shows that this bus device is sharing location. Tracking stops when you pause or end the trip.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) },
          ],
          { cancelable: false }
        )
      );
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

    try {
      await startForegroundFallback(trip, token);
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Could not start location sharing.');
    }
  };

  // Fetch nearby buses (max 3 only)
  const fetchNearbyBuses = async (tripId: number) => {
    setLoadingNearby(true);
    try {
      const res = await apiRequest<NearbyBusesResponse>(`/emergencies/nearby-buses?tripId=${tripId}`, {
        token,
      });
      setNearbyBuses(res.nearbyBuses || []);
    } catch {
      setNearbyBuses([]);
    } finally {
      setLoadingNearby(false);
    }
  };

  const handleOpenBreakdownModal = () => {
    const trip = activeTrip.data?.trip;
    if (!trip) return;
    setBreakdownModalOpen(true);
    void fetchNearbyBuses(trip.id);
  };

  const handleSubmitBreakdown = async () => {
    const trip = activeTrip.data?.trip;
    if (!trip || !token) return;
    setSubmittingBreakdown(true);
    try {
      const res = await apiRequest<{ success: boolean; notifiedBuses: any[]; message: string }>(
        '/emergencies/driver/breakdown',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            tripId: trip.id,
            description: breakdownReason,
          }),
        }
      );
      setBreakdownReported(true);
      setReportedInfo({
        count: res.notifiedBuses?.length || 0,
        routeNo: trip.routeService.routeNo,
      });
      setBreakdownModalOpen(false);
      Alert.alert(
        '🚨 Breakdown Alert Broadcasted!',
        `Your breakdown was reported. The ${res.notifiedBuses?.length || 0} nearest buses and Transport Admin have received immediate notification with your coordinates.`
      );
    } catch (err: any) {
      Alert.alert('Could Not Report Breakdown', err?.message || 'An error occurred while reporting breakdown.');
    } finally {
      setSubmittingBreakdown(false);
    }
  };

  const logout = async () => {
    await stopSharing(true);
    await clearDriverToken();
    queryClient.removeQueries({ queryKey: ['driver-profile'] });
    queryClient.removeQueries({ queryKey: ['driver-active-trip'] });
    router.replace('/');
  };

  if (token === undefined || profile.isPending) {
    return <Screen><LoadingState label="Checking driver session..." /></Screen>;
  }
  if (!token) return null;
  if (profile.isError) {
    return <Screen><ErrorState message={profile.error.message} retry={() => profile.refetch()} /></Screen>;
  }

  const driver = profile.data;
  const trip = activeTrip.data?.trip || null;
  const isReturnTrip = trip?.tripDirection === 'FROM_COLLEGE' || trip?.scheduleSnapshot?.tripDirection === 'FROM_COLLEGE';

  return (
    <Screen>
      <AppHeader
        eyebrow="Driver console"
        title={'Hello, ' + driver.name}
        subtitle={driver.assignedRoute ? 'Assigned to Route ' + driver.assignedRoute.routeNo : 'No route is currently assigned'}
        action={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pill tone={trip ? 'success' : 'neutral'}>{trip ? 'Trip running' : 'Off trip'}</Pill>
          </View>
        }
      />

      <Card>
        <SectionTitle>Assignment</SectionTitle>
        {driver.assignedRoute ? (
          <>
            <LabelValue label="Route" value={driver.assignedRoute.routeNo + ' – ' + driver.assignedRoute.name} />
            <LabelValue label="Area" value={driver.assignedRoute.areaCovered} />
            <LabelValue label="Capacity" value={String(driver.assignedRoute.capacity)} />
          </>
        ) : (
          <EmptyState title="No route assigned" message="Ask the transport administrator to assign this driver before starting a trip." />
        )}
      </Card>

      {activeTrip.isError && <Notice tone="danger" title="Trip status unavailable" message={activeTrip.error.message} />}

      {!trip ? (
        <Card>
          <SectionTitle>Start Trip</SectionTitle>
          <Text style={styles.help}>
            Select your trip direction. Forward trips pick up students towards VBIT College. Return trips depart from VBIT and drop off students in reverse sequence with dynamic live ETAs.
          </Text>

          {/* Direction Selector */}
          <View style={{ flexDirection: 'row', gap: 10, marginVertical: 12 }}>
            <Pressable
              onPress={() => setSelectedDirection('TO_COLLEGE')}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: selectedDirection === 'TO_COLLEGE' ? '#EA580C' : '#334155',
                backgroundColor: selectedDirection === 'TO_COLLEGE' ? 'rgba(234, 88, 12, 0.15)' : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 22 }}>🎓</Text>
              <Text style={{ fontWeight: '700', color: selectedDirection === 'TO_COLLEGE' ? '#EA580C' : '#94a3b8', fontSize: 13, marginTop: 4 }}>
                To College
              </Text>
              <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 2 }}>
                City Stops &rarr; VBIT
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedDirection('FROM_COLLEGE')}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: selectedDirection === 'FROM_COLLEGE' ? '#EA580C' : '#334155',
                backgroundColor: selectedDirection === 'FROM_COLLEGE' ? 'rgba(234, 88, 12, 0.15)' : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 22 }}>🏠</Text>
              <Text style={{ fontWeight: '700', color: selectedDirection === 'FROM_COLLEGE' ? '#EA580C' : '#94a3b8', fontSize: 13, marginTop: 4 }}>
                Return from College
              </Text>
              <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 2 }}>
                VBIT &rarr; Reverse Drops
              </Text>
            </Pressable>
          </View>

          {startTrip.isError && <Notice tone="danger" title="Could not start trip" message={startTrip.error.message} />}
          <Button
            label={selectedDirection === 'FROM_COLLEGE' ? 'Start Return Trip from VBIT' : 'Start Trip to College'}
            onPress={() => startTrip.mutate(selectedDirection)}
            loading={startTrip.isPending}
            disabled={!driver.assignedRoute}
            size="lg"
          />
        </Card>
      ) : (
        <Card>
          <View style={styles.row}>
            <SectionTitle>
              {isReturnTrip ? 'Live Return Trip 🏠' : 'Live Trip to College 🎓'}
            </SectionTitle>
            <Pill tone={sharing ? 'success' : 'warning'}>
              {sharing ? (trackingMode === 'background' ? 'Background GPS' : 'Foreground GPS') : 'GPS paused'}
            </Pill>
          </View>
          <LabelValue label="Route" value={trip.routeService.routeNo + ' – ' + trip.routeService.name} />
          <LabelValue label="Started" value={new Date(trip.startTime).toLocaleTimeString()} />
          <LabelValue
            label="Direction"
            value={isReturnTrip ? 'Return from VBIT (Reverse Drops with Dynamic ETAs)' : 'Inbound to VBIT Campus'}
          />
          <LabelValue
            label="Progress"
            value={trip.currentStopIndex + ' of ' + (trip.scheduleSnapshot?.stops?.length || trip.scheduleVersion.stops.length) + ' stops reached'}
          />

          {locationMessage && (
            <Notice
              tone={sharing ? 'success' : 'warning'}
              title={sharing ? 'Location service' : 'Location not sharing'}
              message={locationMessage}
            />
          )}

          {sharing ? (
            <Button label="Pause GPS sharing" variant="secondary" onPress={() => { void stopSharing(); }} />
          ) : (
            <Button label="Share live GPS" onPress={beginLocationSharing} size="lg" />
          )}

          {/* ─── Breakdown Reporting Section ("only when trip is running & live GPS is sharing") ─── */}
          <View style={styles.breakdownSection}>
            {breakdownReported ? (
              <View style={styles.breakdownAlertActiveBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 22 }}>🚨</Text>
                  <Text style={styles.breakdownAlertActiveTitle}>
                    BUS BREAKDOWN BROADCASTED
                  </Text>
                </View>
                <Text style={styles.breakdownAlertActiveText}>
                  Route {reportedInfo?.routeNo || trip.routeService.routeNo} is reported broken down & stopped.
                  {reportedInfo?.count
                    ? ` Immediate notification was sent to ${reportedInfo.count} nearest route bus(es) and Transport Admin.`
                    : ' Transport Admin has been alerted immediately.'}
                </Text>
              </View>
            ) : (
              <>
                {sharing ? (
                  <View>
                    <Text style={styles.breakdownInfoText}>
                      Emergency breakdown? Send immediate proximity alert to the nearest 3 running buses and Transport Control:
                    </Text>
                    <Pressable
                      onPress={handleOpenBreakdownModal}
                      style={({ pressed }) => [
                        styles.breakdownButton,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={{ fontSize: 18 }}>🚨</Text>
                      <Text style={styles.breakdownButtonText}>Report Bus Breakdown</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.breakdownDisabledBox}>
                    <Text style={styles.breakdownDisabledText}>
                      ℹ️ <Text style={{ fontWeight: '700', color: colors.text }}>Breakdown Alert Disabled:</Text> Start live GPS sharing above to enable breakdown reporting and automatically locate the nearest 3 buses.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          <Notice
            tone={queueStatus.queued ? 'warning' : 'info'}
            title={queueStatus.queued ? queueStatus.queued + ' GPS updates waiting' : 'Offline queue ready'}
            message={'At most 200 unsent samples are retained and retried in order. ' + (queueStatus.dropped ? queueStatus.dropped + ' oldest samples were dropped.' : 'No samples have been dropped.')}
          />

          {endTrip.isError && <Notice tone="danger" title="Could not end trip" message={endTrip.error.message} />}
          <Button label="End trip" variant="danger" onPress={() => endTrip.mutate(trip.id)} loading={endTrip.isPending} />
        </Card>
      )}

      <Button label="Log out" variant="ghost" onPress={logout} />

      {/* ─── MODAL 1: REPORT BUS BREAKDOWN (For Current Driver) ─── */}
      <Modal visible={breakdownModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 22 }}>🚨</Text>
                <Text style={styles.modalTitle}>Report Bus Breakdown</Text>
              </View>
              <Pressable onPress={() => setBreakdownModalOpen(false)} hitSlop={10}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                This broadcasts an emergency breakdown notification with your exact live GPS location to the nearest 3 active route buses and the Transport Admin Panel.
              </Text>

              {/* Nearest 3 Buses Section */}
              <Text style={styles.sectionHeader}>NEAREST RUNNING BUSES (MAX 3)</Text>
              {loadingNearby ? (
                <View style={styles.nearbyLoadingBox}>
                  <ActivityIndicator color="#EA580C" />
                  <Text style={styles.nearbyLoadingText}>Scanning active fleet for nearest 3 buses...</Text>
                </View>
              ) : nearbyBuses.length > 0 ? (
                <View style={{ gap: 8, marginVertical: 8 }}>
                  {nearbyBuses.map((bus) => (
                    <View key={bus.tripId} style={styles.nearbyBusCard}>
                      <View style={styles.nearbyBusHeader}>
                        <View style={styles.routeBadge}>
                          <Text style={styles.routeBadgeText}>Route {bus.routeNo}</Text>
                        </View>
                        <Text style={styles.distanceBadge}>📍 {bus.distanceKm} km away</Text>
                      </View>
                      <Text style={styles.nearbyRouteName}>{bus.routeName}</Text>
                      <Text style={styles.nearbyDriverInfo}>Driver: {bus.driverName} • {bus.driverPhone}</Text>
                    </View>
                  ))}
                  <Text style={styles.nearbyNote}>
                    ✓ Only these {nearbyBuses.length} nearest driver(s) and Transport Admin will receive your breakdown alert.
                  </Text>
                </View>
              ) : (
                <View style={styles.noNearbyBox}>
                  <Text style={{ fontSize: 20 }}>📡</Text>
                  <Text style={styles.noNearbyText}>
                    No other active buses are currently sharing live GPS nearby. Your breakdown alert will be sent directly to the Transport Admin Panel.
                  </Text>
                </View>
              )}

              {/* Breakdown Reason Selector */}
              <Text style={[styles.sectionHeader, { marginTop: 14 }]}>BREAKDOWN REASON / DESCRIPTION</Text>
              <View style={styles.presetPillsRow}>
                {[
                  'Engine stopped on road',
                  'Puncture / Flat tyre',
                  'Mechanical / Brake issue',
                  'Battery / Electrical failure',
                ].map((reason) => (
                  <Pressable
                    key={reason}
                    onPress={() => setBreakdownReason(reason)}
                    style={[
                      styles.presetPill,
                      breakdownReason === reason && styles.presetPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetPillText,
                        breakdownReason === reason && styles.presetPillTextActive,
                      ]}
                    >
                      {reason}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={breakdownReason}
                onChangeText={setBreakdownReason}
                placeholder="Add details, landmark, or notes..."
                placeholderTextColor="#64748b"
                style={styles.reasonInput}
                multiline
              />

              <View style={{ marginTop: 20, gap: 10, paddingBottom: 16 }}>
                <Pressable
                  onPress={handleSubmitBreakdown}
                  disabled={submittingBreakdown}
                  style={[
                    styles.submitBreakdownBtn,
                    submittingBreakdown && { opacity: 0.6 },
                  ]}
                >
                  {submittingBreakdown ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={{ fontSize: 16 }}>🚨</Text>
                      <Text style={styles.submitBreakdownBtnText}>
                        Broadcast Breakdown Alert ({nearbyBuses.length || 0} Buses & Admin)
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setBreakdownModalOpen(false)}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: INCOMING BREAKDOWN ALERT (Received from other nearby driver) ─── */}
      <Modal visible={Boolean(incomingAlert)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: '#EF4444', borderWidth: 2 }]}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}>
                <Text style={{ fontSize: 28 }}>🚨</Text>
              </View>
              <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
                NEARBY BUS BREAKDOWN ALERT!
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                A campus bus has broken down and stopped near you!
              </Text>
            </View>

            {incomingAlert && (
              <View style={styles.alertDetailBox}>
                <View style={styles.alertDetailRow}>
                  <Text style={styles.alertDetailLabel}>BROKEN DOWN BUS:</Text>
                  <Text style={styles.alertDetailValue}>Route {incomingAlert.brokenDownRouteNo} ({incomingAlert.brokenDownRouteName})</Text>
                </View>
                <View style={styles.alertDetailRow}>
                  <Text style={styles.alertDetailLabel}>DISTANCE TO YOU:</Text>
                  <Text style={[styles.alertDetailValue, { color: '#EF4444', fontWeight: '800' }]}>
                    ~{incomingAlert.distanceKm} km away
                  </Text>
                </View>
                <View style={styles.alertDetailRow}>
                  <Text style={styles.alertDetailLabel}>DRIVER IN CHARGE:</Text>
                  <Text style={styles.alertDetailValue}>
                    {incomingAlert.brokenDownDriverName} ({incomingAlert.brokenDownDriverPhone})
                  </Text>
                </View>
                <View style={styles.alertDetailRow}>
                  <Text style={styles.alertDetailLabel}>DETAILS:</Text>
                  <Text style={[styles.alertDetailValue, { fontStyle: 'italic' }]}>
                    &quot;{incomingAlert.description}&quot;
                  </Text>
                </View>

                <Text style={{ fontSize: 12, color: '#f59e0b', marginTop: 10, lineHeight: 17 }}>
                  💡 Notice: If your route passes this location and you have spare capacity, please coordinate to assist stranded students.
                </Text>
              </View>
            )}

            <View style={{ marginTop: 16, gap: 10 }}>
              {incomingAlert?.brokenDownDriverPhone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${incomingAlert.brokenDownDriverPhone}`)}
                  style={styles.callDriverBtn}
                >
                  <Text style={{ fontSize: 16 }}>📞</Text>
                  <Text style={styles.callDriverBtnText}>
                    Call Driver ({incomingAlert.brokenDownDriverPhone})
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => setIncomingAlert(null)}
                style={styles.acknowledgeBtn}
              >
                <Text style={styles.acknowledgeBtnText}>Acknowledge Alert & Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
    help: { color: colors.textSecondary, lineHeight: 21 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    breakdownSection: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    breakdownInfoText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 8,
      lineHeight: 18,
    },
    breakdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#DC2626',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: radius.md,
      gap: 8,
      shadowColor: '#DC2626',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 4,
    },
    breakdownButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    breakdownDisabledBox: {
      backgroundColor: 'rgba(234, 88, 12, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(234, 88, 12, 0.25)',
      borderRadius: radius.md,
      padding: 12,
    },
    breakdownDisabledText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    breakdownAlertActiveBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderWidth: 1,
      borderColor: '#EF4444',
      borderRadius: radius.md,
      padding: 14,
    },
    breakdownAlertActiveTitle: {
      color: '#EF4444',
      fontWeight: '800',
      fontSize: 15,
    },
    breakdownAlertActiveText: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 4,
      lineHeight: 18,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surfaceElevated || '#1e293b',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    modalClose: {
      fontSize: 18,
      color: colors.textSecondary,
      fontWeight: '700',
      padding: 4,
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 14,
    },
    sectionHeader: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    nearbyLoadingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 16,
      backgroundColor: colors.surface || 'rgba(15, 23, 42, 0.6)',
      borderRadius: radius.md,
    },
    nearbyLoadingText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    nearbyBusCard: {
      backgroundColor: colors.surface || 'rgba(15, 23, 42, 0.6)',
      padding: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nearbyBusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    routeBadge: {
      backgroundColor: 'rgba(234, 88, 12, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(234, 88, 12, 0.4)',
    },
    routeBadgeText: {
      color: '#EA580C',
      fontSize: 12,
      fontWeight: '700',
    },
    distanceBadge: {
      color: '#f59e0b',
      fontSize: 12,
      fontWeight: '700',
    },
    nearbyRouteName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginTop: 2,
    },
    nearbyDriverInfo: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    nearbyNote: {
      fontSize: 11,
      color: '#10B981',
      fontWeight: '600',
      marginTop: 2,
    },
    noNearbyBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      backgroundColor: colors.surface || 'rgba(15, 23, 42, 0.6)',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noNearbyText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    presetPillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    presetPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface || 'transparent',
    },
    presetPillActive: {
      borderColor: '#EA580C',
      backgroundColor: 'rgba(234, 88, 12, 0.15)',
    },
    presetPillText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    presetPillTextActive: {
      color: '#EA580C',
      fontWeight: '700',
    },
    reasonInput: {
      backgroundColor: colors.surface || 'rgba(15, 23, 42, 0.6)',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: 10,
      color: colors.text,
      fontSize: 13,
      minHeight: 56,
      textAlignVertical: 'top',
    },
    submitBreakdownBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#DC2626',
      paddingVertical: 14,
      borderRadius: radius.md,
      gap: 8,
    },
    submitBreakdownBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    alertDetailBox: {
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      borderRadius: radius.md,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      gap: 6,
    },
    alertDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    alertDetailLabel: {
      fontSize: 11,
      color: '#94a3b8',
      fontWeight: '700',
    },
    alertDetailValue: {
      fontSize: 12,
      color: '#f8fafc',
      fontWeight: '600',
      maxWidth: '65%',
      textAlign: 'right',
    },
    callDriverBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#10B981',
      paddingVertical: 12,
      borderRadius: radius.md,
      gap: 8,
    },
    callDriverBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    acknowledgeBtn: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: colors.surface || '#334155',
    },
    acknowledgeBtnText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
  }), [colors]);
};
