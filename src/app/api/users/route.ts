import { NextResponse } from 'next/server';
import { asc, ne } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireUser } from '@/lib/api';

export async function GET(req: Request) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  const db = await getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      image: schema.users.image,
    })
    .from(schema.users)
    .where(ne(schema.users.id, userId))
    .orderBy(asc(schema.users.email));

  const filtered = rows
    .filter((u) => {
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aGmail = a.email.toLowerCase().endsWith('@gmail.com') ? 0 : 1;
      const bGmail = b.email.toLowerCase().endsWith('@gmail.com') ? 0 : 1;
      if (aGmail !== bGmail) return aGmail - bGmail;
      return (a.name || a.email).localeCompare(b.name || b.email);
    })
    .slice(0, 30);

  return NextResponse.json({ users: filtered });
}
