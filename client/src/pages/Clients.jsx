import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Users, ChevronRight, Phone } from 'lucide-react';
import { api, getErrorMessage } from '../services/api.js';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import ClientFormModal from '../components/ClientFormModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import SearchInput from '../components/SearchInput.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews.jsx';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get('/clients', { params });
      setClients(data.clients);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useRealtimeRefresh(['clients'], load);

  async function handleCreateOrUpdate(form) {
    if (editing) {
      const { data } = await api.put(`/clients/${editing.id}`, form);
      setClients((prev) => prev.map((c) => (c.id === data.client.id ? data.client : c)));
      toast.success('Client updated successfully');
    } else {
      const { data } = await api.post('/clients', form);
      setClients((prev) => [...prev, data.client].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Client added successfully');
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await api.delete(`/clients/${deleting.id}`);
      setClients((prev) => prev.filter((c) => c.id !== deleting.id));
      toast.success('Client deleted successfully');
      setDeleting(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Clients</h1>
          <p className="text-sm text-ink-soft">{clients.length} clients</p>
        </div>
        <button
          className="btn-primary hidden md:inline-flex"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Add client
        </button>
      </div>

      <SearchInput placeholder="Search clients…" value={search} onChange={setSearch} />

      {loading ? (
        <LoadingState label="Loading clients…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients found"
          description="Add your first client to start creating packing bills."
          action={
            <button
              className="btn-primary mt-2"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus size={16} /> Add client
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <div key={c.id} className="card flex flex-col p-4">
              <Link to={`/clients/${c.id}`} className="flex flex-1 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{c.name}</p>
                  {c.phone && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                      <Phone size={13} /> {c.phone}
                    </p>
                  )}
                  {c.address && <p className="mt-1 truncate text-xs text-ink-faint">{c.address}</p>}
                </div>
                <ChevronRight size={18} className="mt-0.5 shrink-0 text-ink-faint" />
              </Link>
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => {
                    setEditing(c);
                    setModalOpen(true);
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button className="btn-danger flex-1" onClick={() => setDeleting(c)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn-primary fixed bottom-20 right-4 z-10 h-14 w-14 rounded-full p-0 shadow-card md:hidden"
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        aria-label="Add client"
      >
        <Plus size={22} />
      </button>

      <ClientFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreateOrUpdate} initial={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        busy={deleteBusy}
        title="Delete client"
        message={`Delete ${deleting?.name}? This can't be undone.`}
      />
    </div>
  );
}
