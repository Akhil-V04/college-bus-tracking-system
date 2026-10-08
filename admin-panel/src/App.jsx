import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import Layout from './Layout';
import Login from './Login';
import Dashboard from './screens/Dashboard';
import RouteServicesScreen from './screens/RouteServicesScreen';
import DriversScreen from './screens/DriversScreen';
import ClassAdvisorsScreen from './screens/ClassAdvisorsScreen';
import SchedulesScreen from './screens/SchedulesScreen';
import RostersScreen from './screens/RostersScreen';
import LateAlertsScreen from './screens/LateAlertsScreen';
import AuditLogScreen from './screens/AuditLogScreen';
import OperationsScreen from './screens/OperationsScreen';
import SessionsScreen from './screens/SessionsScreen';
import IssuesScreen from './screens/IssuesScreen';
import KnowledgeScreen from './screens/KnowledgeScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import StopsScreen from './screens/StopsScreen';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="routes" element={<RouteServicesScreen />} />
            <Route path="stops" element={<StopsScreen />} />
            <Route path="schedules" element={<SchedulesScreen />} />
            <Route path="rosters" element={<RostersScreen />} />
            <Route path="drivers" element={<DriversScreen />} />
            <Route path="class-advisors" element={<ClassAdvisorsScreen />} />
            <Route path="late-alerts" element={<LateAlertsScreen />} />
            <Route path="operations" element={<OperationsScreen />} />
            <Route path="audit-log" element={<AuditLogScreen />} />
            <Route path="sessions" element={<SessionsScreen />} />
            <Route path="issues" element={<IssuesScreen />} />
            <Route path="knowledge" element={<KnowledgeScreen />} />
            <Route path="notifications" element={<NotificationsScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
