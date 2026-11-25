import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';
import { voteInput } from '@/lib/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const { id: questionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
    return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });
  }

  const parsed = voteInput.safeParse(await req.json().catch(() => ({})));
  const type = parsed.success ? parsed.data.type : 'like';

  const db = await getDb();

  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(eq(schema.questions.id, questionId))
      .limit(1);

    if (!target) return null;

    const [existing] = await tx
      .select()
      .from(schema.questionVotes)
      .where(and(eq(schema.questionVotes.questionId, questionId), eq(schema.questionVotes.userId, user.id)))
      .limit(1);

    let userVote: 'like' | 'unlike' | null = type;

    if (existing) {
      if (existing.voteType === type) {
        // Ижил дарсан байсан тул цуцална
        await tx.delete(schema.questionVotes).where(eq(schema.questionVotes.id, existing.id));
        userVote = null;
      } else {
        // Эсрэг сонголт руу (like <-> unlike) шилжүүлнэ
        await tx
          .update(schema.questionVotes)
          .set({ voteType: type, voterName: user.name, voterImage: user.image })
          .where(eq(schema.questionVotes.id, existing.id));
      }
    } else {
      await tx
        .insert(schema.questionVotes)
        .values({
          questionId,
          userId: user.id,
          voteType: type,
          voterName: user.name,
          voterImage: user.image,
        })
        .onConflictDoNothing();
    }

    const allVotes = await tx
      .select()
      .from(schema.questionVotes)
      .where(eq(schema.questionVotes.questionId, questionId));

    const likedBy = allVotes
      .filter((v) => v.voteType !== 'unlike')
      .map((v) => ({ userId: v.userId, name: v.voterName || v.userId.split('@')[0], image: v.voterImage ?? null }));
    const unlikedBy = allVotes
      .filter((v) => v.voteType === 'unlike')
      .map((v) => ({ userId: v.userId, name: v.voterName || v.userId.split('@')[0], image: v.voterImage ?? null }));

    await tx
      .update(schema.questions)
      .set({ votesCount: likedBy.length, dislikesCount: unlikedBy.length })
      .where(eq(schema.questions.id, questionId));

    return {
      userVote,
      votesCount: likedBy.length,
      dislikesCount: unlikedBy.length,
      likedBy,
      unlikedBy,
    };
  });

  if (!result) {
    return NextResponse.json({ error: 'Асуулт олдсонгүй' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result });
}
