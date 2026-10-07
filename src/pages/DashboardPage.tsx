import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Plus,
} from 'lucide-react';
import { ContactPartyModal } from '../components/modals/ContactPartyModal';
import { IncidentReportModal } from '../components/modals/IncidentReportModal';
import { ReturnVehicleModal } from '../components/modals/ReturnVehicleModal';
import {
  Button,
  StatusBadge,
  VehicleImage,
} from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { Booking, IncidentType } from '../types/models';
import {
  calculateBookingStatus,
  evaluateVehicleOperationalStatus,
  formatCurrency,
  formatDateTime,
} from '../utils/rentalCalculations';

export const DashboardPage: React.FC = () => {
  const {
    currentUser,
    vehicles,
    bookings,
    incidents,
    sendOverdueReminder,
  } = useApp();
  const navigate = useNavigate();

  const [returnModalBooking, setReturnModalBooking] = useState<Booking | null>(
    null
  );
  const [incidentModalState, setIncidentModalState] = useState<{
    booking: Booking;
    type: IncidentType;
  } | null>(null);
  const [contactModalState, setContactModalState] = useState<{
    booking: Booking;
    roleView: 'OWNER' | 'RENTER';
  } | null>(null);

  if (!currentUser) return null;

  const myRentals = bookings.filter((b) => b.renterId === currentUser.id);
  const myOwnedVehicles = vehicles.filter((v) => v.ownerId === currentUser.id);
  const bookingsOnMyVehicles = bookings.filter(
    (b) => b.ownerId === currentUser.id
  );

  const activeRentals = myRentals.filter((b) => {
    const st = calculateBookingStatus(b);
    return st === 'ACTIVE' || st === 'UPCOMING' || st === 'OVERDUE';
  });

  const overdueRentals = myRentals.filter(
    (b) => calculateBookingStatus(b) === 'OVERDUE'
  );

  const overdueOnMyFleet = bookingsOnMyVehicles.filter(
    (b) => calculateBookingStatus(b) === 'OVERDUE'
  );

  const totalEarnedFromFleet = bookingsOnMyVehicles
    .filter((b) => calculateBookingStatus(b) !== 'CANCELLED')
    .reduce(
      (sum, b) => sum + b.rentalAmount + b.latePenalty + b.damageAmount,
      0
    );

  const totalSpentOnRentals = myRentals
    .filter((b) => calculateBookingStatus(b) !== 'CANCELLED')
    .reduce(
      (sum, b) => sum + b.rentalAmount + b.latePenalty + b.damageAmount,
      0
    );

  const openIncidentsForMe = incidents.filter((inc) => {
    const relatedBooking = bookings.find((b) => b.id === inc.bookingId);
    const isInvolved =
      inc.reportedBy === currentUser.id ||
      relatedBooking?.ownerId === currentUser.id ||
      relatedBooking?.renterId === currentUser.id;
    return (
      isInvolved && (inc.status === 'OPEN' || inc.status === 'UNDER_REVIEW')
    );
  });

  const getVehicle = (vehicleId: string) =>
    vehicles.find((v) => v.id === vehicleId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Account overview
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Signed in as {currentUser.name} ({currentUser.email})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/list-vehicle')}
          >
            List My vehicle
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/rent')}
          >
            Book a vehicle
          </Button>
        </div>
      </div>

      {/* Overdue Alert Banner (Only shown when an overdue trip exists) */}
      {(overdueRentals.length > 0 || overdueOnMyFleet.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-red-900">
                {overdueRentals.length > 0
                  ? `${overdueRentals.length} rental(s) past scheduled return time`
                  : `${overdueOnMyFleet.length} customer trip(s) on your fleet overdue`}
              </h2>
              <p className="text-xs text-red-800 mt-0.5">
                {overdueRentals.length > 0
                  ? 'Complete return check-in promptly to minimize hourly late fees.'
                  : 'You can send a return reminder or log a non-return report from the trip record.'}
              </p>
            </div>
          </div>
          {overdueRentals.length > 0 ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setReturnModalBooking(overdueRentals[0])}
            >
              Return vehicle now
            </Button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => navigate(`/bookings/${overdueOnMyFleet[0].id}`)}
            >
              Inspect overdue trip
            </Button>
          )}
        </div>
      )}

      {/* Single Unified Metric Strip */}
      <div className="bg-white border border-zinc-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200">
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">
            Active & upcoming trips
          </p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {activeRentals.length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {myRentals.length} total rentals booked
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">My listed fleet</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {myOwnedVehicles.length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {bookingsOnMyVehicles.length} customer reservations
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">
            Fleet gross earnings
          </p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {formatCurrency(totalEarnedFromFleet)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {formatCurrency(totalSpentOnRentals)} spent as renter
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">Open incidents</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {openIncidentsForMe.length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {openIncidentsForMe.length === 0
              ? 'No active claims'
              : 'Under review'}
          </p>
        </div>
      </div>

      {/* Main Two-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 Columns: Trips & Fleet Bookings */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              Current & recent reservations
            </h2>
            <Link
              to="/bookings"
              className="text-xs font-medium text-[#0F766E] hover:underline inline-flex items-center gap-1"
            >
              <span>All bookings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {myRentals.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-3">
              <p className="text-sm font-medium text-zinc-900">
                No reservations under your account yet
              </p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Browse available cars, SUVs, and bikes to schedule your first trip.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/rent')}
              >
                Browse vehicles
              </Button>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
              {myRentals.slice(0, 5).map((booking) => {
                const vehicle = getVehicle(booking.vehicleId);
                const st = calculateBookingStatus(booking);
                const canReturn =
                  st === 'ACTIVE' || st === 'OVERDUE' || st === 'UPCOMING';
                const fullName = vehicle
                  ? `${vehicle.brand} ${vehicle.model}`
                  : 'Vehicle';
                const totalCharges =
                  booking.rentalAmount +
                  booking.latePenalty +
                  booking.damageAmount;

                return (
                  <div
                    key={booking.id}
                    className="p-4 sm:p-5 hover:bg-zinc-50/60 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <VehicleImage
                          src={vehicle?.images[0]}
                          alt={fullName}
                          className="w-16 h-12 rounded-lg object-cover border border-zinc-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/bookings/${booking.id}`}
                              className="text-sm font-semibold text-zinc-900 hover:text-[#0F766E] truncate"
                            >
                              {fullName}
                            </Link>
                            <StatusBadge status={st} size="sm" />
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 font-mono">
                            {formatDateTime(booking.pickupDateTime)} →{' '}
                            {formatDateTime(booking.returnDateTime)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-semibold text-zinc-900">
                          {formatCurrency(totalCharges)}
                        </p>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          +{formatCurrency(booking.securityDeposit)} deposit
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100">
                      <span className="text-xs text-zinc-500">
                        {vehicle?.location || 'Verified pickup hub'}
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setContactModalState({
                              booking,
                              roleView: 'RENTER',
                            })
                          }
                        >
                          Contact host
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/bookings/${booking.id}`)}
                        >
                          Details
                        </Button>
                        {canReturn && (
                          <Button
                            variant={st === 'OVERDUE' ? 'danger' : 'primary'}
                            size="sm"
                            onClick={() => setReturnModalBooking(booking)}
                          >
                            Return vehicle
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Customer Reservations on My Fleet */}
          {bookingsOnMyVehicles.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-base font-semibold text-zinc-900">
                Customer trips on your fleet ({bookingsOnMyVehicles.length})
              </h2>
              <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
                {bookingsOnMyVehicles.slice(0, 4).map((b) => {
                  const v = getVehicle(b.vehicleId);
                  const st = calculateBookingStatus(b);
                  return (
                    <div
                      key={b.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900">
                            {v ? `${v.brand} ${v.model}` : 'Vehicle'}
                          </span>
                          <StatusBadge status={st} size="sm" />
                        </div>
                        <p className="text-zinc-500">
                          Renter: {b.renterName} · Due{' '}
                          <span className="font-mono">
                            {formatDateTime(b.returnDateTime)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {st === 'OVERDUE' && (
                          <Button
                            variant="amber"
                            size="sm"
                            leftIcon={<BellRing className="w-3.5 h-3.5" />}
                            onClick={() => sendOverdueReminder(b.id)}
                          >
                            Remind ({b.remindersSent})
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/bookings/${b.id}`)}
                        >
                          Inspect
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns: My Fleet Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              My fleet ({myOwnedVehicles.length})
            </h2>
            <Link
              to="/my-vehicles"
              className="text-xs font-medium text-[#0F766E] hover:underline inline-flex items-center gap-1"
            >
              <span>Manage fleet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {myOwnedVehicles.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-3">
              <p className="text-sm font-medium text-zinc-900">
                No vehicles listed yet
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                List your car, SUV, or bike to earn rental income when you are not using it.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/list-vehicle')}
              >
                List a vehicle
              </Button>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
              {myOwnedVehicles.map((v) => {
                const opStatus = evaluateVehicleOperationalStatus(
                  v,
                  bookings,
                  incidents
                );
                const fullName = `${v.brand} ${v.model}`;
                return (
                  <div
                    key={v.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-zinc-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <VehicleImage
                        src={v.images[0]}
                        alt={fullName}
                        className="w-14 h-10 rounded-md object-cover border border-zinc-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <Link
                          to={`/my-vehicles/${v.id}`}
                          className="text-sm font-semibold text-zinc-900 hover:text-[#0F766E] truncate block"
                        >
                          {fullName}
                        </Link>
                        <p className="text-xs text-zinc-500 font-mono">
                          {v.registrationNumber} ·{' '}
                          {formatCurrency(v.hourlyRate)}/hr
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge
                        status={opStatus.badgeLabel}
                        tone={opStatus.statusTone}
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {returnModalBooking && (
        <ReturnVehicleModal
          isOpen={Boolean(returnModalBooking)}
          onClose={() => setReturnModalBooking(null)}
          booking={returnModalBooking}
          vehicle={getVehicle(returnModalBooking.vehicleId)}
        />
      )}

      {incidentModalState && (
        <IncidentReportModal
          isOpen={Boolean(incidentModalState)}
          onClose={() => setIncidentModalState(null)}
          booking={incidentModalState.booking}
          vehicle={getVehicle(incidentModalState.booking.vehicleId)}
          initialType={incidentModalState.type}
        />
      )}

      {contactModalState && (
        <ContactPartyModal
          isOpen={Boolean(contactModalState)}
          onClose={() => setContactModalState(null)}
          booking={contactModalState.booking}
          vehicle={getVehicle(contactModalState.booking.vehicleId)}
          roleView={contactModalState.roleView}
        />
      )}
    </div>
  );
};
