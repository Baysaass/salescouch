import 'server-only';
import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

export type UserPlan = 'free' | 'pro';

const ensuredUsers = new Set<string>();

function isProByEnv(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.PRO_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

async function ensureSessionUserRow(
  id: string,
  email?: string | null,
  name?: string | null,
  image?: string | null,
) {
  if (ensuredUsers.has(id)) return;
  try {
    const db = await getDb();
    await db
      .insert(schema.users)
      .values({
        id,
        email: (email || id).toLowerCase(),
        name: name ?? null,
        image: image ?? null,
      })
      .onConflictDoNothing();
    if (ensuredUsers.size > 2000) ensuredUsers.clear();
    ensuredUsers.add(id);
  } catch {}
}

export async function requireUser(): Promise<string | NextResponse> {
  const session = await auth();
  const id = session?.user?.id || session?.user?.email?.toLowerCase();
  if (!id) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });
  await ensureSessionUserRow(id, session?.user?.email, session?.user?.name, session?.user?.image);
  return id;
}

export async function getSessionUser() {
  const session = await auth();
  const id = session?.user?.id || session?.user?.email?.toLowerCase();
  if (!id) return null;

  let plan: UserPlan = isProByEnv(session?.user?.email || id) ? 'pro' : 'free';
  let followedTags: string[] = [];

  try {
    const db = await getDb();
    const [row] = await db
      .select({ plan: schema.users.plan, followedTags: schema.users.followedTags })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!row) {
      await ensureSessionUserRow(id, session?.user?.email, session?.user?.name, session?.user?.image);
    }
    if (row?.plan === 'pro') plan = 'pro';
    if (Array.isArray(row?.followedTags)) followedTags = row.followedTags.slice(0, 5);
  } catch {}

  return {
    id,
    name: session?.user?.name || session?.user?.email?.split('@')[0] || 'Борлуулагч',
    image: session?.user?.image || null,
    email: session?.user?.email || '',
    plan,
    followedTags,
  };
}

export async function findContact(userId: string, contactId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) return null;
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.contacts)
    .where(and(eq(schema.contacts.id, contactId), eq(schema.contacts.userId, userId)))
    .limit(1);
  if (rows[0]) return rows[0];

  const shared = await db
    .select({ contact: schema.contacts })
    .from(schema.contactShares)
    .innerJoin(schema.contacts, eq(schema.contactShares.contactId, schema.contacts.id))
    .where(
      and(
        eq(schema.contactShares.contactId, contactId),
        eq(schema.contactShares.sharedWithUserId, userId),
      ),
    )
    .limit(1);
  return shared[0]?.contact ?? null;
}

export async function listContactShares(contactId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      userId: schema.contactShares.sharedWithUserId,
      note: schema.contactShares.note,
      sharedAt: schema.contactShares.createdAt,
      email: schema.users.email,
      name: schema.users.name,
      image: schema.users.image,
    })
    .from(schema.contactShares)
    .innerJoin(schema.users, eq(schema.contactShares.sharedWithUserId, schema.users.id))
    .where(eq(schema.contactShares.contactId, contactId))
    .orderBy(asc(schema.contactShares.createdAt));

  return rows.map((r) => ({
    userId: r.userId,
    email: r.email,
    name: r.name,
    image: r.image,
    note: r.note,
    sharedAt: r.sharedAt.toISOString(),
  }));
}
