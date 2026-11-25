import 'server-only';
import { desc, eq, sql } from 'drizzle-orm';
import type { getDb } from '@/db';
import { schema } from '@/db';
import type { Contact, PersonaMatch, Question, QuestionCluster, QuestionComment } from '@/db/schema';
import { DEFAULT_QUESTIONS } from './default-questions';

const aiEnabled = () => Boolean(process.env.OPENAI_API_KEY);

type DB = Awaited<ReturnType<typeof getDb>>;

export interface PersonaArchetype {
  id: string;
  name: string;
  trigger: string;
  keywords: string[];
  summary: string;
}

export const PERSONA_ARCHETYPES: PersonaArchetype[] = [
  {
    id: 'persona-1',
    name: 'Завгүй жолооч (Авто Каско / Хялбар)',
    trigger: 'Mental Accounting & Time Delay ↓',
    keywords: ['машин', 'жолооч', 'авто', 'каско', 'приус', 'франшиз', 'осол', 'хялбар', 'ухаалаг', 'үнэлгээ', 'өдөр', 'апп'],
    summary: '25–38 нас, үнэ харьцуулдаг, салбар орох дургүй, 3 минутын онлайн шийдэл ба 3 өдрийн нөхөн төлбөрт мэдрэг.',
  },
  {
    id: 'persona-2',
    name: 'Яарч буй гадаад зорчигч',
    trigger: 'Regret Aversion & Effort ↓',
    keywords: ['аялал', 'гадаад', 'виз', 'нислэг', 'онгоц', 'зорчигч', 'ачаа', 'эмчилгээ', 'яаралтай', 'маргааш'],
    summary: 'Нислэгийн өмнө яарч буй, гадаадад өвдөх эрсдэлээс сэргийлдэг, 3 минутад цахим полис хүсдэг аялагч.',
  },
  {
    id: 'persona-3',
    name: 'Цахимд эргэлздэг ЖДҮ / Орон сууц эзэмшигч',
    trigger: 'Status-Quo Bias & Authority',
    keywords: ['байр', 'орон сууц', 'хөрөнгө', 'ус', 'доод айл', 'дэлгүүр', 'оффис', 'тамга', 'цахим гэрээ', 'qr', 'нягтлан'],
    summary: '32–48 нас, ус алдалт болон доод айлын эрсдэлээс айдаг, цахим гэрээний хуулийн хүчинтэй эсэхэд баталгаа хүсдэг.',
  },
  {
    id: 'persona-b2b',
    name: 'Байгууллагын захирал / HR (Корпорат)',
    trigger: 'ROI & Productivity ↑',
    keywords: ['компани', 'байгууллага', 'ажилтан', 'захирал', 'hr', 'санхүү', 'төсөв', 'автопарк', 'эрүүл мэнд', 'шийдвэр'],
    summary: 'Шийдвэр гаргагч эсвэл санхүү хариуцагч; багцын хөнгөлөлт, ажилтны сэтгэл ханамж, бичиг цаасны ачааллыг чухалчилдаг.',
  },
  {
    id: 'persona-renewal',
    name: 'Сунгалт ба Өөр даатгалтай харилцагч',
    trigger: 'Loss Aversion & Switching Gain',
    keywords: ['сунгалт', 'дуусах', 'өөр газар', 'өрсөлдөгч', 'бодь', 'манд', 'миг', 'урамшуулал', 'өмнөх', 'нөхөн төлбөр'],
    summary: 'Хугацаа дуусах дөхсөн эсвэл өрсөлдөгчид даатгалтай; хуучин даатгалын дутагдлыг илрүүлж шилжүүлэх шаардлагатай.',
  },
];

const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EMBED_MODEL = () => process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const LOCAL_DIM = 128;

/** Кирилл болон Латин текстээс детерминист 128-хэмжээст L2-нормчилсон вектор үүсгэх (fallback болон хурдан хайлт) */
export function localEmbed(text: string): number[] {
  const vec = new Array<number>(LOCAL_DIM).fill(0);
  const norm = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return vec;

  const hashAdd = (token: string, weight: number) => {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % LOCAL_DIM;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign * weight;
  };

  const words = norm.split(' ').filter((w) => w.length > 1);
  for (const w of words) {
    hashAdd(`w:${w}`, 2.0);
    // Монгол үгийн залгавар, язгуур тааруулахад 3 болон 4 тэмдэгтийн trigram нэмнэ
    if (w.length >= 3) {
      for (let i = 0; i <= w.length - 3; i++) {
        hashAdd(`t:${w.slice(i, i + 3)}`, 1.0);
      }
    }
  }

  let mag = 0;
  for (let i = 0; i < LOCAL_DIM; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag) || 1;
  return vec.map((v) => Math.round((v / mag) * 1e5) / 1e5);
}

export function cosineSimilarity(a?: number[] | null, b?: number[] | null): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

function normalizeCentroid(vectors: number[][]): number[] {
  if (!vectors.length) return [];
  const dim = vectors[0].length;
  const out = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) continue;
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }
  let mag = 0;
  for (let i = 0; i < dim; i++) mag += out[i] * out[i];
  mag = Math.sqrt(mag) || 1;
  return out.map((x) => Math.round((x / mag) * 1e5) / 1e5);
}

/** Текстүүдийг вектор болгох (OpenAI Embedding API, алдаа гарвал/түлхүүргүй бол локал вектор) */
export async function embedBatch(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
  if (!texts.length) return { vectors: [], model: 'local-trigram-v1' };
  if (!aiEnabled()) {
    return { vectors: texts.map(localEmbed), model: 'local-trigram-v1' };
  }

  const abortCtrl = new AbortController();
  const timeoutId = setTimeout(() => abortCtrl.abort(), 12000);
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: abortCtrl.signal,
      body: JSON.stringify({
        model: EMBED_MODEL(),
        input: texts.map((t) => t.slice(0, 6000)),
      }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Embedding алдаа (${res.status})`);
    const json = (await res.json()) as { data?: { index: number; embedding: number[] }[] };
    const sorted = (json.data ?? []).sort((a, b) => a.index - b.index);
    if (sorted.length !== texts.length) throw new Error('Embedding тоо зөрлөө');
    return {
      vectors: sorted.map((d) => d.embedding.map((x) => Math.round(x * 1e5) / 1e5)),
      model: EMBED_MODEL(),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('OpenAI Embedding саатсан тул локал вектор ашиглалаа:', (err as Error).message);
    return { vectors: texts.map(localEmbed), model: 'local-trigram-v1' };
  }
}

interface VectorNode {
  id: string;
  category: string;
  votesCount: number;
  vector: number[];
}

interface RawCluster {
  indices: number[];
  centroid: number[];
}

/** Векторуудын ижилслээр семантик кластер ба асуулт хоорондын хамаарал үүсгэх */
function buildVectorClusters(nodes: VectorNode[], model: string): { clusters: RawCluster[]; relatedMap: Map<string, string[]> } {
  const relatedMap = new Map<string, string[]>();
  if (!nodes.length) return { clusters: [], relatedMap };

  // Асуулт бүрийн хамгийн ойрын 3 хамааралтай асуултыг олно
  for (let i = 0; i < nodes.length; i++) {
    const scored: { id: string; sim: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const sim = cosineSimilarity(nodes[i].vector, nodes[j].vector);
      scored.push({ id: nodes[j].id, sim });
    }
    scored.sort((a, b) => b.sim - a.sim);
    relatedMap.set(
      nodes[i].id,
      scored.slice(0, 3).map((x) => x.id),
    );
  }

  // Хамгийн өндөр vote-той асуултаас эхлүүлж кластер үүсгэнэ
  const order = nodes.map((_, i) => i).sort((a, b) => nodes[b].votesCount - nodes[a].votesCount);
  const threshold = model === 'local-trigram-v1' ? 0.34 : 0.56;
  const maxPerCluster = Math.max(3, Math.ceil(nodes.length / 3));

  const clusters: RawCluster[] = [];
  for (const idx of order) {
    let bestCluster = -1;
    let bestSim = -1;
    for (let c = 0; c < clusters.length; c++) {
      if (clusters[c].indices.length >= maxPerCluster) continue;
      const sim = cosineSimilarity(nodes[idx].vector, clusters[c].centroid);
      // Ангилал давхцвал жижиг бонус өгнө
      const sameCatBonus = clusters[c].indices.some((m) => nodes[m].category === nodes[idx].category) ? 0.08 : 0;
      const score = sim + sameCatBonus;
      if (score >= threshold && score > bestSim) {
        bestSim = score;
        bestCluster = c;
      }
    }

    if (bestCluster >= 0) {
      clusters[bestCluster].indices.push(idx);
      clusters[bestCluster].centroid = normalizeCentroid(clusters[bestCluster].indices.map((m) => nodes[m].vector));
    } else {
      clusters.push({ indices: [idx], centroid: nodes[idx].vector });
    }
  }

  // Ганц асуулттай жижиг кластеруудыг ижилсэл өндөр кластертай нэгтгэнэ (хэрэв нийт кластер > 5 бол)
  if (clusters.length > 5) {
    for (let c = clusters.length - 1; c >= 0; c--) {
      if (clusters[c].indices.length !== 1 || clusters.length <= 4) continue;
      const orphanIdx = clusters[c].indices[0];
      let target = -1;
      let targetSim = -1;
      for (let o = 0; o < clusters.length; o++) {
        if (o === c || clusters[o].indices.length >= maxPerCluster + 1) continue;
        const sim =
          cosineSimilarity(nodes[orphanIdx].vector, clusters[o].centroid) +
          (clusters[o].indices.some((m) => nodes[m].category === nodes[orphanIdx].category) ? 0.1 : 0);
        if (sim > targetSim) {
          targetSim = sim;
          target = o;
        }
      }
      if (target >= 0 && targetSim >= threshold * 0.65) {
        clusters[target].indices.push(orphanIdx);
        clusters[target].centroid = normalizeCentroid(clusters[target].indices.map((m) => nodes[m].vector));
        clusters.splice(c, 1);
      }
    }
  }

  return { clusters, relatedMap };
}

interface AnalyzedClusterOutput {
  clusterIndex: number;
  name: string;
  summary: string;
  performanceVerdict: string;
  bestPersonas: PersonaMatch[];
  nextClusterIndex: number | null;
  nextClusterReason: string;
  refinedQuestion: string;
  refinedRationale: string;
}

interface AnalyzedQuestionOutput {
  id: string;
  aiAnalysis: string;
  refinedVariant: string;
  personaScores: PersonaMatch[];
}

function scorePersonasByRules(text: string, category: string, votes: number): PersonaMatch[] {
  const lower = text.toLowerCase();
  const baseBoost = Math.min(18, Math.round(votes / 2));
  const scores = PERSONA_ARCHETYPES.map((p) => {
    let hits = 0;
    const matchedWords: string[] = [];
    for (const kw of p.keywords) {
      if (lower.includes(kw)) {
        hits++;
        matchedWords.push(kw);
      }
    }
    let catBonus = 0;
    if (p.id === 'persona-1' && (category === 'closing' || category === 'digital' || category === 'objection')) catBonus = 18;
    if (p.id === 'persona-3' && (category === 'bant' || category === 'discovery')) catBonus = 14;
    if (p.id === 'persona-b2b' && (category === 'bant' || category === 'spin')) catBonus = 16;
    if (p.id === 'persona-renewal' && (category === 'renewal' || category === 'objection')) catBonus = 22;
    if (p.id === 'persona-2' && category === 'digital') catBonus = 14;

    const raw = Math.min(97, Math.max(42, 48 + hits * 11 + catBonus + baseBoost));
    const reason = matchedWords.length
      ? `"${matchedWords.slice(0, 3).join(', ')}" сэдэв болон ${p.trigger} сэтгэл зүйтэй шууд нийцэж байна.`
      : `${p.trigger} сэтгэл зүйд тохирох бүтэцтэй.`;
    return { personaId: p.id, personaName: p.name, score: raw, reason };
  });

  return scores.sort((a, b) => b.score - a.score).slice(0, 3);
}

function localAnalyze(
  questions: Question[],
  commentsByQ: Map<string, QuestionComment[]>,
  rawClusters: RawCluster[],
): { clusters: AnalyzedClusterOutput[]; questions: AnalyzedQuestionOutput[] } {
  const clusterOutputs: AnalyzedClusterOutput[] = rawClusters.map((rc, cIdx) => {
    const members = rc.indices.map((i) => questions[i]).sort((a, b) => b.votesCount - a.votesCount);
    const lead = members[0];
    const allComments = members.flatMap((m) => commentsByQ.get(m.id) ?? []);
    const combinedText = members.map((m) => `${m.title} ${m.question} ${m.context ?? ''}`).join(' ') + ' ' + allComments.map((c) => c.content).join(' ');
    const bestPersonas = scorePersonasByRules(combinedText, lead.category, lead.votesCount);
    const totalVotes = members.reduce((s, m) => s + m.votesCount, 0);

    const hasClosingNext = rawClusters.findIndex((other, oIdx) => oIdx !== cIdx && other.indices.some((i) => questions[i].category === 'closing'));
    const nextIdx =
      lead.category !== 'closing' && hasClosingNext >= 0
        ? hasClosingNext
        : rawClusters.length > 1
          ? (cIdx + 1) % rawClusters.length
          : null;

    const cleanQ = lead.question.replace(/^[«"]|[»"]$/g, '').trim();
    const commentInsight = allComments[0]?.content ? ` Хамт олны туршлагаас харахад: "${allComments[0].content.slice(0, 120)}..."` : '';

    return {
      clusterIndex: cIdx,
      name: members.length > 1 ? `${lead.title.split(':')[0]} (${members.length} асуултын бүлэг)` : lead.title,
      summary: `Нийт ${members.length} ижил зорилготой асуултаас бүрдэх вектор кластер. Гол чиглэл: ${lead.context || lead.title}`,
      performanceVerdict: `Нийт ${totalVotes} vote, ${allComments.length} бодит туршлагын сэтгэгдэлтэй.${commentInsight || ' Илүү олон бодит дуудлагын сэтгэгдэл нэмэгдэх тусам үнэлгээ нарийсна.'}`,
      bestPersonas,
      nextClusterIndex: nextIdx,
      nextClusterReason:
        nextIdx !== null
          ? lead.category === 'closing'
            ? 'Хаалтын дараа харилцагчийн сэтгэл ханамж ба сунгалт/нэмэлт хамгаалалтын яриа руу шилжинэ.'
            : 'Энэ бүлгийн асуултаар хэрэгцээ/өвдөлтийг гаргасны дараа төлбөрийн линк эсвэл шийдлийн хаалт руу шилжих нь хамгийн үр дүнтэй.'
          : '',
      refinedQuestion: `«${cleanQ} — Бид танд салбар дээр цаг алдахгүй 3 минутад цахимаар шийдээд өгвөл танд аль хувилбар нь илүү тохирох вэ?»`,
      refinedRationale: `Хамгийн олон (${lead.votesCount}) vote авсан үндсэн асуултыг Практикалын "3 минутын хурд + сонголтын уян хатан байдал"-тай нэгтгэж боловсруулав.`,
    };
  });

  const questionOutputs: AnalyzedQuestionOutput[] = questions.map((q) => {
    const cs = commentsByQ.get(q.id) ?? [];
    const combined = `${q.title} ${q.question} ${q.context ?? ''} ${cs.map((c) => c.content).join(' ')}`;
    const personaScores = scorePersonasByRules(combined, q.category, q.votesCount);
    const topP = personaScores[0];
    return {
      id: q.id,
      aiAnalysis: `${q.votesCount} vote · ${cs.length} туршлагатай. ${topP.personaName} төрөлд (${topP.score}%) хамгийн өндөр үр дүнтэй. ${
        cs[0] ? `Бодит үр дүн: ${cs[0].content.slice(0, 140)}` : 'Шинэ туршлагын сэтгэгдэл нэмэгдэх тусам шинэчлэгдэнэ.'
      }`,
      refinedVariant: q.question,
      personaScores,
    };
  });

  return { clusters: clusterOutputs, questions: questionOutputs };
}

async function analyzeWithOpenAI(
  questions: Question[],
  commentsByQ: Map<string, QuestionComment[]>,
  rawClusters: RawCluster[],
): Promise<{ clusters: AnalyzedClusterOutput[]; questions: AnalyzedQuestionOutput[] }> {
  if (!aiEnabled()) return localAnalyze(questions, commentsByQ, rawClusters);

  const personaDesc = PERSONA_ARCHETYPES.map((p) => `- ${p.id} (${p.name}): ${p.summary} [${p.trigger}]`).join('\n');
  const clusterSummary = rawClusters
    .map((rc, idx) => {
      const items = rc.indices.map((i) => {
        const q = questions[i];
        const cs = (commentsByQ.get(q.id) ?? []).map((c) => `    * ${c.authorName}: ${c.content}`).join('\n');
        return `  - id="${q.id}" | category="${q.category}" | votes=${q.votesCount}\n    title="${q.title}"\n    question="${q.question}"\n    context="${q.context ?? ''}"${cs ? `\n    comments:\n${cs}` : ''}`;
      });
      return `CLUSTER ${idx}:\n${items.join('\n')}`;
    })
    .join('\n\n');

  const abortCtrl = new AbortController();
  const timeoutId = setTimeout(() => abortCtrl.abort(), 22000);
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: abortCtrl.signal,
      body: JSON.stringify({
        model: MODEL(),
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Чи "Практикал Даатгал" ХХК-ийн Question Intelligence AI шинжээч. Доорх вектор кластерууд, асуултууд, тэдгээрийн vote болон борлуулагчдын бодит туршлагын сэтгэгдлийг (comments) шинжлээд ЗӨВХӨН JSON буцаа.

ПЕРСОНА ХҮСНЭГТ:
${personaDesc}

ШААРДЛАГАТАЙ JSON БҮТЭЦ:
{
  "clusters": [
    {
      "clusterIndex": 0,
      "name": "Кластерийн оновчтой богино нэр (Монголоор)",
      "summary": "Энэ бүлгийн асуултуудын сэтгэл зүйн мөн чанар ба хэзээ хэрэглэх дүгнэлт (1-2 өгүүлбэр)",
      "performanceVerdict": "Vote болон бодит коммент дээр үндэслэсэн ажилласан байдлын дүгнэлт (юу нь ажилласан, юун дээр анхаарах)",
      "bestPersonas": [
        { "personaId": "persona-1", "personaName": "Завгүй жолооч (Авто Каско / Хялбар)", "score": 92, "reason": "Яагаад тохирох богино тайлбар" }
      ],
      "nextClusterIndex": 1,
      "nextClusterReason": "Энэ кластерын дараа аль кластер руу шилжвэл борлуулалт хаахад илүү үр дүнтэйг тайлбарла",
      "refinedQuestion": "Кластерийн бүх асуулт болон шилдэг комментийн туршлагыг шингээн боловсруулсан хамгийн хүчтэй сайжруулсан асуулт («...»)",
      "refinedRationale": "Яагаад энэ шинэчилсэн асуулт илүү үр дүнтэй болох шалтгаан"
    }
  ],
  "questions": [
    {
      "id": "question-uuid",
      "aiAnalysis": "Уг асуултын бодит үр дүн, коммент болон ажиллах нөхцөлийн товч дүгнэлт",
      "refinedVariant": "Энэ асуултын сайжруулсан илүү хурц хувилбар",
      "personaScores": [
        { "personaId": "persona-1", "personaName": "...", "score": 90, "reason": "..." }
      ]
    }
  ]
}
Анхаар: clusters бүрт bestPersonas яг 3 ширхэг (score 0-100), questions бүрт бүх асуултын id багтсан байх ёстой. Зөвхөн Монгол хэлээр бич.`,
          },
          { role: 'user', content: clusterSummary },
        ],
      }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`OpenAI дүгнэлтийн алдаа (${res.status})`);
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}') as {
      clusters?: AnalyzedClusterOutput[];
      questions?: AnalyzedQuestionOutput[];
    };
    if (!Array.isArray(parsed.clusters) || parsed.clusters.length !== rawClusters.length) {
      throw new Error('Кластер дүгнэлтийн бүтэц дутуу');
    }

    const fallback = localAnalyze(questions, commentsByQ, rawClusters);
    const qMap = new Map((parsed.questions ?? []).map((x) => [x.id, x]));
    const mergedQuestions = fallback.questions.map((fq) => {
      const aiQ = qMap.get(fq.id);
      if (!aiQ) return fq;
      return {
        id: fq.id,
        aiAnalysis: aiQ.aiAnalysis || fq.aiAnalysis,
        refinedVariant: aiQ.refinedVariant || fq.refinedVariant,
        personaScores: Array.isArray(aiQ.personaScores) && aiQ.personaScores.length ? aiQ.personaScores.slice(0, 3) : fq.personaScores,
      };
    });

    return {
      clusters: parsed.clusters.map((c, idx) => ({
        ...fallback.clusters[idx],
        ...c,
        clusterIndex: idx,
        bestPersonas: Array.isArray(c.bestPersonas) && c.bestPersonas.length ? c.bestPersonas.slice(0, 3) : fallback.clusters[idx].bestPersonas,
      })),
      questions: mergedQuestions,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('OpenAI кластер шинжилгээ саатсан тул локал дүгнэлт хийлээ:', (err as Error).message);
    return localAnalyze(questions, commentsByQ, rawClusters);
  }
}

let inFlightAnalysis: Promise<{ ok: boolean; clustersCount: number; questionsCount: number; model: string }> | null = null;

/** Бүх асуултыг векторжуулан кластер болгож, ажилласан байдал ба Persona дүгнэлт үүсгэнэ */
export async function runQuestionIntelligence(db: DB, forceReembed = false) {
  if (inFlightAnalysis) return inFlightAnalysis;

  inFlightAnalysis = (async () => {
    const allQuestions = await db.select().from(schema.questions).orderBy(desc(schema.questions.votesCount));
    if (!allQuestions.length) {
      return { ok: true, clustersCount: 0, questionsCount: 0, model: 'none' };
    }

    const allComments = await db.select().from(schema.questionComments);
    const commentsByQ = new Map<string, QuestionComment[]>();
    for (const c of allComments) {
      const arr = commentsByQ.get(c.questionId) ?? [];
      arr.push(c);
      commentsByQ.set(c.questionId, arr);
    }

    const desiredModel = aiEnabled() ? EMBED_MODEL() : 'local-trigram-v1';
    const needsEmbed = allQuestions.some(
      (q) => forceReembed || !Array.isArray(q.embedding) || q.embedding.length === 0 || q.embeddingModel !== desiredModel,
    );

    let vectors: number[][] = [];
    let usedModel = desiredModel;

    if (needsEmbed) {
      const texts = allQuestions.map((q) => {
        const cs = (commentsByQ.get(q.id) ?? []).map((c) => c.content).join(' | ');
        return `[${q.category}] ${q.title}. ${q.question} ${q.context ?? ''} ${cs}`;
      });
      const embedded = await embedBatch(texts);
      vectors = embedded.vectors;
      usedModel = embedded.model;
    } else {
      vectors = allQuestions.map((q) => q.embedding as number[]);
      usedModel = allQuestions[0].embeddingModel || desiredModel;
    }

    // Бүх вектор ижил урттай эсэхийг баталгаажуулна
    const expectedLen = vectors[0]?.length ?? LOCAL_DIM;
    if (vectors.some((v) => v.length !== expectedLen)) {
      vectors = allQuestions.map((q) => localEmbed(`${q.title} ${q.question} ${q.context ?? ''}`));
      usedModel = 'local-trigram-v1';
    }

    const nodes: VectorNode[] = allQuestions.map((q, idx) => ({
      id: q.id,
      category: q.category,
      votesCount: q.votesCount,
      vector: vectors[idx],
    }));

    const { clusters: rawClusters, relatedMap } = buildVectorClusters(nodes, usedModel);
    const analyzed = await analyzeWithOpenAI(allQuestions, commentsByQ, rawClusters);

    const now = new Date();
    const clusterIds: string[] = [];

    await db.transaction(async (tx) => {
      // Хуучин кластеруудыг цэвэрлээд шинэ кластеруудыг үүсгэнэ
      await tx.update(schema.questions).set({ clusterId: null });
      await tx.delete(schema.questionClusters);

      for (let i = 0; i < rawClusters.length; i++) {
        const rc = rawClusters[i];
        const info = analyzed.clusters[i];
        const memberVotes = rc.indices.map((m) => allQuestions[m].votesCount);
        const avgVotes = Math.round(memberVotes.reduce((a, b) => a + b, 0) / Math.max(1, memberVotes.length));

        const [insertedCluster] = await tx
          .insert(schema.questionClusters)
          .values({
            name: info.name,
            summary: info.summary,
            performanceVerdict: info.performanceVerdict,
            bestPersonas: info.bestPersonas,
            nextClusterReason: info.nextClusterReason || null,
            refinedQuestion: info.refinedQuestion,
            refinedRationale: info.refinedRationale,
            centroid: rc.centroid,
            questionCount: rc.indices.length,
            avgVotes,
            updatedAt: now,
          })
          .returning({ id: schema.questionClusters.id });

        clusterIds.push(insertedCluster.id);
      }

      // Кластер хоорондын шилжилтийн (nextClusterId) холбоосыг хадгална
      for (let i = 0; i < rawClusters.length; i++) {
        const nextIdx = analyzed.clusters[i]?.nextClusterIndex;
        if (typeof nextIdx === 'number' && nextIdx >= 0 && nextIdx < clusterIds.length && nextIdx !== i) {
          await tx
            .update(schema.questionClusters)
            .set({ nextClusterId: clusterIds[nextIdx] })
            .where(eq(schema.questionClusters.id, clusterIds[i]));
        }
      }

      // Асуулт бүрийн вектор, кластер ID, persona оноо, дүгнэлтийг хадгална
      const qAnalysisMap = new Map(analyzed.questions.map((x) => [x.id, x]));
      for (let cIdx = 0; cIdx < rawClusters.length; cIdx++) {
        const clusterId = clusterIds[cIdx];
        for (const qIdx of rawClusters[cIdx].indices) {
          const q = allQuestions[qIdx];
          const qa = qAnalysisMap.get(q.id);
          await tx
            .update(schema.questions)
            .set({
              embedding: vectors[qIdx],
              embeddingModel: usedModel,
              clusterId,
              personaScores: qa?.personaScores ?? [],
              aiAnalysis: qa?.aiAnalysis ?? null,
              refinedVariant: qa?.refinedVariant ?? null,
              relatedQuestionIds: relatedMap.get(q.id) ?? [],
              analyzedAt: now,
            })
            .where(eq(schema.questions.id, q.id));
        }
      }
    });

    return {
      ok: true,
      clustersCount: clusterIds.length,
      questionsCount: allQuestions.length,
      model: usedModel,
    };
  })().finally(() => {
    inFlightAnalysis = null;
  });

  return inFlightAnalysis;
}

export interface SynthesizedQuestionResult {
  title: string;
  category: 'discovery' | 'spin' | 'bant' | 'objection' | 'closing' | 'digital' | 'renewal';
  question: string;
  context: string;
  rationale: string;
  followUpQuestion: string;
  predictedObjection: string;
  targetPersonaName: string;
  modelUsed: string;
}

/** Тодорхой Persona эсвэл CRM харилцагч дээр суурилан хамгийн тохирсон шинэ асуулт боловсруулах агент */
export async function synthesizePersonaQuestion(params: {
  cluster?: QuestionCluster | null;
  sourceQuestion?: Question | null;
  comments?: QuestionComment[];
  contact?: Contact | null;
  personaName?: string | null;
  goal?: string | null;
}): Promise<SynthesizedQuestionResult> {
  const { cluster, sourceQuestion, comments = [], contact, personaName, goal } = params;
  const targetPersonaName =
    personaName ||
    (contact ? `${contact.fullName}${contact.role ? ` (${contact.role})` : ''}${contact.company ? ` · ${contact.company}` : ''}` : null) ||
    cluster?.bestPersonas?.[0]?.personaName ||
    PERSONA_ARCHETYPES[0].name;

  const targetCategory = (sourceQuestion?.category as SynthesizedQuestionResult['category']) || 'discovery';
  const baseContext = [
    cluster ? `Кластер: ${cluster.name}\nДүгнэлт: ${cluster.summary}\nБодит үр дүн: ${cluster.performanceVerdict}` : '',
    sourceQuestion ? `Эх асуулт: ${sourceQuestion.question}\nЗорилго: ${sourceQuestion.title}` : '',
    comments.length ? `Борлуулагчдын туршлага:\n${comments.map((c) => `- ${c.content}`).join('\n')}` : '',
    contact
      ? `Харилцагч: ${contact.fullName}, Үүрэг: ${contact.role ?? 'тодорхойгүй'}, Байгууллага: ${contact.company ?? 'хувь хүн'}, Үе шат: ${contact.stage}, Тэмдэглэл: ${contact.notes ?? ''}, Өвдөлт: ${contact.persona?.pains ?? ''}, Сонирхол: ${contact.persona?.productsOfInterest ?? ''}`
      : '',
    goal ? `Борлуулагчийн нэмэлт зорилго: ${goal}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const localFallback = (): SynthesizedQuestionResult => {
    const leadPhrase = contact
      ? `${contact.fullName.split(' ').slice(-1)[0]} ээ, ${contact.company ? `${contact.company}-ийн` : 'таны'} хувьд`
      : `${targetPersonaName.split('(')[0].trim()} таны хувьд`;
    const baseQ = (sourceQuestion?.question || cluster?.refinedQuestion || 'одоогийн даатгалын нөхцөл тань ямар байгаа вэ?').replace(/^[«"]|[»"]$/g, '');
    return {
      title: `${targetPersonaName.split('(')[0].trim()} — Оновчилсон асуулт`,
      category: targetCategory,
      question: `«${leadPhrase}, ${baseQ.charAt(0).toLowerCase() + baseQ.slice(1)} Хэрэв салбарт очилгүй 3 минутад утсаараа шийдэх боломжтой бол танд ямар асуудал хамгийн түрүүнд хөнгөрөх вэ?»`,
      context: `${targetPersonaName} төрлийн харилцагчийн гол сэдэл болон Practical-ийн 3 минутын онлайн амлалтыг уясан хувилбар.`,
      rationale: comments[0]
        ? `Багийн туршлагаас ("${comments[0].content.slice(0, 90)}...") санаа авч, татгалзал үүсгэхгүй нээлттэй хэлбэрт оруулав.`
        : 'Нээлттэй discovery болон цаг хэмнэлтийн сэтгэл зүйг нэгтгэв.',
      followUpQuestion: '«Тэгвэл яг энэ нөхцөлөөр 2 хувилбарын тооцоог одоо чатаар харьцуулаад илгээчих үү?»',
      predictedObjection: '«Одоо өөр газар даатгалтай байгаа / Дараа болъё» гэвэл одоогийн даатгалын сайжруулах цорын ганц зүйлийг асууна.',
      targetPersonaName,
      modelUsed: 'local-synthesizer-v1',
    };
  };

  if (!aiEnabled()) return localFallback();

  const abortCtrl = new AbortController();
  const timeoutId = setTimeout(() => abortCtrl.abort(), 16000);
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: abortCtrl.signal,
      body: JSON.stringify({
        model: MODEL(),
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Чи "Практикал Даатгал"-ын борлуулалтын ахлах коуч. Өгөгдсөн Persona болон Асуултын банкны кластер/туршлагад тулгуурлан яг тэр хүнд төгс таарсан ШИНЭ, ИЛҮҮ ХҮЧТЭЙ асуулт боловсруулж ЗӨВХӨН JSON буцаа:
{
  "title": "Асуултын зорилго, товч гарчиг (10-120 тэмдэгт)",
  "category": "discovery | spin | bant | objection | closing | digital | renewal аль тохирох 1 утга",
  "question": "«Харилцагчид шууд хэлэх, байгалийн Монгол ярианы өнгөтэй хүчирхэг асуулт»",
  "context": "Хэзээ, яагаад асуух сэтгэл зүйн тайлбар",
  "rationale": "Бодит коммент, кластерийн дүгнэлтээс юуг сайжруулж авсан тайлбар",
  "followUpQuestion": "Энэ асуултын дараа шууд асуух дараагийн алхмын асуулт",
  "predictedObjection": "Харилцагчийн өгөх магадлалтай хариу ба эргүүлэх сэжим"
}`,
          },
          { role: 'user', content: `ЗОРИЛТОТ PERSONA: ${targetPersonaName}\n\n${baseContext}` },
        ],
      }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`OpenAI алдаа (${res.status})`);
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}') as Partial<SynthesizedQuestionResult>;
    const validCats = ['discovery', 'spin', 'bant', 'objection', 'closing', 'digital', 'renewal'] as const;
    const cat = validCats.includes(parsed.category as typeof validCats[number]) ? (parsed.category as typeof validCats[number]) : targetCategory;
    if (!parsed.question || !parsed.title) return localFallback();
    return {
      title: parsed.title,
      category: cat,
      question: parsed.question,
      context: parsed.context || localFallback().context,
      rationale: parsed.rationale || localFallback().rationale,
      followUpQuestion: parsed.followUpQuestion || localFallback().followUpQuestion,
      predictedObjection: parsed.predictedObjection || localFallback().predictedObjection,
      targetPersonaName,
      modelUsed: MODEL(),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Асуулт боловсруулахад OpenAI саатсан тул локал загвар ашиглалаа:', (err as Error).message);
    return localFallback();
  }
}

/** Амьд коуч чатад харилцагчийн Persona-тай вектор/утгаар хамгийн сайн таарах асуулт, кластерийг татах */
export async function retrieveBankIntelligenceForContact(db: DB, c: Contact, userMessage: string, limit = 2) {
  try {
    const allQuestions = await db.select().from(schema.questions).orderBy(desc(schema.questions.votesCount));
    if (!allQuestions.length) return [];

    const queryText = `${c.company ?? ''} ${c.role ?? ''} ${c.stage} ${c.notes ?? ''} ${c.persona?.pains ?? ''} ${c.persona?.productsOfInterest ?? ''} ${c.persona?.objections ?? ''} ${userMessage}`;
    const qVec = localEmbed(queryText);

    const scored = allQuestions.map((q) => {
      const targetVec = localEmbed(`${q.title} ${q.question} ${q.context ?? ''} ${q.aiAnalysis ?? ''}`);
      const sim = cosineSimilarity(qVec, targetVec);
      const voteBoost = Math.min(0.25, q.votesCount / 160);
      return { q, score: sim + voteBoost };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.q);
  } catch {
    return [];
  }
}

/** Асуултын санг хоосон үед үндсэн батлагдсан асуултуудаар идемпотент байдлаар дүүргэх */
export async function ensureQuestionsSeeded(db: DB) {
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

/** Шинээр орсон ганц асуултыг тэр дор нь векторжуулан хамгийн ойр кластер ба Persona-тай холбох */
export async function enrichNewQuestion(db: DB, q: Question) {
  try {
    const text = `[${q.category}] ${q.title}. ${q.question} ${q.context ?? ''}`;
    const { vectors, model } = await embedBatch([text]);
    const vec = vectors[0];
    const personaScores = scorePersonasByRules(text, q.category, q.votesCount);

    const clusters = await db.select().from(schema.questionClusters);
    let bestClusterId: string | null = null;
    let bestSim = -1;
    for (const c of clusters) {
      if (!Array.isArray(c.centroid) || c.centroid.length !== vec.length) continue;
      const sim = cosineSimilarity(vec, c.centroid);
      if (sim > bestSim) {
        bestSim = sim;
        bestClusterId = c.id;
      }
    }

    const others = await db.select().from(schema.questions);
    const related = others
      .filter((o) => o.id !== q.id && Array.isArray(o.embedding) && o.embedding.length === vec.length)
      .map((o) => ({ id: o.id, sim: cosineSimilarity(vec, o.embedding as number[]) }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3)
      .map((x) => x.id);

    const topP = personaScores[0];
    const aiAnalysis = `${topP.personaName} төрөлд (${topP.score}%) тохирох шинэ асуулт. AI шинжилгээг дахин ажиллуулбал коммент болон кластертай бүрэн уялдана.`;

    await db
      .update(schema.questions)
      .set({
        embedding: vec,
        embeddingModel: model,
        clusterId: bestClusterId,
        personaScores,
        aiAnalysis,
        relatedQuestionIds: related,
        analyzedAt: new Date(),
      })
      .where(eq(schema.questions.id, q.id));

    if (bestClusterId) {
      await db
        .update(schema.questionClusters)
        .set({ questionCount: sql`${schema.questionClusters.questionCount} + 1` })
        .where(eq(schema.questionClusters.id, bestClusterId));
    }
  } catch (err) {
    console.warn('Шинэ асуулт векторжуулахад алдаа гарлаа:', (err as Error).message);
  }
}

/** Кластер болон асуултуудын бүрэн тайлангийн өгөгдлийг буцаах (хэрэв кластер хоосон бол автоматаар үүсгэнэ) */
export async function getClustersReport(db: DB, userId: string) {
  await ensureQuestionsSeeded(db);

  let clusters = await db.select().from(schema.questionClusters).orderBy(desc(schema.questionClusters.avgVotes));
  if (clusters.length === 0) {
    await runQuestionIntelligence(db, false);
    clusters = await db.select().from(schema.questionClusters).orderBy(desc(schema.questionClusters.avgVotes));
  }

  const questions = await db
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
      embeddingModel: schema.questions.embeddingModel,
      clusterId: schema.questions.clusterId,
      personaScores: schema.questions.personaScores,
      aiAnalysis: schema.questions.aiAnalysis,
      refinedVariant: schema.questions.refinedVariant,
      relatedQuestionIds: schema.questions.relatedQuestionIds,
      analyzedAt: schema.questions.analyzedAt,
      createdAt: schema.questions.createdAt,
      commentsCount: sql<number>`(select count(*)::int from question_comments qc where qc.question_id = ${schema.questions.id})`,
      userVoted: sql<boolean>`exists(select 1 from question_votes qv where qv.question_id = ${schema.questions.id} and qv.user_id = ${userId})`,
    })
    .from(schema.questions)
    .orderBy(desc(schema.questions.votesCount));

  return {
    clusters: clusters.map((c) => ({
      id: c.id,
      name: c.name,
      summary: c.summary,
      performanceVerdict: c.performanceVerdict,
      bestPersonas: c.bestPersonas,
      nextClusterId: c.nextClusterId,
      nextClusterReason: c.nextClusterReason,
      refinedQuestion: c.refinedQuestion,
      refinedRationale: c.refinedRationale,
      questionCount: c.questionCount,
      avgVotes: c.avgVotes,
      updatedAt: c.updatedAt,
    })),
    questions,
  };
}
