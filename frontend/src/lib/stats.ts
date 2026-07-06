// Public site-stats client. The visitor counter lives on the landing page,
// which anonymous users see, so these call the API directly with plain fetch
// (no Supabase session / auth header needed).

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface VisitCount {
  total: number;
}

/** Count one page view and return the new total. */
export async function recordVisit(): Promise<VisitCount> {
  const res = await fetch(`${API_BASE_URL}/stats/visit`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Current total page views for display. */
export async function getVisits(): Promise<VisitCount> {
  const res = await fetch(`${API_BASE_URL}/stats/visits`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
