import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { findContact, requireUser } from '@/lib/api';
import { generatePersona } from '@/lib/coach';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;
  const contact = await findContact(userId, id);
  if (!contact) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });
  try {
    const persona = await generatePersona(contact);
    const db = await getDb();
    const [row] = await db
      .update(schema.contacts)
      .set({ persona, updatedAt: new Date() })
      .where(eq(schema.contacts.id, id))
      .returning();
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
