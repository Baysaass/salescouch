import { NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';
import { extractHashtags } from '@/lib/default-questions';
import { enrichNewQuestion, fetchQuestionsFeed } from '@/lib/question-agent';
import { questionInput } from '@/lib/validators';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get('tag') || searchParams.get('category');
  const sort = searchParams.get('sort') || 'votes';

  const items = await fetchQuestionsFeed(db, user.id, {
    tag,
    sort,
    includeInsights: user.plan === 'pro',
    followedTags: user.followedTags,
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const parsed = questionInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Мэдээлэл буруу байна' }, { status: 400 });
  }
  const { title, question, category, tags: manualTags, context } = parsed.data;
  const normalizedTags = extractHashtags(`${question} ${context ?? ''}`, manualTags);
  const autoTitle =
    title?.trim() ||
    question
      .replace(/#[\p{L}\p{N}_]+/gu, '')
      .replace(/[«»"]/g, '')
      .trim()
      .slice(0, 72) ||
    'Шинэ асуулт';

  const db = await getDb();
  const [created] = await db
    .insert(schema.questions)
    .values({
      userId: user.id,
      authorName: user.name,
      authorImage: user.image,
      category: category || 'general',
      tags: normalizedTags,
      title: autoTitle,
      question,
      context: context || null,
      votesCount: 0,
      dislikesCount: 0,
    })
    .returning();

  if (created) {
    await enrichNewQuestion(db, created);
  }

  return NextResponse.json(
    {
      ...created,
      commentsCount: 0,
      userVote: null,
      likedBy: [],
      unlikedBy: [],
    },
    { status: 201 },
  );
}
