export type PersuasionStyleId =
  | 'auto'
  | 'curiosity'
  | 'loss_avoidance'
  | 'honesty'
  | 'contrast'
  | 'speed_ease'
  | 'specificity'
  | 'reciprocity';

export type CommentOutcomeId = 'meeting' | 'closed' | 'rejected' | 'insight';

export interface PersuasionStyleMeta {
  id: PersuasionStyleId;
  label: string;
  shortHint: string;
  mechanism: string;
  mnPhrases: string[];
  caveat: string;
  promptInstruction: string;
}

export const PERSUASION_STYLES: PersuasionStyleMeta[] = [
  {
    id: 'auto',
    label: 'Автомат (Persona-д тааруулж)',
    shortHint: 'Харилцагчийн нөхцөлд хамгийн тохирох хөшүүргийг сонгоно',
    mechanism: 'Contextual Fit',
    mnPhrases: ['Таны хувьд', 'Гол давуу тал нь'],
    caveat: 'Хуурамч яаравчлал, баримтгүй тоо ашиглахгүй.',
    promptInstruction: 'Харилцагчийн үе шат болон persona-д хамгийн тохирох сэтгэлзүйн хөшүүргийг сонгон байгалийн асуулт зохио.',
  },
  {
    id: 'curiosity',
    label: 'Сонирхол өдөөх',
    shortHint: 'Мэдээгүй нарийн зүйлийг нь хөндөж харилцагчаар асуулгах',
    mechanism: 'Information Gap (Sugarman / Caples)',
    mnPhrases: ['Та анзаарсан уу', 'Ихэнх хүмүүс орхигдуулдаг зүйл нь', 'Яг юу болдог вэ'],
    caveat: 'Төөрөгдүүлсэн нууцлал биш — дараа нь бодит ашиг тусыг шууд тайлбарла.',
    promptInstruction:
      'СОНИРХОЛ ӨДӨӨХ (Curiosity): "Ихэнх жолооч/компани анзаардаггүй...", "Яагаад...", "Ямар зүйл орхигддог вэ?" зэрэг мэдээллийн цоорхой үүсгэн харилцагч өөрөө сонирхож асуухаар эхлүүл.',
  },
  {
    id: 'loss_avoidance',
    label: 'Алдагдлаас сэргийлэх',
    shortHint: 'Хохирлын дараах зардлыг тодруулж урьдчилан хамгаалах',
    mechanism: 'Loss Avoidance (Kahneman & Tversky)',
    mnPhrases: ['Асуудал гарахын өмнө', 'Эрсдэлээс сэргийлэх', 'Алдахаас өмнө', 'Нэмэлт зардал гаргахгүй'],
    caveat: 'Хэзээ ч баримтгүй айлгахгүй — зөвхөн бодит тохиолдох боломжтой хохирлыг жишээл.',
    promptInstruction:
      'АЛДАГДЛААС СЭРГИЙЛЭХ (Loss Avoidance): Осол, саатал, зогсолтын бодит үр дагаврыг эвтэйхэн тодруулаад, хохирол гарахаас өмнө хэрхэн урьдчилан сэргийлэхийг асуултаар хөнд.',
  },
  {
    id: 'honesty',
    label: 'Шударга тодруулга',
    shortHint: 'Юуг даах ба юуг даахгүйг ил хэлж гүн итгэл төрүүлэх',
    mechanism: 'Honesty & Candour (Sugarman)',
    mnPhrases: ['Шударгаар хэлэхэд', 'Ямар тохиолдолд нөхөгдөхгүй вэ', 'Хэнд тохирох ба хэнд илүүц вэ'],
    caveat: 'Хуурамч сул тал биш, гэрээний бодит хязгаарлалт ба давуу талыг тэнцвэртэй дурд.',
    promptInstruction:
      'ШУДАРГА ТОДРУУЛГА (Honesty / Candour): Даатгалын жижиг үсэг ба татгалзах нөхцөлийг нуухгүй байх давуу талаа ашигла. "Ямар эрсдэлийг хамгаалаад, ямар зүйлийг хасах вэ гэдгийг одоо ил тод ярилцах уу?" өнгөөр асуулт зохио.',
  },
  {
    id: 'contrast',
    label: 'Харьцуулалт ба ялгаа',
    shortHint: 'Хуучин цаасан арга ба цахим шуурхай шийдлийг харьцуулах',
    mechanism: 'Contrast & Differentiation (Schwartz)',
    mnPhrases: ['Салбар луу явахын оронд', 'Зөвхөн хямд үнэ биш', 'Ялгаа нь юу вэ'],
    caveat: 'Өрсөлдөгчийг гүтгэж муулахгүй — зөвхөн бодит үйлчилгээний ялгаагаар харьцуул.',
    promptInstruction:
      'ХАРЬЦУУЛАЛТ БА ЯЛГАА (Contrast): Өрсөлдөгчийг муулахгүйгээр "Цаасаар олон хоног хүлээхийн оронд апп-аар хянах" эсвэл хураамж ба хасалтын бодит ялгааг харилцагч өөрөө харьцуулахаар асуулт зохио.',
  },
  {
    id: 'speed_ease',
    label: 'Хурд ба хялбар байдал',
    shortHint: '3 минут / 1 линк гэх мэт цаг хэмнэх бодит амар байдал',
    mechanism: 'Effort Reduction (Sugarman)',
    mnPhrases: ['Утсаараа 3 минутад', 'Салбарт очилгүй', 'Бичиг цаасгүйгээр', 'Ганц холбоосоор'],
    caveat: 'Хэрэв үнэхээр хэдэн өдөр шаарддаг гэрээ бол 3 минут гэж бүү амла — бодит хугацааг л хэл.',
    promptInstruction:
      'ХУРД БА ХЯЛБАР БАЙДАЛ (Speed & Ease): Харилцагчийн цаг зав, залхуурал/саадыг арилгахад төвлөр ("салбар дээр очихгүйгээр", "утаснаасаа 2-3 минутад").',
  },
  {
    id: 'specificity',
    label: 'Бодит тоо ба нотолгоо',
    shortHint: 'Тодорхой тоо, хугацаа, хасалтын хэмжээгээр баталгаажуулах',
    mechanism: 'Specificity & Proof (Hopkins / Ogilvy)',
    mnPhrases: ['Яг хэд хоногт', 'Бодит жишээн дээр', 'Өмнө ба дараа', 'Төсвийн яг хэдэн хувь'],
    caveat: 'Хуурамч статистик болон батлагдаагүй тоо зохиохыг хатуу хориглоно.',
    promptInstruction:
      'БОДИТ ТОО БА НОТОЛГОО (Specificity & Proof): Ерөнхий магтаал биш, бодит тооцоо, хасалтын хувь, нөхөн төлбөрийн ~3-7 хоногийн шийдвэрлэлт дээр тулгуурлан асуулт зохио.',
  },
  {
    id: 'reciprocity',
    label: 'Үнэ цэнэ ба туслалцаа',
    shortHint: 'Зарахаасаа өмнө үнэгүй харьцуулалт эсвэл тооцоо өгөх',
    mechanism: 'Reciprocity (Cialdini)',
    mnPhrases: ['Үнэгүй тооцоолуур', '1 хуудас харьцуулалт', 'Жишээ загвар илгээе'],
    caveat: 'Үнэгүй зүйл санал болгоод дараа нь нууц нөхцөл тулгахгүй.',
    promptInstruction:
      'ҮНЭ ЦЭНЭ БА ТУСЛАЛЦАА (Reciprocity): Шууд зарах гэж яарахгүйгээр үнэгүй 1 хуудас харьцуулалт, хураамжийн тооцоо эсвэл гэрээ шалгах зөвлөмж өгөхөөр эхэлдэг асуулт зохио.',
  },
];

export const PERSUASION_STYLE_MAP: Record<PersuasionStyleId, PersuasionStyleMeta> = Object.fromEntries(
  PERSUASION_STYLES.map((s) => [s.id, s]),
) as Record<PersuasionStyleId, PersuasionStyleMeta>;

export interface AwarenessStructureGuide {
  awarenessLevel: string;
  structureName: string;
  stepsMn: string;
  bestUse: string;
  primaryMetric: string;
  recommendedTriggers: PersuasionStyleId[];
}

export const AWARENESS_STRUCTURES: Record<string, AwarenessStructureGuide> = {
  low_problem: {
    awarenessLevel: 'Асуудлаа хараахан мэдээгүй / Шинэ сэрэмжлүүлэг (Low / Problem Aware)',
    structureName: 'Problem → Cost → Answer → Тодорхой CTA (эсвэл Question → Reveal → Proof → CTA)',
    stepsMn: '1) Харилцагчийн орчинд тохиолдох бодит асуулт/эрсдэл → 2) Тэр нь хэр их цаг/зардал дагуулдаг → 3) Шийдэх энгийн механизм → 4) Дарамтгүй 1 тодорхой алхам (NN/g).',
    bestUse: 'Хүйтэн эсвэл дөнгөж бүртгэгдсэн харилцагчийн эхний дуудлага, анхны имэйл/чат',
    primaryMetric: 'Хариу өгч яриа эхлүүлэх хувь (чанар)',
    recommendedTriggers: ['curiosity', 'loss_avoidance', 'reciprocity'],
  },
  solution: {
    awarenessLevel: 'Шийдэл хайж буй (Solution Aware)',
    structureName: 'Outcome → Mechanism → Proof → CTA (эсвэл Before → After → Why)',
    stepsMn: '1) Хүрэх үр дүн (жишээ нь 3 өдөрт онлайнаар нөхөн төлбөр) → 2) Яаж ингэж ажилладаг → 3) Бодит тоо/баримт → 4) Тооцоо харах CTA.',
    bestUse: 'Хэрэгцээ нь тодорхой болсон (Qualified) эсвэл цахим даатгал сонирхсон харилцагч',
    primaryMetric: 'Үнийн санал / тооцоолуур хүссэн уулзалт',
    recommendedTriggers: ['speed_ease', 'specificity', 'contrast'],
  },
  product_comparison: {
    awarenessLevel: 'Санал авсан / Өөр газартай харьцуулж буй (Product / Competitive Aware)',
    structureName: 'Specific Claim → Demonstration → Risk Reversal (эсвэл Comparison → Trade-off → CTA)',
    stepsMn: '1) Бодит ялгарал ба тодорхой нөхцөл → 2) Гэрээ/нөхөн төлбөрийн жишээг харуулах → 3) Шударгаар юуг даах ба юуг хасахыг (Trade-off / Honesty) тайлбарлах → 4) Баталгаажуулах алхам.',
    bestUse: 'Proposal ба Хэлэлцээр үе шат, мөн өөр даатгагчтай харьцуулж буй харилцагч',
    primaryMetric: 'Гэрээ хаах хувь ба урт хугацааны сунгалт',
    recommendedTriggers: ['honesty', 'contrast', 'specificity'],
  },
  most_aware_renewal: {
    awarenessLevel: 'Шийдвэр гаргахад бэлэн / Сунгалт дөхсөн (Most Aware)',
    structureName: 'Real Deadline → Reason → CTA',
    stepsMn: '1) Зөвхөн бодит хугацаа (жишээ нь одоогийн гэрээ дуусах өдөр, улирлын эрсдэл) → 2) Тасралтгүй хамгаалалтын шалтгаан → 3) 2 минутын төлбөр/сунгалтын холбоос.',
    bestUse: 'Сунгалт дөхсөн эсвэл гэрээ батлахад бэлэн Халуун харилцагч',
    primaryMetric: 'Гэрээ баталгаажилт ба сунгалтын хурд',
    recommendedTriggers: ['speed_ease', 'loss_avoidance', 'honesty'],
  },
};

/** Харилцагчийн үе шат (stage), температур ба гэрээний бодит огнооноос хамгийн тохирох Awareness бүтцийг сонгох */
export function getAwarenessCoachGuidance(
  stage: string,
  temperature: string,
  hasRealRenewalOrDeadline = false,
): AwarenessStructureGuide {
  if (hasRealRenewalOrDeadline || (stage === 'negotiation' && temperature === 'hot')) {
    return AWARENESS_STRUCTURES.most_aware_renewal;
  }
  if (stage === 'proposal' || stage === 'negotiation') {
    return AWARENESS_STRUCTURES.product_comparison;
  }
  if (stage === 'qualified' || temperature === 'warm') {
    return AWARENESS_STRUCTURES.solution;
  }
  return AWARENESS_STRUCTURES.low_problem;
}

export const ETHICAL_COPY_GUARDRAILS = [
  'Хуурамч яаравчлал хориглоно (Baymard/Cialdini): Бодит огноо, гэрээ дуусах хугацаа байхгүй бол "Өнөөдөр 17:00-д дуусна", "Зөвхөн өнөөдөр", "Сүүлийн 2 цаг" гэж зохиохгүй.',
  'Зохиомол хомсдол ба тоо баримт хориглоно (Hopkins/Caveat): "2 суудал үлдлээ", баталгаагүй % статистик эсвэл зөвшөөрөгдөөгүй хөнгөлөлт зохиохгүй.',
  'Гэрээний татгалзах нөхцөлийг нуухгүй (Sugarman Honesty): Ямар тохиолдолд нөхөгдөх, ямар зүйл хасагдахыг ил хэлэх нь даатгалд хамгийн өндөр итгэл төрүүлдэг.',
  'Бодит үр дүнгээр хэмжих (Guardrail): Зөвхөн хариу авсан/лайк дарсан тоо биш — бодит уулзалт товлосон эсэх, гэрээ хаасан эсэх, сунгалтын чанараар дүгнэнэ.',
];

export interface GuardrailWarning {
  code: string;
  message: string;
}

const GUARDRAIL_CHECKS: { code: string; pattern: RegExp; message: string }[] = [
  {
    code: 'fake_urgency',
    pattern: /(зөвхөн\s*өнөөдөр|өнөөдөр\s*дуусна|өнөө\s*орой\s*дуусна|сүүлийн\s*\d*\s*(минут|цаг)|хэдхэн\s*(минут|цаг)\s*үлдлээ|яг\s*одоо\s*хаагдана)/iu,
    message: 'Анхаар: Бодит гэрээний огноо эсвэл албан ёсны аян биш бол "зөвхөн өнөөдөр / хэдхэн минут үлдлээ" гэх мэт яаравчлал нь даатгалын итгэлийг бууруулдаг.',
  },
  {
    code: 'fake_scarcity',
    pattern: /(зөвхөн\s*\d+\s*(суудал|хүн|ширхэг|гэрээ)\s*(үлдлээ|байна)|суудал\s*дуусаж)/iu,
    message: 'Анхаар: Бодит хязгаарлалт байхгүй бол суудал эсвэл тоо ширхэгээр зохиомол дарамт үүсгэхээс зайлсхийнэ үү.',
  },
  {
    code: 'absolute_guarantee',
    pattern: /(100%\s*(баталгаа|төлнө|шийднэ|хамгаална)|бүх\s*эрсдэлийг\s*(ямар\s*ч\s*нөхцөлгүй|бүрэн)\s*төлнө|татгалзах\s*зүйл\s*огт\s*байхгүй)/iu,
    message: 'Анхаар: Даатгал бүр хасах нөхцөлтэй байдаг. "100% / ямар ч нөхцөлгүй" гэх амлалтын оронд бодит нөхцөл болон хасалтыг тодорхой бичнэ үү.',
  },
];

export function checkCopyGuardrails(text: string): GuardrailWarning[] {
  const clean = text.trim();
  if (!clean) return [];
  return GUARDRAIL_CHECKS.filter((c) => c.pattern.test(clean)).map((c) => ({
    code: c.code,
    message: c.message,
  }));
}

export interface QuestionBankDraft {
  id: string;
  title: string;
  triggerStyle: Exclude<PersuasionStyleId, 'auto'>;
  triggerLabel: string;
  awarenessLabel: string;
  question: string;
  context: string;
  tags: string[];
  abPairHint?: string;
}

/** Асуултын банкан дээр хэрэглэгч өөрөө шалгаж нийтлэхэд бэлэн сэтгэлзүйн загвар асуултууд (DB руу автоматаар ордоггүй) */
export const QUESTION_BANK_DRAFTS: QuestionBankDraft[] = [
  {
    id: 'draft-curiosity-auto',
    title: 'Сонирхол өдөөх: Ихэнх жолооч орхигдуулдаг эрсдэл',
    triggerStyle: 'curiosity',
    triggerLabel: 'Сонирхол өдөөх',
    awarenessLabel: 'Асуудал таниулах (Анхны яриа)',
    question:
      '«Та анзаарсан уу? Авто ослын дараа машин засуулах гэхээсээ илүү бичиг баримт бүрдүүлж, олон хоног унаагүй явах нь жолооч нарт хамгийн их дарамт болдог — танай одоогийн даатгал үүнийг хэр хурдан шийддэг вэ?»',
    context: 'Сонирхол өдөөгч асуултаар анхны яриаг нээж, цахим нөхөн төлбөрийн давуу тал руу хөтөлнө.',
    tags: ['автотээврийндаатгал', 'анхныдуудлага'],
  },
  {
    id: 'draft-loss-b2b',
    title: 'Алдагдлаас сэргийлэх: Тоног төхөөрөмж / Авто зогсолтын өртөг',
    triggerStyle: 'loss_avoidance',
    triggerLabel: 'Алдагдлаас сэргийлэх',
    awarenessLabel: 'Асуудлын үнийг харуулах',
    question:
      '«Хэрэв танай гол техник эсвэл түгээлтийн машин санамсаргүй шалтгаанаар 2 долоо хоног зогсвол өдөрт хэдий хэмжээний орлого, хүргэлтийн торгууль алдах тооцоо гарч байна вэ?»',
    context: 'Хураамжийг зардал биш, санамсаргүй зогсолтын өндөр алдагдлаас сэргийлэх хамгаалалт гэж ойлгуулна (Хувилбар Б: Алдагдлаас сэргийлэх).',
    tags: ['байгууллага', 'татгалзалдавах'],
    abPairHint: 'A/B Туршилтын санаа: Энэ асуултыг "Шударга тодруулга" асуулттай харьцуулан бодит гэрээ хаалтаар хэмжихэд тохиромжтой.',
  },
  {
    id: 'draft-honesty-claim',
    title: 'Шударга тодруулга: Хасах нөхцөлийг урьдчилан ил хэлэх',
    triggerStyle: 'honesty',
    triggerLabel: 'Шударга тодруулга',
    awarenessLabel: 'Эргэлзээ тайлах (Итгэлцэл)',
    question:
      '«Шударгаар хэлэхэд даатгал бүр юуг хамгаалах ба ямар тохиолдолд нөхөгдөхгүй вэ гэдэг заагтай байдаг. Манай нөхцөл яг юуг бүрэн хаагаад, ямар 2–3 зүйлийг хасдгийг танд одоо ил тод тайлбарлаад өгөх үү?»',
    context: 'Гэрээний жижиг үсэгнээс болгоомжилдог Монгол харилцагчийн эргэлзээг Sugarman-ий шударга тодруулгаар шууд задална (Хувилбар А: Ил тод итгэлцэл).',
    tags: ['нөхөнтөлбөр', 'татгалзалдавах'],
    abPairHint: 'A/B Туршилт: "Өнөөдөр дуусах хөнгөлөлт" гэх яаравчлалаас илүү гэрээ хаах магадлалыг баг дээр шалгаарай.',
  },
  {
    id: 'draft-contrast-renewal',
    title: 'Харьцуулалт: Зөвхөн хямд үнэ vs Цаг ба шил тольны хамгаалалт',
    triggerStyle: 'contrast',
    triggerLabel: 'Харьцуулалт ба ялгаа',
    awarenessLabel: 'Өрсөлдөгчтэй харьцуулах',
    question:
      '«Одоогийн даатгалаа сонгохдоо хураамжаас гадна шил/толь, жижиг сэв зураас хэдэн удаа ордог, нөхөн төлбөрөө салбар орохгүйгээр апп-аар хянаж болдог эсэхийг нь харьцуулж үзсэн үү?»',
    context: 'Өрсөлдөгчийг муулахгүйгээр бодит хамгаалалт ба цахим үйлчилгээний ялгааг өөрөөр нь хэлүүлнэ.',
    tags: ['сунгалт', 'автотээврийндаатгал'],
  },
  {
    id: 'draft-before-after-digital',
    title: 'Өмнө ба Дараа: 30 хоног цаас vs 3 өдрийн цахим шийдэл',
    triggerStyle: 'speed_ease',
    triggerLabel: 'Хурд ба хялбар байдал',
    awarenessLabel: 'Шийдэл танилцуулах',
    question:
      '«Өмнө нь осол гарахад ажлаа орхиж замын цагдаа, даатгалын салбар дамжиж хэдэн өдөр явдаг байсан бол — утсаараа зураг дараад 3 өдрийн дотор шийдүүлдэг болбол танд жилд хэдэн цаг хэмнэхээр байна вэ?»',
    context: 'Before → After → Why бүтцээр цахим даатгалын үнэ цэнийг бодитоор төсөөлүүлнэ.',
    tags: ['цахимдаатгал', 'хаалт'],
  },
  {
    id: 'draft-reciprocity-compare',
    title: 'Үнэ цэнэ түрүүлж өгөх: 1 хуудас харьцуулалт',
    triggerStyle: 'reciprocity',
    triggerLabel: 'Үнэ цэнэ ба туслалцаа',
    awarenessLabel: 'Хариу өгөхгүй / Бодъё гэх үед',
    question:
      '«Та одоо шууд шийдэх албагүй ээ — харин танай машины марк, үнэлгээн дээр яг таарсан 2 багцын харьцуулалтыг үнэгүй гаргаад чатаар үлдээчих үү? Дараа нь харьцуулахад амар байна байх.»',
    context: 'Дарамтгүй тусламж (Reciprocity) үзүүлснээр харилцагч татгалзалгүй зөвшөөрч, дараагийн утас/чатад хариулах магадлал өснө.',
    tags: ['үнэтэйбайна', 'хаалт'],
  },
  {
    id: 'draft-specificity-home',
    title: 'Бодит тоо: Орон сууц & Хөршийн хариуцлагын эрсдэл',
    triggerStyle: 'specificity',
    triggerLabel: 'Бодит тоо ба нотолгоо',
    awarenessLabel: 'Хэрэгцээ тодруулах (Орон сууц)',
    question:
      '«Усанд автах эсвэл доод айлд ус алдах ганц тохиолдол гарахад засварын зардал хэдэн сая төгрөгөөс эхэлдгийг бодоод үзвэл, сард аяга кофены үнээр өөрийн болон хөршийн эрсдэлээ хамтад нь хаах нь ямар санагдаж байна вэ?»',
    context: 'Хохирлын бодит хэмжээ ба жижиг сарын өртгийг (Mental Accounting) харьцуулж орон сууцны даатгал сонирхуулна.',
    tags: ['оронсууц', 'эрүүлмэнд'],
  },
  {
    id: 'draft-honesty-ab-price',
    title: 'Бодит CTA: Дараагийн алхмыг тодорхой болгох',
    triggerStyle: 'honesty',
    triggerLabel: 'Шударга тодруулга',
    awarenessLabel: 'Хэлцэл хаах (NN/g CTA)',
    question:
      '«Хэрэв одоогийн санал таны төсөвт хүнд тусаж байвал ямар нэг нууц хураамжгүйгээр зөвхөн гол 2 эрсдэлийг нь багтаасан хялбар хувилбарыг 2 минутад бодоод харуулах уу?»',
    context: '"Дэлгэрэнгүй" биш яг юу авахыг заасан (Information scent) зөөлөн хаалт ба төсвийн уян хатан тохируулга.',
    tags: ['үнэтэйбайна', 'татгалзалдавах'],
  },
];
