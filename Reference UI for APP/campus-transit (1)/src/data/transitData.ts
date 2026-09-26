import { RouteTrip, BusStop } from '../types';

export const RT03_STOPS: BusStop[] = [
  {
    id: 'stop-1',
    name: 'AFZALGANJ CENTRAL LIBRARY',
    subText: 'twd CBS',
    direction: 'twd CBS',
    scheduledArrival: '15:22',
    scheduledDeparture: '15:22',
    status: 'passed',
    lat: 17.3753,
    lng: 78.4744
  },
  {
    id: 'stop-2',
    name: 'CBS',
    subText: 'Central Bus Station',
    direction: 'Platform 4',
    scheduledArrival: '15:28',
    scheduledDeparture: '15:30',
    status: 'current',
    lat: 17.3789,
    lng: 78.4802
  },
  {
    id: 'stop-3',
    name: 'CHADARGHAT(M)',
    subText: 'twd Koti',
    direction: 'twd Koti',
    scheduledArrival: '15:35',
    scheduledDeparture: '15:36',
    status: 'upcoming',
    lat: 17.3821,
    lng: 78.4876
  },
  {
    id: 'stop-4',
    name: 'KOTI MATERNITY HOSPITAL',
    subText: 'twd Ramkoti',
    direction: 'twd Ramkoti',
    scheduledArrival: '15:41',
    scheduledDeparture: '15:42',
    status: 'upcoming',
    lat: 17.3872,
    lng: 78.4912
  },
  {
    id: 'stop-5',
    name: 'RAMKOTI',
    subText: 'twd Tourist',
    direction: 'twd Tourist',
    scheduledArrival: '15:48',
    scheduledDeparture: '15:49',
    status: 'upcoming',
    lat: 17.3914,
    lng: 78.4955
  },
  {
    id: 'stop-6',
    name: 'TOURIST HOTEL',
    subText: 'twd Kachiguda',
    direction: 'twd Kachiguda',
    scheduledArrival: '15:54',
    scheduledDeparture: '15:55',
    status: 'upcoming',
    lat: 17.3967,
    lng: 78.5003
  },
  {
    id: 'stop-7',
    name: 'KACHIGUDA Bus Station',
    subText: 'Opposite Railway Station',
    direction: 'Bay 2',
    scheduledArrival: '16:02',
    scheduledDeparture: '16:04',
    status: 'upcoming',
    lat: 17.3922,
    lng: 78.5041
  },
  {
    id: 'stop-8',
    name: 'LALAPET',
    subText: 'twd Moula Ali',
    direction: 'twd Moula Ali',
    scheduledArrival: '16:15',
    scheduledDeparture: '16:16',
    status: 'upcoming',
    lat: 17.4429,
    lng: 78.5367
  },
  {
    id: 'stop-9',
    name: 'INDUSTRIAL Estate',
    subText: 'twd Kushaiguda',
    direction: 'twd Kushaiguda',
    scheduledArrival: '16:22',
    scheduledDeparture: '16:23',
    status: 'upcoming',
    lat: 17.4512,
    lng: 78.5434
  },
  {
    id: 'stop-10',
    name: 'ZTS X Road',
    subText: 'twd Ecil',
    direction: 'twd Ecil',
    scheduledArrival: '16:28',
    scheduledDeparture: '16:29',
    status: 'upcoming',
    lat: 17.4598,
    lng: 78.5521
  },
  {
    id: 'stop-11',
    name: 'CARBIDE',
    subText: 'twd Ecil',
    direction: 'twd Ecil',
    scheduledArrival: '16:34',
    scheduledDeparture: '16:35',
    status: 'upcoming',
    lat: 17.4661,
    lng: 78.5587
  },
  {
    id: 'stop-12',
    name: 'HB Colony Play Ground',
    subText: 'twd Ecil',
    direction: 'twd Ecil',
    scheduledArrival: '16:40',
    scheduledDeparture: '16:41',
    status: 'upcoming',
    lat: 17.4715,
    lng: 78.5632
  },
  {
    id: 'stop-13',
    name: 'VASUNDHARA Degree College',
    subText: 'twd ECIL',
    direction: 'twd ECIL',
    scheduledArrival: '16:46',
    scheduledDeparture: '16:47',
    status: 'upcoming',
    lat: 17.4789,
    lng: 78.5694
  },
  {
    id: 'stop-14',
    name: 'INDIRANGR Moulali',
    subText: 'twd Ecil',
    direction: 'twd Ecil',
    scheduledArrival: '16:52',
    scheduledDeparture: '16:53',
    status: 'upcoming',
    lat: 17.4842,
    lng: 78.5741
  },
  {
    id: 'stop-15',
    name: 'ECIL Terminal',
    subText: 'Main Bus Station',
    direction: 'Final Terminal',
    scheduledArrival: '17:00',
    scheduledDeparture: '17:00',
    status: 'upcoming',
    lat: 17.4912,
    lng: 78.5802
  }
];

export const ROUTE_TRIPS: RouteTrip[] = [
  {
    id: 'trip-1',
    routeCode: 'RT03',
    routeNumber: 'RT03 (3K)',
    terminalName: 'ECIL TERMINAL',
    origin: 'ECIL',
    originDetail: 'Stops 3',
    destination: 'VBIT Campus',
    destinationDetail: 'Main Gate',
    stopsCount: 3,
    departureTime: '12:46',
    arrivalTime: '15:40',
    duration: '02:54 Hours',
    vehicleNumber: 'TS08Z0239',
    serviceType: 'CAMPUS EXPRESS',
    depotName: 'MUSHIRABAD-II',
    driverName: 'Mr. P.SATAIAH',
    driverContact: '040-69440000',
    stops: RT03_STOPS,
    currentStopIndex: 1
  },
  {
    id: 'trip-2',
    routeCode: 'RT03',
    routeNumber: 'RT03 (3K)',
    terminalName: 'ECIL TERMINAL',
    origin: 'ECIL',
    originDetail: 'Stops 27',
    destination: 'VBIT Campus',
    destinationDetail: 'Engineering Block',
    stopsCount: 27,
    departureTime: '14:04',
    arrivalTime: '15:18',
    duration: '01:14 Hours',
    vehicleNumber: 'TS28Z0010',
    serviceType: 'CAMPUS EXPRESS',
    depotName: 'MUSHIRABAD-II',
    driverName: 'Mr. K.RAMESH',
    driverContact: '040-69440000',
    stops: RT03_STOPS,
    currentStopIndex: 3
  },
  {
    id: 'trip-3',
    routeCode: 'RT03',
    routeNumber: 'RT03 (3K)',
    terminalName: 'ECIL TERMINAL',
    origin: 'ECIL',
    originDetail: 'Stops 18',
    destination: 'VBIT Campus',
    destinationDetail: 'Pharmacy Block',
    stopsCount: 18,
    departureTime: '14:43',
    arrivalTime: '15:57',
    duration: '01:14 Hours',
    vehicleNumber: 'TS07Z4055',
    serviceType: 'CAMPUS EXPRESS',
    depotName: 'MUSHIRABAD-II',
    driverName: 'Mr. B.VENKATESH',
    driverContact: '040-23450033',
    stops: RT03_STOPS,
    currentStopIndex: 2
  },
  {
    id: 'trip-4',
    routeCode: '3K',
    routeNumber: '3K',
    terminalName: 'AFZALGANJ CENTRAL',
    origin: 'AFZALGANJ CENTRAL LIBRARY TWD CBS',
    originDetail: 'Stops 15',
    destination: 'ECIL twd Nagaram',
    destinationDetail: 'Via Nacharam',
    stopsCount: 15,
    departureTime: '01:30 PM',
    arrivalTime: '02:30 PM',
    duration: '01: 00 Hours',
    vehicleNumber: 'AP23Z0073',
    serviceType: 'METRO EXPRESS',
    depotName: 'MUSHIRABAD-II',
    driverName: 'Mr. P.SATAIAH',
    driverContact: '040-69440000',
    stops: RT03_STOPS,
    currentStopIndex: 1
  },
  {
    id: 'trip-5',
    routeCode: 'RT03',
    routeNumber: 'RT03 (3K)',
    terminalName: 'KOTI BUS DEPOT',
    origin: 'KOTI',
    originDetail: 'Stops 22',
    destination: 'VBIT Campus',
    destinationDetail: 'Architecture Block',
    stopsCount: 22,
    departureTime: '15:15',
    arrivalTime: '16:45',
    duration: '01:30 Hours',
    vehicleNumber: 'TS09Z1122',
    serviceType: 'CAMPUS EXPRESS',
    depotName: 'KOTI-I',
    driverName: 'Mr. D.SHANKAR',
    driverContact: '040-69440000',
    stops: RT03_STOPS,
    currentStopIndex: 4
  },
  {
    id: 'trip-6',
    routeCode: 'RT03',
    routeNumber: 'RT03 (3K)',
    terminalName: 'SECUNDERABAD STATION',
    origin: 'Secunderabad',
    originDetail: 'Stops 12',
    destination: 'VBIT Campus',
    destinationDetail: 'North Gate',
    stopsCount: 12,
    departureTime: '16:00',
    arrivalTime: '17:10',
    duration: '01:10 Hours',
    vehicleNumber: 'TS10Z9944',
    serviceType: 'CAMPUS EXPRESS',
    depotName: 'CANTONMENT',
    driverName: 'Mr. M.ANIL',
    driverContact: '040-23450033',
    stops: RT03_STOPS,
    currentStopIndex: 1
  }
];

export const ROUTE_NUMBERS_LIST = [
  { id: 'r-222p', code: '222P', name: 'Patancheru to VBIT Campus Express', buses: 4 },
  { id: 'r-47w', code: '47w', name: 'Warasiguda to Secunderabad via Campus', buses: 3 },
  { id: 'r-1', code: '1', name: 'Afzalgunj to Secunderabad Express', buses: 6 },
  { id: 'r-1-25s', code: '1/25S', name: 'Secunderabad to Subhash Nagar', buses: 2 },
  { id: 'r-1-458', code: '1/458', name: 'Mehdipatnam to Ghatkesar Campus Shuttle', buses: 5 },
  { id: 'r-10', code: '10', name: 'Secunderabad to Sanathnagar Direct', buses: 3 },
  { id: 'r-100-299', code: '100/299', name: 'Hayathnagar to Campus Junction', buses: 4 },
  { id: 'r-100b', code: '100B', name: 'Koti to BHEL via Campus Gate 2', buses: 5 },
  { id: 'r-100d', code: '100D', name: 'Dilsukhnagar to Campus East Terminal', buses: 4 },
  { id: 'r-rt03', code: 'RT03 (3K)', name: 'Afzalgunj to ECIL / VBIT Campus Express', buses: 6 }
];

export const CAMPUS_BUS_NUMBERS = [
  { number: 'TS08Z0239', route: 'RT03 (3K)', driver: 'Mr. P.SATAIAH', status: 'On Route (Near CBS)' },
  { number: 'TS28Z0010', route: 'RT03 (3K)', driver: 'Mr. K.RAMESH', status: 'On Route (Near Nacharam)' },
  { number: 'TS07Z4055', route: 'RT03 (3K)', driver: 'Mr. B.VENKATESH', status: 'Starting from ECIL' },
  { number: 'AP23Z0073', route: '3K', driver: 'Mr. P.SATAIAH', status: 'Arriving at Afzalgunj' },
  { number: 'TS09Z1122', route: '100B', driver: 'Mr. G.NARESH', status: 'Near Campus Gate 1' },
  { number: 'TS10Z9944', route: '222P', driver: 'Mr. R.CHANDRA', status: 'On Route' }
];

export const RECENT_SEARCHES = [
  { id: 'rec-1', from: 'Central Station', to: 'Main Campus', date: 'Today, 2:15 PM' },
  { id: 'rec-2', from: 'North Terminal', to: 'City Square', date: 'Yesterday, 8:40 AM' },
  { id: 'rec-3', from: 'LALAPET', to: 'VBIT Campus', date: '12 Sep, 9:10 AM' },
  { id: 'rec-4', from: 'ECIL', to: 'Engineering Block', date: '11 Sep, 1:20 PM' }
];

export const NEAREST_STAGES = [
  { id: 'stage-1', name: 'LALAPET', distance: '120m away', busesNext10Min: ['RT03 (3K)', '100B'], time: '2 mins' },
  { id: 'stage-2', name: 'INDUSTRIAL Estate', distance: '450m away', busesNext10Min: ['RT03 (3K)', '222P'], time: '6 mins' },
  { id: 'stage-3', name: 'ZTS X Road', distance: '850m away', busesNext10Min: ['100D', '47w'], time: '11 mins' },
  { id: 'stage-4', name: 'ECIL Terminal', distance: '1.4km away', busesNext10Min: ['RT03 (3K)', '1/458'], time: '18 mins' }
];
