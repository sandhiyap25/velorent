import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Car } from 'lucide-react';
import { Button, Input } from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';

export const LoginPage: React.FC = () => {
  const { login } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.success) {
        setError(res.error || 'Invalid email or password.');
        return;
      }

      const from = (location.state as { from?: string } | null)?.from;
      if (from && from !== '/login' && from !== '/signup') {
        navigate(from);
      } else if (res.user?.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#0F766E] text-white flex items-center justify-center mb-3">
              <Car className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
              Sign in to VeloRent
            </h1>
            <p className="text-xs text-zinc-500">
              Manage your vehicle reservations and fleet listings.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={submitting}
            >
              Sign in
            </Button>
          </form>

          <p className="text-xs text-zinc-500 text-center pt-2 border-t border-zinc-100">
            New to VeloRent?{' '}
            <Link
              to="/signup"
              className="text-[#0F766E] font-medium hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
