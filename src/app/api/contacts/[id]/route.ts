import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { findContact, requireUser } from '@/lib/api';
import { clean, contactPatch } from '@/lib/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;
  const existing = await findContact(userId, id);
  if (!existing) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });
  return NextResponse.json(existing);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;
  const existing = await findContact(userId, id);
  if (!existing) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });
  const parsed = contactPatch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const d = parsed.data;
  const set: Partial<typeof schema.contacts.$inferInsert> = { updatedAt: new Date() };
  for (const k of ['fullName', 'company', 'role', 'phone', 'email', 'address', 'notes'] as const) {
    if (d[k] !== undefined) (set as Record<string, unknown>)[k] = d[k] || (k === 'fullName' ? existing.fullName : null);
  }
  if (d.stage) set.stage = d.stage;
  if (d.temperature) set.temperature = d.temperature;
  if (d.channels) set.channels = clean(d.channels);
  if (d.persona) set.persona = clean(d.persona);
  const db = await getDb();
  const [row] = await db.update(schema.contacts).set(set).where(eq(schema.contacts.id, id)).returning();
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;
  if (!(await findContact(userId, id))) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });
  const db = await getDb();
  await db.delete(schema.messages).where(eq(schema.messages.contactId, id));
  await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  return NextResponse.json({ ok: true });
}
