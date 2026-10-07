import React, { useEffect, useState } from 'react';
import { Button, Input } from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';
import { formatShortDate } from '../utils/rentalCalculations';

export const ProfilePage: React.FC = () => {
  const { currentUser, updateProfile, bookings, vehicles } = useApp();

  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [city, setCity] = useState(currentUser?.city || 'Bengaluru');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setPhone(currentUser.phone);
      setCity(currentUser.city || 'Bengaluru');
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const myRentalsCount = bookings.filter(
    (b) => b.renterId === currentUser.id
  ).length;
  const myListedCount = vehicles.filter(
    (v) => v.ownerId === currentUser.id
  ).length;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
          Account settings
        </h1>
        <p className="text-sm text-zinc-600 mt-1">
          Update your contact information and primary city.
        </p>
      </div>

      {/* Account Summary */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-zinc-900 text-white font-semibold text-lg flex items-center justify-center shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              {currentUser.name}
            </h2>
            <p className="text-xs text-zinc-500">
              {currentUser.email} · Member since{' '}
              {formatShortDate(currentUser.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-100">
          <div>
            <p className="text-zinc-500">Trips booked</p>
            <p className="font-mono text-base font-semibold text-zinc-900">
              {myRentalsCount}
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Vehicles listed</p>
            <p className="font-mono text-base font-semibold text-zinc-900">
              {myListedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form
        onSubmit={handleSave}
        className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email address"
            value={currentUser.email}
            disabled
            hint="Email address is linked to your account"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
        </div>

        <div className="pt-2 flex justify-end">
          <Button type="submit" variant="primary" isLoading={saving}>
            Save profile
          </Button>
        </div>
      </form>
    </div>
  );
};
