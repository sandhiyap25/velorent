import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  MapPin,
} from 'lucide-react';
import {
  Button,
  ErrorState,
  Input,
  Modal,
  StatusBadge,
  VehicleImage,
} from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { useNow } from '../hooks/useNow';
import {
  calculateBookingStatus,
  calculateRentalPricing,
  combineDateAndTime,
  evaluateLiveAvailability,
  findNextFreeSlot,
  roundUpToStep,
  formatCurrency,
  formatDateTime,
  LATE_PENALTY_PER_HOUR,
  maskRegistrationNumber,
  splitDateAndTime,
  validateBookingRequest,
} from '../utils/rentalCalculations';

const DURATION_PRESETS = [
  { label: '4 hours', hours: 4 },
  { label: '8 hours', hours: 8 },
  { label: '1 day (24h)', hours: 24 },
  { label: '2 days (48h)', hours: 48 },
];

export const VehicleDetailsPage: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const navigate = useNavigate();

  const {
    currentUser,
    vehicles,
    bookings,
    incidents,
    createBooking,
  } = useApp();

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const now = useNow(30_000);

  // Auto mode: pickup follows real time / next free slot until the user edits it
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [presetHours, setPresetHours] = useState(8);
  const lastAutoPickup = useRef<string>('');

  const computeAutoSlot = (hours: number) => {
    if (!vehicle) return null;
    const slot = findNextFreeSlot(vehicle, bookings, new Date(), hours);
    if (slot) return { pickup: slot.pickup, drop: slot.drop };
    const pickup = roundUpToStep(new Date());
    return { pickup, drop: new Date(pickup.getTime() + hours * 60 * 60 * 1000) };
  };

  const initialSlot = useMemo(() => {
    const slot = computeAutoSlot(8);
    const pickup = slot ? slot.pickup : roundUpToStep(new Date());
    const drop = slot ? slot.drop : new Date(pickup.getTime() + 8 * 3600 * 1000);
    return {
      pickup: splitDateAndTime(pickup.toISOString()),
      drop: splitDateAndTime(drop.toISOString()),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [pickupDate, setPickupDate] = useState(initialSlot.pickup.date);
  const [pickupTime, setPickupTime] = useState(initialSlot.pickup.time);
  const [returnDate, setReturnDate] = useState(initialSlot.drop.date);
  const [returnTime, setReturnTime] = useState(initialSlot.drop.time);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-sync the schedule with real time / bookings while the user hasn't edited it
  useEffect(() => {
    if (!autoSchedule || !vehicle) return;
    const slot = computeAutoSlot(presetHours);
    if (!slot) return;
    const p = splitDateAndTime(slot.pickup.toISOString());
    const r = splitDateAndTime(slot.drop.toISOString());
    const key = `${p.date}T${p.time}|${r.date}T${r.time}`;
    if (key === lastAutoPickup.current) return;
    lastAutoPickup.current = key;
    setPickupDate(p.date);
    setPickupTime(p.time);
    setReturnDate(r.date);
    setReturnTime(r.time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, bookings, vehicle, autoSchedule, presetHours]);

  if (!vehicle) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorState
          title="Vehicle not found"
          message="The vehicle you requested does not exist or has been removed."
          actionLabel="Back to marketplace"
          onAction={() => navigate('/rent')}
        />
      </div>
    );
  }

  const fullName = `${vehicle.brand} ${vehicle.model}`;
  const dailyPrice = vehicle.dailyRate || vehicle.hourlyRate * 20;
  const isOwner = Boolean(currentUser && vehicle.ownerId === currentUser.id);

  const opStatus = evaluateLiveAvailability(vehicle, bookings, incidents, now);

  const pickupISO = combineDateAndTime(pickupDate, pickupTime);
  const returnISO = combineDateAndTime(returnDate, returnTime);

  const pricing = (() => {
    if (!pickupISO || !returnISO) {
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
    return calculateRentalPricing(vehicle, pickupISO, returnISO);
  })();

  const validation = (() => {
    if (!currentUser) {
      return { valid: true };
    }
    return validateBookingRequest({
      vehicle,
      currentUser,
      pickupISO,
      returnISO,
      allBookings: bookings,
      allIncidents: incidents,
      now,
    });
  })();

  const scheduledBookings = bookings.filter((b) => {
    if (b.vehicleId !== vehicle.id) return false;
    const st = calculateBookingStatus(b);
    return st === 'ACTIVE' || st === 'UPCOMING' || st === 'OVERDUE';
  });

  const applyDurationPreset = (hours: number) => {
    if (autoSchedule) {
      setPresetHours(hours);
      lastAutoPickup.current = '';
      setBookingError(null);
      return;
    }
    const basePickup = pickupISO
      ? new Date(pickupISO)
      : new Date(Date.now() + 60 * 60 * 1000);
    const nextReturn = new Date(basePickup.getTime() + hours * 60 * 60 * 1000);
    const split = splitDateAndTime(nextReturn.toISOString());
    setReturnDate(split.date);
    setReturnTime(split.time);
    setBookingError(null);
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (!validation.valid) {
      setBookingError(validation.error || 'Selected time slot is unavailable.');
      return;
    }

    if (!agreedToTerms) {
      setBookingError(
        'Please accept the rental agreement and return policy before confirming.'
      );
      return;
    }

    setConfirmModalOpen(true);
  };

  const handleFinalizeBooking = async () => {
    if (!pickupISO || !returnISO) return;
    setSubmitting(true);
    try {
      const res = await createBooking({
        vehicleId: vehicle.id,
        pickupISO,
        returnISO,
      });

      if (!res.success) {
        setBookingError(res.error || 'Unable to complete reservation.');
        setConfirmModalOpen(false);
        return;
      }

      setConfirmModalOpen(false);
      if (res.booking) {
        navigate(`/bookings/${res.booking.id}`);
      } else {
        navigate('/bookings');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/rent"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to vehicles</span>
        </Link>

        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/my-vehicles/${vehicle.id}`)}
          >
            Manage your listing
          </Button>
        )}
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Vehicle Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Primary Image + Thumbnails */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="aspect-[16/10] w-full bg-zinc-100">
              <VehicleImage
                src={vehicle.images[selectedImageIdx] || vehicle.images[0]}
                alt={fullName}
                className="w-full h-full object-cover"
              />
            </div>
            {vehicle.images.length > 1 && (
              <div className="p-3 border-t border-zinc-200 flex items-center gap-2 overflow-x-auto">
                {vehicle.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors shrink-0 cursor-pointer ${
                      selectedImageIdx === idx
                        ? 'border-[#0F766E]'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <VehicleImage
                      src={img}
                      alt={`${fullName} thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vehicle Overview Card */}
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-200 pb-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700">
                    {vehicle.type}
                  </span>
                  <StatusBadge
                    status={opStatus.badgeLabel}
                    tone={opStatus.statusTone}
                    size="sm"
                  />
                </div>
                <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
                  {fullName}
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>{vehicle.location}</span>
                  <span>·</span>
                  <span className="font-mono">
                    {maskRegistrationNumber(
                      vehicle.registrationNumber,
                      isOwner || currentUser?.role === 'ADMIN'
                    )}
                  </span>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="flex sm:justify-end items-baseline gap-1">
                  <span className="font-mono text-2xl font-semibold text-zinc-900">
                    {formatCurrency(vehicle.hourlyRate)}
                  </span>
                  <span className="text-xs text-zinc-500">/ hour</span>
                </div>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {formatCurrency(dailyPrice)} / day ·{' '}
                  {formatCurrency(vehicle.securityDeposit)} deposit
                </p>
              </div>
            </div>

            {/* Technical Specs Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div>
                <p className="text-xs text-zinc-500">Transmission</p>
                <p className="text-sm font-medium text-zinc-900 mt-0.5">
                  {vehicle.transmission}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Fuel type</p>
                <p className="text-sm font-medium text-zinc-900 mt-0.5">
                  {vehicle.fuelType}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Capacity</p>
                <p className="text-sm font-medium text-zinc-900 mt-0.5">
                  {vehicle.seats} {vehicle.seats === 1 ? 'seat' : 'seats'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Host</p>
                <p className="text-sm font-medium text-zinc-900 mt-0.5">
                  {vehicle.ownerName}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2 pt-4 border-t border-zinc-200">
              <h2 className="text-sm font-semibold text-zinc-900">
                Vehicle description
              </h2>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {vehicle.description}
              </p>
            </div>

            {/* Included Features */}
            {vehicle.features.length > 0 && (
              <div className="space-y-2.5 pt-4 border-t border-zinc-200">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Features & equipment
                </h2>
                <div className="flex flex-wrap gap-2">
                  {vehicle.features.map((feat) => (
                    <span
                      key={feat}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Rental Terms & Availability Window */}
            <div className="space-y-2 pt-4 border-t border-zinc-200">
              <h2 className="text-sm font-semibold text-zinc-900">
                Availability & policy terms
              </h2>
              <ul className="space-y-1.5 text-xs text-zinc-600">
                <li>
                  • Available window:{' '}
                  <span className="font-mono text-zinc-900">
                    {formatDateTime(vehicle.availableFrom)}
                  </span>{' '}
                  to{' '}
                  <span className="font-mono text-zinc-900">
                    {formatDateTime(vehicle.availableUntil)}
                  </span>
                </li>
                <li>
                  • Refundable security deposit of{' '}
                  <span className="font-mono font-medium text-zinc-900">
                    {formatCurrency(vehicle.securityDeposit)}
                  </span>{' '}
                  is settled upon vehicle return inspection.
                </li>
                <li>
                  • Late returns beyond the scheduled drop-off time incur{' '}
                  <span className="font-mono font-medium text-zinc-900">
                    {formatCurrency(LATE_PENALTY_PER_HOUR)}/hr
                  </span>
                  .
                </li>
                <li>• {vehicle.cancellationPolicy}</li>
              </ul>
            </div>
          </div>

          {/* Existing Reserved Slots */}
          {scheduledBookings.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Upcoming & active reservations ({scheduledBookings.length})
              </h2>
              <p className="text-xs text-zinc-500">
                Choose pickup and return times that do not overlap with the windows below:
              </p>
              <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-lg overflow-hidden">
                {scheduledBookings.map((b) => {
                  const st = calculateBookingStatus(b);
                  return (
                    <div
                      key={b.id}
                      className="px-3.5 py-2.5 flex items-center justify-between text-xs bg-zinc-50/50"
                    >
                      <span className="font-mono text-zinc-700">
                        {formatDateTime(b.pickupDateTime)} →{' '}
                        {formatDateTime(b.returnDateTime)}
                      </span>
                      <StatusBadge status={st} size="sm" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Sticky Reservation Calculator */}
        <div className="lg:col-span-5 lg:sticky lg:top-20">
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
            <div className="border-b border-zinc-200 pb-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Reserve this vehicle
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Select your pickup and return schedule for instant pricing.
              </p>
            </div>

            {!opStatus.isBookable && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{opStatus.badgeLabel}</p>
                  <p className="mt-0.5">{opStatus.reason}</p>
                </div>
              </div>
            )}

            {opStatus.isBookable && !opStatus.isFreeNow && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {opStatus.reason}
              </div>
            )}

            {!autoSchedule && (
              <button
                type="button"
                onClick={() => {
                  lastAutoPickup.current = '';
                  setAutoSchedule(true);
                  setBookingError(null);
                }}
                className="text-xs font-medium text-[#0F766E] hover:underline cursor-pointer"
              >
                Use next available time
              </button>
            )}

            <form onSubmit={handleOpenConfirm} className="space-y-4">
              {/* Quick Duration Presets */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700">
                  Quick trip duration
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.hours}
                      type="button"
                      onClick={() => applyDurationPreset(preset.hours)}
                      disabled={!opStatus.isBookable || isOwner}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Pickup date"
                  type="date"
                  min={splitDateAndTime(now.toISOString()).date}
                  value={pickupDate}
                  onChange={(e) => {
                    setPickupDate(e.target.value);
                    setAutoSchedule(false);
                    setBookingError(null);
                  }}
                  disabled={!opStatus.isBookable || isOwner}
                  required
                />
                <Input
                  label="Pickup time"
                  type="time"
                  value={pickupTime}
                  onChange={(e) => {
                    setPickupTime(e.target.value);
                    setAutoSchedule(false);
                    setBookingError(null);
                  }}
                  disabled={!opStatus.isBookable || isOwner}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Return date"
                  type="date"
                  min={pickupDate}
                  value={returnDate}
                  onChange={(e) => {
                    setReturnDate(e.target.value);
                    setAutoSchedule(false);
                    setBookingError(null);
                  }}
                  disabled={!opStatus.isBookable || isOwner}
                  required
                />
                <Input
                  label="Return time"
                  type="time"
                  value={returnTime}
                  onChange={(e) => {
                    setReturnTime(e.target.value);
                    setAutoSchedule(false);
                    setBookingError(null);
                  }}
                  disabled={!opStatus.isBookable || isOwner}
                  required
                />
              </div>

              {/* Validation Error */}
              {(bookingError || (!validation.valid && validation.error)) && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{bookingError || validation.error}</span>
                </div>
              )}

              {/* Itemized Price Breakdown */}
              {pricing.valid && (
                <div className="bg-[#F8F8F7] border border-zinc-200 rounded-lg p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Duration</span>
                    <span className="font-mono font-medium text-zinc-900">
                      {pricing.formattedDuration}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-zinc-600">
                    <span>
                      Rental charge ({pricing.durationHours}h ×{' '}
                      {formatCurrency(pricing.hourlyRate)}/h)
                    </span>
                    <span className="font-mono font-medium text-zinc-900">
                      {formatCurrency(pricing.rentalAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Refundable security deposit</span>
                    <span className="font-mono font-medium text-zinc-900">
                      {formatCurrency(pricing.securityDeposit)}
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-zinc-200 flex items-center justify-between text-sm font-semibold text-zinc-900">
                    <span>Total payable now</span>
                    <span className="font-mono text-base">
                      {formatCurrency(pricing.totalPayable)}
                    </span>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2.5 text-xs text-zinc-600 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-[#0F766E] focus:ring-[#0F766E]"
                />
                <span>
                  I agree to return the vehicle on time and understand that late returns or physical damage are deducted from the security deposit.
                </span>
              </label>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={!opStatus.isBookable || isOwner || !pricing.valid}
              >
                {isOwner
                  ? 'You own this listing'
                  : currentUser
                  ? 'Review & confirm booking'
                  : 'Sign in to book'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Booking Confirmation Modal */}
      {pricing.valid && (
        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Confirm reservation"
          subtitle={fullName}
          maxWidth="md"
        >
          <div className="space-y-5">
            <div className="bg-[#F8F8F7] border border-zinc-200 rounded-lg p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Pickup</span>
                <span className="font-mono font-medium text-zinc-900">
                  {formatDateTime(pickupISO)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Return</span>
                <span className="font-mono font-medium text-zinc-900">
                  {formatDateTime(returnISO)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Duration</span>
                <span className="font-mono font-medium text-zinc-900">
                  {pricing.formattedDuration}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-200 flex justify-between">
                <span className="text-zinc-500">Rental fee</span>
                <span className="font-mono font-medium text-zinc-900">
                  {formatCurrency(pricing.rentalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Security deposit</span>
                <span className="font-mono font-medium text-zinc-900">
                  {formatCurrency(pricing.securityDeposit)}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-200 flex justify-between text-sm font-semibold text-zinc-900">
                <span>Total payable</span>
                <span className="font-mono">
                  {formatCurrency(pricing.totalPayable)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setConfirmModalOpen(false)}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={submitting}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={handleFinalizeBooking}
              >
                Confirm & pay {formatCurrency(pricing.totalPayable)}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
