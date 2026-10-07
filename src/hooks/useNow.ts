import { useEffect, useState } from 'react';

/**
 * Returns the current Date and re-renders every `intervalMs` (default 30s),
 * so anything derived from "now" (availability badges, default pickup time)
 * stays live without a page refresh.
 */
export function useNow(intervalMs: number = 30_000): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
