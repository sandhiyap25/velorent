import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Booking, Incident, Vehicle } from '../types/models';
import { useNow } from '../hooks/useNow';
import {
  evaluateLiveAvailability,
  formatCurrency,
} from '../utils/rentalCalculations';
import { Button, StatusBadge, VehicleImage } from './ui/CommonUI';

interface VehicleCardProps {
  vehicle: Vehicle;
  bookings: Booking[];
  incidents: Incident[];
  currentUserId?: string;
  onSelect?: (vehicle: Vehicle) => void;
  actionLabel?: string;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  bookings,
  incidents,
  currentUserId,
  onSelect,
  actionLabel,
}) => {
  const navigate = useNavigate();
  const now = useNow(30_000); // keeps the badge live
  const opStatus = evaluateLiveAvailability(vehicle, bookings, incidents, now);
  const isOwner = Boolean(currentUserId && vehicle.ownerId === currentUserId);
  const fullName = `${vehicle.brand} ${vehicle.model}`;
  const dailyPrice = vehicle.dailyRate || vehicle.hourlyRate * 20;

  const handleAction = () => {
    if (onSelect) {
      onSelect(vehicle);
    } else if (isOwner) {
      navigate(`/my-vehicles/${vehicle.id}`);
    } else {
      navigate(`/rent/${vehicle.id}`);
    }
  };

  return (
    <div
      onClick={handleAction}
      className="group bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors duration-150 overflow-hidden flex flex-col cursor-pointer"
    >
      {/* Image Container (16:10 aspect ratio) */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 border-b border-zinc-100">
        <VehicleImage
          src={vehicle.images[0] || ''}
          alt={fullName}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />

        {/* Top Row: Category & Status */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/95 text-zinc-800 border border-zinc-200/80">
            {vehicle.type}
          </span>
          <StatusBadge
            status={opStatus.badgeLabel}
            tone={opStatus.statusTone}
            size="sm"
          />
        </div>

        {isOwner && (
          <div className="absolute bottom-2.5 left-2.5">
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-900/90 text-white">
              Your listing
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <p className="text-xs text-zinc-500">{vehicle.brand}</p>
          <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-[#0F766E] transition-colors line-clamp-1">
            {fullName}
          </h3>

          {/* Specs row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 mt-2">
            <span>{vehicle.transmission}</span>
            <span className="text-zinc-300">·</span>
            <span>{vehicle.fuelType}</span>
            <span className="text-zinc-300">·</span>
            <span>
              {vehicle.seats} {vehicle.seats === 1 ? 'seat' : 'seats'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1.5">
            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{vehicle.location}</span>
          </div>
        </div>

        {/* Pricing & Action Footer */}
        <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-base font-semibold text-zinc-900">
                {formatCurrency(vehicle.hourlyRate)}
              </span>
              <span className="text-xs text-zinc-500">/ hr</span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              {formatCurrency(dailyPrice)}/day · {formatCurrency(vehicle.securityDeposit)} deposit
            </p>
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <Button
              variant={isOwner ? 'outline' : 'primary'}
              size="sm"
              onClick={handleAction}
            >
              {actionLabel || (isOwner ? 'Manage' : 'View details')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
