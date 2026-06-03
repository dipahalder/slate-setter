/**
 * Verdict + pill logic for the Release Planner.
 * Ported from the design prototype's engine.js.
 * Constants flagged with ⚡ are hand-tuned placeholders — calibrate against real data.
 */

/** ⚡ Baseline US weekend industry gross in $M (avg 2015-2026, ex-2020) */
const INDUSTRY_BASELINE_M = 108;

/** ⚡ Average opening weekend by genre in $M — used to compute genreLift */
export const GENRE_BASE_M: Record<string, number> = {
  Horror:    25,
  Drama:     15,
  Thriller:  22,
  Comedy:    18,
  Action:    35,
  'Sci-Fi':  30,
  Animation: 40,
  Romance:   12,
};

export type Tone = 'good' | 'warn' | 'bad';

export const DOT_COLOR: Record<Tone, string> = {
  good: 'var(--dot-green)',
  warn: 'var(--dot-amber)',
  bad:  'var(--dot-red)',
};

export function seasonalIndex(histAvgDollars: number): number {
  return histAvgDollars / (INDUSTRY_BASELINE_M * 1_000_000);
}

export function genreLift(genreAvgDollars: number, genre: string): number {
  if (!genreAvgDollars) return 1.0;
  const base = (GENRE_BASE_M[genre] ?? 20) * 1_000_000;
  return genreAvgDollars / base;
}

/** ⚡ K=25 means $25M weighted pressure halves the opening — tune against real outcomes */
export function crowdingFactor(pressureM: number): number {
  const K = 25;
  return K / (K + pressureM);
}

export function readVerdict(directCount: number, sg: number, genre: string): { word: string; tone: Tone } {
  const g = genre.toLowerCase();
  if (directCount >= 2) return { word: genre ? `Crowded for ${g}` : 'Crowded weekend', tone: 'bad' };
  if (directCount === 1) return { word: sg >= 1.08 ? 'Strong but contested' : 'Contested slot', tone: 'warn' };
  if (sg >= 1.08) return { word: genre ? `Prime ${g} window` : 'Strong week', tone: 'good' };
  if (sg < 0.92) return { word: 'Soft week', tone: 'warn' };
  return { word: 'Open lane', tone: 'good' };
}

export function driversText(si: number, gl: number, genre: string, directCount: number): string {
  const parts = [`${Math.round(si * 100)}% of an avg frame`];
  const lift = Math.round((gl - 1) * 100);
  if (genre && lift !== 0) parts.push(`${genre.toLowerCase()} ${lift > 0 ? '+' : ''}${lift}%`);
  parts.push(directCount ? `${directCount} audience rival${directCount > 1 ? 's' : ''}` : 'clear lane');
  return parts.join(' · ');
}

export type Pill = { tone: 'pos' | 'warn'; text: string };

export function buildPills(
  wideOpenerCount: number,
  topHoldoverTitle: string | null,
  topHoldoverScreens: number,
  sg: number,
  genre: string,
  directRivals: Array<{ title: string; week_in_run: number }>,
): Pill[] {
  const pills: Pill[] = [];
  const g = genre.toLowerCase();

  if (wideOpenerCount <= 2) pills.push({ tone: 'pos', text: `Light competition — ${wideOpenerCount} wide opener${wideOpenerCount === 1 ? '' : 's'}` });
  else if (wideOpenerCount <= 4) pills.push({ tone: 'warn', text: `Moderate competition — ${wideOpenerCount} wide openers` });
  else pills.push({ tone: 'warn', text: `Crowded weekend — ${wideOpenerCount} wide openers` });

  if (sg >= 1.05) pills.push({ tone: 'pos', text: genre ? `Strong week historically for ${g}` : 'Strong week historically' });
  else if (sg < 0.9) pills.push({ tone: 'warn', text: genre ? `Soft week historically for ${g}` : 'Soft week historically' });
  else pills.push({ tone: 'pos', text: 'Average historical strength' });

  if (topHoldoverTitle) pills.push({ tone: 'warn', text: `${topHoldoverTitle} holdover — ${topHoldoverScreens.toLocaleString()} screens` });

  if (genre) {
    if (directRivals.length) {
      const top = directRivals[0];
      pills.push({ tone: 'warn', text: `${top.title} in week ${top.week_in_run} — genre overlap` });
    } else {
      pills.push({ tone: 'pos', text: 'No direct genre rivals' });
    }
  }

  return pills;
}

/** Decay holds by legs type — for projecting a film's future weeks */
export function holdFactor(legs: 'frontloaded' | 'normal' | 'leggy', week: number): number {
  if (legs === 'frontloaded') return ([0.40, 0.52, 0.58, 0.62, 0.66, 0.70][week - 1] ?? 0.70);
  if (legs === 'leggy')       return ([0.62, 0.70, 0.74, 0.78, 0.80, 0.82, 0.84][week - 1] ?? 0.84);
  return ([0.50, 0.58, 0.62, 0.66, 0.70, 0.72][week - 1] ?? 0.72);
}

export function weeklyGrossProjection(openingM: number, runWeeks: number, legs: 'frontloaded' | 'normal' | 'leggy'): number[] {
  const out = [openingM];
  for (let w = 1; w < runWeeks; w++) out.push(out[w - 1] * holdFactor(legs, w));
  return out;
}
