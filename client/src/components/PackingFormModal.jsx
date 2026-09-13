import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';

const today = () => new Date().toISOString().slice(0, 10);

export default function PackingFormModal({ open, onClose, onSubmit, clients, stockOptions }) {
  const [form, setForm] = useState({
    clientId: '',
    product: '',
    stockEntryId: '',
    quantity: '',
    weightKg: '',
    date: today(),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ clientId: '', product: '', stockEntryId: '', quantity: '', weightKg: '', date: today() });
      setError('');
    }
  }, [open]);

  const products = useMemo(() => [...new Set(stockOptions.map((s) => s.product))], [stockOptions]);

  const sizesForProduct = useMemo(
    () => stockOptions.filter((s) => s.product === form.product && s.availableKg > 0),
    [stockOptions, form.product]
  );

  const selectedStock = stockOptions.find((s) => s.id === form.stockEntryId);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleProductChange(product) {
    setForm((f) => ({ ...f, product, stockEntryId: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.clientId) return setError('Select a client');
    if (!form.stockEntryId) return setError('Select a product and size');
    const weight = Number(form.weightKg);
    if (!weight || weight <= 0) return setError('Enter a valid weight in KG');
    if (selectedStock && weight > selectedStock.availableKg) {
      return setError(`Only ${selectedStock.availableKg} KG available in this batch`);
    }

    setBusy(true);
    try {
      await onSubmit({
        clientId: form.clientId,
        stockEntryId: form.stockEntryId,
        quantity: form.quantity || undefined,
        weightKg: weight,
        date: form.date,
      });
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="New packing bill">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Client</label>
          <select className="input" value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Product</label>
            <select className="input" value={form.product} onChange={(e) => handleProductChange(e.target.value)}>
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Size</label>
            <select
              className="input"
              value={form.stockEntryId}
              onChange={(e) => set('stockEntryId', e.target.value)}
              disabled={!form.product}
            >
              <option value="">Select size…</option>
              {sizesForProduct.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.size} — {s.availableKg} KG available
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity / rolls (optional)</label>
            <input
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              placeholder="3"
            />
          </div>
          <div>
            <label className="label">Weight (KG)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.weightKg}
              onChange={(e) => set('weightKg', e.target.value)}
              placeholder="90"
            />
          </div>
        </div>

        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>

        {selectedStock && (
          <p className="text-xs text-ink-faint">{selectedStock.availableKg} KG available in the selected batch.</p>
        )}

        {error && <div className="rounded-control bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
