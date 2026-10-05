export type AppRole = 'passenger' | 'driver';
export type UserRole = AppRole;

export type ScreenId =
  | 'splash'
  | 'role-selection'
  | 'dashboard'
  | 'search-directory'
  | 'search-from-to'
  | 'search-route-number'
  | 'search-stage'
  | 'route-results'
  | 'bus-details'
  | 'emergency-hub'
  | 'report-accident'
  | 'bus-pass'
  | 'flag-bus'
  | 'nearby-stages'
  | 'driver-console';

export interface BusStop {
  id: string;
  name: string;
  subText?: string;
  direction?: string;
  scheduledArrival: string;
  scheduledDeparture: string;
  status: 'passed' | 'current' | 'upcoming';
  lat?: number;
  lng?: number;
}

export interface RouteTrip {
  id: string;
  routeCode: string;
  routeNumber: string; // e.g. "RT03 (3K)" or "222P"
  terminalName: string;
  origin: string;
  originDetail?: string;
  destination: string;
  destinationDetail?: string;
  stopsCount: number;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  vehicleNumber: string;
  serviceType: string; // e.g. "CAMPUS EXPRESS", "METRO EXPRESS"
  depotName: string;
  driverName: string;
  driverContact: string;
  stops: BusStop[];
  currentStopIndex: number;
}

export interface RecentSearch {
  id: string;
  from: string;
  to: string;
  timestamp: string;
}

export interface EmergencyOption {
  id: string;
  title: string;
  icon: string;
  description: string;
}
