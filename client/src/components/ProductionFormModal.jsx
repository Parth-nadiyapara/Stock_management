import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';

const today = () => new Date().toISOString().slice(0, 10);

// materialOptions: [{ id, product, date, availableKg }] - flat list
// of existing Material stock_entries (materials have no size, so
// batches are distinguished by date instead).
export default function ProductionFormModal({ open, onClose, onSubmit, materialOptions }) {
  const [form, setForm] = useState({
    materialStockEntryId: '',
    product: '',
    size: '',
    quantityKg: '',
    pricePerKg: '',
    date: today(),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ materialStockEntryId: '', product: '', size: '', quantityKg: '', pricePerKg: '', date: today() });
      setError('');
    }
  }, [open]);

  const selectedMaterial = useMemo(
    () => materialOptions.find((m) => m.id === form.materialStockEntryId),
    [materialOptions, form.materialStockEntryId]
  );

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.materialStockEntryId) return setError('Select a material');
    if (!form.product.trim()) return setError('Enter the product to produce');
    if (!form.size.trim()) return setError('Size is required');
    const quantity = Number(form.quantityKg);
    if (!quantity || quantity <= 0) return setError('Enter a valid quantity in KG');
    if (selectedMaterial && quantity > selectedMaterial.availableKg) {
      return setError(`Only ${selectedMaterial.availableKg} KG of material available`);
    }

    setBusy(true);
    try {
      await onSubmit({
        materialStockEntryId: form.materialStockEntryId,
        product: form.product.trim(),
        size: form.size.trim(),
        quantityKg: quantity,
        pricePerKg: form.pricePerKg === '' ? undefined : Number(form.pricePerKg),
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
    <Modal open={open} onClose={onClose} title="Produce from material">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Material</label>
          <select
            className="input"
            value={form.materialStockEntryId}
            onChange={(e) => set('materialStockEntryId', e.target.value)}
          >
            <option value="">Select material batch…</option>
            {materialOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.product} · {m.date} — {m.availableKg} KG available
              </option>
            ))}
          </select>
          {materialOptions.length === 0 && (
            <p className="mt-1.5 text-xs text-ink-faint">
              No material stock available. Add material stock first from the Stock page.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Product to produce</label>
            <input
              className="input"
              value={form.product}
              onChange={(e) => set('product', e.target.value)}
              placeholder="Plastic Roll"
            />
          </div>
          <div>
            <label className="label">Size</label>
            <input className="input" value={form.size} onChange={(e) => set('size', e.target.value)} placeholder="2 inch" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity (KG)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.quantityKg}
              onChange={(e) => set('quantityKg', e.target.value)}
              placeholder="120"
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Price / KG (₹) — optional</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={form.pricePerKg}
            onChange={(e) => set('pricePerKg', e.target.value)}
            placeholder="0"
          />
        </div>

        <p className="text-xs text-ink-faint">
          Material used and product produced are always equal (no waste tracked). Material stock decreases by this
          amount and a new Product stock batch is created for it.
        </p>

        {error && <div className="rounded-control bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || materialOptions.length === 0}>
            {busy ? 'Saving…' : 'Save production'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
