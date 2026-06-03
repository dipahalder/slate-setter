import { sql } from '@/lib/db';

export async function GET() {
  const rows = await sql`
    SELECT DISTINCT unnest(genre) AS genre
    FROM films
    WHERE genre IS NOT NULL
    ORDER BY genre
  `;
  return Response.json(rows.map((r) => r.genre as string));
}
