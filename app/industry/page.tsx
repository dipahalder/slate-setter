'use client';

import { useState, useEffect } from 'react';
import { fmtM, MONTHS, FULL_MONTHS } from '@/lib/utils';

const YEAR_OPTIONS = ['all', '2026', '2025', '2024', '2023', '2022', '2021', '2019', '2018', '2017', '2016', '2015'];

type AllWeek = { iso_week: number; avg_gross: string; has_holiday: boolean; holiday_name: string | null };
type YearWeek = { date: string; gross: string; holiday_flag: boolean; holiday_name: string | null };
type TopWeekend = { date: string; gross: string; holiday_flag: boolean; holiday_name: string | null; leading_film: string | null; leading_week_in_run: number | null; leading_genre: string[] | null; leading_gross: string | null };
type Summary = {
  totalGross: number;
  medianWeekendGross: number;
  peakWeekend: { date: string; gross: number; leadingFilm: string | null; leadingStudio: string | null; leadingGross: number | null } | null;
  strongestMonth: { month: number; avgGross: number } | null;
};
type CalData = { summary: Summary; weeks: (AllWeek | YearWeek)[]; topWeekends: TopWeekend[] };
type BarItem = { w: number; grossM: number; holiday: boolean; label: string; holidayName: string | null; date?: string };

const LEGEND = [
  ['$120M+', 'var(--tier-high)'],
  ['$60–120M', 'var(--tier-mid)'],
  ['Under $60M', 'var(--tier-low)'],
  ['Holiday weekend', 'var(--tier-holiday)'],
] as const;

function isoWeekToLabel(week: number): string {
  const jan4 = new Date(2025, 0, 4);
  const day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (day - 1) + (week - 1) * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function tierColor(grossM: number, holiday: boolean): string {
  if (holiday) return 'var(--tier-holiday)';
  if (grossM >= 120) return 'var(--tier-high)';
  if (grossM >= 60) return 'var(--tier-mid)';
  return 'var(--tier-low)';
}

export default function IndustryPage() {
  const [year, setYear] = useState('all');
  const [data, setData] = useState<CalData | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    setData(null);
    setHover(null);
    fetch(`/api/industry/calendar?year=${year}`)
      .then((r) => r.json())
      .then(setData);
  }, [year]);

  const isAll = year === 'all';
  const bars: BarItem[] = data
    ? isAll
      ? (data.weeks as AllWeek[]).map((w, i) => ({
          w: i,
          grossM: Number(w.avg_gross) / 1_000_000,
          holiday: w.has_holiday,
          label: isoWeekToLabel(w.iso_week),
          holidayName: w.holiday_name ?? null,
        }))
      : (data.weeks as YearWeek[]).map((w, i) => ({
          w: i,
          grossM: Number(w.gross) / 1_000_000,
          holiday: w.holiday_flag,
          label: new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          holidayName: w.holiday_name ?? null,
          date: w.date,
        }))
    : [];

  // For year view, place bars at their correct week-of-year slot (0–51) so month labels align.
  // For all-years view, bars are already 52 ISO weeks — use directly.
  const renderSlots: (BarItem | null)[] = isAll
    ? bars
    : (() => {
        const arr: (BarItem | null)[] = new Array(52).fill(null);
        bars.forEach((b) => {
          if (b.date) {
            const d = new Date(b.date + 'T00:00:00');
            const startOfYear = new Date(d.getFullYear(), 0, 1);
            const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
            const slot = Math.min(51, Math.floor(dayOfYear / 7));
            arr[slot] = b;
          }
        });
        return arr;
      })();

  const maxM = bars.length ? Math.max(...bars.map((b) => b.grossM), 1) : 1;
  const s = data?.summary;
  const top = data?.topWeekends ?? [];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '26px 30px 70px' }}>
      {/* Year selector */}
      <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <label style={{ margin: 0 }}>Year</label>
        <div style={{ position: 'relative' }}>
          <select
            className="control"
            style={{ width: 160, fontSize: 14, padding: '8px 12px' }}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y === 'all' ? 'All years avg' : y}</option>
            ))}
          </select>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-3)' }}>▾</span>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <IndStat
          label={
            s?.peakWeekend?.date
              ? `Peak weekend — ${new Date(s.peakWeekend.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Peak weekend'
          }
          value={s?.peakWeekend ? fmtM(s.peakWeekend.gross / 1_000_000) : '—'}
          sub={
            s?.peakWeekend?.leadingFilm
              ? `Leading film: ${s.peakWeekend.leadingFilm}${s.peakWeekend.leadingGross ? ` · ${fmtM(s.peakWeekend.leadingGross / 1_000_000)}` : ''}`
              : undefined
          }
        />
        <IndStat
          label="Strongest month"
          value={s?.strongestMonth ? FULL_MONTHS[Number(s.strongestMonth.month) - 1] : '—'}
          sub={s?.strongestMonth ? fmtM(s.strongestMonth.avgGross / 1_000_000) + ' avg' : undefined}
        />
        <IndStat
          label="Total gross"
          value={s ? fmtM(s.totalGross / 1_000_000) : '—'}
          sub={s ? 'Median weekend: ' + fmtM(s.medianWeekendGross / 1_000_000) : undefined}
        />
      </div>

      {/* Chart */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '24px 24px 18px', marginTop: 20 }}>
        {!data ? (
          <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            Loading…
          </div>
        ) : (
          <>
            <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 168 }}>
                {renderSlots.map((b, i) => (
                  b ? (
                    <div
                      key={i}
                      onMouseEnter={() => setHover(i)}
                      style={{
                        flex: 1,
                        height: Math.max(4, (b.grossM / maxM) * 168) + 'px',
                        background: tierColor(b.grossM, b.holiday),
                        borderRadius: '3px 3px 0 0',
                        cursor: 'default',
                        opacity: hover == null || hover === i ? 1 : 0.4,
                        transition: 'opacity .1s',
                      }}
                    />
                  ) : (
                    <div key={i} style={{ flex: 1 }} />
                  )
                ))}
              </div>
              {hover != null && renderSlots[hover] && (
                <div style={{
                  position: 'absolute',
                  left: `${Math.min(92, Math.max(8, ((hover + 0.5) / renderSlots.length) * 100))}%`,
                  top: 0,
                  transform: 'translate(-50%, calc(-100% - 8px))',
                  pointerEvents: 'none',
                  zIndex: 5,
                  background: 'var(--ink)',
                  color: 'var(--panel)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  boxShadow: 'var(--shadow-pop)',
                  whiteSpace: 'nowrap',
                }}>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{renderSlots[hover]!.label}</div>
                  {renderSlots[hover]!.holidayName && (
                    <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>📅 {renderSlots[hover]!.holidayName}</div>
                  )}
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>Industry gross{isAll ? ' (avg)' : ''}</div>
                  <div className="tnum" style={{ fontSize: 17, fontWeight: 700, marginTop: 1 }}>
                    {fmtM(renderSlots[hover]!.grossM)}
                  </div>
                </div>
              )}
            </div>

            {/* Month axis */}
            <div style={{ display: 'flex', marginTop: 8 }}>
              {MONTHS.map((m) => (
                <div key={m} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>{m}</div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 18, marginTop: 16, flexWrap: 'wrap' }}>
              {LEGEND.map(([lab, col]) => (
                <span key={lab} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink-2)' }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: col }} />{lab}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Records table */}
      {top.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Biggest weekends on record</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                {(['#', 'Date', 'Leading film', 'Genre', 'Wk', 'Industry gross'] as const).map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 4 ? 'right' : 'left', padding: '12px 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '14px 8px', color: 'var(--ink-3)', fontSize: 13.5, width: 40 }}>{i + 1}</td>
                  <td className="tnum" style={{ padding: '14px 8px', color: 'var(--ink-2)', fontSize: 14 }}>
                    {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '14px 8px', fontWeight: 600, fontSize: 14.5 }}>{r.leading_film ?? '—'}</td>
                  <td style={{ padding: '14px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      {r.leading_genre?.map((g, i) => (
                        <span key={i} style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 12, background: 'var(--card-2)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}>{g}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                    {r.leading_week_in_run != null && (
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 99,
                        fontSize: 13,
                        fontWeight: 600,
                        background: r.leading_week_in_run === 1 ? 'var(--pos-bg)' : 'var(--warn-bg)',
                        color: r.leading_week_in_run === 1 ? 'var(--pos-ink)' : 'var(--warn-ink)',
                      }}>
                        Week {r.leading_week_in_run}
                      </span>
                    )}
                  </td>
                  <td className="tnum" style={{ padding: '14px 8px', textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{fmtM(Number(r.gross) / 1_000_000)}</div>
                    {r.leading_gross && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        {fmtM(Number(r.leading_gross) / 1_000_000)} leading film
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IndStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '18px 20px' }}>
      <div className="eyebrow" style={{ fontSize: 11 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 32, fontWeight: 800, marginTop: 10, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 7 }}>{sub}</div>}
    </div>
  );
}
