import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { findContact, getSessionUser } from '@/lib/api';
import { synthesizePersonaQuestion } from '@/lib/question-agent';
import { questionSynthesizeInput } from '@/lib/validators';

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const parsed = questionSynthesizeInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Хүсэлтийн өгөгдөл буруу байна' }, { status: 400 });
  }
  const { clusterId, questionId, contactId, personaName, goal } = parsed.data;

  const db = await getDb();

  const cluster = clusterId
    ? (await db.select().from(schema.questionClusters).where(eq(schema.questionClusters.id, clusterId)).limit(1))[0] ?? null
    : null;

  const sourceQuestion = questionId
    ? (await db.select().from(schema.questions).where(eq(schema.questions.id, questionId)).limit(1))[0] ?? null
    : null;

  const comments = sourceQuestion
    ? await db.select().from(schema.questionComments).where(eq(schema.questionComments.questionId, sourceQuestion.id))
    : [];

  const contact = contactId ? await findContact(user.id, contactId) : null;

  const result = await synthesizePersonaQuestion({
    cluster,
    sourceQuestion,
    comments,
    contact,
    personaName,
    goal,
  });

  return NextResponse.json(result);
}
