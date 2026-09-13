import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, PackageCheck } from 'lucide-react';
import { api, getErrorMessage } from '../services/api.js';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews.jsx';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/clients/${id}`);
      setData(data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(['packing_bills', 'clients'], load);

  if (loading) return <LoadingState label="Loading client…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const { client, packingHistory } = data;

  return (
    <div className="space-y-5">
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Back to clients
      </Link>

      <div className="card p-5">
        <h1 className="text-xl font-semibold text-ink">{client.name}</h1>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          {client.phone && (
            <span className="flex items-center gap-1.5">
              <Phone size={14} /> {client.phone}
            </span>
          )}
          {client.address && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} /> {client.address}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-faint">Added by {client.createdBy}</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Packing history</h2>
        {packingHistory.length === 0 ? (
          <EmptyState icon={PackageCheck} title="No packing bills yet" description="Bills created for this client will show up here." />
        ) : (
          <div className="space-y-2.5">
            {packingHistory.map((p) => (
              <div key={p.id} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-mono text-xs font-semibold text-accent-dark">{p.billNumber}</p>
                  <p className="mt-0.5 text-sm text-ink">
                    {p.product} · {p.size}
                    {p.quantity ? ` · ${p.quantity} rolls` : ''}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {formatDate(p.date)} · by {p.createdBy}
                  </p>
                </div>
                <span className="badge-accent">{p.weightKg} KG</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
