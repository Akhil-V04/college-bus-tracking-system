import React, { useState, useEffect } from 'react';
import { ScreenId, UserRole, RouteTrip } from './types';
import { ROUTE_TRIPS } from './data/transitData';
import { PhoneFrame } from './components/PhoneFrame';

// Screens
import { SplashScreen } from './components/Screens/SplashScreen';
import { RoleSelectionScreen } from './components/Screens/RoleSelectionScreen';
import { DashboardScreen } from './components/Screens/DashboardScreen';
import { RouteSearchDirectoryScreen } from './components/Screens/RouteSearchDirectoryScreen';
import { SearchFromToScreen } from './components/Screens/SearchFromToScreen';
import { SearchByRouteScreen } from './components/Screens/SearchByRouteScreen';
import { SearchStageScreen } from './components/Screens/SearchStageScreen';
import { RouteResultsScreen } from './components/Screens/RouteResultsScreen';
import { BusDetailsScreen } from './components/Screens/BusDetailsScreen';
import { EmergencyHubScreen } from './components/Screens/EmergencyHubScreen';
import { ReportAccidentScreen } from './components/Screens/ReportAccidentScreen';
import { NearbyStagesScreen } from './components/Screens/NearbyStagesScreen';
import { BusPassScreen } from './components/Screens/BusPassScreen';
import { FlagBusScreen } from './components/Screens/FlagBusScreen';
import { DriverConsoleScreen } from './components/Screens/DriverConsoleScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('splash');
  const [screenHistory, setScreenHistory] = useState<ScreenId[]>(['splash']);
  const [role, setRole] = useState<UserRole>('passenger');
  const [selectedRouteCode, setSelectedRouteCode] = useState<string>('RT03 (3K)');
  const [selectedTrip, setSelectedTrip] = useState<RouteTrip>(ROUTE_TRIPS[0]);
  const [emergencyCategory, setEmergencyCategory] = useState<string>('Report Accident');
  const [isDark, setIsDark] = useState<boolean>(false);
  const [showScreenSwitcher, setShowScreenSwitcher] = useState<boolean>(true);

  // Apply dark mode class to html element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const navigateTo = (screen: ScreenId) => {
    setScreenHistory(prev => [...prev, screen]);
    setCurrentScreen(screen);
  };

  const handleBack = () => {
    if (screenHistory.length > 1) {
      const nextHistory = [...screenHistory];
      nextHistory.pop();
      const previousScreen = nextHistory[nextHistory.length - 1];
      setScreenHistory(nextHistory);
      setCurrentScreen(previousScreen);
    } else {
      setCurrentScreen('dashboard');
    }
  };

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const allScreens: { id: ScreenId; label: string; group: string }[] = [
    { id: 'splash', label: '1. Splash Screen', group: 'Onboarding' },
    { id: 'role-selection', label: '2. Role Selection', group: 'Onboarding' },
    { id: 'dashboard', label: '3. Main Dashboard', group: 'Core' },
    { id: 'search-directory', label: '4. Route Search Directory', group: 'Search' },
    { id: 'search-from-to', label: '5. Search From & To', group: 'Search' },
    { id: 'search-route-number', label: '6. Search Route Number', group: 'Search' },
    { id: 'search-stage', label: '7. Search Stage (Keypad)', group: 'Search' },
    { id: 'route-results', label: '8. Route Results (RT03)', group: 'Live Tracker' },
    { id: 'bus-details', label: '9. Bus Details (Map / Tabs / Remind Me)', group: 'Live Tracker' },
    { id: 'emergency-hub', label: '10. Emergency Hub', group: 'Safety' },
    { id: 'report-accident', label: '11. Report Accident & SOS', group: 'Safety' },
    { id: 'nearby-stages', label: '12. Nearby Stages', group: 'Transit Tools' },
    { id: 'bus-pass', label: '13. Digital Bus Pass', group: 'Transit Tools' },
    { id: 'flag-bus', label: '14. Flag A Bus', group: 'Transit Tools' },
    { id: 'driver-console', label: '15. Driver Cockpit HUD', group: 'Driver' },
  ];

  return (
    <div className="min-h-screen bg-[#eaecf0] dark:bg-slate-950 flex flex-col xl:flex-row items-center justify-center p-2 sm:p-4 lg:p-6 gap-6 font-sans">
      {/* Phone Frame Container */}
      <div className="flex flex-col items-center">
        <PhoneFrame isDark={isDark}>
          {currentScreen === 'splash' && (
            <SplashScreen onNavigate={navigateTo} />
          )}

          {currentScreen === 'role-selection' && (
            <RoleSelectionScreen
              onSelectRole={(r) => {
                setRole(r);
                if (r === 'driver') {
                  navigateTo('driver-console');
                } else {
                  navigateTo('dashboard');
                }
              }}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'dashboard' && (
            <DashboardScreen
              onNavigate={navigateTo}
              onToggleTheme={toggleTheme}
            />
          )}

          {currentScreen === 'search-directory' && (
            <RouteSearchDirectoryScreen
              onBack={handleBack}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'search-from-to' && (
            <SearchFromToScreen
              onBack={handleBack}
              onSearch={(from, to) => {
                setSelectedRouteCode(`${from} → ${to}`);
              }}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'search-route-number' && (
            <SearchByRouteScreen
              onBack={handleBack}
              onSelectRoute={(code) => setSelectedRouteCode(code)}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'search-stage' && (
            <SearchStageScreen
              onBack={handleBack}
              onSelectStage={(stage) => setSelectedRouteCode(`Stage: ${stage}`)}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'route-results' && (
            <RouteResultsScreen
              routeCode={selectedRouteCode}
              onBack={handleBack}
              onSelectTrip={(trip) => setSelectedTrip(trip)}
              onNavigate={navigateTo}
              onToggleTheme={toggleTheme}
            />
          )}

          {currentScreen === 'bus-details' && (
            <BusDetailsScreen
              trip={selectedTrip}
              onBack={handleBack}
              onToggleTheme={toggleTheme}
              isDark={isDark}
            />
          )}

          {currentScreen === 'emergency-hub' && (
            <EmergencyHubScreen
              onBack={handleBack}
              onSelectOption={(optionId) => {
                const titleMap: Record<string, string> = {
                  'women-safety': 'Women Safety Assist',
                  'report-breakdown': 'Report Breakdown',
                  'medical-assistance': 'Medical Emergency',
                  'report-accident': 'Report Accident',
                };
                setEmergencyCategory(titleMap[optionId] || 'Emergency Assistance');
              }}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'report-accident' && (
            <ReportAccidentScreen
              categoryTitle={emergencyCategory}
              onBack={handleBack}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'nearby-stages' && (
            <NearbyStagesScreen
              onBack={handleBack}
              onSelectStage={(stage) => setSelectedRouteCode(`From: ${stage}`)}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'bus-pass' && (
            <BusPassScreen
              onBack={handleBack}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'flag-bus' && (
            <FlagBusScreen
              onBack={handleBack}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === 'driver-console' && (
            <DriverConsoleScreen
              onBack={handleBack}
              onNavigate={navigateTo}
            />
          )}
        </PhoneFrame>

        {/* Quick bottom screen switcher toggle for mobile */}
        <div className="xl:hidden mt-3 text-center">
          <button
            onClick={() => setShowScreenSwitcher(prev => !prev)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 text-[#EA580C] shadow border border-orange-200 dark:border-slate-700 cursor-pointer"
          >
            {showScreenSwitcher ? 'Hide Screen Navigator' : 'Show All 15 Screens'}
          </button>
        </div>
      </div>

      {/* Screen Navigator Side Panel (Enables direct inspection of all 15 screens) */}
      {showScreenSwitcher && (
        <aside className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-5 flex flex-col max-h-[844px] overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]"></span>
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">Campus Transit Hub</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Exact recreation of all 15 screen designs
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer text-xs flex items-center space-x-1"
              title="Toggle Theme"
            >
              <span>{isDark ? '☀️ Light' : '🌙 Dark'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
            {['Onboarding', 'Core', 'Search', 'Live Tracker', 'Safety', 'Transit Tools', 'Driver'].map(group => {
              const groupScreens = allScreens.filter(s => s.group === group);
              if (groupScreens.length === 0) return null;

              return (
                <div key={group} className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group}
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {groupScreens.map(screen => {
                      const isActive = currentScreen === screen.id;
                      return (
                        <button
                          key={screen.id}
                          onClick={() => navigateTo(screen.id)}
                          className={`text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                            isActive
                              ? 'bg-[#EA580C] text-white shadow-sm font-semibold'
                              : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-orange-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <span className="truncate">{screen.label}</span>
                          {isActive && <span className="text-[10px] uppercase font-bold tracking-wider">Active</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
            <span>Role: <strong className="text-[#EA580C] uppercase">{role}</strong></span>
            <span>Route: <strong className="text-slate-700 dark:text-slate-200">{selectedRouteCode}</strong></span>
          </div>
        </aside>
      )}
    </div>
  );
}
