import {
  Booking,
  BookingStatus,
  Incident,
  User,
  Vehicle,
} from '../types/models';

export const LATE_PENALTY_PER_HOUR = 300; // ₹300/hour configurable mock rule

/**
 * Formats an amount in Indian Rupees (₹) with tabular precision
 */
export function formatCurrency(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${safeAmount.toLocaleString('en-IN')}`;
}

/**
 * Masks a vehicle registration number for privacy (e.g. KA-01-MJ-4821 -> KA-01-••-4821)
 */
export function maskRegistrationNumber(regNo: string, showFull = false): string {
  if (!regNo) return 'N/A';
  if (showFull) return regNo.toUpperCase();
  const parts = regNo.trim().toUpperCase().split(/[-\s]+/);
  if (parts.length >= 4) {
    return `${parts[0]}-${parts[1]}-••-${parts[parts.length - 1]}`;
  }
  if (regNo.length > 6) {
    return `${regNo.slice(0, 4)}••${regNo.slice(-4)}`;
  }
  return regNo;
}

/**
 * Formats an ISO date string into a readable Indian date & time
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatShortDate(isoString?: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Converts a Date or ISO string into `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`)
 */
export function toDateTimeLocalString(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Converts separate date (`YYYY-MM-DD`) and time (`HH:mm`) strings into an ISO string
 */
export function combineDateAndTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const combined = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(combined.getTime())) return null;
  return combined.toISOString();
}

/**
 * Splits an ISO string into `{ date: 'YYYY-MM-DD', time: 'HH:mm' }` in local time
 */
export function splitDateAndTime(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) {
    return { date: '', time: '' };
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Dynamically calculates the authoritative booking status based on dates and return state.
 * States: UPCOMING, ACTIVE, OVERDUE, RETURNED, RETURNED_LATE, CANCELLED
 */
export function calculateBookingStatus(
  booking: Booking,
  referenceNow: Date = new Date()
): BookingStatus {
  if (booking.status === 'CANCELLED') {
    return 'CANCELLED';
  }

  const expectedReturn = new Date(booking.returnDateTime);
  const pickup = new Date(booking.pickupDateTime);

  if (booking.actualReturnDateTime) {
    const actualReturn = new Date(booking.actualReturnDateTime);
    // Allow 1 minute grace for exact timestamp matches
    if (actualReturn.getTime() - expectedReturn.getTime() > 60 * 1000) {
      return 'RETURNED_LATE';
    }
    return 'RETURNED';
  }

  // If not yet returned and not cancelled:
  if (referenceNow.getTime() < pickup.getTime()) {
    return 'UPCOMING';
  }

  if (referenceNow.getTime() <= expectedReturn.getTime()) {
    return 'ACTIVE';
  }

  return 'OVERDUE';
}

/**
 * Calculates rental duration in hours (handling fractional hours cleanly) and total charges.
 */
export function calculateRentalPricing(
  vehicle: Pick<Vehicle, 'hourlyRate' | 'dailyRate' | 'securityDeposit'>,
  pickupISO: string,
  returnISO: string
): {
  valid: boolean;
  durationHours: number;
  formattedDuration: string;
  hourlyRate: number;
  rentalAmount: number;
  securityDeposit: number;
  totalPayable: number;
} {
  const pickup = new Date(pickupISO);
  const drop = new Date(returnISO);

  if (
    Number.isNaN(pickup.getTime()) ||
    Number.isNaN(drop.getTime()) ||
    drop.getTime() <= pickup.getTime()
  ) {
    return {
      valid: false,
      durationHours: 0,
      formattedDuration: '0 hours',
      hourlyRate: vehicle.hourlyRate,
      rentalAmount: 0,
      securityDeposit: vehicle.securityDeposit,
      totalPayable: 0,
    };
  }

  const diffMs = drop.getTime() - pickup.getTime();
  const rawHours = diffMs / (1000 * 60 * 60);
  const durationHours = Math.round(rawHours * 100) / 100;

  const rentalAmount = Math.round(durationHours * vehicle.hourlyRate);
  const securityDeposit = vehicle.securityDeposit;
  const totalPayable = rentalAmount + securityDeposit;

  const days = Math.floor(durationHours / 24);
  const remHours = Math.round((durationHours % 24) * 10) / 10;
  let formattedDuration = `${durationHours} ${durationHours === 1 ? 'hour' : 'hours'}`;
  if (days > 0) {
    formattedDuration = `${durationHours} hrs (${days}d ${remHours > 0 ? `${remHours}h` : ''})`.trim();
  }

  return {
    valid: true,
    durationHours,
    formattedDuration,
    hourlyRate: vehicle.hourlyRate,
    rentalAmount,
    securityDeposit,
    totalPayable,
  };
}

/**
 * Checks whether a requested [pickupISO, returnISO] overlaps with any existing active/upcoming/overdue booking
 * Overlap rule: requestedPickup < existingDrop AND requestedDrop > existingPickup
 */
export function findOverlappingBooking(
  vehicleId: string,
  requestedPickupISO: string,
  requestedDropISO: string,
  allBookings: Booking[],
  excludeBookingId?: string
): Booking | null {
  const reqPickup = new Date(requestedPickupISO).getTime();
  const reqDrop = new Date(requestedDropISO).getTime();

  if (Number.isNaN(reqPickup) || Number.isNaN(reqDrop)) return null;

  for (const b of allBookings) {
    if (b.vehicleId !== vehicleId) continue;
    if (excludeBookingId && b.id === excludeBookingId) continue;

    const currentStatus = calculateBookingStatus(b);
    // Cancelled or already returned vehicles do not block future non-overlapping slots
    if (
      currentStatus === 'CANCELLED' ||
      currentStatus === 'RETURNED' ||
      currentStatus === 'RETURNED_LATE'
    ) {
      continue;
    }

    const existingPickup = new Date(b.pickupDateTime).getTime();
    const existingDrop = new Date(b.returnDateTime).getTime();

    if (reqPickup < existingDrop && reqDrop > existingPickup) {
      return b;
    }
  }

  return null;
}

/**
 * Evaluates overall vehicle operational availability (ignoring specific requested time slot)
 */
export function evaluateVehicleOperationalStatus(
  vehicle: Vehicle,
  allBookings: Booking[],
  allIncidents: Incident[],
  now: Date = new Date()
): {
  isBookable: boolean;
  badgeLabel: string;
  statusTone: 'success' | 'warning' | 'danger' | 'neutral';
  reason: string;
  hasActiveOrOverdueBooking: boolean;
  activeBooking?: Booking;
} {
  const vehicleBookings = allBookings.filter((b) => b.vehicleId === vehicle.id);
  const activeOrOverdue = vehicleBookings.find((b) => {
    const st = calculateBookingStatus(b, now);
    return st === 'ACTIVE' || st === 'OVERDUE';
  });

  const overdueBooking = vehicleBookings.find(
    (b) => calculateBookingStatus(b, now) === 'OVERDUE'
  );

  const blockingIncident = allIncidents.find(
    (inc) =>
      inc.vehicleId === vehicle.id &&
      (inc.status === 'OPEN' || inc.status === 'UNDER_REVIEW') &&
      (inc.type === 'Vehicle Not Returned' ||
        inc.type === 'Suspected Theft' ||
        inc.type === 'Accident')
  );

  if (vehicle.status === 'DISABLED') {
    return {
      isBookable: false,
      badgeLabel: 'Listing Disabled',
      statusTone: 'neutral',
      reason: 'This vehicle listing has been temporarily paused by the owner.',
      hasActiveOrOverdueBooking: Boolean(activeOrOverdue),
      activeBooking: activeOrOverdue,
    };
  }

  if (blockingIncident) {
    return {
      isBookable: false,
      badgeLabel: 'Incident Hold',
      statusTone: 'danger',
      reason: `Blocked due to open incident (${blockingIncident.type}).`,
      hasActiveOrOverdueBooking: Boolean(activeOrOverdue),
      activeBooking: activeOrOverdue,
    };
  }

  if (overdueBooking) {
    return {
      isBookable: false,
      badgeLabel: 'Currently Overdue',
      statusTone: 'danger',
      reason: 'Current rental has passed its return deadline and has not been checked in yet.',
      hasActiveOrOverdueBooking: true,
      activeBooking: overdueBooking,
    };
  }

  const availUntil = new Date(vehicle.availableUntil).getTime();
  if (now.getTime() > availUntil) {
    return {
      isBookable: false,
      badgeLabel: 'Window Expired',
      statusTone: 'neutral',
      reason: 'The owner availability window for this listing has ended.',
      hasActiveOrOverdueBooking: Boolean(activeOrOverdue),
      activeBooking: activeOrOverdue,
    };
  }

  if (activeOrOverdue) {
    return {
      isBookable: true, // Bookable for future non-overlapping slots within availability window
      badgeLabel: 'In Active Trip (Future Slots Open)',
      statusTone: 'warning',
      reason: `Currently out on rental until ${formatDateTime(activeOrOverdue.returnDateTime)}. Available for non-conflicting future dates.`,
      hasActiveOrOverdueBooking: true,
      activeBooking: activeOrOverdue,
    };
  }

  return {
    isBookable: true,
    badgeLabel: 'Available',
    statusTone: 'success',
    reason: 'Ready for booking within listed availability window.',
    hasActiveOrOverdueBooking: false,
  };
}

/**
 * Comprehensive validation for a booking request
 */
export function validateBookingRequest(params: {
  vehicle: Vehicle;
  currentUser: User | null;
  pickupISO: string | null;
  returnISO: string | null;
  allBookings: Booking[];
  allIncidents: Incident[];
  now?: Date;
}): { valid: boolean; error?: string; conflictingBooking?: Booking } {
  const {
    vehicle,
    currentUser,
    pickupISO,
    returnISO,
    allBookings,
    allIncidents,
    now = new Date(),
  } = params;

  if (!currentUser) {
    return { valid: false, error: 'Please log in to book a vehicle.' };
  }

  if (vehicle.ownerId === currentUser.id) {
    return {
      valid: false,
      error: 'You cannot book your own listed vehicle.',
    };
  }

  const opStatus = evaluateVehicleOperationalStatus(
    vehicle,
    allBookings,
    allIncidents,
    now
  );
  if (!opStatus.isBookable) {
    return {
      valid: false,
      error: opStatus.reason,
    };
  }

  if (!pickupISO || !returnISO) {
    return {
      valid: false,
      error: 'Please select both pickup and return date and time.',
    };
  }

  const pickup = new Date(pickupISO);
  const drop = new Date(returnISO);

  if (Number.isNaN(pickup.getTime()) || Number.isNaN(drop.getTime())) {
    return { valid: false, error: 'Invalid pickup or return date/time format.' };
  }

  // Allow 5-minute grace window for selecting "now"
  if (pickup.getTime() < now.getTime() - 5 * 60 * 1000) {
    return {
      valid: false,
      error: 'Pickup date and time cannot be in the past.',
    };
  }

  if (drop.getTime() <= pickup.getTime()) {
    return {
      valid: false,
      error: 'Return date and time must be after pickup date and time.',
    };
  }

  const diffHours = (drop.getTime() - pickup.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) {
    return {
      valid: false,
      error: 'Minimum rental duration is 1 hour.',
    };
  }

  const availFrom = new Date(vehicle.availableFrom);
  const availUntil = new Date(vehicle.availableUntil);

  if (pickup.getTime() < availFrom.getTime() || drop.getTime() > availUntil.getTime()) {
    return {
      valid: false,
      error: `Requested period must fall within the vehicle's availability window (${formatDateTime(vehicle.availableFrom)} to ${formatDateTime(vehicle.availableUntil)}).`,
    };
  }

  const conflict = findOverlappingBooking(
    vehicle.id,
    pickupISO,
    returnISO,
    allBookings
  );

  if (conflict) {
    return {
      valid: false,
      error: 'This vehicle is already booked during the selected time.',
      conflictingBooking: conflict,
    };
  }

  return { valid: true };
}

/**
 * Calculates late return duration, late penalty, and security deposit settlement
 */
export function calculateSettlementSummary(params: {
  rentalAmount: number;
  securityDeposit: number;
  expectedReturnISO: string;
  actualReturnISO?: string | null;
  approvedDamageAmount: number;
  estimatedRepairCost?: number;
  damageReviewStatus?: string;
}): {
  isLate: boolean;
  lateHours: number;
  latePenalty: number;
  approvedDamage: number;
  totalDeductions: number;
  refundableDeposit: number;
  additionalAmountDue: number;
  finalTotalCharges: number;
} {
  const {
    rentalAmount,
    securityDeposit,
    expectedReturnISO,
    actualReturnISO,
    approvedDamageAmount = 0,
  } = params;

  let lateHours = 0;
  let latePenalty = 0;
  let isLate = false;

  if (actualReturnISO) {
    const expected = new Date(expectedReturnISO).getTime();
    const actual = new Date(actualReturnISO).getTime();
    // More than 1 minute late counts as late return
    if (actual - expected > 60 * 1000) {
      isLate = true;
      const rawLateHours = (actual - expected) / (1000 * 60 * 60);
      lateHours = Math.round(rawLateHours * 100) / 100;
      latePenalty = Math.round(lateHours * LATE_PENALTY_PER_HOUR);
    }
  }

  const approvedDamage = Math.max(0, Math.round(approvedDamageAmount));
  const totalDeductions = latePenalty + approvedDamage;
  const refundableDeposit = Math.max(0, securityDeposit - totalDeductions);
  const additionalAmountDue = Math.max(0, totalDeductions - securityDeposit);
  const finalTotalCharges = rentalAmount + totalDeductions;

  return {
    isLate,
    lateHours,
    latePenalty,
    approvedDamage,
    totalDeductions,
    refundableDeposit,
    additionalAmountDue,
    finalTotalCharges,
  };
}

/* ------------------------------------------------------------------ */
/*  Slot-aware, real-time availability helpers                         */
/* ------------------------------------------------------------------ */

const HOUR_MS = 60 * 60 * 1000;
const MIN_RENTAL_MS = HOUR_MS; // minimum rental duration = 1 hour
const SLOT_STEP_MINUTES = 15;

/**
 * Rounds a date UP to the next slot boundary (default: 15 minutes).
 * e.g. 22:07 -> 22:15, 22:15 -> 22:15 (already on boundary)
 */
export function roundUpToStep(
  date: Date,
  stepMinutes: number = SLOT_STEP_MINUTES
): Date {
  const stepMs = stepMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
}

/** Bookings that still occupy the vehicle (not cancelled / returned). */
function getBlockingBookings(
  vehicleId: string,
  allBookings: Booking[],
  now: Date
): Booking[] {
  return allBookings.filter((b) => {
    if (b.vehicleId !== vehicleId) return false;
    const st = calculateBookingStatus(b, now);
    return st === 'ACTIVE' || st === 'UPCOMING' || st === 'OVERDUE';
  });
}

export interface FreeSlot {
  pickup: Date;
  drop: Date;
  durationHours: number;
}

/**
 * Finds the earliest free slot for a vehicle starting at/after `from`.
 * - Skips past any booking that overlaps the minimum 1h window.
 * - Respects the owner's availability window.
 * - Uses `desiredHours` but shrinks it if the next booking starts sooner
 *   (as long as at least 1 hour remains).
 * Returns null if there is no bookable slot left.
 */
export function findNextFreeSlot(
  vehicle: Vehicle,
  allBookings: Booking[],
  from: Date = new Date(),
  desiredHours: number = 8
): FreeSlot | null {
  const blocking = getBlockingBookings(vehicle.id, allBookings, from);
  const availFrom = new Date(vehicle.availableFrom).getTime();
  const availUntil = new Date(vehicle.availableUntil).getTime();

  let candidate = roundUpToStep(
    new Date(Math.max(from.getTime(), Number.isNaN(availFrom) ? 0 : availFrom))
  ).getTime();

  // Push the candidate forward past every booking that collides with a 1h window
  for (let i = 0; i <= blocking.length; i++) {
    const hit = blocking.find((b) => {
      const s = new Date(b.pickupDateTime).getTime();
      const e = new Date(b.returnDateTime).getTime();
      return candidate < e && candidate + MIN_RENTAL_MS > s;
    });
    if (!hit) break;
    candidate = roundUpToStep(new Date(hit.returnDateTime)).getTime();
  }

  // Latest possible end: next booking start after candidate, or availability end
  let limit = Number.isNaN(availUntil) ? Infinity : availUntil;
  for (const b of blocking) {
    const s = new Date(b.pickupDateTime).getTime();
    if (s >= candidate && s < limit) limit = s;
  }

  const end = Math.min(candidate + desiredHours * HOUR_MS, limit);
  if (end - candidate < MIN_RENTAL_MS) return null;

  return {
    pickup: new Date(candidate),
    drop: new Date(end),
    durationHours: (end - candidate) / HOUR_MS,
  };
}

/**
 * Real-time availability used by BOTH the vehicle card and the details page,
 * so the badge outside always agrees with what you see inside.
 *
 * "Available"  -> can be picked up right now for at least 1 hour
 * "Booked now" -> bookable overall, but a reservation blocks the current time
 *                 (includes the next free time in `reason`)
 */
export function evaluateLiveAvailability(
  vehicle: Vehicle,
  allBookings: Booking[],
  allIncidents: Incident[],
  now: Date = new Date()
): ReturnType<typeof evaluateVehicleOperationalStatus> & {
  isFreeNow: boolean;
  nextFreeSlot: FreeSlot | null;
} {
  const base = evaluateVehicleOperationalStatus(
    vehicle,
    allBookings,
    allIncidents,
    now
  );

  if (!base.isBookable) {
    return { ...base, isFreeNow: false, nextFreeSlot: null };
  }

  const nextFreeSlot = findNextFreeSlot(vehicle, allBookings, now, 8);
  const nowMs = now.getTime();
  const blocking = getBlockingBookings(vehicle.id, allBookings, now);

  const blockedNow = blocking.some((b) => {
    const s = new Date(b.pickupDateTime).getTime();
    const e = new Date(b.returnDateTime).getTime();
    return nowMs < e && nowMs + MIN_RENTAL_MS > s;
  });

  const availFromMs = new Date(vehicle.availableFrom).getTime();
  const notOpenYet = nowMs < availFromMs;

  if (!nextFreeSlot) {
    return {
      ...base,
      isBookable: false,
      badgeLabel: 'Fully Booked',
      statusTone: 'danger',
      reason: 'No free time slots remain in this vehicle’s availability window.',
      isFreeNow: false,
      nextFreeSlot: null,
    };
  }

  if (blockedNow) {
    return {
      ...base,
      isBookable: true,
      badgeLabel: 'Booked now',
      statusTone: 'warning',
      reason: `Currently reserved. Next free slot starts ${formatDateTime(
        nextFreeSlot.pickup.toISOString()
      )}.`,
      isFreeNow: false,
      nextFreeSlot,
    };
  }

  if (notOpenYet) {
    return {
      ...base,
      isBookable: true,
      badgeLabel: 'Opens soon',
      statusTone: 'warning',
      reason: `Bookable from ${formatDateTime(
        nextFreeSlot.pickup.toISOString()
      )}.`,
      isFreeNow: false,
      nextFreeSlot,
    };
  }

  return {
    ...base,
    badgeLabel: 'Available',
    statusTone: 'success',
    reason: 'Ready for booking within listed availability window.',
    isFreeNow: true,
    nextFreeSlot,
  };
}
