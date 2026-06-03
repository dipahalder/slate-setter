import type { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (!q) return Response.json([]);

  const pattern = `%${q}%`;
  const startPattern = `${q}%`;

  const rows = await sql`
    SELECT id, title, studio, release_date::text AS release_date, is_wide
    FROM films
    WHERE title ILIKE ${pattern}
    ORDER BY
      CASE
        WHEN LOWER(title) = LOWER(${q}) THEN 0
        WHEN LOWER(title) ILIKE LOWER(${startPattern}) THEN 1
        ELSE 2
      END,
      title
    LIMIT 5
  `;

  return Response.json(rows);
}
