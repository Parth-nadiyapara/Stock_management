import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Boxes, Factory } from 'lucide-react';
import { api, getErrorMessage } from '../services/api.js';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import StockFormModal from '../components/StockFormModal.jsx';
import ProductionFormModal from '../components/ProductionFormModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import SearchInput from '../components/SearchInput.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews.jsx';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'product', label: 'Products' },
  { value: 'material', label: 'Materials' },
];

export default function Stock() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // client-side only, no refetch needed

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [productionOpen, setProductionOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (sizeFilter) params.size = sizeFilter;
      if (dateFilter) params.date = dateFilter;
      const { data } = await api.get('/stock', { params });
      setStock(data.stock);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, sizeFilter, dateFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search typing
    return () => clearTimeout(t);
  }, [load]);

  useRealtimeRefresh(['stock_entries'], load);

  const sizes = [...new Set(stock.map((s) => s.size).filter(Boolean))];
  const visibleStock = useMemo(
    () => (typeFilter === 'all' ? stock : stock.filter((s) => s.productType === typeFilter)),
    [stock, typeFilter]
  );
  const materialOptions = useMemo(
    () =>
      stock
        .filter((s) => s.productType === 'material' && s.availableKg > 0)
        .map((s) => ({ id: s.id, product: s.product, date: s.date, availableKg: s.availableKg })),
    [stock]
  );

  // Mutations update local state directly instead of refetching the
  // whole list - the create/update/delete response already has
  // everything we need to render, so there's no need for a second
  // network round trip. Realtime still keeps other tabs/users in sync.
  async function handleCreateOrUpdate(form) {
    if (editing) {
      const { data } = await api.put(`/stock/${editing.id}`, form);
      setStock((prev) => prev.map((s) => (s.id === data.stock.id ? data.stock : s)));
      toast.success('Stock updated successfully');
    } else {
      const { data } = await api.post('/stock', form);
      setStock((prev) => [data.stock, ...prev]);
      toast.success('Stock added successfully');
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await api.delete(`/stock/${deleting.id}`);
      setStock((prev) => prev.filter((s) => s.id !== deleting.id));
      toast.success('Stock entry deleted successfully');
      setDeleting(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  // Production affects two stock rows at once (the material batch
  // is deducted, a new product batch is created). The backend
  // returns both already in Stock-page shape, so we merge them
  // directly instead of refetching the whole list.
  async function handleProduction(payload) {
    const { data } = await api.post('/production', payload);
    setStock((prev) => [data.productStock, ...prev.map((s) => (s.id === data.materialStock.id ? data.materialStock : s))]);
    toast.success(`Production saved — ${data.production.producedKg} KG ${data.production.product} added to stock`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Stock</h1>
          <p className="text-sm text-ink-soft">{visibleStock.length} batches on record</p>
        </div>
        <button
          className="btn-primary hidden md:inline-flex"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Add stock
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="segmented w-full max-w-xs">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={typeFilter === t.value ? 'segmented-option-active' : 'segmented-option'}
              onClick={() => setTypeFilter(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="btn-secondary shrink-0" onClick={() => setProductionOpen(true)}>
          <Factory size={16} /> Produce
        </button>
      </div>

      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <SearchInput className="flex-1" placeholder="Search product…" value={search} onChange={setSearch} />
        <select className="input md:w-40" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
          <option value="">All sizes</option>
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input md:w-44"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingState label="Loading stock…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : visibleStock.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No stock entries found"
          description="Add your first stock batch to get started."
          action={
            <button
              className="btn-primary mt-2"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus size={16} /> Add stock
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-card border border-border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Total KG</th>
                  <th className="px-4 py-3">Available KG</th>
                  <th className="px-4 py-3">Price/KG</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Added by</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleStock.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-soft/60">
                    <td className="px-4 py-3 font-medium text-ink">{s.product}</td>
                    <td className="px-4 py-3">
                      <span className={s.productType === 'material' ? 'badge-neutral' : 'badge-accent'}>
                        {s.productType === 'material' ? 'Material' : 'Product'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{s.size || '—'}</td>
                    <td className="px-4 py-3 text-ink-soft">{s.weightKg.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={s.isLowStock ? 'badge-warning' : 'badge-accent'}>
                        {s.availableKg.toLocaleString()} KG
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">₹{s.pricePerKg}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(s.date)}</td>
                    <td className="px-4 py-3 text-ink-soft">{s.createdBy}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-control text-ink-soft hover:bg-black/5"
                          onClick={() => {
                            setEditing(s);
                            setModalOpen(true);
                          }}
                          aria-label="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-control text-danger hover:bg-danger/10"
                          onClick={() => setDeleting(s)}
                          aria-label="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {visibleStock.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-ink">{s.product}</p>
                      <span className={s.productType === 'material' ? 'badge-neutral' : 'badge-accent'}>
                        {s.productType === 'material' ? 'Material' : 'Product'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-faint">
                      {s.size ? `${s.size} · ` : ''}
                      {formatDate(s.date)}
                    </p>
                  </div>
                  <span className={`${s.isLowStock ? 'badge-warning' : 'badge-accent'} shrink-0`}>
                    {s.availableKg} KG
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-ink-soft">
                  <span>
                    {s.weightKg} KG total · ₹{s.pricePerKg}/KG
                  </span>
                  <span className="text-xs text-ink-faint">by {s.createdBy}</span>
                </div>
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => {
                      setEditing(s);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button className="btn-danger flex-1" onClick={() => setDeleting(s)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sticky mobile add button */}
      <button
        className="btn-primary fixed bottom-20 right-4 z-10 h-14 w-14 rounded-full p-0 shadow-card md:hidden"
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        aria-label="Add stock"
      >
        <Plus size={22} />
      </button>

      <StockFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initial={editing}
      />

      <ProductionFormModal
        open={productionOpen}
        onClose={() => setProductionOpen(false)}
        onSubmit={handleProduction}
        materialOptions={materialOptions}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        busy={deleteBusy}
        title="Delete stock entry"
        message={`Delete ${deleting?.product}${deleting?.size ? ` (${deleting.size})` : ''}? This can't be undone.`}
      />
    </div>
  );
}
