import { sql } from '@/lib/db';

type Row = Record<string, unknown>;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let filmRows: Row[], runRows: Row[];
  try {
    [filmRows, runRows] = await Promise.all([
      sql`
        SELECT id, title, studio, release_date::text AS release_date, is_wide, distributor
        FROM films
        WHERE id = ${id}::uuid
      `,
      sql`
        SELECT
          we.week_in_run,
          we.gross,
          we.screens,
          we.market_share,
          w.date::text,
          w.total_industry_gross,
          w.holiday_flag,
          w.holiday_name
        FROM weekend_entries we
        JOIN weekends w ON w.id = we.weekend_id
        WHERE we.film_id = ${id}::uuid
        ORDER BY we.week_in_run
      `,
    ]) as [Row[], Row[]];
  } catch (err) {
    console.error('[/api/films/[id]/run]', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }

  if (!filmRows.length) {
    return Response.json({ error: 'Film not found' }, { status: 404 });
  }

  const weeks = runRows;
  const wk1 = weeks.find((w) => w.week_in_run === 1);
  const wk2 = weeks.find((w) => w.week_in_run === 2);
  const openingGross = Number(wk1?.gross ?? 0);
  const wk2Gross = Number(wk2?.gross ?? 0);

  const stats = {
    openingGross,
    totalGross: weeks.reduce((sum, w) => sum + Number(w.gross ?? 0), 0),
    wk2DropPct:
      wk1 && wk2 && openingGross > 0
        ? Math.round(((openingGross - wk2Gross) / openingGross) * 100)
        : null,
    peakScreens: Math.max(0, ...weeks.map((w) => Number(w.screens ?? 0))),
    runWeeks: weeks.length,
    openingMarketShare: wk1?.market_share ? Number(wk1.market_share) : null,
  };

  return Response.json({ film: filmRows[0], stats, weeks });
}
