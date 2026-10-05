export type ScreenType =
  | 'home'
  | 'role-selection'
  | 'campus-search-menu'
  | 'search-from-to'
  | 'station-search'
  | 'search-route-number'
  | 'route-results'
  | 'bus-details'
  | 'stop-progression'
  | 'emergency-report';

export type BusDetailTab = 'my-route' | 'full-route' | 'bus-info';

export interface RouteStop {
  id: string;
  name: string;
  subtext?: string;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  isLive?: boolean;
  status?: 'passed' | 'live' | 'upcoming';
  distance?: string;
}

export interface BusTripResult {
  id: string;
  routeCode: string;
  routeName: string;
  startStop: string;
  startStopCount: number;
  startTime: string;
  destStop: string;
  destBlock: string;
  destTime: string;
  duration: string;
  registrationNumber: string;
  serviceType: string;
  activeBus?: string;
}

export interface BusInfoDetails {
  routeNumber: string;
  duration: string;
  status: 'Running' | 'Scheduled' | 'Delayed';
  registrationNumber: string;
  serviceType: string;
  dateOfTrip: string;
  depotName: string;
  originName: string;
  destinationName: string;
  stdOrigin: string;
  staDestination: string;
  driverName: string;
  helplineNumbers: string[];
  punctualityRate: string;
}

export interface RecentTrip {
  id: string;
  from: string;
  to: string;
}

export interface BusRouteItem {
  number: string;
  title?: string;
  terminal?: string;
}
