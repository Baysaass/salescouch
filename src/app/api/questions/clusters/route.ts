import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { getSessionUser } from '@/lib/api';
import { getClustersReport } from '@/lib/question-agent';

export const maxDuration = 60;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 });

  const db = await getDb();
  const report = await getClustersReport(db, user.id);
  return NextResponse.json(report);
}
