import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import { VehicleCard } from '../components/VehicleCard';
import { Button } from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { VehicleType } from '../types/models';

const CATEGORIES: { label: string; value: 'ALL' | VehicleType }[] = [
  { label: 'All vehicles', value: 'ALL' },
  { label: 'Cars', value: 'Car' },
  { label: 'SUVs', value: 'SUV' },
  { label: 'Bikes', value: 'Bike' },
  { label: 'Vans', value: 'Van' },
];

export const HomePage: React.FC = () => {
  const { currentUser, vehicles, bookings, incidents } = useApp();
  const navigate = useNavigate();

  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | VehicleType>(
    'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');

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
        if (selectedCategory !== 'ALL' && v.type !== selectedCategory)
          return false;
        if (
          selectedCity !== 'ALL' &&
          !v.location.toLowerCase().includes(selectedCity.toLowerCase())
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            v.brand.toLowerCase().includes(q) ||
            v.model.toLowerCase().includes(q) ||
            v.location.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .slice(0, 6);
  }, [vehicles, selectedCategory, selectedCity, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (selectedCategory !== 'ALL') params.set('type', selectedCategory);
    if (selectedCity !== 'ALL') params.set('city', selectedCity);
    navigate(`/rent?${params.toString()}`);
  };

  return (
    <div className="space-y-12 pb-12">
      {/* Clean Header & Search Section */}
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-2xl sm:text-4xl font-semibold text-zinc-900 tracking-tight leading-tight">
              Self-drive cars, SUVs, and two-wheelers by the hour or day
            </h1>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
              Book verified local vehicles with upfront hourly and daily rates, refundable security deposits, and clear pickup schedules.
            </p>
          </div>

          {/* Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-7 bg-[#F8F8F7] border border-zinc-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
          >
            <div className="sm:col-span-4 flex items-center gap-2.5 bg-white border border-zinc-300 rounded-lg px-3 h-10">
              <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <select
                  aria-label="Filter by city"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full text-sm text-zinc-900 bg-transparent focus:outline-none cursor-pointer truncate"
                >
                  <option value="ALL">All cities ({cities.length})</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-5 flex items-center gap-2.5 bg-white border border-zinc-300 rounded-lg px-3 h-10">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search model, brand, or neighborhood..."
                className="w-full text-sm text-zinc-900 bg-transparent focus:outline-none placeholder:text-zinc-400"
              />
            </div>

            <div className="sm:col-span-3">
              <Button type="submit" variant="primary" size="lg" fullWidth>
                Search vehicles
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Featured Vehicles Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          {/* Category Segmented Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <Link
            to="/rent"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F766E] hover:underline shrink-0"
          >
            <span>View all {vehicles.length} vehicles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-900">
              No vehicles match your current filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedCity('ALL');
                setSearchQuery('');
              }}
            >
              Reset filters
            </Button>
          </div>
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
      </section>

      {/* Straightforward How It Works & Host CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-zinc-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 grid grid-cols-1 lg:grid-cols-3">
          <div className="p-6 space-y-2">
            <span className="text-xs font-mono font-medium text-zinc-400">
              01
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">
              Transparent hourly & daily billing
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Every listing shows its exact hourly rate, daily reference rate, and refundable security deposit before you confirm.
            </p>
          </div>
          <div className="p-6 space-y-2">
            <span className="text-xs font-mono font-medium text-zinc-400">
              02
            </span>
            <h3 className="text-sm font-semibold text-zinc-900">
              Conflict-checked reservations
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Each vehicle displays its current operational status and existing reservation windows so double-bookings cannot occur.
            </p>
          </div>
          <div className="p-6 flex flex-col justify-between gap-4 bg-zinc-50/50">
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-zinc-900">
                Have an idle car or bike?
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                List your vehicle with custom hourly rates, availability windows, and security deposit terms.
              </p>
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(currentUser ? '/list-vehicle' : '/login')
                }
              >
                List a vehicle
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
