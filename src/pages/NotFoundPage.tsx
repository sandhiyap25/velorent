import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/CommonUI';
import { useApp } from '../hooks/useAppContext';

export const NotFoundPage: React.FC = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
      <div className="w-10 h-10 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center mx-auto">
        <Compass className="w-5 h-5" />
      </div>
      <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
        Page not found
      </h1>
      <p className="text-xs text-zinc-500 leading-relaxed">
        The page you requested does not exist or may have been moved.
      </p>
      <div className="flex items-center justify-center gap-2.5 pt-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(currentUser ? '/dashboard' : '/')}
        >
          {currentUser ? 'Back to overview' : 'Back to home'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/rent')}>
          Browse vehicles
        </Button>
      </div>
    </div>
  );
};
