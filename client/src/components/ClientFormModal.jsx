import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';

export default function ClientFormModal({ open, onClose, onSubmit, initial }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { name: initial.name, phone: initial.phone || '', address: initial.address || '' } : { name: '', phone: '', address: '' });
      setError('');
    }
  }, [open, initial]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Client name is required');

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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit client' : 'Add client'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Client name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="ABC Industries" />
        </div>
        <div>
          <label className="label">Contact / mobile number</label>
          <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="9876543210" />
        </div>
        <div>
          <label className="label">Address (optional)</label>
          <textarea
            className="input min-h-[80px] resize-none"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="MIDC, Pune"
          />
        </div>

        {error && <div className="rounded-control bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add client'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
