import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './auth';
import Login from './Login';
import Layout from './Layout';
import { RoutesScreen, StopsScreen, DriversScreen, ClassAdvisorsScreen } from './screens/simpleScreens';
import { BusesScreen, StudentsScreen } from './screens/relationshipScreens';
import RouteDetail from './RouteDetail';
import DelayedBuses from './DelayedBuses';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/routes" replace />} />
              <Route path="routes" element={<RoutesScreen />} />
              <Route path="routes/:id" element={<RouteDetail />} />
              <Route path="stops" element={<StopsScreen />} />
              <Route path="buses" element={<BusesScreen />} />
              <Route path="drivers" element={<DriversScreen />} />
              <Route path="students" element={<StudentsScreen />} />
              <Route path="class-advisors" element={<ClassAdvisorsScreen />} />
              <Route path="delayed-buses" element={<DelayedBuses />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}