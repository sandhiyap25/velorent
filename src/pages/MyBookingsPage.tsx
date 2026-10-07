import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ContactPartyModal } from '../components/modals/ContactPartyModal';
import { IncidentReportModal } from '../components/modals/IncidentReportModal';
import { ReturnVehicleModal } from '../components/modals/ReturnVehicleModal';
import {
  Button,
  EmptyState,
  StatusBadge,
  VehicleImage,
} from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { Booking } from '../types/models';
import {
  calculateBookingStatus,
  formatCurrency,
  formatDateTime,
} from '../utils/rentalCalculations';

type TabFilter =
  | 'ALL'
  | 'ACTIVE_UPCOMING'
  | 'COMPLETED'
  | 'LATE_OR_ISSUES'
  | 'CANCELLED';
type PerspectiveMode = 'RENTER' | 'OWNER';

export const MyBookingsPage: React.FC = () => {
  const {
    currentUser,
    vehicles,
    bookings,
    incidents,
    cancelBooking,
  } = useApp();
  const navigate = useNavigate();

  const [perspective, setPerspective] = useState<PerspectiveMode>('RENTER');
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [returnModalBooking, setReturnModalBooking] = useState<Booking | null>(
    null
  );
  const [incidentModalBooking, setIncidentModalBooking] =
    useState<Booking | null>(null);
  const [contactModalBooking, setContactModalBooking] =
    useState<Booking | null>(null);

  if (!currentUser) return null;

  const myRenterBookings = bookings.filter(
    (b) => b.renterId === currentUser.id
  );
  const myOwnerBookings = bookings.filter((b) => b.ownerId === currentUser.id);

  const baseBookings =
    perspective === 'RENTER' ? myRenterBookings : myOwnerBookings;

  const filteredBookings = useMemo(() => {
    return baseBookings.filter((b) => {
      const vehicle = vehicles.find((v) => v.id === b.vehicleId);
      const st = calculateBookingStatus(b);
      const hasIncident = incidents.some((inc) => inc.bookingId === b.id);

      if (activeTab === 'ACTIVE_UPCOMING') {
        if (st !== 'ACTIVE' && st !== 'UPCOMING' && st !== 'OVERDUE') {
          return false;
        }
      } else if (activeTab === 'COMPLETED') {
        if (st !== 'RETURNED') return false;
      } else if (activeTab === 'LATE_OR_ISSUES') {
        if (st !== 'RETURNED_LATE' && st !== 'OVERDUE' && !hasIncident) {
          return false;
        }
      } else if (activeTab === 'CANCELLED') {
        if (st !== 'CANCELLED') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = b.id.toLowerCase().includes(q);
        const matchVehicle = vehicle
          ? `${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(q) ||
            vehicle.registrationNumber.toLowerCase().includes(q)
          : false;
        const matchRenter = b.renterName.toLowerCase().includes(q);
        if (!matchId && !matchVehicle && !matchRenter) return false;
      }

      return true;
    });
  }, [baseBookings, vehicles, incidents, activeTab, searchQuery]);

  const returnModalVehicle = returnModalBooking
    ? vehicles.find((v) => v.id === returnModalBooking.vehicleId) || null
    : null;

  const incidentModalVehicle = incidentModalBooking
    ? vehicles.find((v) => v.id === incidentModalBooking.vehicleId) || null
    : null;

  const contactModalVehicle = contactModalBooking
    ? vehicles.find((v) => v.id === contactModalBooking.vehicleId) || null
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header & Perspective Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Bookings
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            View rental schedules, complete vehicle returns, or report an incident.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-lg bg-zinc-100 border border-zinc-200 self-start">
          <button
            onClick={() => setPerspective('RENTER')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              perspective === 'RENTER'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            My trips ({myRenterBookings.length})
          </button>
          <button
            onClick={() => setPerspective('OWNER')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              perspective === 'OWNER'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Fleet bookings ({myOwnerBookings.length})
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'ACTIVE_UPCOMING', label: 'Active & upcoming' },
              { id: 'COMPLETED', label: 'Returned' },
              { id: 'LATE_OR_ISSUES', label: 'Late or incidents' },
              { id: 'CANCELLED', label: 'Cancelled' },
            ] as { id: TabFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vehicle or booking ID..."
            className="w-full pl-9 pr-3 h-9 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0F766E]"
          />
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          title={
            perspective === 'RENTER'
              ? 'No trips found'
              : 'No customer bookings found'
          }
          description={
            perspective === 'RENTER'
              ? 'You have no bookings matching the selected filter.'
              : 'When renters reserve your listed vehicles, their bookings appear here.'
          }
          actionLabel={
            perspective === 'RENTER' ? 'Browse vehicles' : 'List a vehicle'
          }
          onAction={() =>
            navigate(perspective === 'RENTER' ? '/rent' : '/list-vehicle')
          }
        />
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
          {filteredBookings.map((booking) => {
            const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
            if (!vehicle) return null;

            const fullName = `${vehicle.brand} ${vehicle.model}`;
            const st = calculateBookingStatus(booking);
            const bookingIncidents = incidents.filter(
              (inc) => inc.bookingId === booking.id
            );
            const canReturnOrInspect =
              st === 'ACTIVE' || st === 'UPCOMING' || st === 'OVERDUE';
            const canCancel = st === 'UPCOMING';
            const totalCharges =
              booking.rentalAmount + booking.latePenalty + booking.damageAmount;

            return (
              <div key={booking.id} className="p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Vehicle & Dates */}
                  <div className="flex items-start gap-4">
                    <VehicleImage
                      src={vehicle.images[0] || ''}
                      alt={fullName}
                      className="w-20 h-14 rounded-lg object-cover border border-zinc-200 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400">
                          {booking.id}
                        </span>
                        <Link
                          to={`/bookings/${booking.id}`}
                          className="text-sm font-semibold text-zinc-900 hover:text-[#0F766E]"
                        >
                          {fullName}
                        </Link>
                        <StatusBadge status={st} size="sm" />
                        {bookingIncidents.length > 0 && (
                          <StatusBadge
                            status="Incident logged"
                            tone="warning"
                            size="sm"
                          />
                        )}
                      </div>

                      <p className="text-xs text-zinc-600 font-mono">
                        {formatDateTime(booking.pickupDateTime)} →{' '}
                        {formatDateTime(booking.returnDateTime)}
                      </p>

                      <p className="text-xs text-zinc-500">
                        {perspective === 'RENTER'
                          ? `Location: ${vehicle.location}`
                          : `Renter: ${booking.renterName} (${booking.renterEmail})`}
                      </p>
                    </div>
                  </div>

                  {/* Right: Financial Summary */}
                  <div className="flex sm:flex-col justify-between sm:items-end gap-1 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-100">
                    <div>
                      <span className="text-xs text-zinc-500 sm:hidden mr-2">
                        Total:
                      </span>
                      <span className="font-mono text-base font-semibold text-zinc-900">
                        {formatCurrency(totalCharges)}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      Base {formatCurrency(booking.rentalAmount)} · Deposit{' '}
                      {formatCurrency(booking.securityDeposit)}
                      {booking.latePenalty > 0 && (
                        <span className="text-red-600">
                          {' '}
                          · Late +{formatCurrency(booking.latePenalty)}
                        </span>
                      )}
                      {booking.damageAmount > 0 && (
                        <span className="text-red-600">
                          {' '}
                          · Damage +{formatCurrency(booking.damageAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-zinc-500">
                    {booking.actualReturnDateTime
                      ? `Returned ${formatDateTime(booking.actualReturnDateTime)}`
                      : `${booking.durationHours}h scheduled rental`}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/bookings/${booking.id}`)}
                    >
                      View details
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setContactModalBooking(booking)}
                    >
                      {perspective === 'RENTER'
                        ? 'Contact host'
                        : 'Contact renter'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIncidentModalBooking(booking)}
                    >
                      Report incident
                    </Button>

                    {canCancel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelBooking(booking.id)}
                      >
                        Cancel
                      </Button>
                    )}

                    {canReturnOrInspect && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setReturnModalBooking(booking)}
                      >
                        {perspective === 'OWNER'
                          ? 'Inspect & close return'
                          : 'Return vehicle'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ReturnVehicleModal
        isOpen={Boolean(returnModalBooking)}
        onClose={() => setReturnModalBooking(null)}
        booking={returnModalBooking}
        vehicle={returnModalVehicle}
      />

      <IncidentReportModal
        isOpen={Boolean(incidentModalBooking)}
        onClose={() => setIncidentModalBooking(null)}
        booking={incidentModalBooking}
        vehicle={incidentModalVehicle}
      />

      <ContactPartyModal
        isOpen={Boolean(contactModalBooking)}
        onClose={() => setContactModalBooking(null)}
        booking={contactModalBooking}
        vehicle={contactModalVehicle}
        roleLabel={perspective === 'RENTER' ? 'Vehicle Host' : 'Renter'}
      />
    </div>
  );
};
