import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id: questionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
    return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.questionComments)
    .where(eq(schema.questionComments.questionId, questionId))
    .orderBy(asc(schema.questionComments.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const { id: questionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
    return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: 'Сэтгэгдэл хоосон байна' }, { status: 400 });
  }

  const db = await getDb();
  const [created] = await db
    .insert(schema.questionComments)
    .values({
      questionId,
      userId: user.id,
      authorName: user.name,
      authorImage: user.image,
      content,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
