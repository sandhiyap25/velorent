import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  Button,
  StatusBadge,
  VehicleImage,
} from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import {
  calculateBookingStatus,
  evaluateVehicleOperationalStatus,
  formatCurrency,
  formatDateTime,
} from '../utils/rentalCalculations';

export const AdminDashboardPage: React.FC = () => {
  const { users, vehicles, bookings, incidents } = useApp();
  const navigate = useNavigate();

  const activeBookings = bookings.filter((b) => {
    const st = calculateBookingStatus(b);
    return st === 'ACTIVE' || st === 'UPCOMING';
  });
  const overdueBookings = bookings.filter(
    (b) => calculateBookingStatus(b) === 'OVERDUE'
  );
  const lateReturnedBookings = bookings.filter(
    (b) => calculateBookingStatus(b) === 'RETURNED_LATE'
  );
  const openIncidents = incidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );

  const totalRevenueVolume = bookings
    .filter((b) => calculateBookingStatus(b) !== 'CANCELLED')
    .reduce(
      (sum, b) => sum + b.rentalAmount + b.latePenalty + b.damageAmount,
      0
    );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Operations & claims administration
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Monitor active fleet bookings, overdue returns, and incident claims across {users.length} registered accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/admin/incidents')}
          >
            Review incidents ({openIncidents.length} open)
          </Button>
        </div>
      </div>

      {/* Single Restrained Metric Strip */}
      <div className="bg-white border border-zinc-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200">
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">Total fleet size</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {vehicles.length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {users.length} registered users
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">
            Active reservations
          </p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {activeBookings.length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {bookings.length} total bookings
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">Late or overdue</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {overdueBookings.length + lateReturnedBookings.length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {overdueBookings.length} currently overdue
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">
            Gross booking volume
          </p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {formatCurrency(totalRevenueVolume)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {openIncidents.length} unresolved incident(s)
          </p>
        </div>
      </div>

      {/* Main Split Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 Cols: Recent & Overdue Bookings Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              All platform reservations ({bookings.length})
            </h2>
            <Link
              to="/bookings"
              className="text-xs font-medium text-[#0F766E] hover:underline inline-flex items-center gap-1"
            >
              <span>Bookings view</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
            {bookings.slice(0, 8).map((b) => {
              const vehicle = vehicles.find((v) => v.id === b.vehicleId);
              const st = calculateBookingStatus(b);
              const fullName = vehicle
                ? `${vehicle.brand} ${vehicle.model}`
                : 'Vehicle';
              return (
                <div
                  key={b.id}
                  onClick={() => navigate(`/bookings/${b.id}`)}
                  className="p-4 hover:bg-zinc-50/70 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-400">
                        {b.id}
                      </span>
                      <span className="text-sm font-semibold text-zinc-900">
                        {fullName}
                      </span>
                      <StatusBadge status={st} size="sm" />
                    </div>
                    <p className="text-xs text-zinc-500">
                      Renter: {b.renterName} · Return:{' '}
                      <span className="font-mono">
                        {formatDateTime(b.returnDateTime)}
                      </span>
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="font-mono text-sm font-semibold text-zinc-900">
                      {formatCurrency(
                        b.rentalAmount + b.latePenalty + b.damageAmount
                      )}
                    </p>
                    {(b.latePenalty > 0 || b.damageAmount > 0) && (
                      <p className="font-mono text-[11px] text-red-600">
                        +{formatCurrency(b.latePenalty + b.damageAmount)} fees
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Open Incidents & Fleet Status */}
        <div className="lg:col-span-5 space-y-6">
          {/* Open Incidents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                Incident queue ({incidents.length})
              </h2>
              <Link
                to="/admin/incidents"
                className="text-xs font-medium text-[#0F766E] hover:underline inline-flex items-center gap-1"
              >
                <span>Manage claims</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
              {incidents.slice(0, 4).map((inc) => {
                const vehicle = vehicles.find((v) => v.id === inc.vehicleId);
                const fullName = vehicle
                  ? `${vehicle.brand} ${vehicle.model}`
                  : 'Vehicle';
                return (
                  <div key={inc.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-900">
                        {inc.type}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={inc.priority} size="sm" />
                        <StatusBadge status={inc.status} size="sm" />
                      </div>
                    </div>
                    <p className="text-zinc-500">
                      {fullName} · Reported by {inc.reporterName}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono font-semibold text-red-700">
                        {inc.estimatedDamageCost
                          ? `Est. ${formatCurrency(inc.estimatedDamageCost)}`
                          : inc.id}
                      </span>
                      <Link
                        to="/admin/incidents"
                        className="text-[#0F766E] font-medium hover:underline"
                      >
                        Review →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fleet Directory */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">
              Fleet operational status
            </h2>
            <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
              {vehicles.slice(0, 6).map((v) => {
                const opStatus = evaluateVehicleOperationalStatus(
                  v,
                  bookings,
                  incidents
                );
                const fullName = `${v.brand} ${v.model}`;
                return (
                  <div
                    key={v.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <VehicleImage
                        src={v.images[0] || ''}
                        alt={fullName}
                        className="w-12 h-9 rounded object-cover border border-zinc-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 truncate">
                          {fullName}
                        </p>
                        <p className="font-mono text-zinc-500">
                          {v.registrationNumber}
                        </p>
                      </div>
                    </div>
                    <StatusBadge
                      status={opStatus.badgeLabel}
                      tone={opStatus.statusTone}
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
