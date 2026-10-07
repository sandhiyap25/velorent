import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { LoadingState } from './components/ui/CommonUI';
import { AppProvider, useApp } from './hooks/useAppContext';
import { MainLayout } from './layouts/MainLayout';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminIncidentsPage } from './pages/AdminIncidentsPage';
import { BookingDetailsPage } from './pages/BookingDetailsPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { ListVehiclePage } from './pages/ListVehiclePage';
import { LoginPage } from './pages/LoginPage';
import { ManageVehiclePage } from './pages/ManageVehiclePage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { MyVehiclesPage } from './pages/MyVehiclesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { RentMarketplacePage } from './pages/RentMarketplacePage';
import { SignupPage } from './pages/SignupPage';
import { VehicleDetailsPage } from './pages/VehicleDetailsPage';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isLoading } = useApp();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <LoadingState message="Verifying session..." />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<MainLayout />}>
            {/* Public & Browsable Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/rent" element={<RentMarketplacePage />} />
            <Route path="/rent/:vehicleId" element={<VehicleDetailsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Protected Authenticated User Routes */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/booking/:bookingId"
              element={
                <RequireAuth>
                  <BookingDetailsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/bookings"
              element={
                <RequireAuth>
                  <MyBookingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/bookings/:bookingId"
              element={
                <RequireAuth>
                  <BookingDetailsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/list-vehicle"
              element={
                <RequireAuth>
                  <ListVehiclePage />
                </RequireAuth>
              }
            />
            <Route
              path="/my-vehicles"
              element={
                <RequireAuth>
                  <MyVehiclesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/my-vehicles/:vehicleId"
              element={
                <RequireAuth>
                  <ManageVehiclePage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminDashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/incidents"
              element={
                <RequireAuth>
                  <AdminIncidentsPage />
                </RequireAuth>
              }
            />

            {/* 404 Not Found */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
