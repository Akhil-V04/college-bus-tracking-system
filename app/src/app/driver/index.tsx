import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Socket } from 'socket.io-client';

import CampusMap, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/map/CampusMap';
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
import { decodePolyline } from '@/lib/polyline';
import { createLiveSocket } from '@/lib/socket';
import {
  BreakdownAlertPayload,
  DriverProfile,
  DriverTrip,
  NearbyBus,
  NearbyBusesResponse,
} from '@/types/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_COLLAPSED_HEIGHT = 280;
const SHEET_EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.72);
const ORANGE_ACCENT = '#EA580C';

type TripResponse = { trip: DriverTrip | null };
type StartResponse = { tripId: number; resumed: boolean; routeNo: string };
type LocationAck = { ok: boolean; stored?: boolean; error?: string; timestamp?: string };

export default function DriverConsoleScreen() {
  const { colors, isDark } = useTheme();
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

  // Exact immediate driver coordinates for live map rendering without 15s lag
  const [driverCurrentCoords, setDriverCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

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

  // Timeline Bottom Sheet Animation & Drag Handlers
  const mapRef = useRef<any>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetHeightAnim = useRef(new Animated.Value(SHEET_COLLAPSED_HEIGHT)).current;

  const toggleSheet = () => {
    const toValue = sheetExpanded ? SHEET_COLLAPSED_HEIGHT : SHEET_EXPANDED_HEIGHT;
    Animated.spring(sheetHeightAnim, {
      toValue,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
    setSheetExpanded(!sheetExpanded);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 12,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -40) {
            Animated.spring(sheetHeightAnim, {
              toValue: SHEET_EXPANDED_HEIGHT,
              friction: 8,
              tension: 40,
              useNativeDriver: false,
            }).start();
            setSheetExpanded(true);
          } else if (gesture.dy > 40) {
            Animated.spring(sheetHeightAnim, {
              toValue: SHEET_COLLAPSED_HEIGHT,
              friction: 8,
              tension: 40,
              useNativeDriver: false,
            }).start();
            setSheetExpanded(false);
          }
        },
      }),
    [sheetHeightAnim]
  );

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

  const trip = activeTrip.data?.trip || null;
  const isReturnTrip =
    trip?.tripDirection === 'FROM_COLLEGE' ||
    trip?.scheduleSnapshot?.direction === 'FROM_COLLEGE';

  // Extract stops from trip
  const stops = useMemo(() => {
    if (!trip) return [];
    if (
      trip.scheduleSnapshot &&
      Array.isArray(trip.scheduleSnapshot.stops) &&
      trip.scheduleSnapshot.stops.length
    ) {
      return trip.scheduleSnapshot.stops.map((s: any) => ({
        id: s.scheduleStopId || s.stopId,
        stopId: s.stopId,
        sequenceOrder: s.sequenceOrder,
        scheduledTime: s.scheduledTime,
        stop: {
          id: s.stopId,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
        },
      }));
    }
    return (trip.scheduleVersion?.stops || []).map((s) => ({
      id: s.id,
      stopId: s.stop.id,
      sequenceOrder: s.sequenceOrder,
      scheduledTime: s.scheduledTime,
      stop: s.stop,
    }));
  }, [trip]);

  // Decode route polyline
  const polylineCoordinates = useMemo(() => {
    if (!trip) return [];
    const rawPolyline =
      trip.scheduleSnapshot?.geometryPolyline || trip.scheduleVersion?.geometryPolyline;
    if (rawPolyline) {
      const decoded = decodePolyline(rawPolyline);
      if (decoded.length > 0) return decoded;
    }
    return stops.map((s) => ({ latitude: s.stop.latitude, longitude: s.stop.longitude }));
  }, [trip, stops]);

  // Map initial region
  const initialRegion = useMemo(() => {
    if (driverCurrentCoords) {
      return {
        latitude: driverCurrentCoords.latitude,
        longitude: driverCurrentCoords.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      };
    }
    if (stops.length === 0) {
      return {
        latitude: 17.4334,
        longitude: 78.6837,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    const lats = stops.map((s) => s.stop.latitude);
    const lngs = stops.map((s) => s.stop.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.015, (maxLat - minLat) * 1.35),
      longitudeDelta: Math.max(0.015, (maxLng - minLng) * 1.35),
    };
  }, [stops, driverCurrentCoords]);

  // Continuous immediate location watcher for real-time driver map display
  useEffect(() => {
    if (!trip) return undefined;
    let subscription: Location.LocationSubscription | null = null;
    let mounted = true;

    // Immediately attempt to fetch initial position
    const fetchImmediatePos = async () => {
      try {
        const services = await Location.hasServicesEnabledAsync().catch(() => false);
        if (services) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          if (mounted && pos?.coords) {
            setDriverCurrentCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          }
        }
      } catch {}
    };
    void fetchImmediatePos();

    // High-frequency watcher for smooth map marker updates (2s polling)
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 3,
      },
      (loc) => {
        if (!mounted) return;
        setDriverCurrentCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    )
      .then((sub) => {
        if (mounted) subscription = sub;
        else sub.remove();
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [trip]);

  // Auto-detect when driver turns ON phone location and automatically start sharing & fetch position
  useEffect(() => {
    if (!trip) return undefined;

    const checkAndAutoStart = async () => {
      const servicesOn = await Location.hasServicesEnabledAsync().catch(() => false);
      if (servicesOn) {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          if (pos?.coords) {
            setDriverCurrentCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          }
        } catch {}

        if (!sharing) {
          void beginLocationSharing();
        }
      }
    };

    // AppState change (e.g. driver opened notification shade/quick settings, turned on GPS, and returned)
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkAndAutoStart();
      }
    });

    // Active polling while trip is running and GPS is paused or coords missing
    let pollInterval: any = null;
    if (!sharing || !driverCurrentCoords) {
      pollInterval = setInterval(checkAndAutoStart, 3000);
    }

    return () => {
      appStateSub.remove();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [trip, sharing, driverCurrentCoords]);

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
    onSuccess: async () => {
      setBreakdownReported(false);
      setReportedInfo(null);
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] });

      // Immediately fetch current position
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (pos?.coords) {
          setDriverCurrentCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch {}

      // Automatically start live GPS sharing
      setTimeout(() => {
        void beginLocationSharing();
      }, 400);
    },
    onError: (err: any) => {
      Alert.alert('Could Not Start Trip', err?.message || 'Failed to start trip. Please try again.');
    },
  });

  const handleStartTrip = async () => {
    if (Platform.OS !== 'web') {
      const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
      if (!servicesEnabled) {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {}
        const recheck = await Location.hasServicesEnabledAsync().catch(() => false);
        if (!recheck) {
          Alert.alert(
            'Location Services Required',
            'Please turn ON your phone GPS / Location in Android Quick Settings before starting the trip. Live location is required for passengers to track this bus.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Turn On & Retry',
                onPress: () => {
                  void handleStartTrip();
                },
              },
            ]
          );
          return;
        }
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location permission in phone settings to start the trip.'
        );
        return;
      }
    }

    startTrip.mutate(selectedDirection);
  };

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
      setDriverCurrentCoords(null);
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] });
      Alert.alert('Trip Ended', 'The trip has been completed successfully.');
    },
    onError: (err: any) => {
      Alert.alert('Could Not End Trip', err?.message || 'Failed to complete trip. Please try again.');
    },
  });

  const startForegroundFallback = async (currentTrip: DriverTrip, driverToken: string) => {
    const liveSocket = createLiveSocket(driverToken);
    socket.current = liveSocket;
    liveSocket.connect();
    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 5_000, distanceInterval: 20 },
      (location) => {
        setDriverCurrentCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        liveSocket.emit(
          'driver:location',
          {
            tripId: currentTrip.id,
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
        );
      }
    );
    setTrackingMode('foreground');
    setSharing(true);
  };

  const beginLocationSharing = async () => {
    const currentTrip = activeTrip.data?.trip;
    if (!currentTrip || !token || sharing) return;
    setLocationMessage(null);

    // 1. Check if location services (GPS hardware switch) are enabled on device
    if (Platform.OS !== 'web') {
      const servicesOn = await Location.hasServicesEnabledAsync().catch(() => false);
      if (!servicesOn) {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {}
        const recheck = await Location.hasServicesEnabledAsync().catch(() => false);
        if (!recheck) {
          setLocationMessage('Location services are turned OFF. Please turn on phone GPS to share live location.');
          return;
        }
      }
    }

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      setLocationMessage('Location permission was denied. Open phone settings and allow precise location.');
      return;
    }

    // Immediately fetch location so driver position is shown right away
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (pos?.coords) {
        setDriverCurrentCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }
    } catch {}

    if (Platform.OS !== 'web') {
      // Check if background permission is already granted or was previously approved
      const bgPerm = await Location.getBackgroundPermissionsAsync();
      const alreadyAccepted = await AsyncStorage.getItem('bg_location_prompt_accepted');

      // Only show alert if NOT yet granted AND not previously accepted!
      if (bgPerm.status !== 'granted' && alreadyAccepted !== 'true') {
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
        await AsyncStorage.setItem('bg_location_prompt_accepted', 'true');
      }

      const background = await Location.requestBackgroundPermissionsAsync();
      if (background.status === 'granted') {
        await AsyncStorage.setItem('bg_location_prompt_accepted', 'true');
        try {
          await startBackgroundDriverLocation(currentTrip.id);
          const flushed = await flushDriverLocationQueue();
          setQueueStatus({ queued: flushed.queued, dropped: flushed.dropped });
          setTrackingMode('background');
          setSharing(true);
          setLocationMessage('Background GPS is active.');
          return;
        } catch (error) {
          setLocationMessage(error instanceof Error ? error.message : 'Background GPS could not start. Using foreground mode.');
        }
      } else {
        setLocationMessage('Background permission was not granted. GPS works only while screen is open.');
      }
    }

    try {
      await startForegroundFallback(currentTrip, token);
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Could not start location sharing.');
    }
  };

  // Focus map on a specific stop
  const focusOnStop = (stopItem: { stop: { latitude: number; longitude: number } }) => {
    mapRef.current?.animateToRegion(
      {
        latitude: stopItem.stop.latitude,
        longitude: stopItem.stop.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      600
    );
  };

  // Center map on driver's live bus
  const focusOnBus = () => {
    if (driverCurrentCoords) {
      mapRef.current?.animateToRegion(
        {
          latitude: driverCurrentCoords.latitude,
          longitude: driverCurrentCoords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        600
      );
    }
  };

  // Re-center map to view entire route
  const resetMapZoom = () => {
    if (stops.length > 0) {
      mapRef.current?.animateToRegion(initialRegion, 600);
    }
  };

  // Open Turn-by-Turn voice navigation in native Google Maps (100% free, 0 API charges)
  const openGoogleMapsNavigation = (targetStop?: { stop: { latitude: number; longitude: number; name: string } }) => {
    const dest =
      targetStop ||
      stops.find((s) => s.sequenceOrder >= currentStopIndex) ||
      stops[stops.length - 1];
    if (!dest) {
      Alert.alert('No Stops Found', 'Could not determine the destination stop.');
      return;
    }
    const lat = dest.stop.latitude;
    const lng = dest.stop.longitude;
    const url = Platform.select({
      android: `google.navigation:q=${lat},${lng}&mode=d`,
      ios: `maps://app?daddr=${lat},${lng}&dirflg=d`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
    });
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
    if (!trip) return;
    setBreakdownModalOpen(true);
    void fetchNearbyBuses(trip.id);
  };

  const handleSubmitBreakdown = async () => {
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

  const getDepartureTime = (scheduledTime: string) => {
    if (!scheduledTime) return '--:--';
    const parts = scheduledTime.split(':');
    if (parts.length < 2) return scheduledTime;
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10) + 2;
    if (m >= 60) {
      h = (h + 1) % 24;
      m = m - 60;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  if (token === undefined || profile.isPending) {
    return (
      <Screen>
        <LoadingState label="Checking driver session..." />
      </Screen>
    );
  }
  if (!token) return null;
  if (profile.isError) {
    return (
      <Screen>
        <ErrorState message={profile.error.message} retry={() => profile.refetch()} />
      </Screen>
    );
  }

  const driver = profile.data;
  const currentStopIndex = trip?.currentStopIndex || 0;

  return (
    <View style={styles.screenContainer}>
      {/* ─── CASE 1: TRIP IS RUNNING -> LIVE MAP VIEW WITH DRAG-UP TIMELINE (Assignment section removed) ─── */}
      {trip ? (
        <View style={styles.tripActiveWrapper}>
          {/* Top Compact Trip HUD Header */}
          <View style={styles.topHudBar}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.topHudRouteNo}>Route {trip.routeService.routeNo}</Text>
                <Pill tone={sharing ? 'success' : 'warning'}>
                  {sharing ? 'Live GPS Sharing' : 'GPS Paused'}
                </Pill>
              </View>
              <Text style={styles.topHudRouteName} numberOfLines={1}>
                {trip.routeService.name} • {isReturnTrip ? 'Return Drops 🏠' : 'Morning Inbound 🎓'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => openGoogleMapsNavigation()}
                hitSlop={12}
                style={styles.hudNavBtn}
                accessibilityLabel="Turn-by-turn Navigation in Google Maps"
              >
                <Text style={styles.hudNavBtnText}>🧭 Navigate</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Alert.alert('End Active Trip', 'Are you sure you want to complete and end this trip?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'End Trip', style: 'destructive', onPress: () => endTrip.mutate(trip.id) },
                  ]);
                }}
                hitSlop={16}
                style={styles.hudEndTripBtn}
                accessibilityLabel="End Current Trip"
              >
                <Text style={styles.hudEndTripText}>End Trip</Text>
              </Pressable>
            </View>
          </View>

          {/* Full Live Campus Map */}
          <View style={styles.mapContainer}>
            <CampusMap
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
            >
              {/* Route Polyline */}
              {polylineCoordinates.length > 0 ? (
                <Polyline
                  coordinates={polylineCoordinates}
                  strokeColor={colors.accent || ORANGE_ACCENT}
                  strokeWidth={4}
                />
              ) : null}

              {/* Stop Markers */}
              {stops.map((entry, idx) => {
                const isPassed = currentStopIndex > entry.sequenceOrder;
                const isAtStop = currentStopIndex === entry.sequenceOrder && currentStopIndex > 0;
                return (
                  <Marker
                    key={`driver-stop-${entry.stop.id}-${idx}`}
                    coordinate={{
                      latitude: entry.stop.latitude,
                      longitude: entry.stop.longitude,
                    }}
                    title={entry.stop.name}
                    description={`Stop ${entry.sequenceOrder} • Scheduled: ${entry.scheduledTime}`}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View
                      style={[
                        styles.stopMarkerDot,
                        isPassed
                          ? styles.stopMarkerPassed
                          : isAtStop
                          ? styles.stopMarkerActive
                          : styles.stopMarkerUpcoming,
                      ]}
                    >
                      <View style={styles.stopMarkerInner} />
                    </View>
                  </Marker>
                );
              })}

              {/* Live Driver Bus Marker (Immediate GPS with 0 lag) */}
              {driverCurrentCoords ? (
                <Marker
                  coordinate={driverCurrentCoords}
                  title="Your Bus (Live)"
                  description={`Route ${trip.routeService.routeNo}`}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.busMarkerHalo}>
                    <Text style={styles.busMarkerEmoji}>🚌</Text>
                  </View>
                </Marker>
              ) : null}
            </CampusMap>

            {/* Floating Map HUD Controls */}
            <View style={styles.mapFloatingControls}>
              <Pressable
                onPress={focusOnBus}
                style={[styles.floatingHudBtn, !driverCurrentCoords && { opacity: 0.5 }]}
                hitSlop={8}
                accessibilityLabel="Center on My Bus"
              >
                <Text style={styles.floatingHudIcon}>🎯</Text>
              </Pressable>

              <Pressable
                onPress={resetMapZoom}
                style={styles.floatingHudBtn}
                hitSlop={8}
                accessibilityLabel="Fit Route"
              >
                <Text style={styles.floatingHudIcon}>↻</Text>
              </Pressable>

              <Pressable
                onPress={() => openGoogleMapsNavigation()}
                style={[styles.floatingHudBtn, { backgroundColor: '#1E3A8A', borderColor: '#3B82F6' }]}
                hitSlop={8}
                accessibilityLabel="Navigate in Google Maps"
              >
                <Text style={styles.floatingHudIcon}>🧭</Text>
              </Pressable>
            </View>

            {/* Live GPS Status Pill Overlay */}
            <View style={styles.mapStatusBadge}>
              <View
                style={[
                  styles.pulsingDot,
                  { backgroundColor: sharing ? '#10B981' : '#F59E0B' },
                ]}
              />
              <Text style={styles.mapStatusBadgeText}>
                {sharing ? 'Live GPS Active (Immediate)' : 'GPS Paused'}
              </Text>
            </View>
          </View>

          {/* ─── Expandable Drag-Up Timeline Bottom Sheet (Identical theme to Passenger View) ─── */}
          <Animated.View style={[styles.bottomSheet, { height: sheetHeightAnim }]}>
            {/* Sheet Drag Handle Area */}
            <View {...panResponder.panHandlers}>
              <Pressable onPress={toggleSheet} style={styles.sheetHandleArea}>
                <View style={styles.sheetHandleBar} />
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetHeaderText}>
                    {sheetExpanded ? '↓ Tap or drag down to collapse' : '↑ Tap or pull up for full stop timeline'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={styles.sheetStopsCount}>
                      {currentStopIndex} / {stops.length} Reached
                    </Text>
                    <Pressable
                      onPress={() => {
                        Alert.alert('End Active Trip', 'Are you sure you want to complete and end this trip?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'End Trip', style: 'destructive', onPress: () => endTrip.mutate(trip.id) },
                        ]);
                      }}
                      hitSlop={10}
                      style={styles.sheetQuickEndTripBtn}
                    >
                      <Text style={styles.sheetQuickEndTripText}>End Trip</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </View>

            {/* Stop Timeline List */}
            <FlatList
              data={stops}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.timelineList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const isPassed = currentStopIndex > item.sequenceOrder;
                const isAtStop = currentStopIndex === item.sequenceOrder && currentStopIndex > 0;
                const isLast = index === stops.length - 1;

                return (
                  <Pressable
                    onPress={() => focusOnStop(item)}
                    style={({ pressed }) => [
                      styles.timelineRow,
                      pressed ? styles.timelineRowPressed : null,
                    ]}
                  >
                    {/* Left Column: Vertical Line & Node */}
                    <View style={styles.timelineNodeColumn}>
                      <View
                        style={[
                          styles.timelineCircle,
                          isPassed
                            ? styles.timelineCirclePassed
                            : isAtStop
                            ? styles.timelineCircleActive
                            : styles.timelineCircleUpcoming,
                        ]}
                      />
                      {!isLast ? (
                        <View
                          style={[
                            styles.timelineLine,
                            isPassed ? styles.timelineLinePassed : styles.timelineLineUpcoming,
                          ]}
                        />
                      ) : null}
                    </View>

                    {/* Middle Column: Stop Name & Timings */}
                    <View style={styles.timelineDetails}>
                      <Text style={styles.stopNameText} numberOfLines={2}>
                        {item.stop.name.toUpperCase()}
                      </Text>

                      <View style={styles.timingRow}>
                        <Text style={styles.arrivalText}>
                          {isReturnTrip ? 'Drop: ' : '→ '}
                          {item.scheduledTime}
                        </Text>
                        <Text style={styles.departureText}>
                          ↳ {getDepartureTime(item.scheduledTime)}
                        </Text>
                      </View>
                    </View>

                    {/* Right Column: Status Badge */}
                    <View style={styles.statusCol}>
                      {isPassed ? (
                        <Text style={styles.statusBusLeft}>Bus Left</Text>
                      ) : isAtStop ? (
                        <Text style={styles.statusAtStop}>At Stop</Text>
                      ) : (
                        <Text style={styles.statusScheduled}>On Time</Text>
                      )}
                    </View>
                  </Pressable>
                );
              }}
              ListFooterComponent={
                <View style={styles.timelineFooterActions}>
                  {/* Location Message Notice if any */}
                  {locationMessage && (
                    <Notice
                      tone={sharing ? 'success' : 'warning'}
                      title={sharing ? 'Location service' : 'Location paused'}
                      message={locationMessage}
                    />
                  )}

                  {/* GPS Sharing Control */}
                  <View style={{ marginVertical: 6 }}>
                    {sharing ? (
                      <Button
                        label="Pause GPS sharing"
                        variant="secondary"
                        onPress={() => {
                          void stopSharing();
                        }}
                      />
                    ) : (
                      <Button label="Share live GPS" onPress={beginLocationSharing} size="lg" />
                    )}
                  </View>

                  {/* Breakdown Reporting Section */}
                  <View style={styles.breakdownSectionBox}>
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
                            ? ` Alert sent to ${reportedInfo.count} nearest route bus(es) and Transport Admin.`
                            : ' Transport Admin has been alerted immediately.'}
                        </Text>
                      </View>
                    ) : (
                      <>
                        {sharing ? (
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

                  {/* End Trip Action */}
                  <Button
                    label="End trip"
                    variant="danger"
                    onPress={() => {
                      Alert.alert('End Trip', 'Are you sure you want to end this trip?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'End Trip', style: 'destructive', onPress: () => endTrip.mutate(trip.id) },
                      ]);
                    }}
                    loading={endTrip.isPending}
                  />
                </View>
              }
            />
          </Animated.View>
        </View>
      ) : (
        /* ─── CASE 2: OFF-TRIP (Shows Assignment Card & Start Trip Options) ─── */
        <ScrollView style={styles.offTripScroll} contentContainerStyle={{ padding: 16, gap: 16 }}>
          <AppHeader
            eyebrow="Driver console"
            title={'Hello, ' + driver.name}
            subtitle={
              driver.assignedRoute
                ? 'Assigned to Route ' + driver.assignedRoute.routeNo
                : 'No route is currently assigned'
            }
            action={<Pill tone="neutral">Off trip</Pill>}
          />

          <Card>
            <SectionTitle>Assignment</SectionTitle>
            {driver.assignedRoute ? (
              <>
                <LabelValue
                  label="Route"
                  value={driver.assignedRoute.routeNo + ' – ' + driver.assignedRoute.name}
                />
                <LabelValue label="Area" value={driver.assignedRoute.areaCovered} />
                <LabelValue label="Capacity" value={String(driver.assignedRoute.capacity)} />
              </>
            ) : (
              <EmptyState
                title="No route assigned"
                message="Ask the transport administrator to assign this driver before starting a trip."
              />
            )}
          </Card>

          {activeTrip.isError && (
            <Notice tone="danger" title="Trip status unavailable" message={activeTrip.error.message} />
          )}

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
                  backgroundColor:
                    selectedDirection === 'TO_COLLEGE' ? 'rgba(234, 88, 12, 0.15)' : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 22 }}>🎓</Text>
                <Text
                  style={{
                    fontWeight: '700',
                    color: selectedDirection === 'TO_COLLEGE' ? '#EA580C' : '#94a3b8',
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
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
                  backgroundColor:
                    selectedDirection === 'FROM_COLLEGE' ? 'rgba(234, 88, 12, 0.15)' : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 22 }}>🏠</Text>
                <Text
                  style={{
                    fontWeight: '700',
                    color: selectedDirection === 'FROM_COLLEGE' ? '#EA580C' : '#94a3b8',
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  Return from College
                </Text>
                <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 2 }}>
                  VBIT &rarr; Reverse Drops
                </Text>
              </Pressable>
            </View>

            {startTrip.isError && (
              <Notice tone="danger" title="Could not start trip" message={startTrip.error.message} />
            )}
            <Button
              label={
                selectedDirection === 'FROM_COLLEGE'
                  ? 'Start Return Trip from VBIT'
                  : 'Start Trip to College'
              }
              onPress={handleStartTrip}
              loading={startTrip.isPending}
              disabled={!driver.assignedRoute}
              size="lg"
            />
          </Card>

          <Button label="Log out" variant="ghost" onPress={logout} />
        </ScrollView>
      )}

      {/* ─── MODAL 1: REPORT BUS BREAKDOWN ─── */}
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

                <Pressable onPress={() => setBreakdownModalOpen(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: INCOMING BREAKDOWN ALERT (From other nearby driver) ─── */}
      <Modal visible={Boolean(incomingAlert)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: '#EF4444', borderWidth: 2 }]}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
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
                  <Text style={styles.alertDetailValue}>
                    Route {incomingAlert.brokenDownRouteNo} ({incomingAlert.brokenDownRouteName})
                  </Text>
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

              <Pressable onPress={() => setIncomingAlert(null)} style={styles.acknowledgeBtn}>
                <Text style={styles.acknowledgeBtnText}>Acknowledge Alert & Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return useMemo(
    () =>
      StyleSheet.create({
        screenContainer: {
          flex: 1,
          backgroundColor: colors.background,
        },
        offTripScroll: {
          flex: 1,
        },
        help: {
          color: colors.textSecondary,
          lineHeight: 21,
        },
        tripActiveWrapper: {
          flex: 1,
          position: 'relative',
        },
        topHudBar: {
          position: 'absolute',
          top: Math.max(12, insets.top + 8),
          left: 12,
          right: 12,
          zIndex: 40,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          borderRadius: 14,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 8,
        },
        topHudRouteNo: {
          fontSize: 16,
          fontWeight: '800',
          color: '#EA580C',
        },
        topHudRouteName: {
          fontSize: 12,
          color: '#F1F5F9',
          marginTop: 2,
          fontWeight: '600',
        },
        hudEndTripBtn: {
          backgroundColor: '#DC2626',
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 8,
          minWidth: 84,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 5,
          shadowColor: '#DC2626',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
        },
        hudEndTripText: {
          color: '#FFFFFF',
          fontWeight: '800',
          fontSize: 13,
        },
        hudNavBtn: {
          backgroundColor: '#2563EB',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#60A5FA',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        hudNavBtnText: {
          color: '#FFFFFF',
          fontWeight: '800',
          fontSize: 12,
        },
        mapContainer: {
          flex: 1,
          width: '100%',
        },
        mapFloatingControls: {
          position: 'absolute',
          top: Math.max(90, insets.top + 78),
          right: 14,
          zIndex: 35,
          gap: 10,
        },
        floatingHudBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.95)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 5,
        },
        floatingHudIcon: {
          fontSize: 18,
        },
        mapStatusBadge: {
          position: 'absolute',
          top: Math.max(90, insets.top + 78),
          left: 14,
          zIndex: 35,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.94)',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        pulsingDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
        },
        mapStatusBadgeText: {
          fontSize: 11,
          fontWeight: '700',
          color: '#FFFFFF',
        },
        stopMarkerDot: {
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 3,
        },
        stopMarkerPassed: {
          backgroundColor: '#10B981',
        },
        stopMarkerActive: {
          backgroundColor: '#EA580C',
          transform: [{ scale: 1.25 }],
        },
        stopMarkerUpcoming: {
          backgroundColor: '#64748B',
        },
        stopMarkerInner: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#ffffff',
        },
        busMarkerHalo: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(234, 88, 12, 0.25)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: '#EA580C',
        },
        busMarkerEmoji: {
          fontSize: 22,
        },

        // Bottom Sheet Styles
        bottomSheet: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surfaceElevated || '#1e293b',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 16,
          zIndex: 50,
          overflow: 'hidden',
        },
        sheetHandleArea: {
          paddingVertical: 10,
          paddingHorizontal: 20,
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        sheetHandleBar: {
          width: 44,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.textSecondary,
          opacity: 0.5,
          marginBottom: 8,
        },
        sheetHeaderRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        },
        sheetHeaderText: {
          fontSize: 12,
          color: '#F8FAFC',
          fontWeight: '600',
        },
        sheetStopsCount: {
          fontSize: 12,
          fontWeight: '700',
          color: '#EA580C',
        },
        sheetQuickEndTripBtn: {
          backgroundColor: '#DC2626',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 6,
        },
        sheetQuickEndTripText: {
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: '800',
        },

        // Timeline Styles
        timelineList: {
          padding: 16,
          paddingBottom: 36,
        },
        timelineRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          minHeight: 52,
        },
        timelineRowPressed: {
          opacity: 0.7,
        },
        timelineNodeColumn: {
          width: 24,
          alignItems: 'center',
          marginRight: 12,
        },
        timelineCircle: {
          width: 12,
          height: 12,
          borderRadius: 6,
          marginTop: 4,
          borderWidth: 2,
          borderColor: colors.surfaceElevated || '#1e293b',
        },
        timelineCirclePassed: {
          backgroundColor: '#10B981',
        },
        timelineCircleActive: {
          backgroundColor: '#EA580C',
          borderColor: '#EA580C',
          shadowColor: '#EA580C',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 4,
          elevation: 4,
        },
        timelineCircleUpcoming: {
          backgroundColor: '#475569',
        },
        timelineLine: {
          width: 2,
          flex: 1,
          minHeight: 38,
          marginVertical: 2,
        },
        timelineLinePassed: {
          backgroundColor: '#10B981',
        },
        timelineLineUpcoming: {
          backgroundColor: '#334155',
        },
        timelineDetails: {
          flex: 1,
          paddingBottom: 12,
        },
        stopNameText: {
          fontSize: 14,
          fontWeight: '800',
          color: '#FFFFFF',
          letterSpacing: 0.3,
        },
        timingRow: {
          flexDirection: 'row',
          gap: 12,
          marginTop: 3,
        },
        arrivalText: {
          fontSize: 12,
          color: '#CBD5E1',
          fontWeight: '600',
        },
        departureText: {
          fontSize: 12,
          color: '#94A3B8',
          fontWeight: '500',
        },
        statusCol: {
          alignItems: 'flex-end',
          paddingTop: 2,
        },
        statusBusLeft: {
          fontSize: 10,
          fontWeight: '700',
          color: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 6,
        },
        statusAtStop: {
          fontSize: 10,
          fontWeight: '800',
          color: '#EA580C',
          backgroundColor: 'rgba(234, 88, 12, 0.15)',
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 6,
        },
        statusScheduled: {
          fontSize: 10,
          fontWeight: '700',
          color: '#E2E8F0',
          backgroundColor: 'rgba(100, 116, 139, 0.25)',
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 6,
        },

        timelineFooterActions: {
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: 10,
        },
        breakdownSectionBox: {
          marginVertical: 4,
        },
        breakdownButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#DC2626',
          paddingVertical: 13,
          borderRadius: radius.md,
          gap: 8,
          shadowColor: '#DC2626',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          elevation: 3,
        },
        breakdownButtonText: {
          color: '#FFFFFF',
          fontSize: 14,
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
          padding: 12,
        },
        breakdownAlertActiveTitle: {
          color: '#EF4444',
          fontWeight: '800',
          fontSize: 14,
        },
        breakdownAlertActiveText: {
          color: colors.textSecondary,
          fontSize: 12,
          marginTop: 4,
          lineHeight: 17,
        },

        // Modal Styles
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
      }),
    [colors, isDark]
  );
};
