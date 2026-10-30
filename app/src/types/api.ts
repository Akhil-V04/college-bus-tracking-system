export type PassengerType = 'STUDENT' | 'FACULTY';

export type RouteSummary = {
  id: number;
  routeNo: string;
  name: string;
  areaCovered: string;
  capacity: number;
  assignedPassengerCount: number;
  driver: { name: string } | null;
  roster: { name: string; academicYear: string } | null;
  hasActiveTrip?: boolean;
  tripDirection?: 'TO_COLLEGE' | 'FROM_COLLEGE';
  isEventOverride?: boolean;
  eventTitle?: string | null;
  previewStops?: string[];
  majorStops?: Array<{ id: number; name: string }>;
  isPublished?: boolean;
};

export type ScheduleStop = {
  id: number;
  sequenceOrder: number;
  scheduledTime: string;
  stop: { id: number; name: string; latitude: number; longitude: number };
};

export type RouteDetail = Omit<RouteSummary, 'roster'> & {
  schedule: {
    id: number;
    name: string;
    direction: string;
    isEventOverride?: boolean;
    remainingMinutes?: number | null;
    geometryPolyline?: string | null;
    stops: ScheduleStop[];
  } | null;
  activeTrip: {
    id: number;
    startTime: string;
    currentStopIndex: number;
    tripDirection?: 'TO_COLLEGE' | 'FROM_COLLEGE';
    trackingState?: string;
    latitude?: number | null;
    longitude?: number | null;
    speedKmh?: number | null;
  } | null;
  availableDirections?: string[];
  roster: { name: string; academicYear: string } | null;
};

export type RouteRosterPassenger = {
  name: string;
  passengerType: PassengerType;
  rollNo?: string | null;
  facultyId?: string | null;
  department?: string | null;
  year?: number | null;
  section?: string | null;
};

export type RouteRoster = {
  routeNo: string;
  routeName?: string;
  driver?: { name: string; driverCode: string } | null;
  roster: { id: number; name: string; academicYear: string; version: number };
  total: number;
  stops: Array<{
    stopId: number;
    stopName: string;
    sequenceOrder: number;
    scheduledTime: string;
    passengers: RouteRosterPassenger[];
  }>;
};

export type EtaResult = {
  status: string;
  message?: string;
  stopId?: number;
  etaMinutes?: number | null;
  etaRangeMinutes?: { min: number; max: number };
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type DriverProfile = {
  role: 'driver';
  id: number;
  driverCode: string;
  name: string;
  assignedRoute: {
    id: number;
    routeNo: string;
    name: string;
    areaCovered: string;
    capacity: number;
  } | null;
};

export type DriverTrip = {
  id: number;
  status: 'RUNNING';
  startTime: string;
  currentStopIndex: number;
  routeService: {
    id: number;
    routeNo: string;
    name: string;
    areaCovered: string;
    capacity: number;
  };
  tripDirection?: string;
  scheduleSnapshot?: {
    id?: number;
    name?: string;
    direction?: string;
    geometryPolyline?: string | null;
    stops: Array<{
      scheduleStopId: number;
      stopId: number;
      sequenceOrder: number;
      scheduledTime: string;
      name: string;
      latitude: number;
      longitude: number;
    }>;
  } | null;
  scheduleVersion: {
    geometryPolyline?: string | null;
    stops: ScheduleStop[];
  };
};

export type BusUpdate = {
  tripId: number;
  routeServiceId: number;
  latitude: number;
  longitude: number;
  currentStopIndex: number;
  timestamp: string;
  eta: EtaResult;
};

export type NearbyBus = {
  tripId: number;
  routeId: number;
  routeNo: string;
  routeName: string;
  driverId: number;
  driverName: string;
  driverPhone: string;
  distanceMeters: number;
  distanceKm: number;
  latitude: number;
  longitude: number;
  lastSeenAt: string;
};

export type NearbyBusesResponse = {
  gpsActive: boolean;
  message?: string;
  myLocation?: { latitude: number; longitude: number; receivedAt: string };
  nearbyBuses: NearbyBus[];
};

export type BreakdownAlertPayload = {
  emergencyId: string;
  brokenDownTripId: number;
  brokenDownRouteNo: string;
  brokenDownRouteName: string;
  brokenDownDriverName: string;
  brokenDownDriverPhone: string;
  distanceKm: number;
  distanceMeters: number;
  location: { latitude: number; longitude: number };
  description: string;
  timestamp: string;
};

