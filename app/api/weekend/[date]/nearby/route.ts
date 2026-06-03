import type { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const genre = request.nextUrl.searchParams.get('genre') ?? '';

  const rows = await sql`
    SELECT
      w.date::text,
      w.holiday_flag,
      w.holiday_name,
      COUNT(CASE WHEN we.week_in_run = 1 AND f.is_wide THEN 1 END)::int AS wide_opener_count,
      COUNT(CASE WHEN we.week_in_run = 1 THEN 1 END)::int AS total_opener_count,
      COUNT(CASE WHEN f.is_wide AND ${genre} != '' AND f.genre[1] = ${genre} AND we.screens >= 1000 THEN 1 END)::int AS direct_rival_count,
      COALESCE(MAX(CASE WHEN we.week_in_run = 1 AND f.is_wide THEN we.screens::int END), 0) AS max_opener_screens,
      COALESCE(MAX(CASE WHEN we.week_in_run = 2 THEN we.screens::int END), 0) AS max_week2_screens,
      COALESCE(MAX(CASE WHEN we.week_in_run = 3 THEN we.screens::int END), 0) AS max_week3_screens
    FROM weekends w
    LEFT JOIN weekend_entries we ON we.weekend_id = w.id
    LEFT JOIN films f ON f.id = we.film_id
    WHERE w.date BETWEEN (${date}::date - INTERVAL '28 days') AND (${date}::date + INTERVAL '28 days')
    GROUP BY w.id, w.date, w.holiday_flag, w.holiday_name
    ORDER BY w.date
  `;

  return Response.json(rows);
}
