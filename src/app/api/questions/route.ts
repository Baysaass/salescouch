import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';
import { DEFAULT_QUESTIONS } from '@/lib/default-questions';

export async function GET(req: Request) {
  const user = await getSessionUser();
  const db = await getDb();

  // Хэрэв асуултын хүснэгт хоосон бол үндсэн батлагдсан асуултуудаар seed хийнэ
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(schema.questions);
  if ((existing[0]?.count ?? 0) === 0) {
    for (const q of DEFAULT_QUESTIONS) {
      const [inserted] = await db
        .insert(schema.questions)
        .values({
          userId: user?.id || 'system',
          authorName: q.authorName,
          category: q.category,
          title: q.title,
          question: q.question,
          context: q.context,
          votesCount: q.votesCount,
        })
        .returning();

      if (inserted && q.initialComments.length > 0) {
        for (const c of q.initialComments) {
          await db.insert(schema.questionComments).values({
            questionId: inserted.id,
            userId: 'seed-user',
            authorName: c.authorName,
            content: c.content,
          });
        }
      }
    }
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const sort = searchParams.get('sort') || 'votes'; // 'votes' | 'newest'

  // Асуултуудыг vote болон comment тоотой нь цуг татах
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
      createdAt: schema.questions.createdAt,
      commentsCount: sql<number>`(select count(*)::int from question_comments qc where qc.question_id = ${schema.questions.id})`,
      userVoted: user?.id
        ? sql<boolean>`exists(select 1 from question_votes qv where qv.question_id = ${schema.questions.id} and qv.user_id = ${user.id})`
        : sql<boolean>`false`,
    })
    .from(schema.questions)
    .orderBy(sort === 'newest' ? desc(schema.questions.createdAt) : desc(schema.questions.votesCount));

  const filtered = category && category !== 'all' ? rows.filter((r) => r.category === category) : rows;

  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { title, question, category, context } = body;

  if (!title?.trim() || !question?.trim()) {
    return NextResponse.json({ error: 'Гарчиг болон асуулт заавал' }, { status: 400 });
  }

  const db = await getDb();
  const [created] = await db
    .insert(schema.questions)
    .values({
      userId: user.id,
      authorName: user.name,
      authorImage: user.image,
      category: category || 'discovery',
      title: title.trim(),
      question: question.trim(),
      context: context?.trim() || null,
      votesCount: 1, // өөрөө автоматаар 1 vote өгсөнөөр эхэлнэ
    })
    .returning();

  // Өөрийнхөө vote-ийг бүртгэх
  if (created) {
    await db.insert(schema.questionVotes).values({
      questionId: created.id,
      userId: user.id,
    });
  }

  return NextResponse.json(created, { status: 201 });
}
