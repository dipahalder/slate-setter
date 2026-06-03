'use client';

import { useState, useRef, useEffect } from 'react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toLocal(dateStr: string) {
  return new Date(dateStr + 'T00:00:00');
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

export function CalendarPicker({
  value,
  onChange,
  highlights = {},
  onMonthChange,
}: {
  value: string;
  onChange: (d: string) => void;
  highlights?: Record<string, string>;
  onMonthChange?: (year: number, month: number) => void;
}) {
  const sel = value ? toLocal(value) : null;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(sel?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(sel?.getMonth() ?? new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = toLocal(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  function prevMonth() {
    const nm = viewMonth === 0 ? 11 : viewMonth - 1;
    const ny = viewMonth === 0 ? viewYear - 1 : viewYear;
    setViewMonth(nm); setViewYear(ny);
    onMonthChange?.(ny, nm);
  }

  function nextMonth() {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    setViewMonth(nm); setViewYear(ny);
    onMonthChange?.(ny, nm);
  }

  function pickDay(day: number) {
    onChange(toISO(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  }

  const today = toISO(new Date());
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const display = sel
    ? sel.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Pick a date';

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--line-2)'}`,
          boxShadow: open ? '0 0 0 3px var(--accent-bg)' : 'none',
          background: 'var(--panel)',
          borderRadius: 'var(--r-sm)',
          padding: '11px 14px',
          fontSize: 16,
          color: sel ? 'var(--ink)' : 'var(--ink-3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'border-color 0.13s, box-shadow 0.13s',
        }}
      >
        <span>{display}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flex: 'none', opacity: 0.5 }}>
          <rect x="1" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4 1v3M10 1v3M1 6h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 200,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-pop)',
          padding: '18px 16px 14px',
          minWidth: 272,
        }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={prevMonth} style={navBtn}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} style={navBtn}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DAYS.map((d, i) => (
              <div key={d} style={{
                textAlign: 'center',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.05em',
                padding: '4px 0 6px',
                color: 'var(--ink-3)',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Date grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }, (_, i) => <div key={`gap-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const iso = toISO(new Date(viewYear, viewMonth, day));
              const isSelected = iso === value;
              const isToday = iso === today;
              const isFri = new Date(viewYear, viewMonth, day).getDay() === 5;
              const highlightColor = isFri ? highlights[iso] : undefined;

              return (
                <button
                  key={day}
                  onClick={() => pickDay(day)}
                  style={{
                    border: isToday && !isSelected ? '1.5px solid var(--line-2)' : '1.5px solid transparent',
                    borderRadius: 8,
                    padding: '7px 0',
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : highlightColor ? 600 : 400,
                    cursor: isFri ? 'pointer' : 'default',
                    textAlign: 'center',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#fff' : highlightColor ?? (isFri ? 'var(--ink)' : 'var(--ink-3)'),
                    opacity: isFri ? 1 : 0.35,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected && isFri) (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)'; }}
                  onMouseLeave={e => { if (!isSelected && isFri) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--dot-green)', display: 'inline-block' }} />
                <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--dot-amber)', display: 'inline-block' }} />
                <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--dot-red)', display: 'inline-block' }} />
              </span>
              Fri competition
            </span>
            <button
              onClick={() => { onChange(today); setOpen(false); }}
              style={{ border: 0, background: 'transparent', fontSize: 12, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 6,
  color: 'var(--ink-2)',
  display: 'flex',
  alignItems: 'center',
};
