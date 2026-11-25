import { NextResponse } from 'next/server';
import { asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireUser } from '@/lib/api';
import { clean, contactInput } from '@/lib/validators';

export async function GET() {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;

  const db = await getDb();

  // Надад хуваалцсан харилцагчдын мэдээлэл
  const incomingShares = await db
    .select({
      contactId: schema.contactShares.contactId,
      ownerUserId: schema.contactShares.ownerUserId,
      note: schema.contactShares.note,
      sharedAt: schema.contactShares.createdAt,
      ownerEmail: schema.users.email,
      ownerName: schema.users.name,
      ownerImage: schema.users.image,
    })
    .from(schema.contactShares)
    .leftJoin(schema.users, eq(schema.contactShares.ownerUserId, schema.users.id))
    .where(eq(schema.contactShares.sharedWithUserId, userId));

  const sharedByMap = new Map(
    incomingShares.map((s) => [
      s.contactId,
      {
        userId: s.ownerUserId,
        email: s.ownerEmail || s.ownerUserId,
        name: s.ownerName || s.ownerUserId.split('@')[0],
        image: s.ownerImage ?? null,
        note: s.note ?? null,
        sharedAt: s.sharedAt.toISOString(),
      },
    ]),
  );

  const sharedIds = incomingShares.map((s) => s.contactId);
  const whereClause =
    sharedIds.length > 0
      ? or(eq(schema.contacts.userId, userId), inArray(schema.contacts.id, sharedIds))
      : eq(schema.contacts.userId, userId);

  const rows = await db
    .select({
      contact: schema.contacts,
      lastMessage: sql<string | null>`(select content from messages m where m.contact_id = ${schema.contacts.id} order by m.created_at desc limit 1)`,
      lastAt: sql<string | null>`(select max(created_at) from messages m where m.contact_id = ${schema.contacts.id})`,
    })
    .from(schema.contacts)
    .where(whereClause)
    .orderBy(desc(schema.contacts.updatedAt));

  // Миний эзэмшлийн харилцагчдаас хэнтэй хуваалцсан жагсаалт
  const ownedIds = rows.filter((r) => r.contact.userId === userId).map((r) => r.contact.id);
  const sharedWithMap = new Map<
    string,
    { userId: string; email: string; name: string | null; image: string | null; note: string | null; sharedAt: string }[]
  >();

  if (ownedIds.length > 0) {
    const outgoing = await db
      .select({
        contactId: schema.contactShares.contactId,
        userId: schema.contactShares.sharedWithUserId,
        note: schema.contactShares.note,
        sharedAt: schema.contactShares.createdAt,
        email: schema.users.email,
        name: schema.users.name,
        image: schema.users.image,
      })
      .from(schema.contactShares)
      .innerJoin(schema.users, eq(schema.contactShares.sharedWithUserId, schema.users.id))
      .where(inArray(schema.contactShares.contactId, ownedIds))
      .orderBy(asc(schema.contactShares.createdAt));

    for (const s of outgoing) {
      const list = sharedWithMap.get(s.contactId) ?? [];
      list.push({
        userId: s.userId,
        email: s.email,
        name: s.name,
        image: s.image,
        note: s.note,
        sharedAt: s.sharedAt.toISOString(),
      });
      sharedWithMap.set(s.contactId, list);
    }
  }

  return NextResponse.json(
    rows.map((r) => {
      const isOwner = r.contact.userId === userId;
      return {
        ...r.contact,
        lastMessage: r.lastMessage,
        lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null,
        isOwner,
        sharedBy: isOwner ? null : (sharedByMap.get(r.contact.id) ?? null),
        sharedWith: isOwner ? (sharedWithMap.get(r.contact.id) ?? []) : [],
      };
    }),
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
  return NextResponse.json(
    { ...row, lastMessage: null, lastAt: null, isOwner: true, sharedBy: null, sharedWith: [] },
    { status: 201 },
  );
}
