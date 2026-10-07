export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  avatarInitials?: string;
  city?: string;
  rating?: number;
}

export type VehicleType = 'Car' | 'SUV' | 'Bike' | 'Van';

export type VehicleListingStatus = 'AVAILABLE' | 'DISABLED' | 'MAINTENANCE';

export interface Vehicle {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  ownerRating: number;
  type: VehicleType;
  brand: string;
  model: string;
  registrationNumber: string;
  location: string;
  hourlyRate: number;
  dailyRate?: number;
  availableFrom: string;
  availableUntil: string;
  status: VehicleListingStatus;
  securityDeposit: number;
  description: string;
  features: string[];
  rules: string[];
  cancellationPolicy: string;
  images: string[];
  transmission: 'Automatic' | 'Manual';
  fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid';
  seats: number;
  createdAt: string;
}

export type BookingStatus =
  | 'UPCOMING'
  | 'ACTIVE'
  | 'OVERDUE'
  | 'RETURNED'
  | 'RETURNED_LATE'
  | 'CANCELLED';

export type VehicleCondition = 'No Damage' | 'Minor Damage' | 'Major Damage';

export type DamageReviewStatus = 'NONE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED';

export interface Booking {
  id: string;
  vehicleId: string;
  renterId: string;
  renterName: string;
  renterEmail: string;
  renterPhone: string;
  ownerId: string;
  ownerName: string;
  pickupDateTime: string;
  returnDateTime: string;
  actualReturnDateTime?: string | null;
  durationHours: number;
  hourlyRate: number;
  rentalAmount: number;
  securityDeposit: number;
  lateHours: number;
  latePenalty: number;
  conditionOnReturn?: VehicleCondition;
  damageDescription?: string;
  damageEvidence?: string[];
  estimatedRepairCost: number;
  damageAmount: number; // Admin-approved damage deduction
  damageReviewStatus: DamageReviewStatus;
  damageAdminNotes?: string;
  status: BookingStatus;
  remindersSent: number;
  lastReminderAt?: string;
  createdAt: string;
}

export type IncidentType =
  | 'Vehicle Not Returned'
  | 'Suspected Theft'
  | 'Vehicle Damage'
  | 'Accident'
  | 'Other';

export type IncidentStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';

export type IncidentPriority = 'STANDARD' | 'HIGH' | 'CRITICAL';

export interface Incident {
  id: string;
  bookingId: string;
  vehicleId: string;
  reportedBy: string;
  reporterName: string;
  reporterRole: 'OWNER' | 'RENTER' | 'ADMIN';
  type: IncidentType;
  priority: IncidentPriority;
  description: string;
  evidence: string[];
  status: IncidentStatus;
  adminRemarks: string;
  estimatedDamageCost?: number;
  approvedDamageAmount?: number;
  damageStatus?: DamageReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string; // 'ALL' or specific user.id or 'ADMIN'
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  link?: string;
  createdAt: string;
}
