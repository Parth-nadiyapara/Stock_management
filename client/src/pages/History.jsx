import { useCallback, useEffect, useState } from 'react';
import { History as HistoryIcon } from 'lucide-react';
import { api, getErrorMessage } from '../services/api.js';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews.jsx';

const ACTIONS = [
  { value: '', label: 'All actions' },
  { value: 'stock.create', label: 'Stock added' },
  { value: 'stock.update', label: 'Stock updated' },
  { value: 'stock.delete', label: 'Stock deleted' },
  { value: 'client.create', label: 'Client added' },
  { value: 'client.update', label: 'Client updated' },
  { value: 'client.delete', label: 'Client deleted' },
  { value: 'packing.create', label: 'Packing created' },
  { value: 'production.create', label: 'Production created' },
];

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function History() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    try {
      const params = {};
      if (userFilter.trim()) params.user = userFilter.trim();
      if (actionFilter) params.action = actionFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data } = await api.get('/activity', { params });
      setActivity(data.activity);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [userFilter, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useRealtimeRefresh(['activity_logs'], load);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">History</h1>
        <p className="text-sm text-ink-soft">A log of everything your team has done</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <input className="input col-span-2 md:col-span-1" placeholder="Filter by user" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} />
        <select className="input" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {loading ? (
        <LoadingState label="Loading history…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : activity.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="No activity found" description="Try adjusting your filters." />
      ) : (
        <div className="card divide-y divide-border">
          {activity.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-4 p-4">
              <p className="text-sm text-ink">{a.description}</p>
              <p className="shrink-0 whitespace-nowrap text-xs text-ink-faint">{formatDateTime(a.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
