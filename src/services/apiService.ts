import heroFleetImg from '../assets/images/hero_rental_fleet_1790575189130.jpg';
import suvShowcaseImg from '../assets/images/vehicle_suv_showcase_1790575200257.jpg';
import sedanHatchbackImg from '../assets/images/vehicle_sedan_hatchback_1790575211147.jpg';
import bikeCruiserImg from '../assets/images/vehicle_bike_cruiser_1790575224964.jpg';
import mpvVanImg from '../assets/images/vehicle_mpv_van_1790575236799.jpg';
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

export const ASSET_IMAGES: Record<string, string> = {
  heroFleet: heroFleetImg,
  suv: suvShowcaseImg,
  car: sedanHatchbackImg,
  bike: bikeCruiserImg,
  van: mpvVanImg,
  '/assets/hero': heroFleetImg,
  '/assets/suv': suvShowcaseImg,
  '/assets/car': sedanHatchbackImg,
  '/assets/bike': bikeCruiserImg,
  '/assets/van': mpvVanImg,
};

/**
 * Resolves database image paths (such as `/assets/suv` or uploaded URLs)
 * into renderable image URLs.
 */
export function resolveVehicleImageUrl(rawUrl: string, fallbackType?: VehicleType): string {
  const trimmed = (rawUrl || '').trim();
  if (ASSET_IMAGES[trimmed]) {
    return ASSET_IMAGES[trimmed];
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('/')) {
    return trimmed;
  }
  if (fallbackType) {
    const key = fallbackType.toLowerCase();
    if (ASSET_IMAGES[key]) return ASSET_IMAGES[key];
  }
  return sedanHatchbackImg;
}

function normalizeVehicle(v: Vehicle): Vehicle {
  const resolvedImages =
    Array.isArray(v.images) && v.images.length > 0
      ? v.images.map((img) => resolveVehicleImageUrl(img, v.type))
      : [resolveVehicleImageUrl('', v.type)];
  return {
    ...v,
    hourlyRate: Number(v.hourlyRate),
    dailyRate: v.dailyRate ? Number(v.dailyRate) : Number(v.hourlyRate) * 20,
    securityDeposit: Number(v.securityDeposit),
    ownerRating: Number(v.ownerRating || 4.9),
    seats: Number(v.seats || 5),
    images: resolvedImages,
    features: Array.isArray(v.features) ? v.features : [],
    rules: Array.isArray(v.rules) ? v.rules : [],
  };
}

function normalizeBooking(b: Booking): Booking {
  return {
    ...b,
    durationHours: Number(b.durationHours),
    hourlyRate: Number(b.hourlyRate),
    rentalAmount: Number(b.rentalAmount),
    securityDeposit: Number(b.securityDeposit),
    lateHours: Number(b.lateHours || 0),
    latePenalty: Number(b.latePenalty || 0),
    estimatedRepairCost: Number(b.estimatedRepairCost || 0),
    damageAmount: Number(b.damageAmount || 0),
    remindersSent: Number(b.remindersSent || 0),
  };
}

function normalizeIncident(inc: Incident): Incident {
  return {
    ...inc,
    estimatedDamageCost:
      inc.estimatedDamageCost !== undefined && inc.estimatedDamageCost !== null
        ? Number(inc.estimatedDamageCost)
        : undefined,
    approvedDamageAmount: Number(inc.approvedDamageAmount || 0),
    evidence: Array.isArray(inc.evidence) ? inc.evidence : [],
  };
}

/**
 * Base URL for the PHP REST API backend.
 * - Defaults to `/api` (proxied to XAMPP `http://localhost/velorent-api/api` or local backend server)
 * - Can be set explicitly via `VITE_API_BASE_URL` in `.env` (e.g., `http://localhost/velorent-api/api`)
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

const AUTH_TOKEN_KEY = 'velorent_session_token';

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (!token) {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    }
  } catch {
    // ignore storage errors
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Invalid JSON response from server (${endpoint}). Ensure XAMPP Apache & MySQL are running.`
    );
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export interface BootstrapResponse {
  success: boolean;
  currentUser: User | null;
  users: User[];
  vehicles: Vehicle[];
  bookings: Booking[];
  incidents: Incident[];
  notifications: NotificationItem[];
}

export const apiService = {
  async fetchBootstrap(): Promise<BootstrapResponse> {
    const res = await apiRequest<BootstrapResponse>('/state/bootstrap.php', {
      method: 'GET',
    });
    return {
      ...res,
      vehicles: (res.vehicles || []).map(normalizeVehicle),
      bookings: (res.bookings || []).map(normalizeBooking),
      incidents: (res.incidents || []).map(normalizeIncident),
      notifications: res.notifications || [],
      users: res.users || [],
    };
  },

  async login(
    email: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    const res = await apiRequest<{ success: boolean; user: User; token: string }>(
      '/auth/login.php',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    if (res.token) {
      setAuthToken(res.token);
    }
    return { user: res.user, token: res.token };
  },

  async register(payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    city?: string;
  }): Promise<{ user: User; token: string }> {
    const res = await apiRequest<{ success: boolean; user: User; token: string }>(
      '/auth/register.php',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    if (res.token) {
      setAuthToken(res.token);
    }
    return { user: res.user, token: res.token };
  },

  async logout(): Promise<void> {
    try {
      await apiRequest('/auth/logout.php', { method: 'POST' });
    } finally {
      setAuthToken(null);
    }
  },

  async updateProfile(payload: {
    name: string;
    phone: string;
    city?: string;
  }): Promise<User> {
    const res = await apiRequest<{ success: boolean; user: User }>(
      '/auth/me.php',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return res.user;
  },

  async createVehicle(payload: {
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
  }): Promise<Vehicle> {
    const res = await apiRequest<{ success: boolean; vehicle: Vehicle }>(
      '/vehicles/index.php',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return normalizeVehicle(res.vehicle);
  },

  async updateVehicle(
    vehicleId: string,
    updates: Record<string, unknown>
  ): Promise<Vehicle> {
    const res = await apiRequest<{ success: boolean; vehicle: Vehicle }>(
      '/vehicles/manage.php',
      {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          vehicleId,
          updates,
        }),
      }
    );
    return normalizeVehicle(res.vehicle);
  },

  async toggleVehicleStatus(
    vehicleId: string
  ): Promise<{ newStatus: string; vehicle: Vehicle }> {
    const res = await apiRequest<{
      success: boolean;
      newStatus: string;
      vehicle: Vehicle;
    }>('/vehicles/manage.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'toggle_status',
        vehicleId,
      }),
    });
    return {
      newStatus: res.newStatus,
      vehicle: normalizeVehicle(res.vehicle),
    };
  },

  async deleteVehicle(vehicleId: string): Promise<void> {
    await apiRequest('/vehicles/manage.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        vehicleId,
      }),
    });
  },

  async createBooking(payload: {
    vehicleId: string;
    pickupISO: string;
    returnISO: string;
  }): Promise<Booking> {
    const res = await apiRequest<{ success: boolean; booking: Booking }>(
      '/bookings/index.php',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return normalizeBooking(res.booking);
  },

  async cancelBooking(bookingId: string): Promise<Booking> {
    const res = await apiRequest<{ success: boolean; booking: Booking }>(
      '/bookings/cancel.php',
      {
        method: 'POST',
        body: JSON.stringify({ bookingId }),
      }
    );
    return normalizeBooking(res.booking);
  },

  async returnVehicle(payload: {
    bookingId: string;
    actualReturnISO: string;
    condition: VehicleCondition;
    damageDescription?: string;
    damageEvidence?: string[];
    estimatedRepairCost?: number;
  }): Promise<Booking> {
    const res = await apiRequest<{ success: boolean; booking: Booking }>(
      '/bookings/return.php',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return normalizeBooking(res.booking);
  },

  async sendOverdueReminder(
    bookingId: string,
    note?: string
  ): Promise<Booking> {
    const res = await apiRequest<{ success: boolean; booking: Booking }>(
      '/bookings/reminder.php',
      {
        method: 'POST',
        body: JSON.stringify({ bookingId, note }),
      }
    );
    return normalizeBooking(res.booking);
  },

  async createIncident(payload: {
    bookingId: string;
    vehicleId: string;
    type: IncidentType;
    description: string;
    evidence?: string[];
    estimatedDamageCost?: number;
  }): Promise<Incident> {
    const res = await apiRequest<{ success: boolean; incident: Incident }>(
      '/incidents/index.php',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return normalizeIncident(res.incident);
  },

  async resolveIncident(payload: {
    incidentId: string;
    status: IncidentStatus;
    adminRemarks: string;
    damageDecision?: DamageReviewStatus;
    approvedDamageAmount?: number;
  }): Promise<{ incident: Incident; booking?: Booking }> {
    const res = await apiRequest<{
      success: boolean;
      incident: Incident;
      booking?: Booking;
    }>('/incidents/resolve.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      incident: normalizeIncident(res.incident),
      booking: res.booking ? normalizeBooking(res.booking) : undefined,
    };
  },

  async markNotificationRead(id: string): Promise<NotificationItem[]> {
    const res = await apiRequest<{
      success: boolean;
      notifications: NotificationItem[];
    }>('/notifications/index.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_read', id }),
    });
    return res.notifications || [];
  },

  async markAllNotificationsRead(): Promise<NotificationItem[]> {
    const res = await apiRequest<{
      success: boolean;
      notifications: NotificationItem[];
    }>('/notifications/index.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    return res.notifications || [];
  },

  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiRequest<{ success: boolean; url: string }>(
      '/uploads/upload.php',
      {
        method: 'POST',
        body: formData,
      }
    );
    return res.url;
  },
};
