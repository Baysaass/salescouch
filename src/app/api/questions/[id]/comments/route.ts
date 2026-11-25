import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getProUserIds, getSessionUser } from '@/lib/api';
import { questionCommentInput } from '@/lib/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

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

  const proIds = await getProUserIds(rows.map((r) => r.userId));
  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      authorPlan: proIds.has(r.userId.toLowerCase()) ? 'pro' : 'free',
    })),
  );
}

export async function POST(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const { id: questionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
    return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });
  }

  const parsed = questionCommentInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Сэтгэгдэл буруу байна' }, { status: 400 });
  }

  const db = await getDb();
  const [exists] = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(eq(schema.questions.id, questionId))
    .limit(1);

  if (!exists) {
    return NextResponse.json({ error: 'Асуулт олдсонгүй' }, { status: 404 });
  }

  const [created] = await db
    .insert(schema.questionComments)
    .values({
      questionId,
      userId: user.id,
      authorName: user.name,
      authorImage: user.image,
      content: parsed.data.content,
    })
    .returning();

  return NextResponse.json({ ...created, authorPlan: user.plan }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const { id: questionId } = await params;
  const commentId = new URL(req.url).searchParams.get('commentId') || '';
  if (!/^[0-9a-f-]{36}$/i.test(questionId) || !/^[0-9a-f-]{36}$/i.test(commentId)) {
    return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });
  }

  const db = await getDb();
  const deleted = await db
    .delete(schema.questionComments)
    .where(
      and(
        eq(schema.questionComments.id, commentId),
        eq(schema.questionComments.questionId, questionId),
        eq(schema.questionComments.userId, user.id),
      ),
    )
    .returning({ id: schema.questionComments.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Сэтгэгдэл олдсонгүй эсвэл устгах эрхгүй' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
