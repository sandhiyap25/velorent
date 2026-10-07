import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { VehicleCard } from '../components/VehicleCard';
import { Button, EmptyState, Select } from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { VehicleType } from '../types/models';
import { evaluateVehicleOperationalStatus } from '../utils/rentalCalculations';

const VEHICLE_CATEGORIES: { value: 'ALL' | VehicleType; label: string }[] = [
  { value: 'ALL', label: 'All types' },
  { value: 'Car', label: 'Cars' },
  { value: 'SUV', label: 'SUVs' },
  { value: 'Bike', label: 'Bikes' },
  { value: 'Van', label: 'Vans' },
];

export const RentMarketplacePage: React.FC = () => {
  const { currentUser, vehicles, bookings, incidents } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get('q') || ''
  );
  const [selectedType, setSelectedType] = useState<'ALL' | VehicleType>(() => {
    const t = searchParams.get('type') as VehicleType | null;
    return t && ['Car', 'SUV', 'Bike', 'Van'].includes(t) ? t : 'ALL';
  });
  const [selectedCity, setSelectedCity] = useState<string>(
    () => searchParams.get('city') || 'ALL'
  );
  const [transmissionFilter, setTransmissionFilter] = useState<string>('ALL');
  const [fuelFilter, setFuelFilter] = useState<string>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('ALL');
  const [maxHourlyBudget, setMaxHourlyBudget] = useState<number>(1000);
  const [sortBy, setSortBy] = useState<string>('recommended');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q');
    const t = searchParams.get('type') as VehicleType | null;
    const c = searchParams.get('city');
    if (q !== null) setSearchQuery(q);
    if (t && ['Car', 'SUV', 'Bike', 'Van'].includes(t)) {
      setSelectedType(t);
    }
    if (c !== null) setSelectedCity(c);
  }, [searchParams]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      const city = v.location.split(/[—,-]/)[0]?.trim();
      if (city) set.add(city);
    });
    return Array.from(set);
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter((v) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const fullName = `${v.brand} ${v.model}`.toLowerCase();
          const match =
            fullName.includes(q) ||
            v.brand.toLowerCase().includes(q) ||
            v.model.toLowerCase().includes(q) ||
            v.location.toLowerCase().includes(q);
          if (!match) return false;
        }

        if (selectedType !== 'ALL' && v.type !== selectedType) return false;

        if (
          selectedCity !== 'ALL' &&
          !v.location.toLowerCase().includes(selectedCity.toLowerCase())
        ) {
          return false;
        }

        if (
          transmissionFilter !== 'ALL' &&
          v.transmission !== transmissionFilter
        ) {
          return false;
        }

        if (fuelFilter !== 'ALL' && v.fuelType !== fuelFilter) {
          return false;
        }

        if (v.hourlyRate > maxHourlyBudget) {
          return false;
        }

        if (availabilityFilter !== 'ALL') {
          const opStatus = evaluateVehicleOperationalStatus(
            v,
            bookings,
            incidents
          );
          if (availabilityFilter === 'AVAILABLE_NOW' && !opStatus.isBookable) {
            return false;
          }
          if (
            availabilityFilter === 'IN_USE_OR_MAINTENANCE' &&
            opStatus.isBookable
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'hourly_asc') return a.hourlyRate - b.hourlyRate;
        if (sortBy === 'hourly_desc') return b.hourlyRate - a.hourlyRate;
        const dailyA = a.dailyRate || a.hourlyRate * 20;
        const dailyB = b.dailyRate || b.hourlyRate * 20;
        if (sortBy === 'price_asc') return dailyA - dailyB;
        if (sortBy === 'price_desc') return dailyB - dailyA;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [
    vehicles,
    bookings,
    incidents,
    searchQuery,
    selectedType,
    selectedCity,
    transmissionFilter,
    fuelFilter,
    maxHourlyBudget,
    availabilityFilter,
    sortBy,
  ]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('ALL');
    setSelectedCity('ALL');
    setTransmissionFilter('ALL');
    setFuelFilter('ALL');
    setAvailabilityFilter('ALL');
    setMaxHourlyBudget(1000);
    setSortBy('recommended');
    setSearchParams({});
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedType !== 'ALL' ||
    selectedCity !== 'ALL' ||
    transmissionFilter !== 'ALL' ||
    fuelFilter !== 'ALL' ||
    availabilityFilter !== 'ALL' ||
    maxHourlyBudget < 1000;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Browse vehicles
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Compare hourly and daily rates, check real-time availability, and reserve online.
          </p>
        </div>
        <div className="text-xs text-zinc-500">
          Showing{' '}
          <span className="font-semibold text-zinc-900">
            {filteredVehicles.length}
          </span>{' '}
          of {vehicles.length} vehicles
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brand, model, or neighborhood..."
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-zinc-300 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15"
            />
          </div>

          {/* City Select */}
          <div className="md:col-span-3">
            <select
              aria-label="Filter by city"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-zinc-300 text-sm text-zinc-900 bg-white focus:outline-none focus:border-[#0F766E]"
            >
              <option value="ALL">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Select */}
          <div className="md:col-span-2">
            <select
              aria-label="Sort vehicles"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-zinc-300 text-sm text-zinc-900 bg-white focus:outline-none focus:border-[#0F766E]"
            >
              <option value="recommended">Recommended</option>
              <option value="hourly_asc">Hourly rate: Low to high</option>
              <option value="hourly_desc">Hourly rate: High to low</option>
              <option value="price_asc">Daily rate: Low to high</option>
              <option value="price_desc">Daily rate: High to low</option>
            </select>
          </div>

          {/* More Filters Toggle */}
          <div className="md:col-span-2">
            <Button
              variant={showAdvancedFilters ? 'secondary' : 'outline'}
              size="md"
              fullWidth
              leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              Filters
            </Button>
          </div>
        </div>

        {/* Category Segmented Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {VEHICLE_CATEGORIES.map((cat) => {
              const active = selectedType === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedType(cat.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear filters</span>
            </button>
          )}
        </div>

        {/* Collapsible Secondary Filters */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-zinc-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              label="Transmission"
              value={transmissionFilter}
              onChange={(e) => setTransmissionFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'Any transmission' },
                { value: 'Automatic', label: 'Automatic' },
                { value: 'Manual', label: 'Manual' },
              ]}
            />
            <Select
              label="Fuel type"
              value={fuelFilter}
              onChange={(e) => setFuelFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'Any fuel type' },
                { value: 'Petrol', label: 'Petrol' },
                { value: 'Diesel', label: 'Diesel' },
                { value: 'Electric', label: 'Electric (EV)' },
                { value: 'Hybrid', label: 'Hybrid' },
              ]}
            />
            <Select
              label="Availability"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'Show all vehicles' },
                { value: 'AVAILABLE_NOW', label: 'Available to book' },
                { value: 'IN_USE_OR_MAINTENANCE', label: 'Paused or on hold' },
              ]}
            />
            <Select
              label="Max hourly rate"
              value={String(maxHourlyBudget)}
              onChange={(e) => setMaxHourlyBudget(Number(e.target.value))}
              options={[
                { value: '1000', label: 'Any hourly rate' },
                { value: '350', label: 'Up to ₹350 / hr' },
                { value: '250', label: 'Up to ₹250 / hr' },
                { value: '150', label: 'Up to ₹150 / hr' },
              ]}
            />
          </div>
        )}
      </div>

      {/* Results Grid */}
      {filteredVehicles.length === 0 ? (
        <EmptyState
          title="No matching vehicles"
          description="Try clearing one of your active filters or expanding your hourly budget."
          actionLabel="Reset filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              bookings={bookings}
              incidents={incidents}
              currentUserId={currentUser?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
