import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, PackagePlus, Truck, Users, Layers, AlertTriangle } from 'lucide-react';
import { api, getErrorMessage } from '../services/api.js';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import StatCard from '../components/StatCard.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews.jsx';

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard');
      setData(data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(['stock_entries', 'clients', 'packing_bills', 'activity_logs'], load);

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const { cards, lowStockItems, recentActivity, recentPacking } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-soft">A quick look at today's stock and activity</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-5">
        <StatCard icon={Boxes} label="Available stock" value={`${cards.totalAvailableKg.toLocaleString()} KG`} />
        <StatCard icon={PackagePlus} label="Added today" value={`${cards.todaysAddedKg.toLocaleString()} KG`} />
        <StatCard icon={Truck} label="Packed today" value={`${cards.todaysPackingKg.toLocaleString()} KG`} />
        <StatCard icon={Users} label="Clients" value={cards.totalClients} />
        <StatCard icon={Layers} label="Products" value={cards.totalProducts} />
      </div>

      {lowStockItems.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-warning">
            <AlertTriangle size={16} />
            <h2 className="text-sm font-semibold">Low stock warning</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((item, i) => (
              <span key={i} className="badge-warning">
                {item.product} · {item.size} — {item.availableKg} KG left
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Recent activity</h2>
          {recentActivity.length === 0 ? (
            <EmptyState title="No activity yet" description="Actions will show up here as your team works." />
          ) : (
            <ul className="space-y-3.5">
              {recentActivity.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-ink">{a.description}</p>
                  <p className="text-xs text-ink-faint">{formatDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent packing bills</h2>
            <Link to="/packing" className="text-sm font-medium text-accent hover:text-accent-dark">
              View all
            </Link>
          </div>
          {recentPacking.length === 0 ? (
            <EmptyState title="No packing bills yet" description="Create one from the Packing page." />
          ) : (
            <ul className="space-y-3.5">
              {recentPacking.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-mono text-xs font-semibold text-accent-dark">{p.billNumber}</p>
                    <p className="text-ink">
                      {p.client} — {p.product}
                    </p>
                  </div>
                  <span className="text-ink-soft">{p.weightKg} KG</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
