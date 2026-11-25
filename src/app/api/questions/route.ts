import { NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';
import { DEFAULT_QUESTIONS } from '@/lib/default-questions';
import { questionInput } from '@/lib/validators';

async function ensureSeeded(db: Awaited<ReturnType<typeof getDb>>) {
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(schema.questions);
  if ((existing[0]?.count ?? 0) > 0) return;

  await db
    .insert(schema.questions)
    .values(
      DEFAULT_QUESTIONS.map((q) => ({
        id: q.id,
        userId: 'system',
        authorName: q.authorName,
        category: q.category,
        title: q.title,
        question: q.question,
        context: q.context,
        votesCount: q.votesCount,
      })),
    )
    .onConflictDoNothing();

  const comments = DEFAULT_QUESTIONS.flatMap((q) =>
    q.initialComments.map((c) => ({
      id: c.id,
      questionId: q.id,
      userId: 'system',
      authorName: c.authorName,
      content: c.content,
    })),
  );
  if (comments.length > 0) {
    await db.insert(schema.questionComments).values(comments).onConflictDoNothing();
  }
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const db = await getDb();
  await ensureSeeded(db);

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

  return NextResponse.json({ ...created, commentsCount: 0, userVoted: true }, { status: 201 });
}
