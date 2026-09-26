import React, { useState } from 'react';
import { ScreenType, BusTripResult } from './types';
import { ROUTE_RESULTS_3K } from './data/mockData';
import { MobileFrame } from './components/MobileFrame';
import { HomeScreen } from './components/HomeScreen';
import { CampusSearchMenuScreen } from './components/CampusSearchMenuScreen';
import { SearchFromToScreen } from './components/SearchFromToScreen';
import { StationSearchInputScreen } from './components/StationSearchInputScreen';
import { SearchByRouteNumberScreen } from './components/SearchByRouteNumberScreen';
import { RouteSearchResultsScreen } from './components/RouteSearchResultsScreen';
import { BusDetailsScreen } from './components/BusDetailsScreen';
import { StopProgressionScreen } from './components/StopProgressionScreen';
import { EmergencyReportScreen } from './components/EmergencyReportScreen';
import { RoleSelectionScreen } from './components/RoleSelectionScreen';
import { RemindMeModal } from './components/RemindMeModal';
import { BusPassModal } from './components/BusPassModal';
import { AboutFleetModal } from './components/AboutFleetModal';
import { FlagBusModal } from './components/FlagBusModal';
import { PunctualityModal } from './components/PunctualityModal';
import { CheckCircle, BellRing } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedRouteCode, setSelectedRouteCode] = useState('RT03 (3K)');
  const [selectedTrip, setSelectedTrip] = useState<BusTripResult>(ROUTE_RESULTS_3K[0]);
  const [userRole, setUserRole] = useState<'passenger' | 'driver'>('passenger');

  // Modals state
  const [isRemindMeOpen, setIsRemindMeOpen] = useState(false);
  const [isBusPassOpen, setIsBusPassOpen] = useState(false);
  const [isAboutFleetOpen, setIsAboutFleetOpen] = useState(false);
  const [isFlagBusOpen, setIsFlagBusOpen] = useState(false);
  const [isPunctualityOpen, setIsPunctualityOpen] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSelectTrip = (trip: BusTripResult) => {
    setSelectedTrip(trip);
  };

  const handleSelectRoute = (routeNumber: string) => {
    setSelectedRouteCode(routeNumber);
  };

  const handleReminderCreated = (station: string, minutes: number) => {
    showToast(`🔔 Reminder set: ${minutes} min before ${station}!`);
  };

  const handleShareRoute = () => {
    showToast('🔗 Route link copied to clipboard!');
  };

  return (
    <div className={`w-full min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <MobileFrame
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      >
        {/* Screen Routing */}
        <div className="w-full h-full relative overflow-y-auto">
          {currentScreen === 'home' && (
            <HomeScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onOpenBusPass={() => setIsBusPassOpen(true)}
              onOpenAboutFleet={() => setIsAboutFleetOpen(true)}
              onOpenFlagBus={() => setIsFlagBusOpen(true)}
            />
          )}

          {currentScreen === 'campus-search-menu' && (
            <CampusSearchMenuScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
            />
          )}

          {currentScreen === 'search-from-to' && (
            <SearchFromToScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
            />
          )}

          {currentScreen === 'station-search' && (
            <StationSearchInputScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
            />
          )}

          {currentScreen === 'route-number-search' && (
            <SearchByRouteNumberScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onSelectRoute={handleSelectRoute}
            />
          )}

          {currentScreen === 'route-results' && (
            <RouteSearchResultsScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onSelectTrip={handleSelectTrip}
              selectedRouteCode={selectedRouteCode}
            />
          )}

          {currentScreen === 'bus-details' && (
            <BusDetailsScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onOpenRemindMe={() => setIsRemindMeOpen(true)}
              onOpenPunctuality={() => setIsPunctualityOpen(true)}
              onOpenShareToast={handleShareRoute}
            />
          )}

          {currentScreen === 'stop-progression' && (
            <StopProgressionScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onOpenRemindMe={() => setIsRemindMeOpen(true)}
              onOpenShareToast={handleShareRoute}
            />
          )}

          {currentScreen === 'emergency-report' && (
            <EmergencyReportScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
            />
          )}

          {currentScreen === 'role-selection' && (
            <RoleSelectionScreen
              onNavigate={setCurrentScreen}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onSelectIdentity={(role) => {
                setUserRole(role);
                showToast(`Switched active role to: ${role === 'passenger' ? 'Passenger (Student)' : 'Bus Driver'}`);
              }}
            />
          )}

          {/* Modals */}
          <RemindMeModal
            isOpen={isRemindMeOpen}
            onClose={() => setIsRemindMeOpen(false)}
            onCreated={handleReminderCreated}
          />

          <BusPassModal
            isOpen={isBusPassOpen}
            onClose={() => setIsBusPassOpen(false)}
          />

          <AboutFleetModal
            isOpen={isAboutFleetOpen}
            onClose={() => setIsAboutFleetOpen(false)}
          />

          <FlagBusModal
            isOpen={isFlagBusOpen}
            onClose={() => setIsFlagBusOpen(false)}
          />

          <PunctualityModal
            isOpen={isPunctualityOpen}
            onClose={() => setIsPunctualityOpen(false)}
          />

          {/* Floating Toast Notification */}
          {toastMessage && (
            <div className="absolute top-16 inset-x-4 z-50 flex items-center justify-center pointer-events-none">
              <div className="bg-[#1E293B] border border-[#EA580C] text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-2 animate-bounce">
                <CheckCircle className="w-4 h-4 text-[#EA580C]" />
                <span>{toastMessage}</span>
              </div>
            </div>
          )}
        </div>
      </MobileFrame>
    </div>
  );
}
