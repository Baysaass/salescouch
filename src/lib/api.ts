import 'server-only';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb, schema } from '@/db';

export async function requireUser(): Promise<string | NextResponse> {
  const session = await auth();
  const id = session?.user?.id || session?.user?.email?.toLowerCase();
  if (!id) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });
  return id;
}

export async function findContact(userId: string, contactId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) return null;
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.contacts)
    .where(and(eq(schema.contacts.id, contactId), eq(schema.contacts.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
