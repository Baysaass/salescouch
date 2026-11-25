import 'server-only';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { getDb } from '@/db';
import { schema } from '@/db';
import type { Contact, PersonaMatch, Question, QuestionCluster, QuestionComment } from '@/db/schema';
import { getProUserIds } from './api';
import { DEFAULT_QUESTIONS } from './default-questions';
import {
  checkCopyGuardrails,
  ETHICAL_COPY_GUARDRAILS,
  PERSUASION_STYLE_MAP,
  type GuardrailWarning,
  type PersuasionStyleId,
} from './persuasion-frameworks';

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
      name: members.length > 1 ? `${lead.title.split(':')[0]} (${members.length} асуулт)` : lead.title,
      summary: `Ижил зорилготой ${members.length} асуултын бүлэг. Гол санаа: ${lead.context || lead.title}`,
      performanceVerdict: `Нийт ${totalVotes} дэмжлэг, ${allComments.length} бодит сэтгэгдэлтэй.${commentInsight || ' Борлуулагчид бодит туршлагаа бичих тусам дүгнэлт баяжна.'}`,
      bestPersonas,
      nextClusterIndex: nextIdx,
      nextClusterReason:
        nextIdx !== null
          ? lead.category === 'closing'
            ? 'Хаалтын дараа харилцагчийн сэтгэл ханамж болон сунгалтын яриа руу шилжинэ.'
            : 'Энэ бүлгийн асуултаар хэрэгцээг гаргасны дараа төлбөрийн холбоос эсвэл шийдлийн хаалт руу шилжихэд илүү үр дүнтэй.'
          : '',
      refinedQuestion: `«${cleanQ} — Салбарт очихгүйгээр утсаараа 3 минутад шийдэх боломжтой бол танд аль хувилбар нь илүү тохирох вэ?»`,
      refinedRationale: `Хамгийн олон дэмжлэг авсан асуултыг 3 минутын хурд ба сонголтын уян хатан байдалтай нэгтгэж боловсруулав.`,
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
  triggerStyle: PersuasionStyleId;
  triggerLabel: string;
  guardrailWarnings: GuardrailWarning[];
  modelUsed: string;
  variantB?: SynthesizedQuestionResult | null;
}

function resolveAutoTrigger(c?: Contact | null): Exclude<PersuasionStyleId, 'auto'> {
  if (!c) return 'honesty';
  if (c.stage === 'proposal' || c.stage === 'negotiation') return 'honesty';
  if (c.stage === 'qualified' || c.temperature === 'warm') return 'speed_ease';
  return 'curiosity';
}

function buildLocalTriggerVariant(
  style: Exclude<PersuasionStyleId, 'auto'>,
  leadPhrase: string,
  baseQ: string,
  targetPersonaName: string,
  comments: QuestionComment[],
  category: SynthesizedQuestionResult['category'],
): SynthesizedQuestionResult {
  const styleMeta = PERSUASION_STYLE_MAP[style];
  const normalizedBase = baseQ.charAt(0).toLowerCase() + baseQ.slice(1);
  let question: string;
  let followUpQuestion: string;
  let predictedObjection: string;

  switch (style) {
    case 'curiosity':
      question = `«${leadPhrase}, ихэнх харилцагч анзааралгүй орхидог нэг зүйл бий — танай одоогийн даатгал нөхөн төлбөр дээр ямар бичиг баримт, хэдэн хоног шаарддагийг шалгаж үзсэн үү?»`;
      followUpQuestion = '«Хэрэв апп-аар бодит цагт хянадаг, ~3 өдөрт шийддэг ялгааг 1 минутад харуулбал сонирхолтой юу?»';
      predictedObjection = '«Мэдэхгүй байна / Өөр газар байгаа» гэвэл шийдвэрлэх хугацааны зөрүүг тодруулна.';
      break;
    case 'loss_avoidance':
      question = `«${leadPhrase}, гэнэтийн осол эсвэл зогсолт гарах үед ганц удаагийн засвар, орлогын алдагдал жилийн хураамжаас хэд дахин давдгийг бодвол хохирол гарахаас өмнө яг юуг нь түрүүлж хаах хэрэгтэй байна вэ?»`;
      followUpQuestion = '«Энэ эрсдэлээс сэргийлэх 2 багцын сарын дүнг харьцуулаад илгээх үү?»';
      predictedObjection = '«Надад тохиолдохгүй байх» гэвэл салбарын бодит жишээ болон сарын бага дүнгээр тайлбарлана.';
      break;
    case 'honesty':
      question = `«${leadPhrase}, шударгаар хэлэхэд даатгал бүр юуг хамгаалах ба ямар 2–3 зүйлийг хасах вэ гэдэг тодорхой заагтай байдаг. Манай гэрээ яг юуг бүрэн хаагаад, юуг нөхөхгүйг танд одоо ил тод тайлбарлаад өгөх үү?»`;
      followUpQuestion = '«Ил тод нөхцөл таалагдвал танай хэрэгцээнд таарсан хураамжийг 2 минутад бодоод харуулах уу?»';
      predictedObjection = '«Ямар зүйл хасагддаг юм бэ?» гэж шууд сонирхож асууна — эргэлзээг нуухгүй тайлбарласнаар итгэл эрс өснө.';
      break;
    case 'contrast':
      question = `«${leadPhrase}, зөвхөн хураамж харахын оронд салбар дамжихгүйгээр утсаар шийддэг, шил толь ба жижиг сэв зураас хэдэн удаа ордог ялгааг одоогийн даатгалтайгаа харьцуулж үзэх үү?»`;
      followUpQuestion = '«Харьцуулалтаар манайх цаг ба хамгаалалтаараа илүү байвал сунгалт дээрээ бодож үзэх үү?»';
      predictedObjection = '«Яг ямар ялгаатай юм?» гэвэл 1 хуудас харьцуулалт илгээнэ.';
      break;
    case 'specificity':
      question = `«${leadPhrase}, бодит тоогоор яривал 5 сая₮ хүртэлх нөхөн төлбөрийг ажлын 7 хоногт (Найдвартай багц дээр хоцорвол өдрийн 0.5% алдангитай) шийддэг — танай төсөвт яг таарах 2 хувилбарын тооцоог харуулах уу?»`;
      followUpQuestion = '«Тооцооны аль хувилбар нь танай төсөвт илүү ойр харагдаж байна вэ?»';
      predictedObjection = '«Яг тийм хурдан гардаг уу?» гэвэл бодит апп хяналт болон гэрээний заалтыг зааж өгнө.';
      break;
    case 'reciprocity':
      question = `«${leadPhrase}, та өнөөдөр шууд шийдэх албагүй ээ — харин танай нөхцөлд тохирсон 2 багцын үнэгүй 1 хуудас харьцуулалтыг бэлдээд чатаар үлдээчих үү? Дараа нь харьцуулахад амар байна байх.»`;
      followUpQuestion = '«Танд аль имэйл эсвэл чатаар харьцуулалтаа явуулахад амар вэ?»';
      predictedObjection = '«За явуулчих» гэж зөөлнөөр зөвшөөрөх магадлал өндөр.';
      break;
    case 'speed_ease':
    default:
      question = `«${leadPhrase}, ${normalizedBase} Хэрэв салбарт очилгүй утсаараа 3 минутад шийдэх боломжтой бол танд ямар асуудал хамгийн түрүүнд хөнгөрөх вэ?»`;
      followUpQuestion = '«Тэгвэл яг энэ нөхцөлөөр 2 хувилбарын тооцоог одоо чатаар харьцуулаад илгээчих үү?»';
      predictedObjection = '«Одоо өөр газар даатгалтай байгаа / Дараа болъё» гэвэл сайжруулах цорын ганц зүйлийг асууна.';
      break;
  }

  const context = `${targetPersonaName} — "${styleMeta.label}" (${styleMeta.mechanism}) аргаар бэлтгэв.`;
  const rationale = comments[0]
    ? `Багийн туршлагаас ("${comments[0].content.slice(0, 80)}...") санаа авч, "${styleMeta.label}" хөшүүргээр боловсруулав. ${styleMeta.caveat}`
    : `${styleMeta.shortHint}. ${styleMeta.caveat}`;

  return {
    title: `${styleMeta.label}: ${targetPersonaName.split('(')[0].trim()}`,
    category,
    question,
    context,
    rationale,
    followUpQuestion,
    predictedObjection,
    targetPersonaName,
    triggerStyle: style,
    triggerLabel: styleMeta.label,
    guardrailWarnings: checkCopyGuardrails(`${question} ${context} ${followUpQuestion}`),
    modelUsed: 'local-synthesizer-v2',
  };
}

/** Тодорхой Persona эсвэл CRM харилцагч дээр суурилан хамгийн тохирсон шинэ асуулт боловсруулах агент */
export async function synthesizePersonaQuestion(params: {
  cluster?: QuestionCluster | null;
  sourceQuestion?: Question | null;
  comments?: QuestionComment[];
  contact?: Contact | null;
  personaName?: string | null;
  goal?: string | null;
  triggerStyle?: PersuasionStyleId | null;
  abTestMode?: boolean;
  abCompareStyle?: PersuasionStyleId | null;
}): Promise<SynthesizedQuestionResult> {
  const {
    cluster,
    sourceQuestion,
    comments = [],
    contact,
    personaName,
    goal,
    triggerStyle = 'auto',
    abTestMode = false,
    abCompareStyle = null,
  } = params;
  const targetPersonaName =
    personaName ||
    (contact ? `${contact.fullName}${contact.role ? ` (${contact.role})` : ''}${contact.company ? ` · ${contact.company}` : ''}` : null) ||
    cluster?.bestPersonas?.[0]?.personaName ||
    PERSONA_ARCHETYPES[0].name;

  const targetCategory = (sourceQuestion?.category as SynthesizedQuestionResult['category']) || 'discovery';
  const resolvedPrimary: Exclude<PersuasionStyleId, 'auto'> =
    !triggerStyle || triggerStyle === 'auto' ? resolveAutoTrigger(contact) : triggerStyle;

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

  const leadPhrase = contact
    ? `${contact.fullName.split(' ').slice(-1)[0]} ээ, ${contact.company ? `${contact.company}-ийн` : 'таны'} хувьд`
    : `${targetPersonaName.split('(')[0].trim()} таны хувьд`;
  const baseQ = (sourceQuestion?.question || cluster?.refinedQuestion || 'одоогийн даатгалын нөхцөл тань ямар байгаа вэ?').replace(/^[«"]|[»"]$/g, '');

  const synthesizeSingle = async (style: Exclude<PersuasionStyleId, 'auto'>): Promise<SynthesizedQuestionResult> => {
    const local = buildLocalTriggerVariant(style, leadPhrase, baseQ, targetPersonaName, comments, targetCategory);
    if (!aiEnabled()) return local;

    const styleMeta = PERSUASION_STYLE_MAP[style];
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
              content: `Чи "Практикал Даатгал"-ын борлуулалтын ахлах коуч. Өгөгдсөн Persona, Асуултын банкны туршлага болон СОНГОСОН СЭТГЭЛЗҮЙН ХӨШҮҮРЭГ дээр тулгуурлан яг тэр хүнд тохирсон ШИНЭ, ИЛҮҮ ХҮЧТЭЙ асуулт боловсруулж ЗӨВХӨН JSON буцаа.

СОНГОСОН ХӨШҮҮРЭГ: ${styleMeta.label} (${styleMeta.mechanism})
ХЭРЭГЛЭХ ЗААВАР: ${styleMeta.promptInstruction}
АНХААРАХ ХЯЗГААРЛАЛТ: ${styleMeta.caveat}

ЁС ЗҮЙ БА ИТГЭЛЦЛИЙН ХАТУУ ДҮРЭМ (Guardrails):
${ETHICAL_COPY_GUARDRAILS.map((g) => `- ${g}`).join('\n')}

JSON БҮТЭЦ:
{
  "title": "Асуултын зорилго, товч гарчиг (10-120 тэмдэгт)",
  "category": "discovery | spin | bant | objection | closing | digital | renewal аль тохирох 1 утга",
  "question": "«Харилцагчид шууд хэлэх, байгалийн Монгол ярианы өнгөтэй хүчирхэг асуулт»",
  "context": "Хэзээ, яагаад энэ сэтгэлзүйн хөшүүргээр асуух тайлбар",
  "rationale": "Бодит коммент, хөшүүрэг ба кластерийн дүгнэлтээс юуг сайжруулж авсан тайлбар",
  "followUpQuestion": "Энэ асуултын дараа шууд асуух дараагийн алхмын тодорхой асуулт",
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
      if (!parsed.question || !parsed.title) return local;

      const out: SynthesizedQuestionResult = {
        title: parsed.title,
        category: cat,
        question: parsed.question,
        context: parsed.context || local.context,
        rationale: parsed.rationale || local.rationale,
        followUpQuestion: parsed.followUpQuestion || local.followUpQuestion,
        predictedObjection: parsed.predictedObjection || local.predictedObjection,
        targetPersonaName,
        triggerStyle: style,
        triggerLabel: styleMeta.label,
        guardrailWarnings: checkCopyGuardrails(`${parsed.title} ${parsed.question} ${parsed.context ?? ''} ${parsed.followUpQuestion ?? ''}`),
        modelUsed: MODEL(),
      };
      return out;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Асуулт боловсруулахад OpenAI саатсан тул локал загвар ашиглалаа:', (err as Error).message);
      return local;
    }
  };

  if (!abTestMode) {
    return synthesizeSingle(resolvedPrimary);
  }

  const resolvedB: Exclude<PersuasionStyleId, 'auto'> =
    abCompareStyle && abCompareStyle !== 'auto' && abCompareStyle !== resolvedPrimary
      ? abCompareStyle
      : resolvedPrimary === 'honesty'
        ? 'loss_avoidance'
        : 'honesty';

  const [variantA, variantB] = await Promise.all([synthesizeSingle(resolvedPrimary), synthesizeSingle(resolvedB)]);
  return {
    ...variantA,
    variantB,
  };
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

let mockCleaned = false;

/** Асуултын санг хоосон үед жишээ асуултуудаар (0 like/комменттой) дүүргэх ба хуучин mock дата байвал цэвэрлэх */
export async function ensureQuestionsSeeded(db: DB) {
  if (!mockCleaned) {
    mockCleaned = true;
    try {
      await db
        .delete(schema.questionComments)
        .where(inArray(schema.questionComments.userId, ['system', 'seed-user']));

      const seedIds = DEFAULT_QUESTIONS.map((q) => q.id);
      const existingSeeds = await db.select().from(schema.questions).where(inArray(schema.questions.id, seedIds));
      for (const row of existingSeeds) {
        const def = DEFAULT_QUESTIONS.find((d) => d.id === row.id);
        if (!def) continue;
        const voteRows = await db.select({ voteType: schema.questionVotes.voteType }).from(schema.questionVotes).where(eq(schema.questionVotes.questionId, row.id));
        const realLikes = voteRows.filter((v) => v.voteType !== 'unlike').length;
        const realUnlikes = voteRows.filter((v) => v.voteType === 'unlike').length;
        const needsUpdate =
          row.authorName !== def.authorName ||
          !Array.isArray(row.tags) ||
          row.tags.length === 0 ||
          row.votesCount !== realLikes ||
          row.dislikesCount !== realUnlikes;
        if (needsUpdate) {
          await db
            .update(schema.questions)
            .set({
              authorName: def.authorName,
              tags: def.tags,
              votesCount: realLikes,
              dislikesCount: realUnlikes,
            })
            .where(eq(schema.questions.id, row.id));
        }
      }
    } catch (err) {
      mockCleaned = false;
      console.warn('Жишээ асуулт цэвэрлэх анхааруулга:', (err as Error).message);
    }
  }

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
        tags: q.tags,
        title: q.title,
        question: q.question,
        context: q.context,
        votesCount: 0,
        dislikesCount: 0,
      })),
    )
    .onConflictDoNothing();
}

export interface VoterInfo {
  userId: string;
  name: string;
  image: string | null;
  plan?: 'pro' | 'free';
}

/** Асуултуудыг Like/Unlike жагсаалт болон сэтгэгдлийн тоотой буцаана; includeInsights=true зөвхөн Pro багцад */
export async function fetchQuestionsFeed(
  db: DB,
  userId: string,
  opts: { tag?: string | null; sort?: string; includeInsights?: boolean; followedTags?: string[] } = {},
) {
  await ensureQuestionsSeeded(db);

  const sortOrder =
    opts.sort === 'newest'
      ? [desc(schema.questions.createdAt)]
      : [desc(schema.questions.votesCount), desc(schema.questions.createdAt)];

  const rows = await db
    .select({
      id: schema.questions.id,
      userId: schema.questions.userId,
      authorName: schema.questions.authorName,
      authorImage: schema.questions.authorImage,
      category: schema.questions.category,
      tags: schema.questions.tags,
      title: schema.questions.title,
      question: schema.questions.question,
      context: schema.questions.context,
      votesCount: schema.questions.votesCount,
      dislikesCount: schema.questions.dislikesCount,
      clusterId: schema.questions.clusterId,
      personaScores: schema.questions.personaScores,
      aiAnalysis: schema.questions.aiAnalysis,
      refinedVariant: schema.questions.refinedVariant,
      relatedQuestionIds: schema.questions.relatedQuestionIds,
      triggerStyle: schema.questions.triggerStyle,
      abGroup: schema.questions.abGroup,
      abVariantLabel: schema.questions.abVariantLabel,
      analyzedAt: schema.questions.analyzedAt,
      createdAt: schema.questions.createdAt,
      commentsCount: sql<number>`(select count(*)::int from question_comments qc where qc.question_id = ${schema.questions.id})`,
    })
    .from(schema.questions)
    .orderBy(...sortOrder);

  const allVotes = await db.select().from(schema.questionVotes);
  const allCommentOutcomes = await db
    .select({ questionId: schema.questionComments.questionId, outcome: schema.questionComments.outcome })
    .from(schema.questionComments);

  const outcomesByQ = new Map<string, { closed: number; meeting: number; rejected: number }>();
  for (const c of allCommentOutcomes) {
    if (!c.outcome) continue;
    const entry = outcomesByQ.get(c.questionId) ?? { closed: 0, meeting: 0, rejected: 0 };
    if (c.outcome === 'closed') entry.closed += 1;
    else if (c.outcome === 'meeting') entry.meeting += 1;
    else if (c.outcome === 'rejected') entry.rejected += 1;
    outcomesByQ.set(c.questionId, entry);
  }
  const proIds = await getProUserIds([
    ...rows.map((r) => r.userId),
    ...allVotes.map((v) => v.userId),
  ]);
  const likesByQ = new Map<string, VoterInfo[]>();
  const unlikesByQ = new Map<string, VoterInfo[]>();
  const myVoteByQ = new Map<string, 'like' | 'unlike'>();

  for (const v of allVotes) {
    const info: VoterInfo = {
      userId: v.userId,
      name: v.voterName || v.userId.split('@')[0] || 'Хэрэглэгч',
      image: v.voterImage ?? null,
      plan: proIds.has(v.userId.toLowerCase()) ? 'pro' : 'free',
    };
    if (v.voteType === 'unlike') {
      const arr = unlikesByQ.get(v.questionId) ?? [];
      arr.push(info);
      unlikesByQ.set(v.questionId, arr);
    } else {
      const arr = likesByQ.get(v.questionId) ?? [];
      arr.push(info);
      likesByQ.set(v.questionId, arr);
    }
    if (v.userId === userId) {
      myVoteByQ.set(v.questionId, v.voteType === 'unlike' ? 'unlike' : 'like');
    }
  }

  const tagFilter = opts.tag?.replace(/^#/, '').trim().toLowerCase();
  const followedSet = new Set((opts.followedTags ?? []).map((t) => t.replace(/^#/, '').trim().toLowerCase()));
  const filtered = tagFilter && tagFilter !== 'all'
    ? tagFilter === 'following'
      ? followedSet.size === 0
        ? []
        : rows.filter((r) => Array.isArray(r.tags) && r.tags.some((t) => followedSet.has(t.toLowerCase())))
      : rows.filter((r) => Array.isArray(r.tags) && r.tags.some((t) => t.toLowerCase() === tagFilter))
    : rows;

  return filtered.map((r) => {
    const likedBy = likesByQ.get(r.id) ?? [];
    const unlikedBy = unlikesByQ.get(r.id) ?? [];
    const base = {
      id: r.id,
      userId: r.userId,
      authorName: r.authorName,
      authorImage: r.authorImage,
      authorPlan: (proIds.has(r.userId.toLowerCase()) ? 'pro' : 'free') as 'pro' | 'free',
      category: r.category,
      tags: Array.isArray(r.tags) ? r.tags : [],
      title: r.title,
      question: r.question,
      context: r.context,
      votesCount: r.votesCount,
      dislikesCount: r.dislikesCount,
      commentsCount: r.commentsCount,
      triggerStyle: r.triggerStyle ?? null,
      abGroup: r.abGroup ?? null,
      abVariantLabel: r.abVariantLabel ?? null,
      outcomes: outcomesByQ.get(r.id) ?? { closed: 0, meeting: 0, rejected: 0 },
      userVote: myVoteByQ.get(r.id) ?? null,
      likedBy,
      unlikedBy,
      createdAt: r.createdAt,
    };
    if (!opts.includeInsights) return base;
    return {
      ...base,
      clusterId: r.clusterId,
      personaScores: r.personaScores,
      aiAnalysis: r.aiAnalysis,
      refinedVariant: r.refinedVariant,
      relatedQuestionIds: r.relatedQuestionIds,
      analyzedAt: r.analyzedAt,
    };
  });
}

/** Шинээр орсон ганц асуултыг тэр дор нь векторжуулан хамгийн ойр кластер ба Persona-тай холбох */
export async function enrichNewQuestion(db: DB, q: Question) {
  try {
    const tagStr = Array.isArray(q.tags) ? q.tags.join(' ') : '';
    const text = `[${q.category}] ${tagStr} ${q.title}. ${q.question} ${q.context ?? ''}`;
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
    const aiAnalysis = `${topP.personaName} төрөлд (${topP.score}%) тохирох шинэ асуулт.`;

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
    console.warn('Шинэ асуулт боловсруулахад алдаа гарлаа:', (err as Error).message);
  }
}

/** Кластер болон асуултуудын бүрэн тайлангийн өгөгдлийг буцаах (Зөвхөн Pro багц) */
export async function getClustersReport(db: DB, userId: string) {
  await ensureQuestionsSeeded(db);

  let clusters = await db.select().from(schema.questionClusters).orderBy(desc(schema.questionClusters.avgVotes));
  if (clusters.length === 0) {
    await runQuestionIntelligence(db, false);
    clusters = await db.select().from(schema.questionClusters).orderBy(desc(schema.questionClusters.avgVotes));
  }

  const questions = await fetchQuestionsFeed(db, userId, { includeInsights: true });

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
