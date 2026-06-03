import { sql } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ genre: string; isoweek: string }> }
) {
  const { genre, isoweek } = await params;
  const week = parseInt(isoweek);

  const films = await sql`
    SELECT
      f.title,
      f.studio,
      f.genre,
      we.gross,
      we.screens,
      w.date::text,
      EXTRACT(YEAR FROM w.date::date)::int AS year
    FROM weekend_entries we
    JOIN films f ON f.id = we.film_id
    JOIN weekends w ON w.id = we.weekend_id
    WHERE we.week_in_run = 1
    AND we.gross >= 5000000
    AND EXTRACT(WEEK FROM w.date::date) = ${week}
    AND EXTRACT(YEAR FROM w.date::date) != 2020
    AND ${genre} = ANY(f.genre)
    ORDER BY we.gross DESC NULLS LAST
    LIMIT 5
  `;

  const grossValues = films.map((f) => Number(f.gross)).filter((g) => g > 0);
  const stats = {
    avgGross: grossValues.length
      ? Math.round(grossValues.reduce((a, b) => a + b, 0) / grossValues.length)
      : 0,
    bestGross: grossValues.length ? Math.max(...grossValues) : 0,
    count: films.length,
  };

  return Response.json({ films, stats });
}
