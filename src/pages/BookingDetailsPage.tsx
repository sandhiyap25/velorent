import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  ShieldAlert,
} from 'lucide-react';
import { ContactPartyModal } from '../components/modals/ContactPartyModal';
import { IncidentReportModal } from '../components/modals/IncidentReportModal';
import { ReturnVehicleModal } from '../components/modals/ReturnVehicleModal';
import {
  Button,
  ConfirmDialog,
  ErrorState,
  StatusBadge,
  VehicleImage,
} from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { IncidentType } from '../types/models';
import {
  calculateBookingStatus,
  calculateSettlementSummary,
  formatCurrency,
  formatDateTime,
  LATE_PENALTY_PER_HOUR,
  maskRegistrationNumber,
} from '../utils/rentalCalculations';

export const BookingDetailsPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  const {
    currentUser,
    vehicles,
    bookings,
    incidents,
    cancelBooking,
    sendOverdueReminder,
  } = useApp();

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [incidentModalType, setIncidentModalType] =
    useState<IncidentType | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  if (!currentUser) return null;

  const booking = bookings.find((b) => b.id === bookingId);
  const vehicle = vehicles.find((v) => v.id === booking?.vehicleId);

  if (!booking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <ErrorState
          title="Reservation not found"
          message="The reservation ID you requested could not be found."
          actionLabel="Back to bookings"
          onAction={() => navigate('/bookings')}
        />
      </div>
    );
  }

  const st = calculateBookingStatus(booking);
  const isRenter = booking.renterId === currentUser.id;
  const isOwner = booking.ownerId === currentUser.id;
  const isAdmin = currentUser.role === 'ADMIN';

  const settlement = calculateSettlementSummary({
    rentalAmount: booking.rentalAmount,
    securityDeposit: booking.securityDeposit,
    expectedReturnISO: booking.returnDateTime,
    actualReturnISO: booking.actualReturnDateTime,
    approvedDamageAmount: booking.damageAmount,
    estimatedRepairCost: booking.estimatedRepairCost,
    damageReviewStatus: booking.damageReviewStatus,
  });

  const bookingIncidents = incidents.filter(
    (inc) => inc.bookingId === booking.id
  );

  const canReturn =
    (isRenter || isAdmin) &&
    (st === 'ACTIVE' || st === 'OVERDUE' || st === 'UPCOMING');
  const canCancel = (isRenter || isAdmin) && st === 'UPCOMING';

  const fullName = vehicle
    ? `${vehicle.brand} ${vehicle.model}`
    : 'Listed vehicle';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="space-y-1">
          <Link
            to="/bookings"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to bookings</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
              Reservation #{booking.id.toUpperCase()}
            </h1>
            <StatusBadge status={st} size="md" />
          </div>
          <p className="text-xs text-zinc-500">
            Created on {formatDateTime(booking.createdAt)} ·{' '}
            {isRenter ? 'Renter view' : isOwner ? 'Host view' : 'Admin view'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setContactModalOpen(true)}
          >
            {isRenter ? 'Contact host' : 'Contact renter'}
          </Button>

          {(isOwner || isAdmin) && st === 'OVERDUE' && (
            <Button
              variant="amber"
              size="sm"
              leftIcon={<BellRing className="w-3.5 h-3.5" />}
              onClick={() => sendOverdueReminder(booking.id)}
            >
              Send reminder ({booking.remindersSent})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            leftIcon={<ShieldAlert className="w-3.5 h-3.5" />}
            onClick={() =>
              setIncidentModalType(
                st === 'OVERDUE' ? 'Vehicle Not Returned' : 'Vehicle Damage'
              )
            }
          >
            Report incident
          </Button>

          {canCancel && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setCancelConfirmOpen(true)}
            >
              Cancel booking
            </Button>
          )}

          {canReturn && (
            <Button
              variant={st === 'OVERDUE' ? 'danger' : 'primary'}
              size="sm"
              onClick={() => setReturnModalOpen(true)}
            >
              Return vehicle
            </Button>
          )}
        </div>
      </div>

      {/* Overdue Warning Banner */}
      {st === 'OVERDUE' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900">
                Rental return is past due
              </p>
              <p className="text-xs text-red-800 mt-0.5">
                Scheduled return was {formatDateTime(booking.returnDateTime)}. Late returns accrue{' '}
                {formatCurrency(LATE_PENALTY_PER_HOUR)}/hr against the security deposit.
              </p>
            </div>
          </div>
          {canReturn && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setReturnModalOpen(true)}
            >
              Complete return check-in
            </Button>
          )}
        </div>
      )}

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Vehicle, Schedule & Inspection */}
        <div className="lg:col-span-7 space-y-6">
          {/* Vehicle Summary */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <VehicleImage
                src={vehicle?.images[0]}
                alt={fullName}
                className="w-24 h-16 rounded-lg object-cover border border-zinc-200 shrink-0"
              />
              <div>
                <p className="text-xs text-zinc-500">{vehicle?.type || 'Vehicle'}</p>
                <Link
                  to={vehicle ? `/rent/${vehicle.id}` : '/rent'}
                  className="text-base font-semibold text-zinc-900 hover:text-[#0F766E]"
                >
                  {fullName}
                </Link>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {vehicle
                    ? maskRegistrationNumber(vehicle.registrationNumber, true)
                    : '—'}{' '}
                  · {vehicle?.location}
                </p>
              </div>
            </div>
            <div className="text-xs text-zinc-600 space-y-1 sm:text-right">
              <p>
                Host: <span className="font-medium text-zinc-900">{booking.ownerName}</span>
              </p>
              <p>
                Renter: <span className="font-medium text-zinc-900">{booking.renterName}</span>
              </p>
            </div>
          </div>

          {/* Schedule Details */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Trip schedule
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-[#F8F8F7] border border-zinc-200">
                <p className="text-zinc-500">Scheduled pickup</p>
                <p className="font-mono font-semibold text-zinc-900 mt-1">
                  {formatDateTime(booking.pickupDateTime)}
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F8F8F7] border border-zinc-200">
                <p className="text-zinc-500">Scheduled return</p>
                <p className="font-mono font-semibold text-zinc-900 mt-1">
                  {formatDateTime(booking.returnDateTime)}
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F8F8F7] border border-zinc-200">
                <p className="text-zinc-500">Actual return check-in</p>
                <p className="font-mono font-semibold text-zinc-900 mt-1">
                  {booking.actualReturnDateTime
                    ? formatDateTime(booking.actualReturnDateTime)
                    : 'Not returned yet'}
                </p>
              </div>
            </div>
          </div>

          {/* Return Condition & Damage Record */}
          {booking.actualReturnDateTime && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Return inspection report
                </h2>
                <StatusBadge
                  status={booking.conditionOnReturn || 'No Damage'}
                  tone={
                    booking.conditionOnReturn === 'No Damage'
                      ? 'success'
                      : 'warning'
                  }
                  size="sm"
                />
              </div>
              <div className="text-xs text-zinc-600 space-y-1.5">
                <p>
                  Condition recorded:{' '}
                  <span className="font-medium text-zinc-900">
                    {booking.conditionOnReturn || 'No Damage'}
                  </span>
                </p>
                {booking.damageDescription && (
                  <p>
                    Notes:{' '}
                    <span className="text-zinc-800">
                      {booking.damageDescription}
                    </span>
                  </p>
                )}
                {booking.estimatedRepairCost > 0 && (
                  <p>
                    Estimated repair cost:{' '}
                    <span className="font-mono font-medium text-zinc-900">
                      {formatCurrency(booking.estimatedRepairCost)}
                    </span>{' '}
                    ({booking.damageReviewStatus})
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Linked Incident Reports */}
          {bookingIncidents.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Linked incident reports ({bookingIncidents.length})
              </h2>
              <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-lg overflow-hidden">
                {bookingIncidents.map((inc) => (
                  <div key={inc.id} className="p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900">
                        {inc.type} (#{inc.id})
                      </span>
                      <StatusBadge status={inc.status} size="sm" />
                    </div>
                    <p className="text-zinc-600">{inc.description}</p>
                    {inc.adminRemarks && (
                      <p className="text-zinc-500 pt-1">
                        Admin note: {inc.adminRemarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Financial Settlement Statement */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
            <div className="border-b border-zinc-200 pb-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Financial settlement summary
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Base rental, security deposit escrow, and any applicable deductions.
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>
                  Base rental ({booking.durationHours}h ×{' '}
                  {formatCurrency(booking.hourlyRate)}/h)
                </span>
                <span className="font-mono font-medium text-zinc-900">
                  {formatCurrency(booking.rentalAmount)}
                </span>
              </div>

              <div className="flex justify-between text-zinc-600">
                <span>Security deposit collected</span>
                <span className="font-mono font-medium text-zinc-900">
                  {formatCurrency(booking.securityDeposit)}
                </span>
              </div>

              <div className="pt-2.5 border-t border-zinc-200 flex justify-between text-zinc-600">
                <span>
                  Late return fee (
                  {settlement.lateHours > 0
                    ? `${settlement.lateHours}h late`
                    : 'On time'}
                  )
                </span>
                <span
                  className={`font-mono font-medium ${
                    settlement.latePenalty > 0
                      ? 'text-red-600'
                      : 'text-zinc-900'
                  }`}
                >
                  {formatCurrency(settlement.latePenalty)}
                </span>
              </div>

              <div className="flex justify-between text-zinc-600">
                <span>Approved damage deduction</span>
                <span
                  className={`font-mono font-medium ${
                    settlement.approvedDamage > 0
                      ? 'text-red-600'
                      : 'text-zinc-900'
                  }`}
                >
                  {formatCurrency(settlement.approvedDamage)}
                </span>
              </div>

              <div className="pt-3 border-t border-zinc-200 flex justify-between text-sm font-semibold text-zinc-900">
                <span>Final rental & fee total</span>
                <span className="font-mono">
                  {formatCurrency(settlement.finalTotalCharges)}
                </span>
              </div>

              <div className="bg-[#F8F8F7] border border-zinc-200 rounded-lg p-3.5 mt-3 space-y-1.5">
                <div className="flex justify-between font-medium text-zinc-900">
                  <span>Refundable deposit balance</span>
                  <span className="font-mono text-emerald-700">
                    {formatCurrency(settlement.refundableDeposit)}
                  </span>
                </div>
                {settlement.additionalAmountDue > 0 && (
                  <div className="flex justify-between font-semibold text-red-700">
                    <span>Additional balance due</span>
                    <span className="font-mono">
                      {formatCurrency(settlement.additionalAmountDue)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {returnModalOpen && (
        <ReturnVehicleModal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          booking={booking}
          vehicle={vehicle}
        />
      )}

      {incidentModalType && (
        <IncidentReportModal
          isOpen={Boolean(incidentModalType)}
          onClose={() => setIncidentModalType(null)}
          booking={booking}
          vehicle={vehicle}
          initialType={incidentModalType}
        />
      )}

      {contactModalOpen && (
        <ContactPartyModal
          isOpen={contactModalOpen}
          onClose={() => setContactModalOpen(false)}
          booking={booking}
          vehicle={vehicle}
          roleView={isOwner ? 'OWNER' : 'RENTER'}
        />
      )}

      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => cancelBooking(booking.id)}
        title="Cancel reservation"
        description="Are you sure you want to cancel this upcoming reservation? Your security deposit and rental payment will be refunded."
        confirmLabel="Cancel reservation"
      />
    </div>
  );
};
