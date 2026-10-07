import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { ReturnVehicleModal } from '../components/modals/ReturnVehicleModal';
import {
  Button,
  EmptyState,
  Input,
  Modal,
  Select,
  StatusBadge,
  Textarea,
} from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import {
  Booking,
  DamageReviewStatus,
  Incident,
  IncidentStatus,
} from '../types/models';
import {
  calculateBookingStatus,
  formatCurrency,
  formatDateTime,
} from '../utils/rentalCalculations';

export const AdminIncidentsPage: React.FC = () => {
  const {
    vehicles,
    bookings,
    incidents,
    adminUpdateIncident,
  } = useApp();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null
  );
  const [editStatus, setEditStatus] = useState<IncidentStatus>('UNDER_REVIEW');
  const [editDamageDecision, setEditDamageDecision] =
    useState<DamageReviewStatus>('APPROVED');
  const [editApprovedAmount, setEditApprovedAmount] = useState<number>(0);
  const [editAdminRemarks, setEditAdminRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [returnModalBooking, setReturnModalBooking] = useState<Booking | null>(
    null
  );

  const overdueOrLateBookings = useMemo(() => {
    return bookings.filter((b) => {
      const st = calculateBookingStatus(b);
      return st === 'OVERDUE' || st === 'RETURNED_LATE';
    });
  }, [bookings]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && inc.priority !== priorityFilter)
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const vehicle = vehicles.find((v) => v.id === inc.vehicleId);
        const matchType = inc.type.toLowerCase().includes(q);
        const matchId = inc.id.toLowerCase().includes(q);
        const matchReporter = inc.reporterName.toLowerCase().includes(q);
        const matchVehicle = vehicle
          ? `${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(q) ||
            vehicle.registrationNumber.toLowerCase().includes(q)
          : false;
        if (!matchType && !matchId && !matchReporter && !matchVehicle) {
          return false;
        }
      }

      return true;
    });
  }, [incidents, vehicles, statusFilter, priorityFilter, searchQuery]);

  const handleOpenReviewModal = (inc: Incident) => {
    setSelectedIncident(inc);
    setEditStatus(inc.status);
    setEditDamageDecision(inc.damageStatus || 'APPROVED');
    setEditApprovedAmount(
      inc.approvedDamageAmount || inc.estimatedDamageCost || 0
    );
    setEditAdminRemarks(inc.adminRemarks || '');
  };

  const handleSaveResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    setSubmitting(true);
    try {
      const res = await adminUpdateIncident({
        incidentId: selectedIncident.id,
        status: editStatus,
        adminRemarks: editAdminRemarks.trim(),
        damageDecision: editDamageDecision,
        approvedDamageAmount: Number(editApprovedAmount) || 0,
      });

      if (res.success) {
        setSelectedIncident(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const returnModalVehicle = returnModalBooking
    ? vehicles.find((v) => v.id === returnModalBooking.vehicleId) || null
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="space-y-1">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to admin overview</span>
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Incident claims & overdue returns
          </h1>
          <p className="text-sm text-zinc-600">
            Review damage reports, approve repair deductions, and settle overdue rentals.
          </p>
        </div>
      </div>

      {/* Section 1: Overdue & Late Return Monitor */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Overdue & late returns ({overdueOrLateBookings.length})
        </h2>

        {overdueOrLateBookings.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-6 text-xs text-zinc-500">
            No overdue or late-returned bookings right now.
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
            {overdueOrLateBookings.map((b) => {
              const vehicle = vehicles.find((v) => v.id === b.vehicleId);
              const st = calculateBookingStatus(b);
              const fullName = vehicle
                ? `${vehicle.brand} ${vehicle.model}`
                : 'Vehicle';

              return (
                <div
                  key={b.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-400">{b.id}</span>
                      <span className="text-sm font-semibold text-zinc-900">
                        {fullName}
                      </span>
                      <StatusBadge status={st} size="sm" />
                    </div>
                    <p className="text-zinc-500">
                      Renter: {b.renterName} ({b.renterPhone}) · Due:{' '}
                      <span className="font-mono">
                        {formatDateTime(b.returnDateTime)}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/bookings/${b.id}`)}
                    >
                      View booking
                    </Button>
                    {st === 'OVERDUE' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setReturnModalBooking(b)}
                      >
                        Process return
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Incident Claims */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900">
            Damage & incident reports ({filteredIncidents.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search claims..."
                className="w-full pl-8 pr-3 h-8 rounded-lg border border-zinc-300 bg-white text-xs text-zinc-900 focus:outline-none focus:border-[#0F766E]"
              />
            </div>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-zinc-300 bg-white text-xs text-zinc-700"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">In review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-zinc-300 bg-white text-xs text-zinc-700"
            >
              <option value="ALL">All priorities</option>
              <option value="STANDARD">Standard</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        {filteredIncidents.length === 0 ? (
          <EmptyState
            title="No incident reports match your filter"
            description="Try clearing your search or status filter."
            actionLabel="Reset filters"
            onAction={() => {
              setStatusFilter('ALL');
              setPriorityFilter('ALL');
              setSearchQuery('');
            }}
          />
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden">
            {filteredIncidents.map((inc) => {
              const vehicle = vehicles.find((v) => v.id === inc.vehicleId);
              const fullName = vehicle
                ? `${vehicle.brand} ${vehicle.model}`
                : 'Vehicle';
              return (
                <div key={inc.id} className="p-5 space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-zinc-400">
                          {inc.id}
                        </span>
                        <span className="text-sm font-semibold text-zinc-900">
                          {inc.type}
                        </span>
                        <StatusBadge status={inc.priority} size="sm" />
                        <StatusBadge status={inc.status} size="sm" />
                      </div>
                      <p className="text-zinc-500">
                        Vehicle: {fullName} ({vehicle?.registrationNumber}) · Booking {inc.bookingId}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="font-mono text-sm font-semibold text-red-700">
                        {formatCurrency(
                          inc.approvedDamageAmount ||
                            inc.estimatedDamageCost ||
                            0
                        )}
                      </p>
                      {inc.estimatedDamageCost !== undefined && (
                        <p className="text-zinc-400">
                          Est: {formatCurrency(inc.estimatedDamageCost)}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-zinc-600 leading-relaxed">
                    {inc.description}
                  </p>

                  {inc.adminRemarks && (
                    <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <span className="font-medium text-zinc-900">
                        Admin remarks:{' '}
                      </span>
                      {inc.adminRemarks}
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-zinc-400">
                      Reported by {inc.reporterName} ({inc.reporterRole}) on{' '}
                      {formatDateTime(inc.createdAt)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/bookings/${inc.bookingId}`)}
                      >
                        Booking details
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenReviewModal(inc)}
                      >
                        {inc.status === 'RESOLVED'
                          ? 'Update resolution'
                          : 'Review & resolve'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Incident Review Modal */}
      <Modal
        isOpen={Boolean(selectedIncident)}
        onClose={() => setSelectedIncident(null)}
        title="Review & resolve incident claim"
        subtitle={
          selectedIncident
            ? `${selectedIncident.id} · ${selectedIncident.type}`
            : ''
        }
        maxWidth="lg"
      >
        {selectedIncident && (
          <form onSubmit={handleSaveResolution} className="space-y-4">
            <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs space-y-1">
              <p className="font-semibold text-zinc-900">
                Reported description
              </p>
              <p className="text-zinc-600">{selectedIncident.description}</p>
              {selectedIncident.estimatedDamageCost !== undefined && (
                <p className="text-zinc-500 pt-1 font-mono">
                  Initial estimate:{' '}
                  {formatCurrency(selectedIncident.estimatedDamageCost)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Case status"
                value={editStatus}
                onChange={(e) =>
                  setEditStatus(e.target.value as IncidentStatus)
                }
                options={[
                  { value: 'OPEN', label: 'Open' },
                  { value: 'UNDER_REVIEW', label: 'In review' },
                  { value: 'RESOLVED', label: 'Resolved' },
                  { value: 'CLOSED', label: 'Closed' },
                ]}
              />

              <Select
                label="Deposit decision"
                value={editDamageDecision}
                onChange={(e) =>
                  setEditDamageDecision(e.target.value as DamageReviewStatus)
                }
                options={[
                  { value: 'PENDING_REVIEW', label: 'Pending review' },
                  { value: 'APPROVED', label: 'Approve deduction' },
                  { value: 'REJECTED', label: 'Reject deduction' },
                  { value: 'RESOLVED', label: 'Settled' },
                ]}
              />

              <Input
                label="Approved charge (₹)"
                type="number"
                min={0}
                value={editApprovedAmount}
                onChange={(e) => setEditApprovedAmount(Number(e.target.value))}
                disabled={editDamageDecision === 'REJECTED'}
              />
            </div>

            <Textarea
              label="Admin remarks"
              rows={3}
              placeholder="Document repair assessment, invoice reference, or deposit settlement..."
              value={editAdminRemarks}
              onChange={(e) => setEditAdminRemarks(e.target.value)}
              required
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedIncident(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={submitting}>
                Save resolution
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ReturnVehicleModal
        isOpen={Boolean(returnModalBooking)}
        onClose={() => setReturnModalBooking(null)}
        booking={returnModalBooking}
        vehicle={returnModalVehicle}
      />
    </div>
  );
};
