'use client';

import { useState, useEffect, useCallback } from 'react';
import { isoWeek, nextFriday, fmtM, fmtShort, weekendLabel } from '@/lib/utils';
import { CalendarPicker } from '@/components/CalendarPicker';
import { weekendDotColor, weekendSignals, verdictWord, SIGNAL_COLOR, type WeekendFacts } from '@/lib/windowScore';

type Film = {
  title: string;
  studio: string;
  genre: string[] | null;
  is_wide: boolean;
  gross: string;
  screens: number | string;
  week_in_run: number;
};
type NearbyWeekend = {
  date: string;
  holiday_flag: boolean;
  holiday_name: string | null;
  wide_opener_count: number;
  total_opener_count: number;
  direct_rival_count: number;
  max_week2_screens: number;
  max_week3_screens: number;
};
type HistWeek = { year: number; date: string; gross: string; holiday_flag: boolean };
type GenreFilm = { title: string; studio: string; genre: string[] | null; gross: string; screens: number; date: string; year: number };
type GenreData = { films: GenreFilm[]; stats: { avgGross: number; bestGross: number; count: number } };
type Weekend = { date: string; total_industry_gross: string; holiday_flag: boolean; holiday_name: string | null };

function winDot(w: NearbyWeekend, genreSelected: boolean): string {
  const comp    = w.wide_opener_count >= 6   ? 'red' : w.wide_opener_count >= 4   ? 'amber' : 'green';
  const wk2     = w.max_week2_screens >= 4500 ? 'red' : w.max_week2_screens >= 4000 ? 'amber' : 'green';
  const wk3     = w.max_week3_screens >= 4000 ? 'red' : w.max_week3_screens >= 3500 ? 'amber' : 'green';
  const genre   = genreSelected ? (w.direct_rival_count >= 2 ? 'red' : w.direct_rival_count >= 1 ? 'amber' : 'green') : 'green';
  const signals = [comp, wk2, wk3, genre];
  if (signals.includes('red')) return 'var(--dot-red)';
  if (signals.filter((s) => s === 'amber').length >= 2) return 'var(--dot-amber)';
  return 'var(--dot-green)';
}

export default function PlannerPage() {
  const [filmTitle, setFilmTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [targetDate, setTargetDate] = useState(nextFriday);

  const [weekend, setWeekend] = useState<Weekend | null>(null);
  const [films, setFilms] = useState<Film[]>([]);
  const [nearby, setNearby] = useState<NearbyWeekend[]>([]);
  const [histWeek, setHistWeek] = useState<HistWeek[]>([]);
  const [annualMedian, setAnnualMedian] = useState(0);
  const [genreData, setGenreData] = useState<GenreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [calHighlights, setCalHighlights] = useState<Record<string, string>>({});

  const fetchData = useCallback(async (date: string, g: string) => {
    if (!date) return;
    setLoading(true);
    const week = isoWeek(date);
    const [wkendRes, nearbyRes, histRes, genreRes] = await Promise.all([
      fetch(`/api/weekend/${date}`).then((r) => r.json()),
      fetch(`/api/weekend/${date}/nearby?genre=${encodeURIComponent(g)}`).then((r) => r.json()),
      fetch(`/api/industry/week/${week}`).then((r) => r.json()),
      g ? fetch(`/api/genre/${encodeURIComponent(g)}/week/${week}`).then((r) => r.json()) : Promise.resolve(null),
    ]);
    setWeekend(wkendRes.weekend ?? null);
    setFilms(wkendRes.films ?? []);
    const nearbyData: NearbyWeekend[] = nearbyRes ?? [];
    setNearby(nearbyData);
    setCalHighlights(prev => ({
      ...prev,
      ...Object.fromEntries(nearbyData.map((w) => [w.date, winDot(w, !!genre)])),
    }));
    setHistWeek(histRes?.weeks ?? []);
    setAnnualMedian(histRes?.annualMedian ?? 0);
    setGenreData(genreRes);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch('/api/genres').then((r) => r.json()).then(setGenres);
  }, []);

  useEffect(() => {
    setCalHighlights({});
    fetchData(targetDate, genre);
  }, [targetDate, genre, fetchData]);

  const fetchMonthHighlights = useCallback(async (year: number, month: number) => {
    const center = `${year}-${String(month + 1).padStart(2, '0')}-15`;
    const rows: NearbyWeekend[] = await fetch(
      `/api/weekend/${center}/nearby?genre=${encodeURIComponent(genre)}`
    ).then((r) => r.json());
    setCalHighlights((prev) => ({
      ...prev,
      ...Object.fromEntries(rows.map((w) => [w.date, winDot(w, !!genre)])),
    }));
  }, [genre]);

  // Engine
  const histAvg = (() => {
    if (!histWeek.length) return 0;
    const sorted = [...histWeek].map((w) => Number(w.gross)).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  })();

  const MIN_CLASH_SCREENS = 1000;
  const top20 = films.slice(0, 20);
  const directRivals = top20
    .filter((f) => genre && f.genre?.[0] === genre && Number(f.screens ?? 0) >= MIN_CLASH_SCREENS)
    .map((f) => ({ title: f.title, week_in_run: f.week_in_run }));
  const directCount = directRivals.length;

  const wideOpeners = films.filter((f) => f.week_in_run === 1 && f.is_wide);
  const topGenreMatch = genre
    ? top20.filter((f) => f.genre?.[0] === genre && Number(f.screens ?? 0) >= MIN_CLASH_SCREENS)[0] ?? null
    : null;

  const topByScreens = (week: number) => {
    const fs = films.filter((f) => f.week_in_run === week);
    if (!fs.length) return null;
    const top = fs.reduce((a, b) => Number(a.screens ?? 0) >= Number(b.screens ?? 0) ? a : b);
    return { title: top.title, screens: Number(top.screens ?? 0) };
  };

  const hasFilmData = films.length > 0;
  const facts: WeekendFacts | null = !loading && histAvg > 0 ? {
    wideOpeners: wideOpeners.length,
    wideOpenerTitles: wideOpeners.map((f) => `${f.title} · ${Number(f.screens).toLocaleString()} screens`),
    week2Holdover: topByScreens(2),
    week3Holdover: topByScreens(3),
    hasSameGenreClash: !!topGenreMatch,
    sameGenreClashWeek: topGenreMatch?.week_in_run ?? null,
    sameGenreClashScreens: topGenreMatch ? Number(topGenreMatch.screens ?? 0) : null,
    rivalNames: directRivals.map((r) => r.title),
    historicalAvgGross: histAvg,
    annualAvgWeeklyGross: annualMedian || 108_000_000,
    holidayName: weekend?.holiday_name ?? null,
    hasFilmData,
  } : null;

  const dotSignal = facts ? weekendDotColor(facts) : null;
  const signals = facts ? weekendSignals(facts) : [];

  // Historical best/worst
  const histBest = histWeek.length
    ? histWeek.reduce((best, w) => (Number(w.gross) > Number(best.gross) ? w : best))
    : null;
  const histWorst = histWeek
    .filter((w) => w.year !== 2020)
    .reduce<HistWeek | null>((worst, w) => (!worst || Number(w.gross) < Number(worst.gross) ? w : worst), null);
  const histMaxGross = histWeek.length ? Math.max(...histWeek.map((w) => Number(w.gross))) : 1;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '26px 30px 70px' }}>
      {/* Form + Verdict */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 30, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 540px', maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
            <div className="field">
              <label>Your film</label>
              <input
                className="control"
                value={filmTitle}
                placeholder="Your film title here"
                spellCheck={false}
                onChange={(e) => setFilmTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Genre</label>
              <div style={{ position: 'relative' }}>
                <select
                  className="control"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                >
                  <option value="">— No genre —</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-3)' }}>▾</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, maxWidth: 420 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Target weekend</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <CalendarPicker
                  value={targetDate}
                  onChange={setTargetDate}
                  highlights={calHighlights}
                  onMonthChange={fetchMonthHighlights}
                />
                <button
                  onClick={() => fetchData(targetDate, genre)}
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 0,
                    borderRadius: 'var(--r-sm)',
                    padding: '0 20px',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Analyze
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div style={{ textAlign: 'right', flex: '0 0 auto', maxWidth: 340, paddingTop: 4 }}>
          <div className="eyebrow" style={{ fontSize: 10.5 }}>{weekendLabel(targetDate)}</div>
          {weekend?.holiday_flag && weekend.holiday_name && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
              background: 'var(--info-bg)', border: '1px solid var(--info-line)',
              borderRadius: 999, padding: '3px 10px',
              fontSize: 12, fontWeight: 600, color: 'var(--info-ink)',
            }}>
              <span>🎉</span>{weekend.holiday_name}
            </div>
          )}
          {dotSignal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'flex-end', marginTop: 6 }}>
              <span style={{ width: 11, height: 11, borderRadius: 999, background: SIGNAL_COLOR[dotSignal], flex: 'none' }} />
              <span style={{ fontSize: 21, fontWeight: 700, whiteSpace: 'nowrap' }}>{verdictWord(signals, dotSignal)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="divider" style={{ margin: '24px 0 20px' }} />

      {/* Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, minHeight: 32 }}>
        {loading ? (
          [140, 210, 180, 160].map((w, i) => (
            <span key={i} className="skeleton-pill" style={{ width: w }} />
          ))
        ) : signals
            .filter((s) => s.key !== 'genre' || !!genre)
            .map((s, i) => <SignalPill key={i} signal={s} />)
        }
      </div>

      <div className="divider" style={{ margin: '22px 0 18px' }} />

      {/* Nearby windows */}
      {nearby.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span className="eyebrow" style={{ flex: 'none', maxWidth: 96, lineHeight: 1.3 }}>Nearby windows</span>
          <div style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 4 }}>
            {[...nearby].sort((a, b) => {
              if (a.direct_rival_count !== b.direct_rival_count) return a.direct_rival_count - b.direct_rival_count;
              return a.date.localeCompare(b.date);
            }).map((w) => {
              const active = w.date === targetDate;
              return (
                <button
                  key={w.date}
                  className={`win${active ? ' active' : ''}`}
                  onClick={() => setTargetDate(w.date)}
                >
                  <span className="wlabel">{fmtShort(w.date)}</span>
                  <span className="wnum">Wk {isoWeek(w.date)}</span>
                  <span className="wdot" style={{ background: winDot(w, !!genre) }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="divider" style={{ margin: '20px 0 26px' }} />

      {/* Three columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 40 }}>
        {/* Historical */}
        <div>
          <div className="section-label">Historical Performance</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500 }}>Best year</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{histBest?.year ?? '—'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                {fmtM(Number(histBest?.gross ?? 0) / 1_000_000)} weekend gross
              </div>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500 }}>Worst year (excl. 2020)</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{histWorst?.year ?? '—'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                {fmtM(Number(histWorst?.gross ?? 0) / 1_000_000)} weekend gross
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <StatCard label="Median weekend gross" value={fmtM(histAvg / 1_000_000)} sub="this week historically" />
          </div>

          {histWeek.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 26 }}>Industry gross — this week by year</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {histWeek.map((r, i) => {
                  const gross = Number(r.gross);
                  const isRecent = i === histWeek.length - 1;
                  return (
                    <div key={r.year} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="tnum" style={{ width: 34, fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500 }}>{r.year}</span>
                      <div style={{ flex: 1, height: 14, background: 'var(--bar-track)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: (gross / histMaxGross) * 100 + '%',
                          height: '100%',
                          background: isRecent ? 'var(--bar-strong)' : 'var(--bar-soft)',
                          borderRadius: 4,
                        }} />
                      </div>
                      <span className="tnum" style={{ width: 48, textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                        {fmtM(gross / 1_000_000)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Competition */}
        <div>
          <div className="section-label">Competition</div>
          {!hasFilmData && !loading && (
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', padding: '8px 0' }}>No data available yet for this weekend.</div>
          )}
          {hasFilmData && directCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '-8px 0 12px', fontSize: 12, color: 'var(--ink-3)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--dot-red)', flex: 'none' }} />
              shares your audience
            </div>
          )}
          <div>
            {films.slice(0, 8).map((f, i) => {
              const isMatch = genre && f.genre?.[0] === genre;
              const scr = Number(f.screens ?? 0);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <span className={`week-tag${f.week_in_run === 1 ? ' w1' : ''}`} style={{ marginTop: 2 }}>Week {f.week_in_run}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontWeight: 600, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</span>
                      {f.is_wide && f.week_in_run === 1 && (
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 5px', flex: 'none', lineHeight: 1.6 }}>Wide</span>
                      )}
                      {isMatch && (
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--dot-red)', flex: 'none' }} title="shares your audience" />
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{f.studio}</div>
                    {f.genre && f.genre.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                        {f.genre.map((g, gi) => (
                          <span key={gi} style={{ padding: '1px 7px', borderRadius: 99, background: 'var(--card-2)', border: '1px solid var(--line)', color: 'var(--ink-3)', fontSize: 11.5 }}>{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap', marginTop: 2 }}>
                    <div className="tnum" style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600 }}>{fmtM(Number(f.gross) / 1_000_000)}</div>
                    <div className="tnum" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{scr.toLocaleString()} screens</div>
                  </div>
                </div>
              );
            })}
            {films.length > 8 && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', paddingTop: 10 }}>
                + {films.length - 8} more in the market
              </div>
            )}
          </div>

          {genre && directRivals.length > 0 && (
            <div className="callout" style={{ marginTop: 18 }}>
              <span style={{ marginTop: 1 }}>⚠</span>
              <span>
                <b>{directRivals[0].title}</b> shares your {genre.toLowerCase()} audience
                {directRivals[0].week_in_run > 1
                  ? ` and is in week ${directRivals[0].week_in_run}`
                  : ', opening this weekend'}.
              </span>
            </div>
          )}
        </div>

        {/* This Weekend */}
        <div>
          <div className="section-label">This Weekend</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatCard label="Wide openers" value={String(wideOpeners.length)} sub="new this weekend" detail={wideOpeners.map((f) => f.title)} />
            <StatCard
              label="Holdovers"
              value={String(films.filter((f) => f.week_in_run > 1 && f.is_wide).length) + ' wide'}
              sub={`${films.filter((f) => f.week_in_run > 1).length} total still in theaters`}
            />
            <StatCard
              label="Holiday"
              value={weekend?.holiday_name ?? 'None'}
              sub={weekend?.holiday_flag ? 'elevated demand' : 'standard weekend'}
              valueColor={weekend?.holiday_flag ? 'var(--pos-ink)' : undefined}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            {!genre ? (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500 }}>Genre performance</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4 }}>Select a genre to see historical openers for this week.</div>
              </div>
            ) : genreData?.stats.count === 0 ? (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500, textTransform: 'capitalize' }}>
                  {genre.toLowerCase()} films this week
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4 }}>
                  No {genre.toLowerCase()} films have opened in this calendar week across any year on record.
                </div>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--accent-bg)' }}>
                <div style={{ fontSize: 12.5, color: 'var(--pos-ink)', fontWeight: 500, textTransform: 'capitalize' }}>
                  {genre.toLowerCase()} films this week
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--pos-ink)' }}>
                  {genreData ? fmtM(genreData.stats.avgGross / 1_000_000) : '—'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--pos-ink)', opacity: 0.85 }}>avg opening weekend gross</div>
                <div style={{ fontSize: 12.5, color: 'var(--pos-ink)', opacity: 0.65 }}>all years on record</div>
              </div>
            )}
          </div>

          <div className="section-label" style={{ marginTop: 24 }}>Notable past openers — this week</div>
          <div>
            {!genre ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Select a genre above to see comparable openers.</div>
            ) : !genreData?.films.length ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No comparable openers on file.</div>
            ) : (genreData.films.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                    {c.title}{' '}
                    <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>({c.year})</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                    {Number(c.screens).toLocaleString()} screens
                  </div>
                </div>
                <span className="tnum" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--pos-ink)' }}>
                  {fmtM(Number(c.gross) / 1_000_000)}
                </span>
              </div>
            )))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalPill({ signal: s }: { signal: { label: string; signal: string; detail?: string[] } }) {
  const [hover, setHover] = useState(false);
  const cls = s.signal === 'green' ? 'pos' : s.signal === 'red' ? 'neg' : 'warn';
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span className={`status-pill ${cls}`} style={{ cursor: s.detail ? 'default' : undefined }}>
        {s.label}
      </span>
      {hover && s.detail && s.detail.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          padding: '10px 14px', zIndex: 50, minWidth: 200, whiteSpace: 'nowrap',
        }}>
          {s.detail.map((name, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--ink)', padding: '3px 0', borderBottom: i < s.detail!.length - 1 ? '1px solid var(--line)' : undefined }}>
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueColor,
  detail,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  detail?: string[];
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 100, position: 'relative', cursor: detail?.length ? 'default' : undefined }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: valueColor ?? 'var(--ink)', marginTop: 'auto', lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{sub}</div>}
      {hover && detail && detail.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          padding: '10px 14px', zIndex: 50, minWidth: 200, whiteSpace: 'nowrap',
        }}>
          {detail.map((name, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--ink)', padding: '3px 0', borderBottom: i < detail.length - 1 ? '1px solid var(--line)' : undefined }}>
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
