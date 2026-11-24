import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireUser } from '@/lib/api';
import { clean, contactInput } from '@/lib/validators';

export async function GET() {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const db = await getDb();
  const rows = await db
    .select({
      contact: schema.contacts,
      lastMessage: sql<string | null>`(select content from messages m where m.contact_id = ${schema.contacts.id} order by m.created_at desc limit 1)`,
      lastAt: sql<string | null>`(select max(created_at) from messages m where m.contact_id = ${schema.contacts.id})`,
    })
    .from(schema.contacts)
    .where(eq(schema.contacts.userId, userId))
    .orderBy(desc(schema.contacts.updatedAt));
  return NextResponse.json(
    rows.map((r) => ({ ...r.contact, lastMessage: r.lastMessage, lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null })),
  );
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const parsed = contactInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const d = parsed.data;
  const db = await getDb();
  const [row] = await db
    .insert(schema.contacts)
    .values({
      userId,
      fullName: d.fullName,
      company: d.company || null,
      role: d.role || null,
      phone: d.phone || null,
      email: d.email || null,
      address: d.address || null,
      stage: d.stage ?? 'lead',
      temperature: d.temperature ?? 'warm',
      channels: clean(d.channels),
      persona: clean(d.persona),
      notes: d.notes || null,
    })
    .returning();
  return NextResponse.json({ ...row, lastMessage: null, lastAt: null }, { status: 201 });
}
