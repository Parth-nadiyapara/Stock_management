import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Printer, PackageCheck } from 'lucide-react';
import { api, getErrorMessage } from '../services/api.js';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import PackingFormModal from '../components/PackingFormModal.jsx';
import PackingBillPrint from '../components/PackingBillPrint.jsx';
import PrintPortal from '../components/PrintPortal.jsx';
import Modal from '../components/Modal.jsx';
import SearchInput from '../components/SearchInput.jsx';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews.jsx';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Packing() {
  const [bills, setBills] = useState([]);
  const [clients, setClients] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refLoaded, setRefLoaded] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [previewBill, setPreviewBill] = useState(null);
  const [printBill, setPrintBill] = useState(null); // only set right when printing, to feed the portal

  // Reference data (clients + packable stock) rarely changes while
  // someone is browsing the packing list, so it's fetched once (plus
  // on realtime changes) rather than on every filter keystroke like
  // the bills list below.
  const loadReference = useCallback(async () => {
    try {
      const [clientsRes, stockRes] = await Promise.all([
        api.get('/clients'),
        api.get('/stock', { params: { type: 'product' } }), // materials never show up here
      ]);
      setClients(clientsRes.data.clients);
      setStock(
        stockRes.data.stock.map((s) => ({ id: s.id, product: s.product, size: s.size, availableKg: s.availableKg }))
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRefLoaded(true);
    }
  }, []);

  const loadBills = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (clientFilter.trim()) params.client = clientFilter.trim();
      if (productFilter.trim()) params.product = productFilter.trim();
      const { data } = await api.get('/packing', { params });
      setBills(data.packing);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, clientFilter, productFilter]);

  useEffect(() => {
    loadReference();
  }, [loadReference]);

  useEffect(() => {
    const t = setTimeout(loadBills, 250);
    return () => clearTimeout(t);
  }, [loadBills]);

  useRealtimeRefresh(['clients', 'stock_entries'], loadReference);
  useRealtimeRefresh(['packing_bills'], loadBills);

  async function handleCreate(payload) {
    const { data } = await api.post('/packing', payload);
    toast.success(`Packing bill ${data.packing.billNumber} created successfully`);
    setModalOpen(false);

    // The backend already applied the deduction atomically - we're
    // not "optimistically" guessing here, just reflecting the delta
    // the server confirmed, so the picker's available KG stays
    // accurate without waiting for a realtime event or a refetch.
    setStock((prev) =>
      prev.map((s) => (s.id === payload.stockEntryId ? { ...s, availableKg: s.availableKg - data.packing.weightKg } : s))
    );
    setBills((prev) => [data.packing, ...prev]);

    // Show the preview - printing only happens if the user clicks Print.
    setPreviewBill(data.packing);
  }

  function openPreview(bill) {
    setPreviewBill(bill);
  }

  function handlePrint() {
    setPrintBill(previewBill);
    // Let the portal render before invoking the browser's print dialog.
    requestAnimationFrame(() => window.print());
  }

  const referenceReady = refLoaded && !loading;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Packing</h1>
          <p className="text-sm text-ink-soft">{bills.length} bills created</p>
        </div>
        <button className="btn-primary hidden md:inline-flex" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New packing bill
        </button>
      </div>

      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <SearchInput className="flex-1" placeholder="Search bill number…" value={search} onChange={setSearch} />
        <input className="input md:w-48" placeholder="Filter by client" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} />
        <input className="input md:w-48" placeholder="Filter by product" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} />
      </div>

      {loading ? (
        <LoadingState label="Loading packing bills…" />
      ) : error ? (
        <ErrorState message={error} onRetry={loadBills} />
      ) : bills.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No packing bills yet"
          description="Create your first packing bill for a client."
          action={
            <button className="btn-primary mt-2" onClick={() => setModalOpen(true)}>
              <Plus size={16} /> New packing bill
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {bills.map((b) => (
            <div key={b.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-accent-dark">{b.billNumber}</p>
                <p className="mt-0.5 truncate text-sm text-ink">
                  {b.client} · {b.product} · {b.size}
                </p>
                <p className="text-xs text-ink-faint">
                  {formatDate(b.date)} · by {b.createdBy}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="badge-accent">{b.weightKg} KG</span>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-control text-ink-soft hover:bg-black/5"
                  onClick={() => openPreview(b)}
                  aria-label="Reprint"
                  title="Reprint"
                >
                  <Printer size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn-primary fixed bottom-20 right-4 z-10 h-14 w-14 rounded-full p-0 shadow-card md:hidden"
        onClick={() => setModalOpen(true)}
        aria-label="New packing bill"
        disabled={!referenceReady}
      >
        <Plus size={22} />
      </button>

      <PackingFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} clients={clients} stockOptions={stock} />

      {/* On-screen preview. Printing is an explicit action - Save/Reprint
          never trigger window.print() on their own. */}
      {previewBill && (
        <Modal
          open={Boolean(previewBill)}
          onClose={() => setPreviewBill(null)}
          title={`Packing bill ${previewBill.billNumber}`}
          footer={
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setPreviewBill(null)}>
                Close
              </button>
              <button className="btn-primary" onClick={handlePrint}>
                <Printer size={14} /> Print
              </button>
            </div>
          }
        >
          <div className="max-h-[65vh] overflow-y-auto rounded-control border border-border">
            <PackingBillPrint bill={previewBill} />
          </div>
        </Modal>
      )}

      {/* The actual print output lives here, completely outside the
          app's DOM tree - see index.css / PrintPortal.jsx. */}
      <PrintPortal>
        <PackingBillPrint bill={printBill} />
      </PrintPortal>
    </div>
  );
}
