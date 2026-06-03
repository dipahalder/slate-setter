import type { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get('year') ?? 'all';
  const isAll = year === 'all';
  const yearInt = isAll ? null : parseInt(year);

  if (!isAll && (isNaN(yearInt!) || yearInt! < 2015 || yearInt! > 2026)) {
    return Response.json({ error: 'Invalid year' }, { status: 400 });
  }

  const [weeksRows, avgRows, peakRows, monthRows, holidayRows] = await Promise.all([
    isAll
      ? sql`
          SELECT
            EXTRACT(WEEK FROM date::date)::int AS iso_week,
            ROUND(AVG(total_industry_gross))::bigint AS avg_gross,
            BOOL_OR(holiday_flag) AS has_holiday,
            MODE() WITHIN GROUP (ORDER BY holiday_name) FILTER (WHERE holiday_name IS NOT NULL) AS holiday_name
          FROM weekends
          WHERE EXTRACT(YEAR FROM date::date) != 2020
          GROUP BY iso_week
          ORDER BY iso_week
        `
      : sql`
          SELECT date::text, total_industry_gross AS gross, holiday_flag, holiday_name
          FROM weekends
          WHERE EXTRACT(YEAR FROM date::date) = ${yearInt}
            AND total_industry_gross > 0
          ORDER BY date
        `,

    isAll
      ? sql`
          SELECT
            ROUND(SUM(total_industry_gross))::bigint AS total,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_industry_gross))::bigint AS median
          FROM weekends
          WHERE EXTRACT(YEAR FROM date::date) != 2020
        `
      : sql`
          SELECT
            ROUND(SUM(total_industry_gross))::bigint AS total,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_industry_gross))::bigint AS median
          FROM weekends
          WHERE EXTRACT(YEAR FROM date::date) = ${yearInt}
            AND total_industry_gross > 0
        `,

    isAll
      ? sql`
          SELECT w.date::text, w.total_industry_gross AS gross, w.holiday_flag, w.holiday_name,
            lf.title AS leading_film, lf.studio AS leading_studio, lf.week_in_run AS leading_week_in_run, lf.genre AS leading_genre, lf.gross AS leading_gross
          FROM weekends w
          LEFT JOIN LATERAL (
            SELECT f.title, f.studio, f.genre, we.week_in_run, we.gross
            FROM weekend_entries we JOIN films f ON f.id = we.film_id
            WHERE we.weekend_id = w.id ORDER BY we.gross DESC NULLS LAST LIMIT 1
          ) lf ON true
          WHERE EXTRACT(YEAR FROM w.date::date) != 2020
          ORDER BY w.total_industry_gross DESC NULLS LAST
          LIMIT 5
        `
      : sql`
          SELECT w.date::text, w.total_industry_gross AS gross, w.holiday_flag, w.holiday_name,
            lf.title AS leading_film, lf.studio AS leading_studio, lf.week_in_run AS leading_week_in_run, lf.genre AS leading_genre, lf.gross AS leading_gross
          FROM weekends w
          LEFT JOIN LATERAL (
            SELECT f.title, f.studio, f.genre, we.week_in_run, we.gross
            FROM weekend_entries we JOIN films f ON f.id = we.film_id
            WHERE we.weekend_id = w.id ORDER BY we.gross DESC NULLS LAST LIMIT 1
          ) lf ON true
          WHERE EXTRACT(YEAR FROM w.date::date) = ${yearInt}
            AND w.total_industry_gross > 0
          ORDER BY w.total_industry_gross DESC NULLS LAST
          LIMIT 5
        `,

    isAll
      ? sql`
          SELECT EXTRACT(MONTH FROM date::date)::int AS month,
            ROUND(AVG(total_industry_gross))::bigint AS avg_gross
          FROM weekends
          WHERE EXTRACT(YEAR FROM date::date) != 2020
          GROUP BY month
          ORDER BY avg_gross DESC NULLS LAST
          LIMIT 1
        `
      : sql`
          SELECT EXTRACT(MONTH FROM date::date)::int AS month,
            ROUND(AVG(total_industry_gross))::bigint AS avg_gross
          FROM weekends
          WHERE EXTRACT(YEAR FROM date::date) = ${yearInt}
            AND total_industry_gross > 0
          GROUP BY month
          ORDER BY avg_gross DESC NULLS LAST
          LIMIT 1
        `,

    isAll
      ? sql`
          SELECT
            AVG(CASE WHEN holiday_flag THEN total_industry_gross END) AS avg_holiday,
            AVG(CASE WHEN NOT holiday_flag THEN total_industry_gross END) AS avg_non_holiday
          FROM weekends
          WHERE EXTRACT(YEAR FROM date::date) != 2020
        `
      : sql`
          SELECT
            AVG(CASE WHEN holiday_flag THEN total_industry_gross END) AS avg_holiday,
            AVG(CASE WHEN NOT holiday_flag THEN total_industry_gross END) AS avg_non_holiday
          FROM weekends
          WHERE EXTRACT(YEAR FROM date::date) = ${yearInt}
            AND total_industry_gross > 0
        `,
  ]);

  type TopWeekend = { date: string; gross: string; holiday_flag: boolean; holiday_name: string | null; leading_film: string | null; leading_studio: string | null; leading_gross: string | null };
  const topWeekends = peakRows as TopWeekend[];
  const peak = topWeekends[0] ?? null;
  const month = monthRows[0] ?? null;
  const { avg_holiday, avg_non_holiday } = (holidayRows[0] ?? {}) as Record<string, unknown>;
  const holidayPremiumPct =
    avg_holiday && avg_non_holiday
      ? Math.round(((Number(avg_holiday) / Number(avg_non_holiday)) - 1) * 100)
      : null;

  return Response.json({
    summary: {
      totalGross: Number((avgRows[0] as Record<string, unknown>)?.total ?? 0),
      medianWeekendGross: Number((avgRows[0] as Record<string, unknown>)?.median ?? 0),
      peakWeekend: peak
        ? {
            date: peak.date,
            gross: Number(peak.gross),
            leadingFilm: peak.leading_film ?? null,
            leadingStudio: peak.leading_studio ?? null,
            leadingGross: peak.leading_gross ? Number(peak.leading_gross) : null,
            holidayName: peak.holiday_name ?? null,
          }
        : null,
      strongestMonth: month
        ? {
            month: (month as Record<string, unknown>).month,
            avgGross: Number((month as Record<string, unknown>).avg_gross),
          }
        : null,
      holidayPremiumPct,
    },
    weeks: weeksRows,
    topWeekends,
  });
}
