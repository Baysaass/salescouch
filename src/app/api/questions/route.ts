import { NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';
import { ensureQuestionsSeeded, enrichNewQuestion } from '@/lib/question-agent';
import { questionInput } from '@/lib/validators';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const db = await getDb();
  await ensureQuestionsSeeded(db);

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const sort = searchParams.get('sort') || 'votes'; // 'votes' | 'newest'

  const rows = await db
    .select({
      id: schema.questions.id,
      userId: schema.questions.userId,
      authorName: schema.questions.authorName,
      authorImage: schema.questions.authorImage,
      category: schema.questions.category,
      title: schema.questions.title,
      question: schema.questions.question,
      context: schema.questions.context,
      votesCount: schema.questions.votesCount,
      embeddingModel: schema.questions.embeddingModel,
      clusterId: schema.questions.clusterId,
      personaScores: schema.questions.personaScores,
      aiAnalysis: schema.questions.aiAnalysis,
      refinedVariant: schema.questions.refinedVariant,
      relatedQuestionIds: schema.questions.relatedQuestionIds,
      analyzedAt: schema.questions.analyzedAt,
      createdAt: schema.questions.createdAt,
      commentsCount: sql<number>`(select count(*)::int from question_comments qc where qc.question_id = ${schema.questions.id})`,
      userVoted: sql<boolean>`exists(select 1 from question_votes qv where qv.question_id = ${schema.questions.id} and qv.user_id = ${user.id})`,
    })
    .from(schema.questions)
    .orderBy(sort === 'newest' ? desc(schema.questions.createdAt) : desc(schema.questions.votesCount), desc(schema.questions.createdAt));

  const filtered = category && category !== 'all' ? rows.filter((r) => r.category === category) : rows;

  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const parsed = questionInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Мэдээлэл буруу байна' }, { status: 400 });
  }
  const { title, question, category, context } = parsed.data;

  const db = await getDb();
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.questions)
      .values({
        userId: user.id,
        authorName: user.name,
        authorImage: user.image,
        category,
        title,
        question,
        context: context || null,
        votesCount: 1,
      })
      .returning();

    if (row) {
      await tx.insert(schema.questionVotes).values({
        questionId: row.id,
        userId: user.id,
      });
    }
    return row;
  });

  if (created) {
    await enrichNewQuestion(db, created);
  }

  return NextResponse.json({ ...created, commentsCount: 0, userVoted: true }, { status: 201 });
}
