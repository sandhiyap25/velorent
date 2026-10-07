import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  Select,
  Textarea,
} from '../ui/CommonUI';
import { useApp } from '../../hooks/useAppContext';
import {
  Booking,
  Vehicle,
  VehicleCondition,
} from '../../types/models';
import {
  calculateSettlementSummary,
  formatCurrency,
  formatDateTime,
  toDateTimeLocalString,
} from '../../utils/rentalCalculations';

interface ReturnVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  vehicle: Vehicle | null | undefined;
}

export const ReturnVehicleModal: React.FC<ReturnVehicleModalProps> = ({
  isOpen,
  onClose,
  booking,
  vehicle,
}) => {
  const { returnVehicle } = useApp();

  const [actualReturnDateInput, setActualReturnDateInput] =
    useState<string>('');
  const [condition, setCondition] = useState<VehicleCondition>('No Damage');
  const [estimatedRepairCost, setEstimatedRepairCost] = useState<number>(1500);
  const [damageDescription, setDamageDescription] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (booking && isOpen) {
      const now = new Date();
      const scheduledEnd = new Date(booking.returnDateTime);
      const defaultReturn = now > scheduledEnd ? now : scheduledEnd;
      setActualReturnDateInput(toDateTimeLocalString(defaultReturn));
      setCondition('No Damage');
      setEstimatedRepairCost(1500);
      setDamageDescription('');
      setError('');
    }
  }, [booking, isOpen]);

  const hasDamage =
    condition === 'Minor Damage' || condition === 'Major Damage';

  const settlement = useMemo(() => {
    if (!booking || !actualReturnDateInput) return null;
    const parsedDate = new Date(actualReturnDateInput);
    if (isNaN(parsedDate.getTime())) return null;

    return calculateSettlementSummary({
      rentalAmount: booking.rentalAmount,
      securityDeposit: booking.securityDeposit,
      expectedReturnISO: booking.returnDateTime,
      actualReturnISO: parsedDate.toISOString(),
      approvedDamageAmount: 0,
      estimatedRepairCost: hasDamage ? Number(estimatedRepairCost) || 0 : 0,
    });
  }, [booking, actualReturnDateInput, hasDamage, estimatedRepairCost]);

  if (!booking || !vehicle) return null;

  const fullName = `${vehicle.brand} ${vehicle.model}`;

  const setPresetReturnTime = (mode: 'ON_TIME' | 'LATE_3H' | 'LATE_12H') => {
    const end = new Date(booking.returnDateTime);
    if (mode === 'ON_TIME') {
      setActualReturnDateInput(toDateTimeLocalString(end));
    } else if (mode === 'LATE_3H') {
      const d = new Date(end.getTime() + 3 * 60 * 60 * 1000);
      setActualReturnDateInput(toDateTimeLocalString(d));
    } else if (mode === 'LATE_12H') {
      const d = new Date(end.getTime() + 12 * 60 * 60 * 1000);
      setActualReturnDateInput(toDateTimeLocalString(d));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedReturn = new Date(actualReturnDateInput);
    if (isNaN(parsedReturn.getTime())) {
      setError('Please enter a valid return date and time.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await returnVehicle({
        bookingId: booking.id,
        actualReturnISO: parsedReturn.toISOString(),
        condition,
        damageDescription: hasDamage ? damageDescription.trim() : undefined,
        estimatedRepairCost: hasDamage ? Number(estimatedRepairCost) : 0,
      });

      if (!res.success) {
        setError(res.error || 'Could not complete return.');
        return;
      }

      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Complete vehicle return & settlement"
      subtitle={`${fullName} (${vehicle.registrationNumber}) · Booking ${booking.id}`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Scheduled Window Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
          <div>
            <span className="text-zinc-500 block">Scheduled pickup</span>
            <span className="font-mono font-semibold text-zinc-900">
              {formatDateTime(booking.pickupDateTime)}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block">Scheduled return</span>
            <span className="font-mono font-semibold text-zinc-900">
              {formatDateTime(booking.returnDateTime)}
            </span>
          </div>
        </div>

        {/* Actual Return Time & Quick Presets */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-medium text-zinc-700">
              Actual return timestamp
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPresetReturnTime('ON_TIME')}
                className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer"
              >
                On time
              </button>
              <button
                type="button"
                onClick={() => setPresetReturnTime('LATE_3H')}
                className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer"
              >
                +3h late
              </button>
              <button
                type="button"
                onClick={() => setPresetReturnTime('LATE_12H')}
                className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer"
              >
                +12h late
              </button>
            </div>
          </div>

          <Input
            type="datetime-local"
            value={actualReturnDateInput}
            onChange={(e) => setActualReturnDateInput(e.target.value)}
            required
          />
        </div>

        {/* Vehicle Condition */}
        <Select
          label="Return inspection condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value as VehicleCondition)}
          options={[
            { value: 'No Damage', label: 'No Damage (Clean return)' },
            {
              value: 'Minor Damage',
              label: 'Minor Damage (Scratch / dent — submit for review)',
            },
            {
              value: 'Major Damage',
              label: 'Major Damage (Mechanical / collision — submit for review)',
            },
          ]}
        />

        {hasDamage && (
          <div className="p-4 rounded-lg bg-red-50/50 border border-red-200 space-y-3">
            <Input
              label="Estimated repair cost (₹)"
              type="number"
              min={100}
              step={100}
              value={estimatedRepairCost}
              onChange={(e) => setEstimatedRepairCost(Number(e.target.value))}
              hint="Sent to admin for verification before deducting from deposit"
              required
            />

            <Textarea
              label="Damage inspection notes"
              rows={2}
              placeholder="Describe the damage observed during return handover..."
              value={damageDescription}
              onChange={(e) => setDamageDescription(e.target.value)}
              required
            />
          </div>
        )}

        {/* Live Settlement Calculation */}
        {settlement && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-2 text-xs">
            <p className="font-semibold text-zinc-900">Settlement breakdown</p>
            <div className="flex justify-between text-zinc-600">
              <span>Base rental (paid)</span>
              <span className="font-mono font-medium text-zinc-900">
                {formatCurrency(booking.rentalAmount)}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Security deposit held</span>
              <span className="font-mono font-medium text-zinc-900">
                {formatCurrency(booking.securityDeposit)}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>
                Late return fee{' '}
                {settlement.isLate
                  ? `(${settlement.lateHours}h × ₹300/hr)`
                  : '(On time)'}
              </span>
              <span
                className={`font-mono font-medium ${
                  settlement.latePenalty > 0 ? 'text-red-600' : 'text-zinc-900'
                }`}
              >
                {settlement.latePenalty > 0
                  ? `+${formatCurrency(settlement.latePenalty)}`
                  : formatCurrency(0)}
              </span>
            </div>
            {hasDamage && (
              <div className="flex justify-between text-amber-800">
                <span>Estimated damage (pending admin review)</span>
                <span className="font-mono font-medium">
                  {formatCurrency(estimatedRepairCost)}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-zinc-200 flex justify-between font-semibold text-zinc-900">
              <span>Final rental charges</span>
              <span className="font-mono">
                {formatCurrency(settlement.finalTotalCharges)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Deposit refund (before pending damage review)</span>
              <span className="font-mono">
                {formatCurrency(settlement.refundableDeposit)}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            Confirm return & settle
          </Button>
        </div>
      </form>
    </Modal>
  );
};
