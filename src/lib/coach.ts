import 'server-only';
import type { Contact, ContactPersona, Message } from '@/db/schema';
import { SKILLS, SKILL_MAP, type SalesSkill } from './skills';
import { STAGE_LABELS, TEMPERATURE_LABELS, PERSONA_FIELDS, CHANNEL_FIELDS } from './labels';
import { SKILL_DOCS } from './skill-docs';
import { COMPANY_FACTS, matchProducts, productBrief, productCatalogCompact, type Product } from './products';
import { playbookPromptCompact } from './playbook';

export function contactText(c: Contact): string {
  return [c.company, c.role, c.notes, ...Object.values(c.persona ?? {}), ...Object.values(c.channels ?? {})]
    .filter(Boolean)
    .join(' ');
}

export const aiEnabled = () => Boolean(process.env.OPENAI_API_KEY);
const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';

export function contactProfile(c: Contact): string {
  const lines: string[] = [
    `Нэр: ${c.fullName}`,
    c.company && `Байгууллага: ${c.company}`,
    c.role && `Албан тушаал: ${c.role}`,
    c.email && `Имэйл: ${c.email}`,
    c.phone && `Утас: ${c.phone}`,
    c.address && `Хаяг: ${c.address}`,
    `Борлуулалтын үе шат: ${STAGE_LABELS[c.stage] ?? c.stage}`,
    `Сонирхол (температур): ${TEMPERATURE_LABELS[c.temperature] ?? c.temperature}`,
  ].filter(Boolean) as string[];

  const ch = CHANNEL_FIELDS.filter((f) => c.channels?.[f.key]).map((f) => `${f.label}: ${c.channels[f.key]}`);
  if (ch.length) lines.push(`Холбогдох сувгууд: ${ch.join('; ')}`);

  const p = PERSONA_FIELDS.filter((f) => c.persona?.[f.key]).map((f) => `- ${f.label}: ${c.persona[f.key]}`);
  if (p.length) lines.push('Persona:', ...p);
  if (c.notes) lines.push(`Тэмдэглэл: ${c.notes}`);
  return lines.join('\n');
}

function systemPrompt(c: Contact, userMessage: string, skill?: SalesSkill): string {
  const library = SKILLS.map((s) => `• ${s.id} — ${s.name}: ${s.short}`).join('\n');
  const matched: Product[] = matchProducts(`${contactText(c)} ${userMessage}`, 4);
  const doc = skill ? SKILL_DOCS[skill.id] : undefined;

  return `Чи бол "Практикал Даатгал" ХХК-ийн борлуулалтын ахлах коуч. Борлуулагч (хэрэглэгч) нэг тодорхой харилцагчтай хэрхэн харилцах, ямар аргаар, ямар бүтээгдэхүүн санал болгохыг зөвлөнө. Чи харилцагчтай өөрөө ярихгүй — борлуулагчид зөвлөнө.

АЖИЛЛАХ ДАРААЛАЛ (дотооддоо бод, хариултад товч тусга):
1. Оношлох: харилцагч аль үе шатанд, юу мэдэгдэж, юу дутуу байна (BANT/MEDDIC-ийн аль шалгуур дутуу).
2. Арга сонгох: доорх skill-ээс тохирохыг сонго (хэрэглэгч сонгосон бол түүнийг баримтал) — яагаад тэр аргыг сонгосноо 1 өгүүлбэрээр хэл.
3. Бүтээгдэхүүн тааруулах: ЗӨВХӨН доорх Practical-ийн бүтээгдэхүүний сангаас санал болго. Хураамж, хамгаалалт, хариуцах хэсэг, нөхөн төлбөрийн хугацааг сангаас яг таг иш татаж, боломжтой бол харилцагчийн машин/ажилтны тоогоор жишээ тооцоо хий (тооцоогоо харуул).
4. Хэрэглэхэд бэлэн гаралт: Монгол хэлээр скрипт, асуулт, мессеж, эсвэл имэйл.
5. Төгсгөлд "**Дараагийн алхам:**" — 1–2 тодорхой үйлдэл, мөн тодруулах 1–2 асуулт.

ДҮРЭМ:
- Сангаас олдохгүй үнэ, нөхцөл, хөнгөлөлтийг ЗОХИОХГҮЙ — "даатгалын менежерээс баталгаажуулах" гэж бич. ⚠️ тэмдэгтэй бүтээгдэхүүний нөхцөлийг баталгаажуулахыг сануул.
- Хууль, ёс зүйд нийцнэ: даатгуулагчийг төөрөгдүүлэх, татгалзах нөхцөлийг нуух, айлган сүрдүүлэхийг зөвлөхгүй. Татгалзах гол нөхцөлийг шударгаар дурд.
- Мэдээлэл дутуу бол таамаглалаа "(таамаг)" гэж тэмдэглэ.
- Имэйл/Gmail ноорог бичихдээ ЗААВАЛ \`\`\`email блок: эхний мөр "Subject: ...", хоосон мөр, дараа нь бие. Харилцагчийг нэрээр нь хүндэтгэлтэй хандана, гарын үсэгт "[Таны нэр] · Практикал Даатгал · 7777-6677".
- Markdown ашигла (гарчиг, жагсаалт, хүснэгт). Хэт урт бүү бич — борлуулагч утсаараа уншина.

КОМПАНИЙН МЭДЭЭЛЭЛ:
${COMPANY_FACTS}

БҮТЭЭГДЭХҮҮНИЙ БҮРЭН ЖАГСААЛТ:
${productCatalogCompact()}

ЭНЭ ХАРИЛЦАГЧИД ХАМГИЙН ТОХИРОХ БАЙЖ МАГАДГҮЙ БҮТЭЭГДЭХҮҮН (дэлгэрэнгүй):
${matched.length ? matched.map(productBrief).join('\n\n') : '(Түлхүүр үгээр тааралгүй — харилцагчийн мэдээллээс таамаглаж, жагсаалтаас сонго.)'}

ШИНГЭЭСЭН SKILL-ҮҮД (devoneonline, rombtr, TheCraigHewitt, Autter-dev, syntax-syndicate, roohe):
${library}

${playbookPromptCompact()}

ХАРИЛЦАГЧИЙН МЭДЭЭЛЭЛ:
${contactProfile(c)}
${
  skill
    ? `
ЭНЭ УДААД ХЭРЭГЛЭХ SKILL: ${skill.name} (${skill.short})
Хэзээ: ${doc?.whenToUse ?? ''}
Арга зүй:
${[...skill.steps, ...(doc?.details ?? [])].map((x) => `- ${x}`).join('\n')}
Жишээ скриптүүд: ${(doc?.scripts ?? []).join(' | ')}
Зайлсхийх алдаа: ${(doc?.mistakes ?? []).join('; ')}
Гаралтын шаардлага: ${skill.instruction}`
    : ''
}`;
}

/** OpenAI-аас текстийн урсгал (stream) буцаана */
export async function* streamOpenAI(
  c: Contact,
  history: Message[],
  userMessage: string,
  skillId?: string | null,
): AsyncGenerator<string, void, unknown> {
  const skill = skillId ? SKILL_MAP[skillId] : undefined;
  const abortCtrl = new AbortController();
  // Нийт 18 секундийн timeout: хэрэв OpenAI удаан саатвал автоматаар локал коуч руу шилжинэ
  const timeoutId = setTimeout(() => abortCtrl.abort(), 18000);

  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: abortCtrl.signal,
      body: JSON.stringify({
        model: MODEL(),
        stream: true,
        temperature: 0.6,
        messages: [
          { role: 'system', content: systemPrompt(c, userMessage, skill) },
          ...history.slice(-20).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const err = await res.text().catch(() => '');
      throw new Error(`OpenAI алдаа (${res.status}): ${err.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          /* хагас мөр */
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/** OpenAI түлхүүргүй үед ажиллах локал дүрэмд суурилсан коуч */
export function localCoach(c: Contact, userMessage: string, skillId?: string | null): string {
  const text = userMessage.toLowerCase();
  const skill =
    (skillId && SKILL_MAP[skillId]) ||
    (/имэйл|email|gmail|захидал/.test(text) && SKILL_MAP['cold-email']) ||
    (/bant|төсөв/.test(text) && SKILL_MAP.bant) ||
    (/spin|асуулт/.test(text) && SKILL_MAP.spin) ||
    (/aida/.test(text) && SKILL_MAP.aida) ||
    (/meddic/.test(text) && SKILL_MAP.meddic) ||
    (/татгалз|үнэтэй|objection/.test(text) && SKILL_MAP.objection) ||
    (/үнэ|хөнгөлөлт|хураамж/.test(text) && SKILL_MAP.pricing) ||
    SKILL_MAP['sales-context'];

  const first = c.fullName.split(' ').slice(-1)[0];
  const p: ContactPersona = c.persona ?? {};
  const known = (v?: string | null) => (v && v.trim() ? v : '_тодорхойгүй — тодруулах_');

  const parts: string[] = [
    `> ⚙️ *Локал горим* — \`OPENAI_API_KEY\` тохируулаагүй тул skill загвараар хариуллаа. Түлхүүр нэмбэл AI бүрэн хариулна.`,
    '',
    `## ${skill.name} — ${c.fullName}${c.company ? ` (${c.company})` : ''}`,
    skill.description,
    '',
    '### Харилцагчийн товч',
    `- **Үүрэг:** ${known(c.role)} · **Үе шат:** ${STAGE_LABELS[c.stage] ?? c.stage}`,
    `- **Зорилго:** ${known(p.goals)}`,
    `- **Өвдөлт:** ${known(p.pains)}`,
    `- **Төсөв:** ${known(p.budget)} · **Хугацаа:** ${known(p.timeline)}`,
    `- **Одоогийн даатгагч:** ${known(p.currentInsurer)} · **Сонирхож буй:** ${known(p.productsOfInterest)}`,
    '',
    '### Алхмууд',
    ...skill.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    `**Даатгалын жишээ:** ${skill.insuranceExample}`,
  ];

  const doc = SKILL_DOCS[skill.id];
  if (doc) {
    parts.push('', `**Хэзээ хэрэглэх:** ${doc.whenToUse}`, '', '### Бэлэн скрипт', ...doc.scripts.map((x) => `- ${x}`));
  }

  const recs = matchProducts(`${contactText(c)} ${userMessage}`, 3);
  if (recs.length) {
    parts.push('', '### Санал болгох Practical бүтээгдэхүүн');
    for (const r of recs) {
      parts.push(`- **${r.name}**${r.status === 'check' ? ' ⚠️' : ''} — ${r.tagline}. Хураамж: ${r.premium}.${r.deductible ? ` Хариуцах хэсэг: ${r.deductible}.` : ''}`);
    }
  } else {
    parts.push('', '### Бүтээгдэхүүн', '- Харилцагчийн хэрэгцээг (машин, ажилтан, хөрөнгө, аялал) тодруулбал тохирох Practical бүтээгдэхүүнийг санал болгоно.');
  }

  if (skill.id === 'bant') {
    parts.push(
      '',
      '| Шалгуур | Мэдэгдэж буй | Дараагийн асуулт |',
      '|---|---|---|',
      `| Budget | ${known(p.budget)} | Одоо даатгалд жилд хэдэн төгрөг зарцуулдаг вэ? |`,
      `| Authority | ${known(p.decisionRole)} | Гэрээг эцэслэн хэн батлах вэ? |`,
      `| Need | ${known(p.pains)} | Хамгийн их санаа зовоож буй эрсдэл юу вэ? |`,
      `| Timeline | ${known(p.timeline || p.renewalDate)} | Одоогийн гэрээ хэзээ дуусах вэ? |`,
    );
  }

  if (skill.category === 'writing' || skill.id === 'aida') {
    const product = p.productsOfInterest || 'даатгалын хамгаалалт';
    parts.push(
      '',
      '### Gmail ноорог',
      '```email',
      `Subject: ${c.company ? `${c.company}-д зориулсан ` : ''}${product} — 15 минутын санал`,
      '',
      `Сайн байна уу, ${first} оо,`,
      '',
      `${c.company ? `${c.company}-ийн` : 'Таны'} ${p.pains ? `"${p.pains}" гэсэн асуудлыг` : 'өнөөгийн эрсдэлийн удирдлагыг'} хөнгөвчлөх нэг санаа байна.`,
      `Манай ${product} нь нөхөн төлбөрийг цахимаар шуурхай шийддэг бөгөөд таны нөхцөлд тохируулан хамрах хүрээг сонгох боломжтой.`,
      '',
      'Энэ долоо хоногт 15 минут ярилцаж, танай одоогийн хамгаалалтыг хамтдаа харвал ямар вэ?',
      '',
      'Хүндэтгэсэн,',
      '[Таны нэр]',
      '```',
    );
  }

  if (/playbook|плейбүүк|скрипт|дижитал даатгал/.test(text)) {
    parts.push(
      '',
      '### Дижитал Sales Playbook-ийн зөвлөмж (Т. Өсөхбаяр v2.0)',
      '- **Амлалт:** "Та салбар дээр очиж цаг алдахгүйгээр утсаараа 3 минутад даатгуулаад, тохиолдол гарвал онлайнаар нөхөн төлбөрөө ~3 өдөрт шийдүүлэх дижитал хамгаалалт өгнө."',
      '- **Хаалтын санал:** «Төлбөрийн холбоосыг одоо чатаар илгээчихье, утаснаасаа 2 минутад баталгаажуулчих уу?» (Activation Energy ↓)',
      '- **Татгалзлын хариу:** «Зөрүүг 12 сард хуваахад сард хэдхэн мянга; харин 3 өдрийн онлайн шийдвэр таны ажлын өдрийг хэмнэнэ.»',
      '- **Follow-up:** Яриа дууссанаас хойш 15 минутад 1 хуудас харьцуулалт + 1-click төлбөрийн линк илгээнэ.',
    );
  }

  parts.push('', `**Дараагийн алхам:** ${skill.prompt}`);
  return parts.join('\n');
}

/** Persona-г AI (эсвэл энгийн дүрмээр) бөглөх */
export async function generatePersona(c: Contact): Promise<ContactPersona> {
  const ruleBased = (): ContactPersona => {
    const role = (c.role || '').toLowerCase();
    const decisionRole = /захирал|ceo|founder|эзэн|удирдах/.test(role)
      ? 'Эцсийн шийдвэр гаргагч'
      : /санхүү|cfo|нягтлан/.test(role)
        ? 'Төсөв батлагч (Economic buyer)'
        : /hr|хүний нөөц/.test(role)
          ? 'Нөлөөлөгч / Champion'
          : 'Тодруулах шаардлагатай';
    return {
      ...c.persona,
      decisionRole: c.persona?.decisionRole || decisionRole,
      productsOfInterest:
        c.persona?.productsOfInterest ||
        (matchProducts(contactText(c), 3).map((p) => p.name).join(', ') || undefined),
      segment: c.persona?.segment || (c.company ? 'Байгууллага (B2B)' : 'Хувь хүн (B2C)'),
      summary:
        c.persona?.summary ||
        `${c.fullName}${c.role ? `, ${c.role}` : ''}${c.company ? ` — ${c.company}` : ''}. ${decisionRole}. Persona-г дэлгэрүүлэхийн тулд discovery асуулт ашиглана уу.`,
    };
  };

  if (!aiEnabled()) {
    return ruleBased();
  }

  try {
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 12000);
    const res = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: abortCtrl.signal,
      body: JSON.stringify({
        model: MODEL(),
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Чи даатгалын борлуулалтын шинжээч. Өгөгдсөн харилцагчийн мэдээллээс buyer persona үүсгэ. Зөвхөн JSON буцаа, түлхүүрүүд: ${PERSONA_FIELDS.map((f) => f.key).join(', ')}. Утга бүр Монгол хэлээр 1–2 өгүүлбэр. Мэдэгдэж буй утгыг хадгал, таамаг бол "(таамаг)" гэж төгсгө. productsOfInterest-д зөвхөн доорх Practical-ийн бүтээгдэхүүний нэрийг ашигла:\n${productCatalogCompact()}`,
          },
          { role: 'user', content: contactProfile(c) },
        ],
      }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`OpenAI алдаа (${res.status})`);
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}') as Record<string, unknown>;
    const out: ContactPersona = { ...c.persona };
    for (const f of PERSONA_FIELDS) {
      const v = parsed[f.key];
      if (typeof v === 'string' && v.trim() && !c.persona?.[f.key]) out[f.key] = v.trim();
    }
    return out;
  } catch (err) {
    console.warn('Persona үүсгэхэд OpenAI алдаа гарсан тул дүрэмд суурилан бөглөлөө:', (err as Error).message);
    return ruleBased();
  }
}
