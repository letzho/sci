import { useCallback, useEffect, useState } from 'react';
import { Ban, CalendarPlus } from 'lucide-react';
import api from '../api/client';
import { Button } from './ui.jsx';

const CHANNELS = [
  { value: 'virtual_call', label: 'Video call' },
  { value: 'chat', label: 'Chat' },
  { value: 'face_to_face', label: 'Face-to-face' },
];

/** Schedule a client appointment or block a date on the rep calendar. */
export default function AppointmentScheduler({
  agentId,
  customerId,
  customerName,
  customers = [],
  defaultDate,
  compact = false,
  onSaved,
}) {
  const [mode, setMode] = useState('appointment');
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');
  const [date, setDate] = useState(defaultDate || '');
  const [time, setTime] = useState('10:00');
  const [channel, setChannel] = useState('virtual_call');
  const [title, setTitle] = useState('Client meeting');
  const [notes, setNotes] = useState('');
  const [blockReason, setBlockReason] = useState('Unavailable');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (customerId) setSelectedCustomerId(customerId);
  }, [customerId]);

  useEffect(() => {
    if (defaultDate) setDate(defaultDate);
  }, [defaultDate]);

  const save = useCallback(async () => {
    if (!agentId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'block') {
        if (!date) throw new Error('Pick a date to block');
        await api.post('/appointments/blocked', { agentId, blockDate: date, reason: blockReason });
        setMessage(`Blocked ${date}`);
      } else {
        const cid = customerId || selectedCustomerId;
        if (!cid) throw new Error('Select a customer');
        if (!date || !time) throw new Error('Pick date and time');
        const scheduledAt = new Date(`${date}T${time}`).toISOString();
        await api.post('/appointments', {
          agentId,
          customerId: cid,
          scheduledAt,
          channel,
          title,
          notes: notes || null,
        });
        const name = customerName || customers.find((c) => c.id === cid)?.name || 'client';
        setMessage(`Scheduled with ${name.split(' ')[0]}`);
        setNotes('');
      }
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }, [
    agentId,
    blockReason,
    channel,
    customerId,
    customerName,
    customers,
    date,
    mode,
    notes,
    onSaved,
    selectedCustomerId,
    time,
    title,
  ]);

  const inputClass = compact
    ? 'w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]'
    : 'w-full rounded-xl border border-slate-200 px-3 py-2 text-xs';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode('appointment')}
          className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-medium ${
            mode === 'appointment' ? 'bg-brand-100 text-brand-700' : 'bg-slate-50 text-slate-500'
          }`}
        >
          <CalendarPlus size={12} /> Book
        </button>
        <button
          type="button"
          onClick={() => setMode('block')}
          className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-medium ${
            mode === 'block' ? 'bg-rose-100 text-rose-700' : 'bg-slate-50 text-slate-500'
          }`}
        >
          <Ban size={12} /> Block date
        </button>
      </div>

      {mode === 'appointment' && !customerId && customers.length > 0 && (
        <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className={inputClass}>
          <option value="">Select customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {mode === 'appointment' && customerId && customerName && (
        <p className="text-[11px] text-slate-600">
          With <strong>{customerName}</strong>
        </p>
      )}

      <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-2'}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        {mode === 'appointment' ? (
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        ) : (
          <input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Reason"
            className={inputClass}
          />
        )}
      </div>

      {mode === 'appointment' && (
        <>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {!compact && (
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting title"
                className={inputClass}
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes for yourself (optional)"
                rows={2}
                className={inputClass}
              />
            </>
          )}
        </>
      )}

      <Button size="sm" className="w-full" disabled={saving} onClick={save}>
        {saving ? 'Saving…' : mode === 'block' ? 'Block date' : 'Schedule appointment'}
      </Button>

      {message && <p className="text-[10px] text-emerald-700">{message}</p>}
      {error && <p className="text-[10px] text-rose-600">{error}</p>}
    </div>
  );
}
