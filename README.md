# InsurTech Sales Coach

Даатгалын борлуулагчдад зориулсан AI чатбот. Борлуулагч харилцагчаа бүртгэж, persona-г нь үүсгэнэ. Дараа нь тухайн харилцагчийн мэдээлэлд үндэслэн коуч BANT, AIDA, SPIN, MEDDIC зэрэг аргаар хэрхэн харилцахыг зөвлөж, Gmail имэйлийн ноорог бичиж өгнө.

## Бүтэц

Зүүн цэс 4 табтай:

| Таб | Агуулга |
|---|---|
| **Харилцагчид** | Харилцагчийн жагсаалт → харилцагч бүрт тусдаа коуч чат (түүх хадгалагдана) → баруун талд холбоо барих мэдээлэл, сувгууд, Persona, тэмдэглэл |
| **Playbook** | **Миний Sales Playbook (Т. Өсөхбаяр · Практикал Дижитал v2.0)**: Ялгарал ба 3 нотолгоо, Бүтээгдэхүүн → Үнэ цэнэ матриц, Асуултын сан (Discovery & Impact), 3 Persona ба 1–9 алхамт харилцан ярианы скрипт, Response Planner (татгалзлууд), Хаалтын 4 хэлбэр, Сунгалтын стандарт хуваарь. "Чатад ашиглах" товчоор шууд коучид илгээнэ. |
| **Docs** | 20 борлуулалтын арга (BANT, AIDA, SPIN, MEDDIC, SPICED, Challenger, Gap, Discovery, Objection, Pricing, Email sequence…). Арга бүрт: хэзээ хэрэвэх, алхмууд, дэлгэрэнгүй тайлбар, бэлэн скрипт, даатгалын жишээ, түгээмэл алдаа. "Чатад хэрэглэх" товчоор харилцагч дээр шууд ажиллуулна. |
| **Бүтээгдэхүүн** | Практикал Даатгалын 20 бүтээгдэхүүн (Хялбар, Ухаалаг 80/100, Найдвартай, Ногоон, Хүнд даац, ХММ, гэнэтийн осол, ЭМД, орон сууц, аялал…) — хураамж, хамгаалалт, хариуцах хэсэг, нөхөн төлбөр, татгалзах нөхцөл. "Санал бэлтгэх" товчоор тухайн харилцагчид тооцоо, скрипт, Gmail ноорог гаргана. |

Коуч хариулахдаа: (1) харилцагчийн үе шат, дутуу мэдээллийг оношилно, (2) тохирох аргыг сонгоно, (3) **зөвхөн Practical-ийн бүтээгдэхүүний сангаас** хураамж, нөхцөлийг иш татаж тооцоо хийнэ, (4) бэлэн скрипт/имэйл гаргана, (5) дараагийн алхмыг санал болгоно.

### Мэдээллийг шинэчлэх
- Бүтээгдэхүүн, хураамж, нөхцөл: `src/lib/products.ts` (NO NAME дискний гэрээ, баталгаа, хураамжийн тооцоолол, FAQ-аас бэлтгэсэн; ⚠️ тэмдэгтэй нь хуучин/төслийн баримт — баталгаажуулах)
- Борлуулалтын аргууд: `src/lib/skills.ts` (товч) + `src/lib/skill-docs.ts` (Docs-ийн дэлгэрэнгүй)

## Локал дээр ажиллуулах

```bash
cd ~/Downloads/insurtech-sales-coach
./start.sh          # эсвэл: npm install && npm run dev
```

http://localhost:3100 хаягаар нээнэ.

- **DB:** `DATABASE_URL` хоосон бол `./data/pglite` хавтсанд PGlite (локал Postgres) автоматаар үүснэ. Нэмэлт суулгах зүйлгүй.
- **Нэвтрэлт:** Google тохируулаагүй бол "Локал туршилтын нэвтрэлт" гарна. Нэр, имэйлээ оруулаад нэвтэрнэ.
- **AI:** `OPENAI_API_KEY` хоосон бол коуч skill-ийн загвараар хариулна. Түлхүүр оруулбал OpenAI бүрэн хариулна.

## Gmail-ээр нэвтрэх (Google OAuth)

1. https://console.cloud.google.com → APIs & Services → Credentials → **Create OAuth client ID** (Web application) гэж орно.
2. Authorized redirect URIs хэсэгт:
   - `http://localhost:3100/api/auth/callback/google`
   - `https://<таны-апп>.vercel.app/api/auth/callback/google`
3. `.env.local` (болон Vercel env) файлд `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`-ийг оруулна.

## Vercel + Supabase руу deploy хийх

1. Supabase → **SQL Editor** дээр `supabase/schema.sql`-ийг ажиллуулна. Апп эхний хүсэлтээр хүснэгтээ өөрөө үүсгэдэг тул энэ алхам заавал биш.
2. Supabase → Project Settings → Database → **Connection string → Transaction pooler** (порт 6543) хаягийг хуулна.
3. Vercel → New Project → энэ хавтас/репо → **Environment Variables** хэсэгт:

| Хувьсагч | Утга |
|---|---|
| `DATABASE_URL` | Supabase pooler connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `OPENAI_API_KEY` | таны түлхүүр |
| `OPENAI_MODEL` | (заавал биш) `gpt-4o-mini` |

4. Deploy хийнэ. Production дээр зөвхөн Gmail нэвтрэлт ажиллана. Туршилтын нэвтрэлт идэвхжүүлэх бол `AUTH_DEV_LOGIN=true` гэж тохируулна.

## Технологи

Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Auth.js v5 (Google) · Drizzle ORM · Supabase Postgres / PGlite · OpenAI Chat Completions (stream)

```
src/
  app/            хуудас + API (contacts, messages, persona, auth)
  components/     workspace, sidebar, contact-list, chat-panel, contact-panel, contact-form, skill-guide
  lib/skills.ts   sales skill сан (20 арга)
  lib/coach.ts    system prompt, OpenAI stream, локал коуч, persona үүсгэгч
  db/             Drizzle схем, холболт (Supabase эсвэл PGlite)
supabase/schema.sql
```
