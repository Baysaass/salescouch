import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { findContact, requireUser } from '@/lib/api';
import { aiEnabled, localCoach, streamOpenAI } from '@/lib/coach';
import { messageInput } from '@/lib/validators';

type Ctx = { params: Promise<{ id: string }> };
export const maxDuration = 60;

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;
  if (!(await findContact(userId, id))) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });
  const db = await getDb();
  const rows = await db.select().from(schema.messages).where(eq(schema.messages.contactId, id)).orderBy(asc(schema.messages.createdAt));
  return NextResponse.json(rows);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;
  if (!(await findContact(userId, id))) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });
  const db = await getDb();
  await db.delete(schema.messages).where(eq(schema.messages.contactId, id));
  return NextResponse.json({ ok: true });
}

/** Хэрэглэгчийн мессежийг хадгалаад, коучийн хариуг stream хэлбэрээр буцаана */
export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;
  const contact = await findContact(userId, id);
  if (!contact) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });
  const parsed = messageInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Мессеж хоосон байна' }, { status: 400 });
  const { content, skill } = parsed.data;

  const db = await getDb();
  const history = await db.select().from(schema.messages).where(eq(schema.messages.contactId, id)).orderBy(asc(schema.messages.createdAt));
  await db.insert(schema.messages).values({ contactId: id, userId, role: 'user', content, skill: skill || null });
  await db.update(schema.contacts).set({ updatedAt: new Date() }).where(eq(schema.contacts.id, id));

  const save = async (text: string) => {
    if (!text.trim()) return;
    await db.insert(schema.messages).values({ contactId: id, userId, role: 'assistant', content: text, skill: skill || null });
  };

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = '';
      try {
        if (!aiEnabled()) {
          full = localCoach(contact, content, skill);
          // жижиг хэсгүүдээр илгээж "бичиж байгаа" мэдрэмж өгнө
          for (const chunk of full.match(/[\s\S]{1,40}/g) ?? []) {
            controller.enqueue(encoder.encode(chunk));
            await new Promise((r) => setTimeout(r, 8));
          }
        } else {
          const stream = await streamOpenAI(contact, history, content, skill);
          const reader = stream.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            full += value;
            controller.enqueue(encoder.encode(value));
          }
        }
      } catch (e) {
        const msg = `\n\n> ⚠️ ${(e as Error).message}`;
        full += msg;
        controller.enqueue(encoder.encode(msg));
      } finally {
        await save(full).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
