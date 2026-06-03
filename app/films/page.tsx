'use client';

import { useState, useEffect } from 'react';
import { fmtM, fmtShort } from '@/lib/utils';

type SearchResult = { id: string; title: string; studio: string; release_date: string; is_wide: boolean };
type RunWeek = {
  week_in_run: number;
  gross: string;
  screens: number | string;
  market_share: string | null;
  date: string;
  total_industry_gross: string;
  holiday_flag: boolean;
  holiday_name: string | null;
};
type FilmRun = {
  film: { id: number; title: string; studio: string; release_date: string; is_wide: boolean; distributor: string | null };
  stats: {
    openingGross: number;
    totalGross: number;
    wk2DropPct: number | null;
    peakScreens: number;
    runWeeks: number;
    openingMarketShare: number | null;
  };
  weeks: RunWeek[];
};

export default function FilmsPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [run, setRun] = useState<FilmRun | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/films/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then(setResults);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const selectFilm = async (r: SearchResult) => {
    setSelId(r.id);
    setLoadingRun(true);
    try {
      const res = await fetch(`/api/films/${r.id}/run`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      const data: FilmRun = await res.json();
      setRun(data);
    } catch (e) {
      console.error('Failed to load film run:', e);
    } finally {
      setLoadingRun(false);
    }
  };

  const weeks = run?.weeks ?? [];
  const grossMs = weeks.map((w) => Number(w.gross) / 1_000_000);
  const maxGrossM = grossMs.length ? Math.max(...grossMs, 1) : 1;
  const totalM = grossMs.reduce((s, g) => s + g, 0);

  return (
    <div style={{
      padding: '26px 30px 70px',
      display: 'grid',
      gridTemplateColumns: '300px 1fr',
      gap: 32,
    }}>
      {/* Left — search + list */}
      <div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Find a film</label>
          <input
            className="control"
            placeholder="Search titles…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          {results.map((r) => {
            const active = r.id === selId;
            return (
              <button
                key={r.id}
                onClick={() => selectFilm(r)}
                style={{
                  textAlign: 'left',
                  border: 0,
                  borderBottom: '1px solid var(--line)',
                  background: active ? 'var(--card)' : 'transparent',
                  padding: '11px 12px',
                  borderRadius: active ? 'var(--r-sm)' : 0,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.studio} · {r.release_date?.slice(0, 4)}</div>
                </div>
              </button>
            );
          })}
          {q && results.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '12px 4px' }}>No titles match "{q}".</div>
          )}
          {!q && !run && (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '12px 4px' }}>Start typing to search films.</div>
          )}
        </div>
      </div>

      {/* Right — detail */}
      <div style={{ minWidth: 0 }}>
        {loadingRun && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--ink-3)', fontSize: 13 }}>
            Loading…
          </div>
        )}

        {run && !loadingRun && (
          <>
            <div>
              <span className="eyebrow">On record</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6, lineHeight: 1.05 }}>{run.film.title}</div>
            <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>
              {run.film.studio} · {weeks[0]?.date?.slice(0, 4) ?? run.film.release_date?.slice(0, 4)}
            </div>

            {/* Fact cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 24 }}>
              <div className="card">
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Opening weekend</div>
                <div className="tnum" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{fmtM(run.stats.openingGross / 1_000_000)}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Weekend gross</div>
                <div className="tnum" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{fmtM(totalM)}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Peak screens</div>
                <div className="tnum" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{run.stats.peakScreens.toLocaleString()}</div>
              </div>
              <div className="card">
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Run length</div>
                <div className="tnum" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{run.stats.runWeeks} wks</div>
              </div>
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Release date</div>
                <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>
                  {weeks[0]?.date
                    ? `${fmtShort(weeks[0].date)}, ${weeks[0].date.slice(0, 4)}`
                    : run.film.release_date}
                  {run.stats.wk2DropPct != null && (
                    <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 400, marginLeft: 18 }}>
                      Wk 2 drop: -{run.stats.wk2DropPct}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Run curve */}
            {weeks.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div className="section-label">Weekly run</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130 }}>
                  {weeks.map((w, i) => {
                    const gM = Number(w.gross) / 1_000_000;
                    return (
                      <div
                        key={i}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                      >
                        <div className="tnum" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 4 }}>{fmtM(gM)}</div>
                        <div style={{
                          width: '100%',
                          maxWidth: 46,
                          height: Math.max(4, (gM / maxGrossM) * 92) + 'px',
                          background: i === 0 ? 'var(--accent)' : 'var(--bar-soft)',
                          borderRadius: '3px 3px 0 0',
                        }} />
                        <div className="wk-badge" style={{ marginTop: 6 }}>W{i + 1}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-3)' }}>
                  Weekend gross{' '}
                  <b style={{ color: 'var(--ink)' }} className="tnum">{fmtM(totalM)}</b>
                  {' '}over a {run.stats.runWeeks}-week run
                  {run.stats.openingGross > 0 && (
                    <> · opening multiple{' '}
                      <b style={{ color: 'var(--ink)' }} className="tnum">
                        {(totalM / (run.stats.openingGross / 1_000_000)).toFixed(1)}×
                      </b>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {!run && !loadingRun && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--ink-3)', fontSize: 14 }}>
            Search for a film to see its theatrical run
          </div>
        )}
      </div>
    </div>
  );
}
