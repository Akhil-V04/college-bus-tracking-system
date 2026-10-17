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
    stops: ScheduleStop[];
  } | null;
  activeTrip: {
    id: number;
    startTime: string;
    currentStopIndex: number;
    tripDirection?: 'TO_COLLEGE' | 'FROM_COLLEGE';
    trackingState?: string;
  } | null;
  roster: { name: string; academicYear: string } | null;
};

export type RouteRoster = {
  routeNo: string;
  roster: { id: number; name: string; academicYear: string; version: number };
  total: number;
  stops: Array<{
    stopId: number;
    stopName: string;
    sequenceOrder: number;
    scheduledTime: string;
    passengers: Array<{ name: string; passengerType: PassengerType }>;
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
  scheduleSnapshot?: any;
  scheduleVersion: { stops: ScheduleStop[] };
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
