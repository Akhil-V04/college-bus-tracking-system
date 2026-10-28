import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { fontWeight, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { apiRequest } from '@/lib/api';
import { decodePolyline } from '@/lib/polyline';
import { createLiveSocket } from '@/lib/socket';
import { BusUpdate, RouteDetail, ScheduleStop } from '@/types/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_COLLAPSED_HEIGHT = 280;
const SHEET_EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.72);

const ORANGE_ACCENT = '#EA580C';

type TabType = 'FULL ROUTE' | 'BUS INFO';
type ReminderFrequency = 'TODAY' | 'DAILY' | 'WEEK';

type SavedReminder = {
  routeNo: string;
  stopId: number;
  stopName: string;
  minutesBefore: number;
  frequency: ReminderFrequency;
  scheduledTime: string;
  createdAt: string;
};

export default function RouteDetailsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ routeNo: string }>();
  const routeNo = Array.isArray(params.routeNo) ? params.routeNo[0] : params.routeNo;

  const [activeTab, setActiveTab] = useState<TabType>('FULL ROUTE');
  const [selectedDirection, setSelectedDirection] = useState<'MORNING' | 'EVENING'>('MORNING');
  const [busUpdate, setBusUpdate] = useState<BusUpdate | null>(null);

  // Bottom Sheet expansion state (supports both tapping & dragging/pulling)
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetHeightAnim = useRef(new Animated.Value(SHEET_COLLAPSED_HEIGHT)).current;
  const currentHeightRef = useRef<number>(SHEET_COLLAPSED_HEIGHT);

  // PanResponder to allow pulling/dragging bottom sheet up and down
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        sheetHeightAnim.stopAnimation((val) => {
          currentHeightRef.current = val;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const newHeight = currentHeightRef.current - gestureState.dy;
        const clamped = Math.max(
          SHEET_COLLAPSED_HEIGHT - 20,
          Math.min(SHEET_EXPANDED_HEIGHT + 20, newHeight)
        );
        sheetHeightAnim.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentHeight = currentHeightRef.current - gestureState.dy;
        const threshold = (SHEET_COLLAPSED_HEIGHT + SHEET_EXPANDED_HEIGHT) / 2;
        let shouldExpand = false;
        if (gestureState.vy < -0.3) {
          shouldExpand = true;
        } else if (gestureState.vy > 0.3) {
          shouldExpand = false;
        } else {
          shouldExpand = currentHeight > threshold;
        }

        const targetHeight = shouldExpand ? SHEET_EXPANDED_HEIGHT : SHEET_COLLAPSED_HEIGHT;
        setSheetExpanded(shouldExpand);
        currentHeightRef.current = targetHeight;
        Animated.spring(sheetHeightAnim, {
          toValue: targetHeight,
          friction: 8,
          tension: 40,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Toggle bottom sheet between collapsed and expanded on tap
  const toggleSheet = () => {
    const shouldExpand = !sheetExpanded;
    const toValue = shouldExpand ? SHEET_EXPANDED_HEIGHT : SHEET_COLLAPSED_HEIGHT;
    currentHeightRef.current = toValue;
    Animated.spring(sheetHeightAnim, {
      toValue,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
    setSheetExpanded(shouldExpand);
  };

  // Remind Me Modal state
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [selectedReminderStopId, setSelectedReminderStopId] = useState<number | null>(null);
  const [reminderMinutes, setReminderMinutes] = useState<number>(3);
  const [reminderFrequency, setReminderFrequency] = useState<ReminderFrequency>('TODAY');
  const [savedReminder, setSavedReminder] = useState<SavedReminder | null>(null);

  const mapRef = useRef<MapView>(null);

  // Fetch route details with direction (defaults to MORNING in backend)
  const route = useQuery({
    queryKey: ['passenger-route', routeNo, selectedDirection],
    queryFn: () =>
      apiRequest<RouteDetail>(
        `/passenger/routes/${encodeURIComponent(routeNo)}?direction=${selectedDirection}`
      ),
    enabled: Boolean(routeNo),
    refetchInterval: 30_000,
  });

  const activeTripId = route.data?.activeTrip?.id || null;

  // Socket.IO live updates
  useEffect(() => {
    if (!activeTripId) {
      setBusUpdate(null);
      return;
    }
    const socket = createLiveSocket();
    socket.connect();
    socket.emit('join:trip', { tripId: activeTripId });
    socket.on('bus:update', (update: BusUpdate) => {
      if (update.tripId === activeTripId) setBusUpdate(update);
    });
    return () => {
      socket.disconnect();
    };
  }, [activeTripId]);

  // Load saved reminder for this route
  useEffect(() => {
    if (routeNo) {
      AsyncStorage.getItem(`bus_reminder_${routeNo}`).then((val) => {
        if (val) {
          try {
            setSavedReminder(JSON.parse(val));
          } catch {
            // ignore
          }
        }
      });
    }
  }, [routeNo]);

  const stops = useMemo(() => route.data?.schedule?.stops || [], [route.data?.schedule?.stops]);

  // Auto-select first stop for reminder if none selected
  useEffect(() => {
    if (stops.length > 0 && selectedReminderStopId === null) {
      setSelectedReminderStopId(stops[0].stop.id);
    }
  }, [stops, selectedReminderStopId]);

  // Current bus index from live socket or route
  const currentStopIndex =
    busUpdate?.currentStopIndex ?? route.data?.activeTrip?.currentStopIndex ?? 0;

  // Polyline coordinates: decoded geometry if available, else stops
  const polylineCoordinates = useMemo(() => {
    if (route.data?.schedule?.geometryPolyline) {
      const decoded = decodePolyline(route.data.schedule.geometryPolyline);
      if (decoded.length > 0) return decoded;
    }
    return stops.map((s) => ({
      latitude: s.stop.latitude,
      longitude: s.stop.longitude,
    }));
  }, [route.data?.schedule?.geometryPolyline, stops]);

  // Map initial region
  const initialRegion = useMemo(() => {
    if (stops.length === 0) {
      return {
        latitude: 17.4706,
        longitude: 78.7256,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
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
      latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.3),
      longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.3),
    };
  }, [stops]);

  // Live bus position
  const liveBusCoords = useMemo(() => {
    if (busUpdate?.latitude && busUpdate?.longitude) {
      return { latitude: busUpdate.latitude, longitude: busUpdate.longitude };
    }
    if (stops.length > 0 && currentStopIndex > 0) {
      const activeStop = stops.find((s) => s.sequenceOrder === currentStopIndex) || stops[0];
      return { latitude: activeStop.stop.latitude, longitude: activeStop.stop.longitude };
    }
    return null;
  }, [busUpdate, stops, currentStopIndex]);

  // Center map on a specific stop
  const focusOnStop = (stop: ScheduleStop) => {
    mapRef.current?.animateToRegion(
      {
        latitude: stop.stop.latitude,
        longitude: stop.stop.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      600
    );
  };

  // Re-center map to show all stops
  const resetMapZoom = () => {
    if (stops.length > 0) {
      mapRef.current?.animateToRegion(initialRegion, 600);
    }
    route.refetch();
  };

  // Share route information
  const handleShare = async () => {
    if (!route.data) return;
    try {
      const stopList = stops.slice(0, 10).map((s) => `• ${s.stop.name} (${s.scheduledTime})`).join('\n') +
        (stops.length > 10 ? `\n...and ${stops.length - 10} more stops` : '');
      const downloadUrl = `http://10.96.63.205:4000/download?route=${encodeURIComponent(route.data.routeNo)}`;
      const deepLink = `college-bus://passenger/${encodeURIComponent(route.data.routeNo)}`;

      await Share.share({
        title: `VBIT College Bus Route ${route.data.routeNo}`,
        message: `🚌 VBIT College Bus — Route ${route.data.routeNo} (${route.data.name})\n\n⏰ Schedule:\n${stopList}\n\n📲 Open in App:\n${deepLink}\n\n🌐 Don't have the app yet? Download directly to your mobile here:\n${downloadUrl}`,
        url: downloadUrl,
      });
    } catch {
      // ignore
    }
  };

  // Save Reminder
  const handleSaveReminder = async () => {
    const selectedStop = stops.find((s) => s.stop.id === selectedReminderStopId);
    if (!selectedStop) {
      Alert.alert('Select Stop', 'Please select a bus stop for your reminder.');
      return;
    }

    const freqText =
      reminderFrequency === 'TODAY'
        ? 'For Today'
        : reminderFrequency === 'DAILY'
        ? 'Daily (Mon-Sat)'
        : 'For Next 7 Days';

    const reminder: SavedReminder = {
      routeNo: String(routeNo),
      stopId: selectedStop.stop.id,
      stopName: selectedStop.stop.name,
      minutesBefore: reminderMinutes,
      frequency: reminderFrequency,
      scheduledTime: selectedStop.scheduledTime,
      createdAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(`bus_reminder_${routeNo}`, JSON.stringify(reminder));
    setSavedReminder(reminder);
    setReminderModalVisible(false);

    Alert.alert(
      '🔔 Reminder Created!',
      `You will be reminded ${reminderMinutes} min before bus reaches ${selectedStop.stop.name} (${selectedStop.scheduledTime}) - ${freqText}.`
    );
  };

  // Delete Reminder
  const handleDeleteReminder = async () => {
    await AsyncStorage.removeItem(`bus_reminder_${routeNo}`);
    setSavedReminder(null);
    setReminderModalVisible(false);
    Alert.alert('Reminder Removed', 'Your scheduled reminder has been cleared.');
  };

  // Helper to calculate departure time (typically arrival + 2 mins)
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

  if (route.isPending) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState label="Loading bus route details..." />
      </SafeAreaView>
    );
  }

  if (route.isError || !route.data) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState
          message={route.error?.message || 'Route not found.'}
          retry={() => route.refetch()}
        />
      </SafeAreaView>
    );
  }

  const detail = route.data;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ─── Top Navbar (Teal) ─── */}
      <View style={styles.header}>
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

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bus Details</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Route {detail.routeNo} • VBIT Campus
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable onPress={handleShare} style={styles.navActionBtn} hitSlop={8}>
            <Text style={styles.navActionIcon}>↗</Text>
          </Pressable>

          <Pressable
            onPress={() => setReminderModalVisible(true)}
            style={[styles.navActionBtn, savedReminder ? styles.navActionBtnActive : null]}
            hitSlop={8}
            accessibilityLabel="Set Bus Reminder"
          >
            <AppIcon name="notifications" size={20} colorScheme={savedReminder ? 'light' : 'dark'} />
            {savedReminder ? <View style={styles.bellBadge} /> : null}
          </Pressable>
        </View>
      </View>

      {/* ─── Tabs (FULL ROUTE | BUS INFO) ─── */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('FULL ROUTE')}
          style={[styles.tabItem, activeTab === 'FULL ROUTE' && styles.tabItemActive]}
        >
          <Text
            style={[styles.tabItemText, activeTab === 'FULL ROUTE' && styles.tabItemTextActive]}
          >
            FULL ROUTE
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('BUS INFO')}
          style={[styles.tabItem, activeTab === 'BUS INFO' && styles.tabItemActive]}
        >
          <Text style={[styles.tabItemText, activeTab === 'BUS INFO' && styles.tabItemTextActive]}>
            BUS INFO
          </Text>
        </Pressable>
      </View>

      {/* ─── Direction Selector (Morning vs Evening) ─── */}
      <View style={styles.directionBar}>
        <Pressable
          onPress={() => setSelectedDirection('MORNING')}
          style={[
            styles.directionPill,
            selectedDirection === 'MORNING' && styles.directionPillActive,
          ]}
        >
          <Text
            style={[
              styles.directionPillText,
              selectedDirection === 'MORNING' && styles.directionPillTextActive,
            ]}
          >
            🌅 Morning (To College)
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setSelectedDirection('EVENING')}
          style={[
            styles.directionPill,
            selectedDirection === 'EVENING' && styles.directionPillActive,
          ]}
        >
          <Text
            style={[
              styles.directionPillText,
              selectedDirection === 'EVENING' && styles.directionPillTextActive,
            ]}
          >
            🌆 Evening (Return)
          </Text>
        </Pressable>
      </View>

      {/* ─── TAB 1: FULL ROUTE (MAP & TIMELINE SHEET) ─── */}
      {activeTab === 'FULL ROUTE' ? (
        <View style={styles.fullRouteContainer}>
          {/* Map Section */}
          <View style={styles.mapContainer}>
            <MapView
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
              {stops.map((entry, idx) => (
                <Marker
                  key={`stop-${entry.stop.id}-${idx}`}
                  coordinate={{
                    latitude: entry.stop.latitude,
                    longitude: entry.stop.longitude,
                  }}
                  title={entry.stop.name}
                  description={`Stop ${entry.sequenceOrder} • Scheduled: ${entry.scheduledTime}`}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.stopMarkerDot}>
                    <View style={styles.stopMarkerInner} />
                  </View>
                </Marker>
              ))}

              {/* Live Bus Marker */}
              {liveBusCoords ? (
                <Marker
                  coordinate={liveBusCoords}
                  title="Campus Bus"
                  description={`Route ${detail.routeNo}`}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.busMarkerHalo}>
                    <Text style={styles.busMarkerEmoji}>🚌</Text>
                  </View>
                </Marker>
              ) : null}
            </MapView>

            {/* Floating Re-center / Refresh Button on Map */}
            <Pressable onPress={resetMapZoom} style={styles.floatingRefreshBtn} hitSlop={10}>
              <Text style={styles.floatingRefreshIcon}>↻</Text>
            </Pressable>
          </View>

          {/* Bottom Expandable Timeline Sheet */}
          <Animated.View style={[styles.bottomSheet, { height: sheetHeightAnim }]}>
            {/* Sheet Drag / Pull Handle */}
            <View {...panResponder.panHandlers}>
              <Pressable onPress={toggleSheet} style={styles.sheetHandleArea}>
                <View style={styles.sheetHandleBar} />
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetHeaderText}>
                    {sheetExpanded ? '↓ Tap or drag down to collapse' : '↑ Tap or pull up to view more'}
                  </Text>
                  <Text style={styles.sheetStopsCount}>{stops.length} Stops</Text>
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
                        <Text style={styles.arrivalText}>→ {item.scheduledTime}</Text>
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
            />
          </Animated.View>
        </View>
      ) : (
        /* ─── TAB 2: BUS INFO ─── */
        <ScrollView contentContainerStyle={styles.busInfoContent} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={styles.busIconBox}>
                <AppIcon name="bus" size={28} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRouteTitle}>Route {detail.routeNo}</Text>
                <Text style={styles.infoRouteSub}>{detail.name}</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoGrid}>
              <View style={styles.infoGridItem}>
                <Text style={styles.infoGridLabel}>ASSIGNED DRIVER</Text>
                <Text style={styles.infoGridValue}>{detail.driver?.name || 'Assigned'}</Text>
              </View>

              <View style={styles.infoGridItem}>
                <Text style={styles.infoGridLabel}>SEAT CAPACITY</Text>
                <Text style={styles.infoGridValue}>
                  {detail.assignedPassengerCount}/{detail.capacity} Seats
                </Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoGridItem}>
                <Text style={styles.infoGridLabel}>COLLEGE ARRIVAL</Text>
                <Text style={styles.infoGridValue}>09:25 AM</Text>
              </View>

              <View style={styles.infoGridItem}>
                <Text style={styles.infoGridLabel}>EVENING DEPARTURE</Text>
                <Text style={styles.infoGridValue}>04:30 PM</Text>
              </View>
            </View>
          </View>

          {/* Area Covered Card */}
          <View style={styles.infoCard}>
            <Text style={styles.cardSectionLabel}>AREA COVERED</Text>
            <Text style={styles.areaCoveredText}>{detail.areaCovered || 'All major campus stops.'}</Text>
          </View>

          {/* Transport Helpdesk & In-Charge */}
          <View style={styles.infoCard}>
            <Text style={styles.cardSectionLabel}>CAMPUS TRANSPORT IN-CHARGES</Text>

            <Pressable
              onPress={() => Linking.openURL('tel:7993453629')}
              style={styles.inchargeRow}
            >
              <View style={styles.phoneIconBox}>
                <Text style={{ fontSize: 16 }}>📞</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inchargeName}>Mr. P. Venu Gopal</Text>
                <Text style={styles.inchargeRole}>Transport In-Charge • 7993453629</Text>
              </View>
              <Text style={styles.callBadge}>Call</Text>
            </Pressable>

            <View style={styles.infoDivider} />

            <Pressable
              onPress={() => Linking.openURL('tel:7993453635')}
              style={styles.inchargeRow}
            >
              <View style={styles.phoneIconBox}>
                <Text style={{ fontSize: 16 }}>📞</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inchargeName}>Mr. G. Ramesh</Text>
                <Text style={styles.inchargeRole}>Transport In-Charge • 7993453635</Text>
              </View>
              <Text style={styles.callBadge}>Call</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* ─── REMIND ME MODAL (Screenshot 3) ─── */}
      <Modal visible={reminderModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Title */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <AppIcon name="notifications" size={22} colorScheme={isDark ? 'dark' : 'light'} />
                <Text style={styles.modalTitle}>Remind Me</Text>
              </View>
              <Pressable onPress={() => setReminderModalVisible(false)} hitSlop={10}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* Stop Selector Dropdown List */}
            <Text style={styles.modalFieldLabel}>SELECT BUS STOP</Text>
            <ScrollView
              style={styles.stopPickerBox}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {stops.map((s) => {
                const isSelected = selectedReminderStopId === s.stop.id;
                return (
                  <Pressable
                    key={`reminder-stop-${s.stop.id}`}
                    onPress={() => setSelectedReminderStopId(s.stop.id)}
                    style={[
                      styles.stopPickerOption,
                      isSelected ? styles.stopPickerOptionSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stopPickerOptionText,
                        isSelected ? styles.stopPickerOptionTextSelected : null,
                      ]}
                    >
                      {s.stop.name} ({s.scheduledTime})
                    </Text>
                    {isSelected ? <Text style={styles.checkIcon}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Reminder Frequency Selector (Today, Daily, Week) */}
            <Text style={styles.modalFieldLabel}>SCHEDULE FREQUENCY</Text>
            <View style={styles.freqRow}>
              {(['TODAY', 'DAILY', 'WEEK'] as ReminderFrequency[]).map((f) => {
                const isSel = reminderFrequency === f;
                const label = f === 'TODAY' ? 'For Today' : f === 'DAILY' ? 'Daily' : 'For a Week';
                return (
                  <Pressable
                    key={f}
                    onPress={() => setReminderFrequency(f)}
                    style={[styles.freqBtn, isSel ? styles.freqBtnSelected : null]}
                  >
                    <Text style={[styles.freqBtnText, isSel ? styles.freqBtnTextSelected : null]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Minutes Before Slider / Chips */}
            <Text style={styles.modalFieldLabel}>ALERT TIMING</Text>
            <View style={styles.minutesRow}>
              {[1, 2, 3, 4, 5].map((m) => {
                const isSel = reminderMinutes === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setReminderMinutes(m)}
                    style={[styles.minuteChip, isSel ? styles.minuteChipSelected : null]}
                  >
                    <Text
                      style={[styles.minuteChipText, isSel ? styles.minuteChipTextSelected : null]}
                    >
                      {m} min
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.reminderExplainText}>
              Alerts you {reminderMinutes} min before bus arrives at{' '}
              <Text style={{ fontWeight: fontWeight.bold, color: colors.accent || ORANGE_ACCENT }}>
                {stops.find((s) => s.stop.id === selectedReminderStopId)?.stop.name || 'selected stop'}
              </Text>
            </Text>

            {/* Active Reminder Warning / Delete option */}
            {savedReminder ? (
              <View style={styles.activeReminderInfo}>
                <Text style={styles.activeReminderInfoText}>
                  Active reminder: {savedReminder.minutesBefore}m before {savedReminder.stopName}
                </Text>
                <Pressable onPress={handleDeleteReminder}>
                  <Text style={styles.deleteReminderText}>Remove</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              <Pressable
                onPress={() => setReminderModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable onPress={handleSaveReminder} style={styles.modalCreateBtn}>
                <Text style={styles.modalCreateBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const useStyles = () => {
  const { colors, isDark } = useTheme();
  const accentColor = colors.accent || ORANGE_ACCENT;
  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        /* Top Navbar */
        header: {
          backgroundColor: accentColor,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        backBtn: {
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        },
        backIcon: { color: '#FFFFFF', fontSize: 24, fontWeight: fontWeight.bold },
        headerCenter: { flex: 1, marginLeft: 8 },
        headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: fontWeight.bold },
        headerSubtitle: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 12 },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        navActionBtn: {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        },
        navActionBtnActive: { backgroundColor: '#FFFFFF' },
        navActionIcon: { fontSize: 18, color: '#FFFFFF' },
        bellBadge: {
          position: 'absolute',
          top: 6,
          right: 6,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#EF4444',
        },

        /* Tabs */
        tabBar: {
          flexDirection: 'row',
          backgroundColor: isDark ? colors.surfaceElevated : '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        },
        tabItem: {
          flex: 1,
          paddingVertical: 14,
          alignItems: 'center',
          borderBottomWidth: 3,
          borderBottomColor: 'transparent',
        },
        tabItemActive: { borderBottomColor: accentColor },
        tabItemText: {
          fontSize: 13,
          fontWeight: fontWeight.bold,
          color: colors.textMuted,
          letterSpacing: 0.5,
        },
        tabItemTextActive: { color: accentColor },

        /* Direction Bar */
        directionBar: {
          flexDirection: 'row',
          paddingHorizontal: spacing.md,
          paddingVertical: 8,
          gap: 10,
          backgroundColor: isDark ? colors.surface : '#F3F4F6',
        },
        directionPill: {
          flex: 1,
          paddingVertical: 8,
          borderRadius: radius.full,
          backgroundColor: isDark ? colors.surfaceElevated : '#FFFFFF',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        },
        directionPillActive: {
          backgroundColor: accentColor,
          borderColor: accentColor,
        },
        directionPillText: {
          fontSize: 12,
          fontWeight: fontWeight.semibold,
          color: colors.textSecondary,
        },
        directionPillTextActive: { color: '#FFFFFF', fontWeight: fontWeight.bold },

        /* Full Route Container */
        fullRouteContainer: { flex: 1, position: 'relative' },
        mapContainer: { flex: 1 },
        floatingRefreshBtn: {
          position: 'absolute',
          top: 14,
          right: 14,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 6,
        },
        floatingRefreshIcon: { fontSize: 22, color: accentColor, fontWeight: fontWeight.bold },

        /* Map Markers */
        stopMarkerDot: {
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: accentColor,
        },
        stopMarkerInner: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: accentColor,
        },
        busMarkerHalo: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(234, 88, 12, 0.25)',
          borderWidth: 2,
          borderColor: accentColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        busMarkerEmoji: { fontSize: 20 },

        /* Bottom Sheet */
        bottomSheet: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: isDark ? colors.surfaceElevated : '#FFFFFF',
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 12,
          overflow: 'hidden',
        },
        sheetHandleArea: {
          alignItems: 'center',
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        },
        sheetHandleBar: {
          width: 44,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.textMuted,
          marginBottom: 6,
        },
        sheetHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingHorizontal: 20,
        },
        sheetHeaderText: {
          fontSize: 13,
          fontWeight: fontWeight.bold,
          color: colors.textSecondary,
        },
        sheetStopsCount: {
          fontSize: 12,
          fontWeight: fontWeight.bold,
          color: accentColor,
        },

        /* Timeline List */
        timelineList: { paddingHorizontal: 16, paddingVertical: 12 },
        timelineRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          minHeight: 64,
        },
        timelineRowPressed: { backgroundColor: 'rgba(234, 88, 12, 0.08)' },
        timelineNodeColumn: {
          width: 28,
          alignItems: 'center',
        },
        timelineCircle: {
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 2,
          backgroundColor: '#FFFFFF',
          zIndex: 2,
        },
        timelineCirclePassed: { borderColor: '#9CA3AF', backgroundColor: '#E5E7EB' },
        timelineCircleActive: { borderColor: '#10B981', backgroundColor: '#10B981' },
        timelineCircleUpcoming: { borderColor: accentColor, backgroundColor: '#FFFFFF' },
        timelineLine: {
          width: 2,
          flex: 1,
          marginVertical: 2,
        },
        timelineLinePassed: { backgroundColor: '#D1D5DB' },
        timelineLineUpcoming: { backgroundColor: accentColor },
        timelineDetails: { flex: 1, paddingLeft: 10, paddingBottom: 16 },
        stopNameText: {
          fontSize: 14,
          fontWeight: fontWeight.bold,
          color: colors.textPrimary,
          letterSpacing: 0.2,
        },
        timingRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
        arrivalText: { fontSize: 13, color: accentColor, fontWeight: fontWeight.semibold },
        departureText: { fontSize: 13, color: colors.textSecondary, fontWeight: fontWeight.medium },
        statusCol: {
          alignItems: 'flex-end',
          paddingBottom: 16,
        },
        statusBusLeft: { fontSize: 12, color: '#EF4444', fontWeight: fontWeight.bold },
        statusAtStop: { fontSize: 12, color: '#10B981', fontWeight: fontWeight.bold },
        statusScheduled: { fontSize: 12, color: accentColor, fontWeight: fontWeight.medium },

        /* Bus Info Content */
        busInfoContent: { padding: spacing.md, gap: spacing.md },
        infoCard: {
          backgroundColor: isDark ? colors.surfaceElevated : '#FFFFFF',
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        },
        infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        busIconBox: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(234, 88, 12, 0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        infoRouteTitle: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.textPrimary },
        infoRouteSub: { fontSize: 13, color: colors.textSecondary },
        infoDivider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: 12 },
        infoGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
        infoGridItem: { flex: 1 },
        infoGridLabel: { fontSize: 11, fontWeight: fontWeight.bold, color: colors.textMuted },
        infoGridValue: {
          fontSize: 14,
          fontWeight: fontWeight.bold,
          color: colors.textPrimary,
          marginTop: 2,
        },
        cardSectionLabel: {
          fontSize: 12,
          fontWeight: fontWeight.bold,
          color: accentColor,
          letterSpacing: 0.5,
          marginBottom: 8,
        },
        areaCoveredText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
        inchargeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
        phoneIconBox: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        inchargeName: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.textPrimary },
        inchargeRole: { fontSize: 12, color: colors.textSecondary },
        callBadge: {
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 4,
          backgroundColor: accentColor,
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: fontWeight.bold,
        },

        /* Remind Me Modal */
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        },
        modalCard: {
          width: '100%',
          maxWidth: 380,
          backgroundColor: isDark ? colors.surfaceElevated : '#FFFFFF',
          borderRadius: radius.xl,
          padding: 20,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 16,
        },
        modalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        },
        modalTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        modalTitle: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.textPrimary },
        modalCloseText: { fontSize: 18, color: colors.textMuted, fontWeight: fontWeight.bold },
        modalFieldLabel: {
          fontSize: 11,
          fontWeight: fontWeight.bold,
          color: colors.textMuted,
          letterSpacing: 0.5,
          marginBottom: 6,
          marginTop: 8,
        },
        stopPickerBox: {
          maxHeight: 120,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 8,
        },
        stopPickerOption: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        },
        stopPickerOptionSelected: { backgroundColor: 'rgba(234, 88, 12, 0.12)' },
        stopPickerOptionText: { fontSize: 13, color: colors.textPrimary },
        stopPickerOptionTextSelected: { color: accentColor, fontWeight: fontWeight.bold },
        checkIcon: { color: accentColor, fontSize: 14, fontWeight: fontWeight.bold },
        freqRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
        freqBtn: {
          flex: 1,
          paddingVertical: 8,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
        },
        freqBtnSelected: {
          borderColor: accentColor,
          backgroundColor: accentColor,
        },
        freqBtnText: { fontSize: 12, fontWeight: fontWeight.semibold, color: colors.textSecondary },
        freqBtnTextSelected: { color: '#FFFFFF', fontWeight: fontWeight.bold },
        minutesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
        minuteChip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        minuteChipSelected: {
          borderColor: accentColor,
          backgroundColor: accentColor,
        },
        minuteChipText: { fontSize: 12, fontWeight: fontWeight.bold, color: colors.textPrimary },
        minuteChipTextSelected: { color: '#FFFFFF' },
        reminderExplainText: {
          fontSize: 12,
          color: colors.textSecondary,
          textAlign: 'center',
          marginVertical: 10,
        },
        activeReminderInfo: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          marginBottom: 10,
        },
        activeReminderInfoText: { fontSize: 11, color: '#EF4444', flex: 1 },
        deleteReminderText: { fontSize: 11, color: '#EF4444', fontWeight: fontWeight.bold },
        modalActionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
        modalCancelBtn: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        },
        modalCancelBtnText: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.textMuted },
        modalCreateBtn: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: radius.sm,
          backgroundColor: accentColor,
          alignItems: 'center',
        },
        modalCreateBtnText: { fontSize: 14, fontWeight: fontWeight.bold, color: '#FFFFFF' },
      }),
    [colors, isDark]
  );
};
