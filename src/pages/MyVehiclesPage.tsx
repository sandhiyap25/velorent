import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  Button,
  EmptyState,
  StatusBadge,
  VehicleImage,
} from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import {
  calculateBookingStatus,
  evaluateVehicleOperationalStatus,
  formatCurrency,
} from '../utils/rentalCalculations';

export const MyVehiclesPage: React.FC = () => {
  const {
    currentUser,
    vehicles,
    bookings,
    incidents,
    toggleVehicleListing,
  } = useApp();
  const navigate = useNavigate();

  if (!currentUser) return null;

  const myVehicles = vehicles.filter((v) => v.ownerId === currentUser.id);
  const myVehicleBookings = bookings.filter(
    (b) => b.ownerId === currentUser.id
  );

  const totalFleetRevenue = myVehicleBookings
    .filter((b) => calculateBookingStatus(b) !== 'CANCELLED')
    .reduce(
      (sum, b) => sum + b.rentalAmount + b.latePenalty + b.damageAmount,
      0
    );

  const activeBookingsOnFleet = myVehicleBookings.filter((b) => {
    const st = calculateBookingStatus(b);
    return st === 'ACTIVE' || st === 'UPCOMING' || st === 'OVERDUE';
  }).length;

  const openIncidentsOnFleet = incidents.filter((inc) => {
    const isMyVehicle = myVehicles.some((v) => v.id === inc.vehicleId);
    return isMyVehicle && inc.status !== 'RESOLVED' && inc.status !== 'CLOSED';
  }).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            My fleet
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Manage pricing, operational status, and customer bookings for your listed vehicles.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/list-vehicle')}
        >
          List a vehicle
        </Button>
      </div>

      {/* Fleet Metric Strip */}
      <div className="bg-white border border-zinc-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200">
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">Listed vehicles</p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {myVehicles.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">
            Active & upcoming bookings
          </p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {activeBookingsOnFleet}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">
            Total fleet earnings
          </p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {formatCurrency(totalFleetRevenue)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-zinc-500">
            Open incident claims
          </p>
          <p className="text-2xl font-semibold text-zinc-900 font-mono mt-1">
            {openIncidentsOnFleet}
          </p>
        </div>
      </div>

      {/* Fleet List */}
      {myVehicles.length === 0 ? (
        <EmptyState
          title="No vehicles in your fleet"
          description="List your car, SUV, bike, or van to start receiving rental bookings."
          actionLabel="List your first vehicle"
          onAction={() => navigate('/list-vehicle')}
        />
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
          {myVehicles.map((vehicle) => {
            const fullName = `${vehicle.brand} ${vehicle.model}`;
            const opStatus = evaluateVehicleOperationalStatus(
              vehicle,
              bookings,
              incidents
            );
            const vehicleBookings = bookings.filter(
              (b) => b.vehicleId === vehicle.id
            );
            const vehicleRevenue = vehicleBookings
              .filter((b) => calculateBookingStatus(b) !== 'CANCELLED')
              .reduce(
                (sum, b) =>
                  sum + b.rentalAmount + b.latePenalty + b.damageAmount,
                0
              );

            return (
              <div key={vehicle.id} className="p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Vehicle Info */}
                  <div className="flex items-start gap-4">
                    <VehicleImage
                      src={vehicle.images[0] || ''}
                      alt={fullName}
                      className="w-24 h-16 rounded-lg object-cover border border-zinc-200 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/my-vehicles/${vehicle.id}`}
                          className="text-base font-semibold text-zinc-900 hover:text-[#0F766E]"
                        >
                          {fullName}
                        </Link>
                        <StatusBadge
                          status={opStatus.badgeLabel}
                          tone={opStatus.statusTone}
                          size="sm"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="font-mono">
                          {vehicle.registrationNumber}
                        </span>
                        <span>·</span>
                        <span>{vehicle.type}</span>
                        <span>·</span>
                        <span>{vehicle.transmission}</span>
                        <span>·</span>
                        <span>{vehicle.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rates & Revenue */}
                  <div className="grid grid-cols-3 gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-100 text-xs">
                    <div>
                      <p className="text-zinc-500">Rates</p>
                      <p className="font-mono font-semibold text-zinc-900 mt-0.5">
                        {formatCurrency(vehicle.hourlyRate)}/h
                      </p>
                      <p className="font-mono text-zinc-500">
                        {formatCurrency(
                          vehicle.dailyRate || vehicle.hourlyRate * 20
                        )}
                        /d
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Bookings</p>
                      <p className="font-mono font-semibold text-zinc-900 mt-0.5">
                        {vehicleBookings.length}
                      </p>
                      <p className="text-zinc-500">{vehicle.fuelType}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Earned</p>
                      <p className="font-mono font-semibold text-zinc-900 mt-0.5">
                        {formatCurrency(vehicleRevenue)}
                      </p>
                      <p className="font-mono text-zinc-500">
                        Dep: {formatCurrency(vehicle.securityDeposit)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-zinc-500">{opStatus.reason}</div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVehicleListing(vehicle.id)}
                    >
                      {vehicle.status === 'DISABLED'
                        ? 'Enable listing'
                        : 'Pause listing'}
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/my-vehicles/${vehicle.id}`)}
                    >
                      Manage vehicle
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
