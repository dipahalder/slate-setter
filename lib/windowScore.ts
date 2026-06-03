export type Signal = 'green' | 'amber' | 'red';

export interface WeekendFacts {
  wideOpeners: number;
  wideOpenerTitles: string[];
  maxOpenerScreens: number;
  week2Holdover: { title: string; screens: number } | null;
  week3Holdover: { title: string; screens: number } | null;
  hasSameGenreClash: boolean;
  sameGenreClashWeek: number | null;
  sameGenreClashScreens: number | null;
  rivalNames: string[];
  historicalAvgGross: number;
  annualAvgWeeklyGross: number;
  holidayName: string | null;
  hasFilmData: boolean;
}

// --- individual signals ---

function competitionSignal(f: WeekendFacts): Signal {
  if (f.wideOpeners >= 6 || f.maxOpenerScreens >= 4500) return 'red';
  if (f.wideOpeners >= 4 || f.maxOpenerScreens >= 3000) return 'amber';
  return 'green';
}

function week2Signal(f: WeekendFacts): Signal {
  const s = f.week2Holdover?.screens ?? 0;
  if (s >= 4500) return 'red';
  if (s >= 4000) return 'amber';
  return 'green';
}

function week3Signal(f: WeekendFacts): Signal {
  const s = f.week3Holdover?.screens ?? 0;
  if (s >= 4000) return 'red';
  if (s >= 3500) return 'amber';
  return 'green';
}

function genreSignal(f: WeekendFacts): Signal {
  if (!f.hasSameGenreClash) return 'green';
  if (f.sameGenreClashWeek && f.sameGenreClashWeek >= 4) return 'green';
  if (f.sameGenreClashWeek && f.sameGenreClashWeek <= 2) return 'red';
  if (f.sameGenreClashScreens && f.sameGenreClashScreens >= 2000) return 'red';
  return 'amber';
}

function historicalSignal(f: WeekendFacts): Signal {
  const ratio = f.historicalAvgGross / f.annualAvgWeeklyGross;
  if (ratio >= 0.95) return 'green';
  if (ratio >= 0.70) return 'amber';
  return 'red';
}

// --- combiners ---

// Dot only reflects competitive threats (not historical opportunity signals)
// red if any threat is red; amber if 2+ threats are amber; else green
// For future weekends with no film data, fall back to the historical signal alone
export function weekendDotColor(f: WeekendFacts): Signal {
  if (!f.hasFilmData) return historicalSignal(f);
  const signals = [
    competitionSignal(f),
    week2Signal(f),
    week3Signal(f),
    genreSignal(f),
  ];
  if (signals.includes('red')) return 'red';
  if (signals.filter((s) => s === 'amber').length >= 2) return 'amber';
  // A dominant opener alone (4000+ screens) is enough to flag amber without a second signal
  if (f.maxOpenerScreens >= 4000) return 'amber';
  return 'green';
}

// Returns one labeled signal per dimension — drives the flags bar
export function weekendSignals(f: WeekendFacts): { key: string; label: string; signal: Signal; detail?: string[] }[] {
  const ratio = f.historicalAvgGross / (f.annualAvgWeeklyGross || 1);
  const seasonalPill = {
    key: 'historical',
    label: (() => {
      const base = ratio >= 0.95 ? 'Peak season' : ratio >= 0.70 ? 'Mid season' : 'Slow season';
      return f.holidayName ? `${base} · ${f.holidayName}` : base;
    })(),
    signal: historicalSignal(f),
  };

  if (!f.hasFilmData) return [seasonalPill];

  return [
    {
      key: 'competition',
      label: f.wideOpeners === 0
        ? 'No other wide openers'
        : `${f.wideOpeners} wide opener${f.wideOpeners !== 1 ? 's' : ''}`,
      signal: competitionSignal(f),
      detail: f.wideOpenerTitles.length ? f.wideOpenerTitles : undefined,
    },
    {
      key: 'week2',
      label: f.week2Holdover
        ? `Week 2 Holdover: ${f.week2Holdover.title} / ${f.week2Holdover.screens.toLocaleString()} screens`
        : 'No week 2 holdover',
      signal: week2Signal(f),
    },
    {
      key: 'week3',
      label: f.week3Holdover
        ? `Week 3 Holdover: ${f.week3Holdover.title} / ${f.week3Holdover.screens.toLocaleString()} screens`
        : 'No week 3 holdover',
      signal: week3Signal(f),
    },
    seasonalPill,
    {
      key: 'genre',
      label: (() => {
        if (!f.hasSameGenreClash) return 'No notable genre clashes';
        const names = f.rivalNames;
        let nameStr = '';
        if (names.length === 1) nameStr = names[0];
        else if (names.length === 2) nameStr = `${names[0]} and ${names[1]}`;
        else nameStr = `${names[0]}, ${names[1]} and ${names.length - 2} more`;
        return `Notable genre clash · ${nameStr}`;
      })(),
      signal: genreSignal(f),
    },
  ];
}

export const SIGNAL_COLOR: Record<Signal, string> = {
  green: 'var(--dot-green)',
  amber: 'var(--dot-amber)',
  red:   'var(--dot-red)',
};

// signals order: [competition (openers + dominant opener screen check), week2holdover, week3holdover, genre]
export function verdictWord(signals: { label: string; signal: Signal }[], overall: Signal): string {
  if (overall === 'green') return 'Clean window';
  const worstIdx = signals.findIndex((s) => s.signal === overall);
  if (overall === 'red') {
    if (worstIdx === 0) return 'Packed weekend';
    if (worstIdx === 1 || worstIdx === 2) return 'Strong holdover';
    return 'Genre clash';
  }
  // amber
  if (worstIdx === 0) return 'Competitive';
  if (worstIdx === 1 || worstIdx === 2) return 'Active holdover';
  return 'Genre overlap';
}
