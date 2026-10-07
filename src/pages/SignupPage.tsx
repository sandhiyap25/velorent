import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car } from 'lucide-react';
import { Button, Input } from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';

export const SignupPage: React.FC = () => {
  const { signup } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError('Please complete all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await signup({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        city: city.trim() || 'Bengaluru',
      });

      if (!res.success) {
        setError(res.error || 'Could not create account.');
        return;
      }

      navigate('/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-[#0F766E] text-white flex items-center justify-center mb-3">
            <Car className="w-4 h-4" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            Create your account
          </h1>
          <p className="text-xs text-zinc-500">
            Rent verified vehicles or list your own car, SUV, or two-wheeler.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full name"
              placeholder="Aarav Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
            <Input
              label="Email address"
              type="email"
              placeholder="aarav@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mobile number"
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
            />
            <Input
              label="City"
              placeholder="Bengaluru"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              label="Confirm password"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={submitting}
          >
            Create account
          </Button>
        </form>

        <p className="text-xs text-zinc-500 text-center pt-2 border-t border-zinc-100">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-[#0F766E] font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
