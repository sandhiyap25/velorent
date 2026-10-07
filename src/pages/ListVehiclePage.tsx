import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Select,
  Textarea,
  VehicleImage,
} from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { PhotoUploader } from '../components/PhotoUploader';
import { ASSET_IMAGES } from '../services/apiService';
import { VehicleType } from '../types/models';
import {
  formatCurrency,
  toDateTimeLocalString,
} from '../utils/rentalCalculations';

const CATEGORY_PHOTOS: { label: string; url: string; type: VehicleType }[] = [
  {
    label: 'SUV',
    type: 'SUV',
    url: ASSET_IMAGES.suv,
  },
  {
    label: 'Sedan / Hatchback',
    type: 'Car',
    url: ASSET_IMAGES.car,
  },
  {
    label: 'Motorcycle',
    type: 'Bike',
    url: ASSET_IMAGES.bike,
  },
  {
    label: 'Passenger Van',
    type: 'Van',
    url: ASSET_IMAGES.van,
  },
];

export const ListVehiclePage: React.FC = () => {
  const { currentUser, createVehicle } = useApp();
  const navigate = useNavigate();

  const defaultAvailFrom = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return toDateTimeLocalString(d);
  }, []);

  const defaultAvailUntil = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    d.setMinutes(0, 0, 0);
    return toDateTimeLocalString(d);
  }, []);

  const [type, setType] = useState<VehicleType>('Car');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [transmission, setTransmission] = useState<'Automatic' | 'Manual'>(
    'Automatic'
  );
  const [fuelType, setFuelType] = useState<
    'Petrol' | 'Diesel' | 'Electric' | 'Hybrid'
  >('Petrol');
  const [seats, setSeats] = useState<number>(5);
  const [location, setLocation] = useState('Bengaluru — Indiranagar');
  const [hourlyRate, setHourlyRate] = useState<number>(180);
  const [dailyRate, setDailyRate] = useState<number>(3600);
  const [securityDeposit, setSecurityDeposit] = useState<number>(4000);
  const [availableFrom, setAvailableFrom] = useState<string>(defaultAvailFrom);
  const [availableUntil, setAvailableUntil] =
    useState<string>(defaultAvailUntil);
  const [images, setImages] = useState<string[]>([ASSET_IMAGES.car]);
  const [description, setDescription] = useState('');
  const [featuresInput, setFeaturesInput] = useState(
    'Apple CarPlay, FASTag Active, Dual Airbags, Rear Camera'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!currentUser) return null;

  const handleTypeChange = (newType: VehicleType) => {
    setType(newType);
    // Only swap in the category preset if the user hasn't uploaded a real
    // photo yet (i.e. the cover image is still one of the presets).
    const preset = CATEGORY_PHOTOS.find((img) => img.type === newType);
    const isStillOnPreset = CATEGORY_PHOTOS.some((c) => c.url === images[0]);
    if (preset && isStillOnPreset) setImages([preset.url]);

    if (newType === 'Bike') {
      setSeats(2);
      setHourlyRate(95);
      setDailyRate(1800);
      setSecurityDeposit(2000);
    } else if (newType === 'SUV') {
      setSeats(7);
      setHourlyRate(280);
      setDailyRate(5500);
      setSecurityDeposit(6000);
    } else if (newType === 'Van') {
      setSeats(7);
      setHourlyRate(300);
      setDailyRate(6000);
      setSecurityDeposit(6000);
    } else {
      setSeats(5);
      setHourlyRate(180);
      setDailyRate(3600);
      setSecurityDeposit(4000);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!brand.trim()) newErrors.brand = 'Brand is required.';
    if (!model.trim()) newErrors.model = 'Model is required.';
    if (!registrationNumber.trim()) {
      newErrors.registrationNumber = 'Registration number is required.';
    } else if (registrationNumber.trim().length < 6) {
      newErrors.registrationNumber =
        'Enter a valid registration plate (e.g., KA-01-MJ-2024).';
    }
    if (!location.trim()) newErrors.location = 'Pickup location is required.';
    if (!hourlyRate || hourlyRate <= 0) {
      newErrors.hourlyRate = 'Hourly rate must be greater than 0.';
    }
    if (securityDeposit < 0) {
      newErrors.securityDeposit = 'Security deposit cannot be negative.';
    }
    if (!description.trim() || description.trim().length < 15) {
      newErrors.description =
        'Provide a short description (at least 15 characters).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const features = featuresInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await createVehicle({
        type,
        brand: brand.trim(),
        model: model.trim(),
        registrationNumber: registrationNumber.trim().toUpperCase(),
        transmission,
        fuelType,
        seats: Number(seats),
        location: location.trim(),
        hourlyRate: Number(hourlyRate),
        dailyRate: Number(dailyRate) || Number(hourlyRate) * 20,
        availableFrom: new Date(availableFrom).toISOString(),
        availableUntil: new Date(availableUntil).toISOString(),
        securityDeposit: Number(securityDeposit),
        images: images.length > 0 ? images : [ASSET_IMAGES.car],
        description: description.trim(),
        features,
      });

      if (!res.success) {
        if (res.error?.toLowerCase().includes('registration')) {
          setErrors({ registrationNumber: res.error });
        } else {
          setErrors({ form: res.error || 'Failed to publish listing.' });
        }
        return;
      }

      navigate('/my-vehicles');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            List a vehicle
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Add your car, SUV, or two-wheeler to the marketplace with custom hourly and daily rates.
          </p>
        </div>
      </div>

      {errors.form && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {errors.form}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column (8 Cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200"
        >
          {/* Section 1: Vehicle Identity */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              1. Vehicle details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Category"
                value={type}
                onChange={(e) =>
                  handleTypeChange(e.target.value as VehicleType)
                }
                options={[
                  { value: 'Car', label: 'Car (Sedan / Hatchback)' },
                  { value: 'SUV', label: 'SUV' },
                  { value: 'Bike', label: 'Motorcycle / Two-Wheeler' },
                  { value: 'Van', label: 'Van / MPV' },
                ]}
              />

              <Input
                label="Make / Brand"
                placeholder="e.g., Hyundai, Tata, Royal Enfield"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                error={errors.brand}
              />

              <Input
                label="Model & variant"
                placeholder="e.g., Creta SX, Nexon EV"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                error={errors.model}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Registration number"
                placeholder="KA-01-MJ-2024"
                value={registrationNumber}
                onChange={(e) =>
                  setRegistrationNumber(e.target.value.toUpperCase())
                }
                error={errors.registrationNumber}
                className="font-mono uppercase"
              />

              <Input
                label="Pickup neighborhood & city"
                placeholder="e.g., Bengaluru — Indiranagar"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                error={errors.location}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  { value: 'Electric', label: 'Electric (EV)' },
                  { value: 'Hybrid', label: 'Hybrid' },
                ]}
              />

              <Input
                label="Seating capacity"
                type="number"
                min={1}
                max={15}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                error={errors.seats}
              />
            </div>
          </div>

          {/* Section 2: Pricing & Availability Window */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              2. Pricing, deposit & availability window
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Hourly rate (₹)"
                type="number"
                min={20}
                value={hourlyRate}
                onChange={(e) => {
                  const hr = Number(e.target.value);
                  setHourlyRate(hr);
                  setDailyRate(hr * 20);
                }}
                error={errors.hourlyRate}
                hint="Authoritative billing rate"
              />

              <Input
                label="Reference daily rate (₹)"
                type="number"
                min={100}
                value={dailyRate}
                onChange={(e) => setDailyRate(Number(e.target.value))}
                hint="Displayed on listing card"
              />

              <Input
                label="Security deposit (₹)"
                type="number"
                min={0}
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                error={errors.securityDeposit}
                hint="Refundable on clean return"
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
          </div>

          {/* Section 3: Photo & Description */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              3. Photo & description
            </h2>

            <PhotoUploader
              images={images}
              onChange={setImages}
              onError={(msg) => setErrors((prev) => ({ ...prev, images: msg }))}
              label="Upload vehicle photos"
            />

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-zinc-700">
                Or start from a category preset:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_PHOTOS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImages([sample.url, ...images.slice(1)])}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      images[0] === sample.url
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              label="Vehicle description"
              rows={3}
              placeholder="Describe the vehicle's condition, luggage space, and pickup instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
            />

            <Input
              label="Included features (comma-separated)"
              placeholder="Apple CarPlay, FASTag Active, Dual Airbags"
              value={featuresInput}
              onChange={(e) => setFeaturesInput(e.target.value)}
            />
          </div>

          {/* Submit Footer */}
          <div className="p-6 bg-zinc-50/60 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/my-vehicles')}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Publish listing
            </Button>
          </div>
        </form>

        {/* Live Listing Preview (4 Cols) */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Marketplace preview
          </h3>
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="aspect-[16/10] bg-zinc-100 border-b border-zinc-200">
              <VehicleImage
                src={images[0] || ASSET_IMAGES.car}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-zinc-500">
                  {brand || 'Brand'} · {type}
                </p>
                <p className="text-sm font-semibold text-zinc-900">
                  {brand || model ? `${brand} ${model}` : 'Vehicle Name'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {transmission} · {fuelType} · {seats} seats
                </p>
              </div>
              <div className="pt-3 border-t border-zinc-100 flex items-baseline justify-between">
                <div>
                  <span className="font-mono text-base font-semibold text-zinc-900">
                    {formatCurrency(hourlyRate || 0)}
                  </span>
                  <span className="text-xs text-zinc-500"> / hr</span>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  {formatCurrency(securityDeposit || 0)} deposit
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
