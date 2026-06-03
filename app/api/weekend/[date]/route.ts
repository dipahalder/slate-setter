import { sql } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  const [weekend, entries] = await Promise.all([
    sql`
      SELECT date, total_industry_gross, holiday_flag, holiday_name
      FROM weekends
      WHERE date = ${date}
    `,
    sql`
      SELECT
        f.title,
        f.studio,
        f.genre,
        f.is_wide,
        we.gross,
        we.screens,
        we.week_in_run,
        we.market_share
      FROM weekend_entries we
      JOIN films f ON f.id = we.film_id
      JOIN weekends w ON w.id = we.weekend_id
      WHERE w.date = ${date}
      ORDER BY we.gross DESC NULLS LAST
    `,
  ]);

  if (!weekend.length) {
    return Response.json({ error: 'Weekend not found' }, { status: 404 });
  }

  return Response.json({ weekend: weekend[0], films: entries });
}
