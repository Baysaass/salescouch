import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getSessionUser } from '@/lib/api';
import { extractHashtags, SUGGESTED_HASHTAGS } from '@/lib/default-questions';
import { ensureQuestionsSeeded } from '@/lib/question-agent';
import { toggleFollowTagInput } from '@/lib/validators';

const MAX_FOLLOWED_TAGS = 5;

function normalizeSingleTag(raw: string): string | null {
  const [normalized] = extractHashtags('', [raw]);
  return normalized || null;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const db = await getDb();
  await ensureQuestionsSeeded(db);

  const rows = await db.select({ tags: schema.questions.tags }).from(schema.questions);
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!Array.isArray(r.tags)) continue;
    for (const raw of r.tags) {
      const clean = normalizeSingleTag(raw);
      if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
    }
  }
  for (const s of SUGGESTED_HASHTAGS) {
    if (!counts.has(s.tag)) counts.set(s.tag, 0);
  }

  const availableTags = Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return NextResponse.json({
    followedTags: user.followedTags.slice(0, MAX_FOLLOWED_TAGS),
    availableTags,
    maxTags: MAX_FOLLOWED_TAGS,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const parsed = toggleFollowTagInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Таг буруу байна' }, { status: 400 });
  }

  const tag = normalizeSingleTag(parsed.data.tag);
  if (!tag) {
    return NextResponse.json({ error: 'Хүчинтэй #таг оруулна уу (хамгийн багадаа 2 тэмдэгт)' }, { status: 400 });
  }

  const db = await getDb();
  const [row] = await db
    .select({ followedTags: schema.users.followedTags })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  const current = Array.isArray(row?.followedTags)
    ? Array.from(new Set(row.followedTags.map((t) => normalizeSingleTag(t)).filter((t): t is string => Boolean(t))))
    : user.followedTags;

  const isAlreadyFollowed = current.includes(tag);
  if (!isAlreadyFollowed && current.length >= MAX_FOLLOWED_TAGS) {
    return NextResponse.json(
      {
        error: `Хамгийн ихдээ ${MAX_FOLLOWED_TAGS} хаштаг дагах боломжтой. Өөр тагийг болиулаад дахин оролдоно уу.`,
        followedTags: current.slice(0, MAX_FOLLOWED_TAGS),
        maxTags: MAX_FOLLOWED_TAGS,
      },
      { status: 400 },
    );
  }

  const nextTags = isAlreadyFollowed ? current.filter((t) => t !== tag) : [...current, tag];

  await db
    .insert(schema.users)
    .values({
      id: user.id,
      email: user.email || user.id,
      name: user.name,
      image: user.image,
      plan: user.plan,
      followedTags: nextTags,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: {
        followedTags: nextTags,
        name: user.name,
        image: user.image,
      },
    });

  return NextResponse.json({
    ok: true,
    followed: !isAlreadyFollowed,
    tag,
    followedTags: nextTags,
    maxTags: MAX_FOLLOWED_TAGS,
  });
}
