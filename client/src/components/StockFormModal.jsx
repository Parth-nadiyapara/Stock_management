import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';

const today = () => new Date().toISOString().slice(0, 10);

export default function StockFormModal({ open, onClose, onSubmit, initial }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({ product: '', type: 'product', size: '', weightKg: '', pricePerKg: '', date: today() });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              product: initial.product,
              type: initial.productType || 'product',
              size: initial.size || '',
              weightKg: initial.weightKg,
              pricePerKg: initial.pricePerKg,
              date: initial.date,
            }
          : { product: '', type: 'product', size: '', weightKg: '', pricePerKg: '', date: today() }
      );
      setError('');
    }
  }, [open, initial]);

  const isMaterial = form.type === 'material';

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.product.trim()) return setError('Product / material name is required');
    if (!isMaterial && !form.size.trim()) return setError('Size is required');
    if (!form.weightKg || Number(form.weightKg) <= 0) return setError('Enter a valid weight in KG');
    if (form.pricePerKg === '' || Number(form.pricePerKg) < 0) return setError('Enter a valid price');

    setBusy(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit stock' : 'Add stock'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Type</label>
          {isEdit ? (
            <p className="text-sm text-ink-soft">
              <span className={isMaterial ? 'badge-neutral' : 'badge-accent'}>{isMaterial ? 'Material' : 'Product'}</span>
              <span className="ml-2 text-xs text-ink-faint">Type is set when the item is first created.</span>
            </p>
          ) : (
            <div className="segmented" role="tablist" aria-label="Stock type">
              <button
                type="button"
                role="tab"
                aria-selected={form.type === 'product'}
                className={form.type === 'product' ? 'segmented-option-active' : 'segmented-option'}
                onClick={() => set('type', 'product')}
              >
                Product
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isMaterial}
                className={isMaterial ? 'segmented-option-active' : 'segmented-option'}
                onClick={() => set('type', 'material')}
              >
                Material
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="label">{isMaterial ? 'Material name' : 'Product name'}</label>
          <input
            className="input"
            value={form.product}
            onChange={(e) => set('product', e.target.value)}
            placeholder={isMaterial ? 'Raw HDPE Granules' : 'Plastic Material A'}
          />
        </div>

        {/* Materials aren't sized - only finished Products are. */}
        <div className={isMaterial ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
          {!isMaterial && (
            <div>
              <label className="label">Size</label>
              <input className="input" value={form.size} onChange={(e) => set('size', e.target.value)} placeholder="2 inch" />
            </div>
          )}
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Weight (KG)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.weightKg}
              onChange={(e) => set('weightKg', e.target.value)}
              placeholder="500"
            />
          </div>
          <div>
            <label className="label">Price / KG (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.pricePerKg}
              onChange={(e) => set('pricePerKg', e.target.value)}
              placeholder="120"
            />
          </div>
        </div>

        {isEdit && (
          <p className="text-xs text-ink-faint">
            Reducing the weight below what's already been packed from this batch isn't allowed.
          </p>
        )}
        {!isEdit && isMaterial && (
          <p className="text-xs text-ink-faint">
            Materials are tracked as stock but won't appear in the Packing bill product picker. Use Produce on the
            Stock page to convert material into a finished Product.
          </p>
        )}

        {error && <div className="rounded-control bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add stock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
