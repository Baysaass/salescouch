import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getSessionUser } from '@/lib/api';
import { ensureQuestionsSeeded, getClustersReport, runQuestionIntelligence } from '@/lib/question-agent';

export const maxDuration = 60;

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });
  if (user.plan !== 'pro') {
    return NextResponse.json({ error: 'Энэ боломж зөвхөн Pro багцад нээлттэй' }, { status: 403 });
  }

  const db = await getDb();
  await ensureQuestionsSeeded(db);
  const stats = await runQuestionIntelligence(db, true);
  const report = await getClustersReport(db, user.id);

  return NextResponse.json({ ...report, stats });
}
