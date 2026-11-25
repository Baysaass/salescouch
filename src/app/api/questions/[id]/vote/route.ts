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

  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: schema.questions.id, votesCount: schema.questions.votesCount })
      .from(schema.questions)
      .where(eq(schema.questions.id, questionId))
      .limit(1);

    if (!target) return null;

    // Давхар даралт болон зэрэгцээ хүсэлтэд race condition гаргахгүйн тулд атомик delete/insert хийнэ
    const removed = await tx
      .delete(schema.questionVotes)
      .where(and(eq(schema.questionVotes.questionId, questionId), eq(schema.questionVotes.userId, user.id)))
      .returning({ id: schema.questionVotes.id });

    if (removed.length > 0) {
      const [updated] = await tx
        .update(schema.questions)
        .set({ votesCount: sql`GREATEST(0, ${schema.questions.votesCount} - 1)` })
        .where(eq(schema.questions.id, questionId))
        .returning({ votesCount: schema.questions.votesCount });
      return { voted: false, votesCount: updated?.votesCount ?? Math.max(0, target.votesCount - 1) };
    }

    const inserted = await tx
      .insert(schema.questionVotes)
      .values({ questionId, userId: user.id })
      .onConflictDoNothing()
      .returning({ id: schema.questionVotes.id });

    if (inserted.length > 0) {
      const [updated] = await tx
        .update(schema.questions)
        .set({ votesCount: sql`${schema.questions.votesCount} + 1` })
        .where(eq(schema.questions.id, questionId))
        .returning({ votesCount: schema.questions.votesCount });
      return { voted: true, votesCount: updated?.votesCount ?? target.votesCount + 1 };
    }

    return { voted: true, votesCount: target.votesCount };
  });

  if (!result) {
    return NextResponse.json({ error: 'Асуулт олдсонгүй' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result });
}
