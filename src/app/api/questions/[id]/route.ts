import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });
  }

  const db = await getDb();
  const deleted = await db
    .delete(schema.questions)
    .where(and(eq(schema.questions.id, id), eq(schema.questions.userId, user.id)))
    .returning({ id: schema.questions.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Олдсонгүй эсвэл устгах эрхгүй' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
