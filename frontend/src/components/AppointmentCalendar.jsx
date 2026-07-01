import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';
import { endOfMonth, formatAppointmentWhen, formatTimeUntil, startOfMonth, toDateKey } from '../utils/appointmentUtils.js';
import AppointmentScheduler from './AppointmentScheduler.jsx';
import { Badge } from './ui.jsx';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function AppointmentCalendar({ agentId, customers = [], onRefresh }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [reminders, setReminders] = useState([]);

  const load = useCallback(async () => {
    if (!agentId) return;
    const from = startOfMonth(viewDate).toISOString();
    const to = endOfMonth(viewDate).toISOString();
    const [calRes, remRes] = await Promise.all([
      api.get('/appointments', { params: { agentId, from, to, includeBlocked: 'true' } }),
      api.get('/appointments/reminders', { params: { agentId } }),
    ]);
    setAppointments(calRes.data.appointments || []);
    setBlockedDates(calRes.data.blockedDates || []);
    setReminders(remRes.data.reminders || []);
  }, [agentId, viewDate]);

  useEffect(() => {
    load();
  }, [load]);

  const apptsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((a) => {
      const key = a.scheduledAt.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  const blockedSet = useMemo(() => new Set(blockedDates.map((b) => b.blockDate)), [blockedDates]);

  const monthLabel = viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const calendarCells = useMemo(() => {
    const first = startOfMonth(viewDate);
    const startPad = first.getDay();
    const daysInMonth = endOfMonth(viewDate).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
    }
    return cells;
  }, [viewDate]);

  const dayAppointments = apptsByDate[selectedDate] || [];
  const dayBlocked = blockedDates.find((b) => b.blockDate === selectedDate);

  function prevMonth() {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  }

  function handleSaved() {
    load();
    onRefresh?.();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-700">Your calendar</h3>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={prevMonth} className="p-1 text-slate-400 hover:text-slate-600">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] font-medium text-slate-600 min-w-[88px] text-center">{monthLabel}</span>
          <button type="button" onClick={nextMonth} className="p-1 text-slate-400 hover:text-slate-600">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {reminders.length > 0 && (
        <div className="mb-2 rounded-lg bg-amber-50 border border-amber-100 px-2 py-1.5 space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-800">
            <Bell size={11} /> Reminders
          </div>
          {reminders.slice(0, 2).map((r) => (
            <div key={r.id} className="text-[10px] text-amber-900 leading-snug">
              {formatTimeUntil(r.scheduledAt)} · {r.customerName?.split(' ')[0]} — {r.title}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] text-slate-400 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-3">
        {calendarCells.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} />;
          const key = toDateKey(cell);
          const hasAppt = Boolean(apptsByDate[key]?.length);
          const isBlocked = blockedSet.has(key);
          const isSelected = key === selectedDate;
          const isToday = key === toDateKey(new Date());
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(key)}
              className={`relative aspect-square rounded-md text-[10px] font-medium transition-colors ${
                isSelected ? 'bg-brand-600 text-white' : isToday ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-700'
              } ${isBlocked && !isSelected ? 'line-through text-rose-400' : ''}`}
            >
              {cell.getDate()}
              {(hasAppt || isBlocked) && (
                <span
                  className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${
                    isBlocked ? 'bg-rose-400' : isSelected ? 'bg-white' : 'bg-brand-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-100 pt-2 mb-2 flex-1 min-h-0 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-500 mb-1">
          {new Date(`${selectedDate}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        {dayBlocked && (
          <Badge tone="danger" className="mb-1 text-[9px]">
            Blocked — {dayBlocked.reason}
          </Badge>
        )}
        {dayAppointments.length === 0 && !dayBlocked && (
          <p className="text-[10px] text-slate-400">No appointments</p>
        )}
        {dayAppointments.map((a) => (
          <div key={a.id} className="text-[10px] text-slate-600 mb-1.5 leading-snug">
            <span className="font-medium text-slate-800">{formatAppointmentWhen(a.scheduledAt)}</span>
            <br />
            {a.customerName} · {a.title}
          </div>
        ))}
      </div>

      <AppointmentScheduler
        agentId={agentId}
        customers={customers}
        defaultDate={selectedDate}
        compact
        onSaved={handleSaved}
      />
    </div>
  );
}
