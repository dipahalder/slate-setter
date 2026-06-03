import { sql } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ isoweek: string }> }
) {
  const { isoweek } = await params;
  const week = parseInt(isoweek);

  const [rows, annualRows] = await Promise.all([
    sql`
      SELECT
        EXTRACT(YEAR FROM w.date::date)::int AS year,
        w.date::text,
        w.total_industry_gross AS gross,
        w.holiday_flag,
        w.holiday_name
      FROM weekends w
      WHERE EXTRACT(WEEK FROM w.date::date) = ${week}
      AND EXTRACT(YEAR FROM w.date::date) != 2020
      ORDER BY year
    `,
    sql`
      SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_industry_gross))::bigint AS annual_median
      FROM weekends
      WHERE EXTRACT(YEAR FROM date::date) != 2020
    `,
  ]);

  return Response.json({ weeks: rows, annualMedian: Number(annualRows[0]?.annual_median ?? 0) });
}
