import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Button, Modal } from '../ui/CommonUI';
import { Booking, User, Vehicle } from '../../types/models';

interface ContactPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  vehicle: Vehicle | null | undefined;
  targetUser?: User | null;
  roleLabel?: string;
  roleView?: 'OWNER' | 'RENTER';
}

export const ContactPartyModal: React.FC<ContactPartyModalProps> = ({
  isOpen,
  onClose,
  booking,
  vehicle,
  targetUser,
  roleLabel,
  roleView,
}) => {
  if (!booking || !vehicle) return null;

  const resolvedLabel =
    roleLabel || (roleView === 'OWNER' ? 'Renter' : 'Vehicle Host');
  const isContactingRenter =
    resolvedLabel === 'Renter' || roleView === 'OWNER';

  const fullName = `${vehicle.brand} ${vehicle.model}`;
  const displayName =
    targetUser?.name ||
    (isContactingRenter ? booking.renterName : vehicle.ownerName);
  const displayEmail =
    targetUser?.email ||
    (isContactingRenter ? booking.renterEmail : 'host@velorent.in');
  const displayPhone =
    targetUser?.phone ||
    (isContactingRenter ? booking.renterPhone : vehicle.ownerPhone);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Contact ${resolvedLabel.toLowerCase()}`}
      subtitle={`Booking ${booking.id} · ${fullName}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3.5 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 text-white font-semibold text-sm flex items-center justify-center shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-zinc-500">{resolvedLabel}</p>
            <p className="text-sm font-semibold text-zinc-900">{displayName}</p>
          </div>
        </div>

        <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-lg text-xs">
          <div className="p-3.5 flex items-center justify-between gap-3">
            <span className="text-zinc-500 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-zinc-400" />
              Phone
            </span>
            <span className="font-mono font-medium text-zinc-900">
              {displayPhone}
            </span>
          </div>

          <div className="p-3.5 flex items-center justify-between gap-3">
            <span className="text-zinc-500 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-zinc-400" />
              Email
            </span>
            <span className="font-medium text-zinc-900">{displayEmail}</span>
          </div>

          <div className="p-3.5 flex items-center justify-between gap-3">
            <span className="text-zinc-500 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-zinc-400" />
              Handover location
            </span>
            <span className="font-medium text-zinc-900 text-right">
              {vehicle.location}
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
