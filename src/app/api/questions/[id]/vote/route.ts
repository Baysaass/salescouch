import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const { id: questionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
    return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });
  }

  const db = await getDb();

  // Өмнө нь vote өгсөн эсэхийг шалгах
  const existingVote = await db
    .select()
    .from(schema.questionVotes)
    .where(and(eq(schema.questionVotes.questionId, questionId), eq(schema.questionVotes.userId, user.id)))
    .limit(1);

  let voted = false;
  if (existingVote.length > 0) {
    // Vote цуцлах (Unlike)
    await db
      .delete(schema.questionVotes)
      .where(and(eq(schema.questionVotes.questionId, questionId), eq(schema.questionVotes.userId, user.id)));
    await db
      .update(schema.questions)
      .set({ votesCount: sql`GREATEST(0, ${schema.questions.votesCount} - 1)` })
      .where(eq(schema.questions.id, questionId));
    voted = false;
  } else {
    // Vote нэмэх (Like)
    await db.insert(schema.questionVotes).values({
      questionId,
      userId: user.id,
    });
    await db
      .update(schema.questions)
      .set({ votesCount: sql`${schema.questions.votesCount} + 1` })
      .where(eq(schema.questions.id, questionId));
    voted = true;
  }

  // Шинэчлэгдсэн тоог авах
  const updated = await db
    .select({ votesCount: schema.questions.votesCount })
    .from(schema.questions)
    .where(eq(schema.questions.id, questionId))
    .limit(1);

  return NextResponse.json({
    ok: true,
    voted,
    votesCount: updated[0]?.votesCount ?? 0,
  });
}
