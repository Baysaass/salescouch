import { NextResponse } from 'next/server';
import { and, eq, or, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { findContact, listContactShares, requireUser } from '@/lib/api';
import { contactShareInput } from '@/lib/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;

  const contact = await findContact(userId, id);
  if (!contact) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });

  const db = await getDb();
  const [owner] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      image: schema.users.image,
    })
    .from(schema.users)
    .where(eq(schema.users.id, contact.userId))
    .limit(1);

  const shares = await listContactShares(id);
  return NextResponse.json({
    isOwner: contact.userId === userId,
    owner: owner ?? { id: contact.userId, email: contact.userId, name: null, image: null },
    sharedWith: shares,
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;

  const contact = await findContact(userId, id);
  if (!contact) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });
  if (contact.userId !== userId) {
    return NextResponse.json({ error: 'Зөвхөн өөрийн бүртгэсэн харилцагчийг хуваалцах боломжтой' }, { status: 403 });
  }

  const parsed = contactShareInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Имэйл хаяг буруу байна' }, { status: 400 });
  }

  const targetEmail = parsed.data.email.trim().toLowerCase();
  if (targetEmail === userId) {
    return NextResponse.json({ error: 'Өөрийн хаяг руу хуваалцах шаардлагагүй' }, { status: 400 });
  }

  const db = await getDb();
  const [recipient] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      image: schema.users.image,
    })
    .from(schema.users)
    .where(or(eq(schema.users.id, targetEmail), eq(sql`lower(${schema.users.email})`, targetEmail)))
    .limit(1);

  if (!recipient) {
    return NextResponse.json(
      { error: 'Энэ Gmail хэрэглэгч манай санд бүртгэлгүй байна. Хүлээн авагч эхлээд системд нэвтэрсэн байх шаардлагатай.' },
      { status: 404 },
    );
  }

  const note = parsed.data.note?.trim() || null;
  await db
    .insert(schema.contactShares)
    .values({
      contactId: id,
      ownerUserId: userId,
      sharedWithUserId: recipient.id,
      note,
    })
    .onConflictDoUpdate({
      target: [schema.contactShares.contactId, schema.contactShares.sharedWithUserId],
      set: { note },
    });

  const shares = await listContactShares(id);
  return NextResponse.json({
    ok: true,
    recipient,
    sharedWith: shares,
    message: `${recipient.name || recipient.email} хэрэглэгчтэй амжилттай хуваалцлаа.`,
  }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;

  const contact = await findContact(userId, id);
  if (!contact) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const targetUserId = String(searchParams.get('userId') || body?.userId || '').trim().toLowerCase();
  if (!targetUserId) {
    return NextResponse.json({ error: 'Хэрэглэгчийн ID шаардлагатай' }, { status: 400 });
  }

  const isOwner = contact.userId === userId;
  if (!isOwner && targetUserId !== userId) {
    return NextResponse.json({ error: 'Зөвхөн харилцагчийн эзэмшигч хуваалцалтыг цуцлах боломжтой' }, { status: 403 });
  }

  const db = await getDb();
  await db
    .delete(schema.contactShares)
    .where(and(eq(schema.contactShares.contactId, id), eq(schema.contactShares.sharedWithUserId, targetUserId)));

  const shares = isOwner ? await listContactShares(id) : [];
  return NextResponse.json({ ok: true, sharedWith: shares });
}
