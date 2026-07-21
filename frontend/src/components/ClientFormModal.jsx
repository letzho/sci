import { useEffect, useState } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import api from '../api/client';
import { Button } from './ui.jsx';

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200';

/**
 * Add or edit an agent-owned client. Demo clients (Alex, Mary, etc.) are read-only.
 * Captures the fields the Client Brief AI uses: profile, health, notes, and prospect vs current.
 */
export default function ClientFormModal({ customer, onClose, onSaved }) {
  const isEdit = Boolean(customer?.id && !customer?.isDemo);
  const [name, setName] = useState(customer?.name || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [dob, setDob] = useState(customer?.dob || '');
  const [healthCondition, setHealthCondition] = useState(customer?.healthCondition || '');
  const [notes, setNotes] = useState(customer?.notes || '');
  const [clientStatus, setClientStatus] = useState(customer?.clientStatus || 'current');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customer) return;
    setName(customer.name || '');
    setEmail(customer.email || '');
    setPhone(customer.phone || '');
    setDob(customer.dob || '');
    setHealthCondition(customer.healthCondition || '');
    setNotes(customer.notes || '');
    setClientStatus(customer.clientStatus || 'current');
  }, [customer]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      name: name.trim(),
      email,
      phone,
      dob,
      healthCondition,
      notes,
      clientStatus,
    };
    try {
      const res = isEdit
        ? await api.put(`/customers/${customer.id}`, payload)
        : await api.post('/customers', payload);
      onSaved?.(res.data.customer);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save client.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} aria-label="Close" />
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto pointer-events-none">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md my-8 pointer-events-auto animate-fade-in"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                <UserPlus size={17} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{isEdit ? 'Edit client' : 'Add client'}</h3>
                <p className="text-[11px] text-slate-500">Private to your account · powers the AI Client Brief</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Full name *</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Email</span>
                <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">Phone</span>
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Date of birth</span>
              <input type="date" className={inputClass} value={dob} onChange={(e) => setDob(e.target.value)} />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Health / medical notes</span>
              <input
                className={inputClass}
                placeholder="e.g. Mild hypertension, controlled with medication"
                value={healthCondition}
                onChange={(e) => setHealthCondition(e.target.value)}
              />
            </label>

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-slate-600">Client type</legend>
              <div className="flex gap-2">
                {[
                  { value: 'current', label: 'Current client' },
                  { value: 'prospect', label: 'Potential prospect' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs cursor-pointer text-center transition-colors ${
                      clientStatus === opt.value
                        ? 'border-brand-400 bg-brand-50 text-brand-800 font-medium'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="clientStatus"
                      value={opt.value}
                      checked={clientStatus === opt.value}
                      onChange={() => setClientStatus(opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Notes for AI brief</span>
              <textarea
                className={`${inputClass} min-h-[88px] resize-y`}
                placeholder="Goals, context, products they are considering, family situation…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add client'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
