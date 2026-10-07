import React, { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  Select,
  Textarea,
} from '../ui/CommonUI';
import { useApp } from '../../hooks/useAppContext';
import { Booking, IncidentType, Vehicle } from '../../types/models';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  vehicle: Vehicle | null | undefined;
  initialType?: IncidentType;
}

export const IncidentReportModal: React.FC<IncidentReportModalProps> = ({
  isOpen,
  onClose,
  booking,
  vehicle,
  initialType = 'Vehicle Damage',
}) => {
  const { createIncidentReport } = useApp();

  const [type, setType] = useState<IncidentType>(initialType);
  const [estimatedDamageCost, setEstimatedDamageCost] = useState<number>(1500);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(initialType || 'Vehicle Damage');
      setError('');
    }
  }, [isOpen, initialType]);

  if (!booking || !vehicle) return null;

  const fullName = `${vehicle.brand} ${vehicle.model}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) {
      setError('Please provide a description of the incident.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createIncidentReport({
        bookingId: booking.id,
        vehicleId: vehicle.id,
        type,
        description: description.trim(),
        estimatedDamageCost:
          type === 'Vehicle Damage' || type === 'Accident'
            ? Number(estimatedDamageCost) || 0
            : undefined,
      });

      if (!res.success) {
        setError(res.error || 'Could not submit incident report.');
        return;
      }

      setDescription('');
      setEstimatedDamageCost(1500);
      setType('Vehicle Damage');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report vehicle damage or incident"
      subtitle={`${fullName} (${vehicle.registrationNumber}) · Booking ${booking.id}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Incident category"
            value={type}
            onChange={(e) => setType(e.target.value as IncidentType)}
            options={[
              { value: 'Vehicle Damage', label: 'Vehicle Damage' },
              { value: 'Accident', label: 'Accident' },
              { value: 'Vehicle Not Returned', label: 'Vehicle Not Returned' },
              { value: 'Suspected Theft', label: 'Suspected Theft' },
              { value: 'Other', label: 'Other' },
            ]}
          />

          {(type === 'Vehicle Damage' || type === 'Accident') && (
            <Input
              label="Estimated repair cost (₹)"
              type="number"
              min={0}
              step={100}
              value={estimatedDamageCost}
              onChange={(e) => setEstimatedDamageCost(Number(e.target.value))}
              required
            />
          )}
        </div>

        <Textarea
          label="Detailed description"
          rows={3}
          placeholder="Explain when and how the issue occurred..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={submitting}>
            Submit report
          </Button>
        </div>
      </form>
    </Modal>
  );
};
