import { NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { findContact, requireUser } from '@/lib/api';
import { aiEnabled, localCoach, streamOpenAI } from '@/lib/coach';
import { retrieveBankIntelligenceForContact } from '@/lib/question-agent';
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

/** Хэрэглэгчийн мессежийг хадгалаад, коучийн хариуг stream хэлбэрээр буцаана эсвэл шууд assistant хариуг хадгална */
export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (typeof userId !== 'string') return userId;
  const { id } = await params;
  const contact = await findContact(userId, id);
  if (!contact) return NextResponse.json({ error: 'Олдсонгүй' }, { status: 404 });
  const parsed = messageInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Мессеж хоосон байна' }, { status: 400 });
  const { role, content, skill } = parsed.data;

  const db = await getDb();

  // Хэрэв шууд assistant мессеж хадгалах хүсэлт ирвэл (клиент талын синхрон баталгаажуулалт)
  if (role === 'assistant') {
    try {
      // Идемпотент шалгалт: хамгийн сүүлийн мессеж нь аль хэдийн энэ хариулт байвал давхардахгүй
      const lastRows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.contactId, id))
        .orderBy(desc(schema.messages.createdAt))
        .limit(1);

      if (lastRows[0]?.role === 'assistant' && lastRows[0]?.content === content) {
        return NextResponse.json({ ok: true, id: lastRows[0].id, alreadySaved: true });
      }

      const [inserted] = await db
        .insert(schema.messages)
        .values({ contactId: id, userId, role: 'assistant', content, skill: skill || null })
        .returning();

      await db.update(schema.contacts).set({ updatedAt: new Date() }).where(eq(schema.contacts.id, id));
      return NextResponse.json({ ok: true, id: inserted?.id });
    } catch (saveErr) {
      console.error('❌ Assistant мессеж шууд хадгалахад алдаа гарлаа:', saveErr);
      return NextResponse.json({ error: 'Хадгалж чадсангүй' }, { status: 500 });
    }
  }

  // Хэрэглэгчийн мессежийг өгөгдлийн санд хадгална
  const history = await db.select().from(schema.messages).where(eq(schema.messages.contactId, id)).orderBy(asc(schema.messages.createdAt));
  await db.insert(schema.messages).values({ contactId: id, userId, role: 'user', content, skill: skill || null });
  await db.update(schema.contacts).set({ updatedAt: new Date() }).where(eq(schema.contacts.id, id));

  // Stream дуусах үед коучийн хариултыг хадгалах туслах функц
  const save = async (text: string) => {
    if (!text.trim()) return;
    try {
      const activeDb = await getDb();
      // Идемпотент шалгалт
      const lastRows = await activeDb
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.contactId, id))
        .orderBy(desc(schema.messages.createdAt))
        .limit(1);

      if (lastRows[0]?.role === 'assistant' && lastRows[0]?.content === text) {
        return;
      }

      await activeDb.insert(schema.messages).values({ contactId: id, userId, role: 'assistant', content: text, skill: skill || null });
      await activeDb.update(schema.contacts).set({ updatedAt: new Date() }).where(eq(schema.contacts.id, id));
    } catch (err) {
      console.error('❌ Stream дуусах үед assistant мессеж хадгалахад алдаа гарлаа:', err);
    }
  };

  const encoder = new TextEncoder();
  const bankQuestions = await retrieveBankIntelligenceForContact(db, contact, content, 2);
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = '';
      try {
        if (!aiEnabled()) {
          full = localCoach(contact, content, skill, bankQuestions);
          for (const chunk of full.match(/[\s\S]{1,60}/g) ?? []) {
            controller.enqueue(encoder.encode(chunk));
            await new Promise((r) => setTimeout(r, 6));
          }
        } else {
          try {
            for await (const chunk of streamOpenAI(contact, history, content, skill, bankQuestions)) {
              full += chunk;
              controller.enqueue(encoder.encode(chunk));
            }
          } catch (aiErr) {
            console.warn('OpenAI алдаа гарсан тул локал коуч руу шилжлээ:', (aiErr as Error).message);
            const note = `> 💡 *OpenAI API (${(aiErr as Error).message.slice(0, 100)}) саатсан тул локал sales коуч шуурхай хариуллаа.*\n\n`;
            full = note + localCoach(contact, content, skill, bankQuestions);
            for (const chunk of full.match(/[\s\S]{1,60}/g) ?? []) {
              controller.enqueue(encoder.encode(chunk));
              await new Promise((r) => setTimeout(r, 6));
            }
          }
        }
      } catch (e) {
        const msg = `\n\n> ⚠️ ${(e as Error).message}`;
        full += msg;
        try {
          controller.enqueue(encoder.encode(msg));
        } catch {}
      } finally {
        await save(full);
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
