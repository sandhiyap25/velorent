import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiService } from '../services/apiService';
import {
  Booking,
  DamageReviewStatus,
  Incident,
  IncidentStatus,
  IncidentType,
  NotificationItem,
  User,
  Vehicle,
  VehicleCondition,
  VehicleType,
} from '../types/models';
import { calculateBookingStatus } from '../utils/rentalCalculations';

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface CreateVehiclePayload {
  type: VehicleType;
  brand: string;
  model: string;
  registrationNumber: string;
  location: string;
  hourlyRate: number;
  dailyRate?: number;
  availableFrom: string;
  availableUntil: string;
  securityDeposit: number;
  description: string;
  features: string[];
  rules?: string[];
  images: string[];
  transmission?: 'Automatic' | 'Manual';
  fuelType?: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid';
  seats?: number;
}

export interface ReturnVehiclePayload {
  bookingId: string;
  actualReturnISO: string;
  condition: VehicleCondition;
  damageDescription?: string;
  damageEvidence?: string[];
  estimatedRepairCost?: number;
}

export interface CreateIncidentPayload {
  bookingId: string;
  vehicleId: string;
  type: IncidentType;
  description: string;
  evidence?: string[];
  estimatedDamageCost?: number;
}

export interface AdminIncidentUpdatePayload {
  incidentId: string;
  status: IncidentStatus;
  adminRemarks: string;
  damageDecision?: DamageReviewStatus;
  approvedDamageAmount?: number;
}

interface AppContextValue {
  currentUser: User | null;
  users: User[];
  vehicles: Vehicle[];
  bookings: Booking[];
  incidents: Incident[];
  notifications: NotificationItem[];
  toasts: ToastMessage[];
  isLoading: boolean;
  apiError: string | null;
  refreshData: () => Promise<void>;
  showToast: (
    title: string,
    type?: ToastMessage['type'],
    message?: string
  ) => void;
  dismissToast: (id: string) => void;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  signup: (payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    city?: string;
  }) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  updateProfile: (payload: {
    name: string;
    phone: string;
    city?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  createBooking: (payload: {
    vehicleId: string;
    pickupISO: string;
    returnISO: string;
  }) => Promise<{ success: boolean; error?: string; booking?: Booking }>;
  cancelBooking: (
    bookingId: string
  ) => Promise<{ success: boolean; error?: string }>;
  returnVehicle: (
    payload: ReturnVehiclePayload
  ) => Promise<{ success: boolean; error?: string; booking?: Booking }>;
  createVehicle: (
    payload: CreateVehiclePayload
  ) => Promise<{ success: boolean; error?: string; vehicle?: Vehicle }>;
  updateVehicle: (
    vehicleId: string,
    updates: Partial<CreateVehiclePayload>
  ) => Promise<{ success: boolean; error?: string }>;
  toggleVehicleListing: (
    vehicleId: string
  ) => Promise<{ success: boolean; error?: string; newStatus?: string }>;
  deleteVehicle: (
    vehicleId: string
  ) => Promise<{ success: boolean; error?: string }>;
  sendOverdueReminder: (
    bookingId: string,
    note?: string
  ) => Promise<{ success: boolean; error?: string }>;
  createIncidentReport: (
    payload: CreateIncidentPayload
  ) => Promise<{ success: boolean; error?: string; incident?: Incident }>;
  adminUpdateIncident: (
    payload: AdminIncidentUpdatePayload
  ) => Promise<{ success: boolean; error?: string }>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const showToast = useCallback(
    (
      title: string,
      type: ToastMessage['type'] = 'info',
      message?: string
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const data = await apiService.fetchBootstrap();
      setCurrentUser(data.currentUser);
      setUsers(data.users);
      setVehicles(data.vehicles);
      setBookings(data.bookings);
      setIncidents(data.incidents);
      setNotifications(data.notifications);
      setApiError(null);
    } catch (err: any) {
      setApiError(err?.message || 'Unable to connect to the backend API.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Periodically evaluate booking statuses in memory and sync with server
  useEffect(() => {
    const interval = setInterval(() => {
      setBookings((prev) => {
        const now = new Date();
        let changed = false;
        const next = prev.map((b) => {
          const computed = calculateBookingStatus(b, now);
          if (computed !== b.status) {
            changed = true;
            return { ...b, status: computed };
          }
          return b;
        });
        return changed ? next : prev;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const { user } = await apiService.login(email, password);
        setCurrentUser(user);
        await refreshData();
        showToast(`Welcome back, ${user.name}`, 'success');
        return { success: true, user };
      } catch (err: any) {
        return {
          success: false,
          error:
            err?.message ||
            'Invalid email or password. Please check your credentials.',
        };
      }
    },
    [refreshData, showToast]
  );

  const signup = useCallback(
    async (payload: {
      name: string;
      email: string;
      phone: string;
      password: string;
      city?: string;
    }) => {
      try {
        const { user } = await apiService.register(payload);
        setCurrentUser(user);
        await refreshData();
        showToast('Account created successfully', 'success');
        return { success: true, user };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Could not create account.',
        };
      }
    },
    [refreshData, showToast]
  );

  const logout = useCallback(async () => {
    await apiService.logout();
    setCurrentUser(null);
    setNotifications([]);
    showToast('You have been signed out', 'info');
  }, [showToast]);

  const updateProfile = useCallback(
    async (payload: { name: string; phone: string; city?: string }) => {
      try {
        const updatedUser = await apiService.updateProfile(payload);
        setCurrentUser(updatedUser);
        await refreshData();
        showToast('Profile updated successfully', 'success');
        return { success: true };
      } catch (err: any) {
        showToast(err?.message || 'Failed to update profile', 'error');
        return {
          success: false,
          error: err?.message || 'Failed to update profile.',
        };
      }
    },
    [refreshData, showToast]
  );

  const createBooking = useCallback(
    async (payload: {
      vehicleId: string;
      pickupISO: string;
      returnISO: string;
    }) => {
      try {
        const booking = await apiService.createBooking(payload);
        await refreshData();
        showToast(
          'Booking confirmed successfully.',
          'success',
          `Booking ID: ${booking.id}`
        );
        return { success: true, booking };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Booking validation failed.',
        };
      }
    },
    [refreshData, showToast]
  );

  const cancelBooking = useCallback(
    async (bookingId: string) => {
      try {
        await apiService.cancelBooking(bookingId);
        await refreshData();
        showToast(
          'Booking cancelled',
          'info',
          `Reservation ${bookingId} has been cancelled and the time slot is now released.`
        );
        return { success: true };
      } catch (err: any) {
        showToast(err?.message || 'Could not cancel booking', 'error');
        return {
          success: false,
          error: err?.message || 'Could not cancel booking.',
        };
      }
    },
    [refreshData, showToast]
  );

  const returnVehicle = useCallback(
    async (payload: ReturnVehiclePayload) => {
      try {
        const booking = await apiService.returnVehicle(payload);
        await refreshData();
        const hasDamage =
          payload.condition === 'Minor Damage' ||
          payload.condition === 'Major Damage';
        showToast(
          booking.status === 'RETURNED_LATE'
            ? 'Vehicle returned (Late Return recorded)'
            : 'Vehicle returned on time',
          hasDamage ? 'warning' : 'success',
          hasDamage
            ? 'Damage report created and sent for Admin deposit review.'
            : undefined
        );
        return { success: true, booking };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Could not process vehicle return.',
        };
      }
    },
    [refreshData, showToast]
  );

  const createVehicle = useCallback(
    async (payload: CreateVehiclePayload) => {
      try {
        const vehicle = await apiService.createVehicle(payload);
        await refreshData();
        showToast(
          'Vehicle listed for rent',
          'success',
          `${vehicle.brand} ${vehicle.model} is now available on the marketplace.`
        );
        return { success: true, vehicle };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Failed to publish vehicle listing.',
        };
      }
    },
    [refreshData, showToast]
  );

  const updateVehicle = useCallback(
    async (vehicleId: string, updates: Partial<CreateVehiclePayload>) => {
      try {
        await apiService.updateVehicle(
          vehicleId,
          updates as Record<string, unknown>
        );
        await refreshData();
        showToast('Vehicle listing updated', 'success');
        return { success: true };
      } catch (err: any) {
        showToast(err?.message || 'Failed to update vehicle', 'error');
        return {
          success: false,
          error: err?.message || 'Failed to update vehicle.',
        };
      }
    },
    [refreshData, showToast]
  );

  const toggleVehicleListing = useCallback(
    async (vehicleId: string) => {
      try {
        const { newStatus } = await apiService.toggleVehicleStatus(vehicleId);
        await refreshData();
        showToast(
          newStatus === 'AVAILABLE'
            ? 'Vehicle listing enabled'
            : 'Vehicle listing disabled',
          'info'
        );
        return { success: true, newStatus };
      } catch (err: any) {
        showToast(err?.message || 'Failed to toggle vehicle status', 'error');
        return {
          success: false,
          error: err?.message || 'Failed to toggle vehicle status.',
        };
      }
    },
    [refreshData, showToast]
  );

  const deleteVehicle = useCallback(
    async (vehicleId: string) => {
      try {
        await apiService.deleteVehicle(vehicleId);
        await refreshData();
        showToast('Vehicle removed from your fleet', 'info');
        return { success: true };
      } catch (err: any) {
        showToast(err?.message || 'Cannot delete vehicle', 'error');
        return {
          success: false,
          error: err?.message || 'Cannot delete vehicle.',
        };
      }
    },
    [refreshData, showToast]
  );

  const sendOverdueReminder = useCallback(
    async (bookingId: string, note?: string) => {
      try {
        const updated = await apiService.sendOverdueReminder(bookingId, note);
        await refreshData();
        showToast(
          'Return reminder sent to renter',
          'info',
          `Notification dispatched to ${updated.renterName}.`
        );
        return { success: true };
      } catch (err: any) {
        showToast(err?.message || 'Failed to send reminder', 'error');
        return {
          success: false,
          error: err?.message || 'Failed to send reminder.',
        };
      }
    },
    [refreshData, showToast]
  );

  const createIncidentReport = useCallback(
    async (payload: CreateIncidentPayload) => {
      try {
        const incident = await apiService.createIncident(payload);
        await refreshData();
        showToast(
          'Incident report created.',
          payload.type === 'Suspected Theft' ? 'warning' : 'info',
          payload.type === 'Suspected Theft'
            ? 'High-priority case logged. Please contact the appropriate authorities and follow the platform incident procedure.'
            : `Case ID: ${incident.id}`
        );
        return { success: true, incident };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Failed to submit incident report.',
        };
      }
    },
    [refreshData, showToast]
  );

  const adminUpdateIncident = useCallback(
    async (payload: AdminIncidentUpdatePayload) => {
      try {
        await apiService.resolveIncident(payload);
        await refreshData();
        showToast('Incident & deposit settlement updated', 'success');
        return { success: true };
      } catch (err: any) {
        showToast(err?.message || 'Failed to update incident', 'error');
        return {
          success: false,
          error: err?.message || 'Failed to update incident.',
        };
      }
    },
    [refreshData, showToast]
  );

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      const updated = await apiService.markNotificationRead(id);
      setNotifications(updated);
    } catch {
      // ignore transient error
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      const updated = await apiService.markAllNotificationsRead();
      setNotifications(updated);
    } catch {
      // ignore transient error
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      users,
      vehicles,
      bookings,
      incidents,
      notifications,
      toasts,
      isLoading,
      apiError,
      refreshData,
      showToast,
      dismissToast,
      login,
      signup,
      logout,
      updateProfile,
      createBooking,
      cancelBooking,
      returnVehicle,
      createVehicle,
      updateVehicle,
      toggleVehicleListing,
      deleteVehicle,
      sendOverdueReminder,
      createIncidentReport,
      adminUpdateIncident,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    [
      currentUser,
      users,
      vehicles,
      bookings,
      incidents,
      notifications,
      toasts,
      isLoading,
      apiError,
      refreshData,
      showToast,
      dismissToast,
      login,
      signup,
      logout,
      updateProfile,
      createBooking,
      cancelBooking,
      returnVehicle,
      createVehicle,
      updateVehicle,
      toggleVehicleListing,
      deleteVehicle,
      sendOverdueReminder,
      createIncidentReport,
      adminUpdateIncident,
      markNotificationRead,
      markAllNotificationsRead,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
