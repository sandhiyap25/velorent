import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { IncidentReportModal } from '../components/modals/IncidentReportModal';
import { PhotoUploader } from '../components/PhotoUploader';
import { ReturnVehicleModal } from '../components/modals/ReturnVehicleModal';
import {
  Button,
  ConfirmDialog,
  Input,
  Select,
  StatusBadge,
  Textarea,
} from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { Booking, VehicleType } from '../types/models';
import {
  calculateBookingStatus,
  evaluateVehicleOperationalStatus,
  formatCurrency,
  formatDateTime,
  toDateTimeLocalString,
} from '../utils/rentalCalculations';

export const ManageVehiclePage: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const navigate = useNavigate();

  const {
    currentUser,
    vehicles,
    bookings,
    incidents,
    updateVehicle,
    toggleVehicleListing,
    deleteVehicle,
  } = useApp();

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState<VehicleType>('Car');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [transmission, setTransmission] = useState<'Automatic' | 'Manual'>(
    'Automatic'
  );
  const [fuelType, setFuelType] = useState<
    'Petrol' | 'Diesel' | 'Electric' | 'Hybrid'
  >('Petrol');
  const [seats, setSeats] = useState<number>(5);
  const [location, setLocation] = useState('');
  const [hourlyRate, setHourlyRate] = useState<number>(150);
  const [dailyRate, setDailyRate] = useState<number>(3000);
  const [securityDeposit, setSecurityDeposit] = useState<number>(4000);
  const [availableFrom, setAvailableFrom] = useState<string>('');
  const [availableUntil, setAvailableUntil] = useState<string>('');
  const [description, setDescription] = useState('');
  const [featuresInput, setFeaturesInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [returnModalBooking, setReturnModalBooking] = useState<Booking | null>(
    null
  );
  const [incidentModalBooking, setIncidentModalBooking] =
    useState<Booking | null>(null);

  useEffect(() => {
    if (vehicle) {
      setBrand(vehicle.brand);
      setModel(vehicle.model);
      setType(vehicle.type);
      setRegistrationNumber(vehicle.registrationNumber);
      setTransmission(vehicle.transmission);
      setFuelType(vehicle.fuelType);
      setSeats(vehicle.seats);
      setLocation(vehicle.location);
      setHourlyRate(vehicle.hourlyRate);
      setDailyRate(vehicle.dailyRate || vehicle.hourlyRate * 20);
      setSecurityDeposit(vehicle.securityDeposit);
      setAvailableFrom(toDateTimeLocalString(vehicle.availableFrom));
      setAvailableUntil(toDateTimeLocalString(vehicle.availableUntil));
      setDescription(vehicle.description);
      setFeaturesInput(vehicle.features.join(', '));
      setImages(vehicle.images && vehicle.images.length > 0 ? vehicle.images : []);
    }
  }, [vehicle]);

  if (!currentUser) return null;

  if (!vehicle) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-3">
          <p className="text-base font-semibold text-zinc-900">
            Vehicle not found
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/my-vehicles')}
          >
            Back to fleet
          </Button>
        </div>
      </div>
    );
  }

  const fullName = `${vehicle.brand} ${vehicle.model}`;
  const opStatus = evaluateVehicleOperationalStatus(
    vehicle,
    bookings,
    incidents
  );
  const vehicleBookings = bookings.filter((b) => b.vehicleId === vehicle.id);
  const vehicleIncidents = incidents.filter((i) => i.vehicleId === vehicle.id);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    const features = featuresInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await updateVehicle(vehicle.id, {
        brand: brand.trim(),
        model: model.trim(),
        type,
        registrationNumber: registrationNumber.trim().toUpperCase(),
        transmission,
        fuelType,
        seats: Number(seats),
        location: location.trim(),
        hourlyRate: Number(hourlyRate),
        dailyRate: Number(dailyRate),
        securityDeposit: Number(securityDeposit),
        availableFrom: availableFrom
          ? new Date(availableFrom).toISOString()
          : vehicle.availableFrom,
        availableUntil: availableUntil
          ? new Date(availableUntil).toISOString()
          : vehicle.availableUntil,
        description: description.trim(),
        features,
        images: images.length > 0 ? images : vehicle.images,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    const res = await deleteVehicle(vehicle.id);
    if (res.success) {
      navigate('/my-vehicles');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="space-y-1">
          <Link
            to="/my-vehicles"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to fleet</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
              {fullName}
            </h1>
            <StatusBadge
              status={opStatus.badgeLabel}
              tone={opStatus.statusTone}
              size="md"
            />
          </div>
          <p className="text-xs text-zinc-500 font-mono">
            Plate: {vehicle.registrationNumber} · {vehicle.location}
          </p>
        </div>

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
            variant="outline"
            size="sm"
            onClick={() => navigate(`/rent/${vehicle.id}`)}
          >
            View public listing
          </Button>
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            Remove
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 6 Columns: Edit Vehicle Form */}
        <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h2 className="text-sm font-semibold text-zinc-900">
              Listing settings & pricing
            </h2>
          </div>

          <form onSubmit={handleSaveChanges} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                required
              />
              <Input
                label="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Registration number"
                value={registrationNumber}
                onChange={(e) =>
                  setRegistrationNumber(e.target.value.toUpperCase())
                }
                className="font-mono uppercase"
                required
              />
              <Input
                label="Pickup location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Category"
                value={type}
                onChange={(e) => setType(e.target.value as VehicleType)}
                options={[
                  { value: 'Car', label: 'Car' },
                  { value: 'SUV', label: 'SUV' },
                  { value: 'Bike', label: 'Bike' },
                  { value: 'Van', label: 'Van' },
                ]}
              />
              <Select
                label="Transmission"
                value={transmission}
                onChange={(e) =>
                  setTransmission(e.target.value as 'Automatic' | 'Manual')
                }
                options={[
                  { value: 'Automatic', label: 'Automatic' },
                  { value: 'Manual', label: 'Manual' },
                ]}
              />
              <Select
                label="Fuel type"
                value={fuelType}
                onChange={(e) =>
                  setFuelType(
                    e.target.value as
                      | 'Petrol'
                      | 'Diesel'
                      | 'Electric'
                      | 'Hybrid'
                  )
                }
                options={[
                  { value: 'Petrol', label: 'Petrol' },
                  { value: 'Diesel', label: 'Diesel' },
                  { value: 'Electric', label: 'Electric' },
                  { value: 'Hybrid', label: 'Hybrid' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Hourly rate (₹)"
                type="number"
                min={10}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                required
              />
              <Input
                label="Daily rate (₹)"
                type="number"
                min={100}
                value={dailyRate}
                onChange={(e) => setDailyRate(Number(e.target.value))}
                required
              />
              <Input
                label="Security deposit (₹)"
                type="number"
                min={0}
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Available from"
                type="datetime-local"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                required
              />
              <Input
                label="Available until"
                type="datetime-local"
                value={availableUntil}
                onChange={(e) => setAvailableUntil(e.target.value)}
                required
              />
            </div>

            <PhotoUploader
              images={images}
              onChange={setImages}
              onError={setImageError}
              label="Vehicle photos"
            />
            {imageError && (
              <p className="text-xs text-red-600">{imageError}</p>
            )}

            <Textarea
              label="Description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />

            <Input
              label="Features (comma-separated)"
              value={featuresInput}
              onChange={(e) => setFeaturesInput(e.target.value)}
            />

            <div className="pt-2">
              <Button type="submit" variant="primary" fullWidth isLoading={saving}>
                Save changes
              </Button>
            </div>
          </form>
        </div>

        {/* Right 6 Columns: Bookings & Incidents on this Vehicle */}
        <div className="lg:col-span-6 space-y-6">
          {/* Customer Bookings */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Customer reservations ({vehicleBookings.length})
              </h2>
            </div>

            {vehicleBookings.length === 0 ? (
              <div className="p-6 text-xs text-zinc-500">
                No reservations recorded for this vehicle yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200">
                {vehicleBookings.map((b) => {
                  const st = calculateBookingStatus(b);
                  const canInspect =
                    st === 'ACTIVE' || st === 'UPCOMING' || st === 'OVERDUE';

                  return (
                    <div key={b.id} className="p-5 space-y-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-zinc-400">
                              {b.id}
                            </span>
                            <span className="font-semibold text-zinc-900">
                              {b.renterName}
                            </span>
                            <StatusBadge status={st} size="sm" />
                          </div>
                          <p className="text-zinc-500 mt-0.5">
                            {b.renterEmail} · {b.renterPhone}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm font-semibold text-zinc-900">
                            {formatCurrency(
                              b.rentalAmount + b.latePenalty + b.damageAmount
                            )}
                          </p>
                          <p className="font-mono text-zinc-500">
                            Dep: {formatCurrency(b.securityDeposit)}
                          </p>
                        </div>
                      </div>

                      <p className="font-mono text-zinc-600">
                        {formatDateTime(b.pickupDateTime)} →{' '}
                        {formatDateTime(b.returnDateTime)}
                      </p>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/bookings/${b.id}`)}
                        >
                          View booking
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIncidentModalBooking(b)}
                        >
                          Log incident
                        </Button>
                        {canInspect && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setReturnModalBooking(b)}
                          >
                            Inspect & close return
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incident Log */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200">
              <h2 className="text-sm font-semibold text-zinc-900">
                Incident history ({vehicleIncidents.length})
              </h2>
            </div>

            {vehicleIncidents.length === 0 ? (
              <div className="p-6 text-xs text-zinc-500">
                No damage or incident reports on this vehicle.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200">
                {vehicleIncidents.map((inc) => (
                  <div key={inc.id} className="p-5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">
                          {inc.type}
                        </span>
                        <StatusBadge status={inc.priority} size="sm" />
                        <StatusBadge status={inc.status} size="sm" />
                      </div>
                      {(inc.approvedDamageAmount || inc.estimatedDamageCost) && (
                        <span className="font-mono font-semibold text-red-700">
                          {formatCurrency(
                            inc.approvedDamageAmount ||
                              inc.estimatedDamageCost ||
                              0
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-600">{inc.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ReturnVehicleModal
        isOpen={Boolean(returnModalBooking)}
        onClose={() => setReturnModalBooking(null)}
        booking={returnModalBooking}
        vehicle={vehicle}
      />

      <IncidentReportModal
        isOpen={Boolean(incidentModalBooking)}
        onClose={() => setIncidentModalBooking(null)}
        booking={incidentModalBooking}
        vehicle={vehicle}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Remove vehicle from platform"
        description="Are you sure you want to permanently remove this vehicle listing? Active or overdue bookings must be completed first."
        confirmLabel="Remove vehicle"
      />
    </div>
  );
};
