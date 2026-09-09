import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { io } from 'socket.io-client';

import { getDriverToken } from '@/lib/auth';
import { API_ORIGIN } from '@/lib/api';

export const DRIVER_LOCATION_TASK = 'college-bus-driver-background-location';
const QUEUE_KEY = 'college-bus-driver-location-queue-v1';
const TRIP_KEY = 'college-bus-driver-active-trip-v1';
const MAX_QUEUE_SIZE = 200;

export type QueuedLocation = {
  tripId: number;
  latitude: number;
  longitude: number;
  deviceTimestamp: string;
  accuracyMeters?: number;
  deviceSpeedKmh?: number;
};

type QueueState = { samples: QueuedLocation[]; dropped: number };

async function readQueue(): Promise<QueueState> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return { samples: [], dropped: 0 };
  try {
    const parsed = JSON.parse(raw) as QueueState;
    return { samples: Array.isArray(parsed.samples) ? parsed.samples : [], dropped: Number(parsed.dropped) || 0 };
  } catch {
    return { samples: [], dropped: 0 };
  }
}

async function writeQueue(queue: QueueState) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function enqueue(samples: QueuedLocation[]) {
  const queue = await readQueue();
  queue.samples.push(...samples);
  if (queue.samples.length > MAX_QUEUE_SIZE) {
    const overflow = queue.samples.length - MAX_QUEUE_SIZE;
    queue.samples.splice(0, overflow);
    queue.dropped += overflow;
  }
  await writeQueue(queue);
}

function sendSample(socket: ReturnType<typeof io>, sample: QueuedLocation) {
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), 8_000);
    socket.emit('driver:location', sample, (ack: { ok?: boolean; stored?: boolean; duplicate?: boolean; reason?: string } = {}) => {
      clearTimeout(timeout);
      const finalResult = Boolean(ack.ok || ack.stored || ack.duplicate || ack.reason === 'TRIP_NOT_RUNNING');
      resolve(finalResult);
    });
  });
}

export async function flushDriverLocationQueue(): Promise<{ sent: number; queued: number; dropped: number }> {
  const token = await getDriverToken();
  const queue = await readQueue();
  if (!token || queue.samples.length === 0) return { sent: 0, queued: queue.samples.length, dropped: queue.dropped };

  const socket = io(API_ORIGIN, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token },
    reconnection: false,
    timeout: 8_000,
  });

  const connected = await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), 8_000);
    socket.once('connect', () => { clearTimeout(timeout); resolve(true); });
    socket.once('connect_error', () => { clearTimeout(timeout); resolve(false); });
    socket.connect();
  });
  if (!connected) {
    socket.disconnect();
    return { sent: 0, queued: queue.samples.length, dropped: queue.dropped };
  }

  let sent = 0;
  for (const sample of queue.samples) {
    if (!(await sendSample(socket, sample))) break;
    sent += 1;
  }
  socket.disconnect();
  if (sent) {
    queue.samples.splice(0, sent);
    await writeQueue(queue);
  }
  return { sent, queued: queue.samples.length, dropped: queue.dropped };
}

TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const tripId = Number(await AsyncStorage.getItem(TRIP_KEY));
  if (!Number.isInteger(tripId) || tripId <= 0) return;
  const locations = (data as { locations?: Location.LocationObject[] }).locations || [];
  await enqueue(locations.map((location) => ({
    tripId,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    deviceTimestamp: new Date(location.timestamp).toISOString(),
    ...(location.coords.accuracy == null ? {} : { accuracyMeters: location.coords.accuracy }),
    ...(location.coords.speed == null || location.coords.speed < 0 ? {} : { deviceSpeedKmh: location.coords.speed * 3.6 }),
  })));
  await flushDriverLocationQueue();
});

export async function startBackgroundDriverLocation(tripId: number) {
  await AsyncStorage.setItem(TRIP_KEY, String(tripId));
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (started) return;
  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5_000,
    distanceInterval: 20,
    deferredUpdatesInterval: 10_000,
    deferredUpdatesDistance: 20,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'College bus trip is live',
      notificationBody: 'Sharing this bus location with assigned passengers.',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopBackgroundDriverLocation(options: { clearQueue?: boolean } = {}) {
  if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  }
  await AsyncStorage.removeItem(TRIP_KEY);
  if (options.clearQueue) await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function getBackgroundLocationStatus() {
  const queue = await readQueue();
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => false);
  return { started, queued: queue.samples.length, dropped: queue.dropped };
}
