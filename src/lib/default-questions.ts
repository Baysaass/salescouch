export interface DefaultQuestion {
  id: string;
  title: string;
  category: 'discovery' | 'spin' | 'bant' | 'objection' | 'closing' | 'digital' | 'renewal';
  tags: string[];
  question: string;
  context: string;
  authorName: string;
  votesCount: number;
  dislikesCount: number;
}

export const SUGGESTED_HASHTAGS: { tag: string; color: string }[] = [
  { tag: 'автотээврийндаатгал', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { tag: 'татгалзалдавах', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { tag: 'хаалт', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { tag: 'цахимдаатгал', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { tag: 'сунгалт', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { tag: 'оронсууц', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { tag: 'эрүүлмэнд', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { tag: 'аялал', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { tag: 'анхныдуудлага', color: 'bg-lime-50 text-lime-800 border-lime-200' },
];

const TAG_COLOR_PALETTE = [
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-teal-50 text-teal-700 border-teal-200',
];

export function tagBadgeColor(tag: string): string {
  const clean = tag.replace(/^#/, '').toLowerCase();
  const preset = SUGGESTED_HASHTAGS.find((x) => x.tag === clean);
  if (preset) return preset.color;
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = (hash + clean.charCodeAt(i)) % TAG_COLOR_PALETTE.length;
  return TAG_COLOR_PALETTE[hash];
}

/** Текст доторх #хаштаг болон гараар сонгосон tag-уудыг цэвэрлэн нэгтгэнэ */
export function extractHashtags(text: string, manualTags: string[] = []): string[] {
  const set = new Set<string>();
  const add = (raw: string) => {
    const clean = raw
      .trim()
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_]/gu, '');
    if (clean.length >= 2 && clean.length <= 40) set.add(clean);
  };
  for (const t of manualTags) add(t);
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  for (const m of matches) add(m);
  return Array.from(set).slice(0, 8);
}

/** Анхны жишээ асуултууд (хуурамч like/коммент байхгүй — бүгд 0-ээс эхэлнэ) */
export const DEFAULT_QUESTIONS: DefaultQuestion[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    title: 'Өмнөх нөхөн төлбөрийн туршлагаас хэрэгцээ сөхөх',
    category: 'spin',
    tags: ['автотээврийндаатгал', 'нөхөнтөлбөр'],
    question: '«Та өмнө нь ямар нэг тохиолдлоор нөхөн төлбөр авах гээд салбар дээр очиж бичиг баримт бүрдүүлэхэд хэр их цаг алдаж байсан бэ?»',
    context: 'Харилцагч өмнөх даатгалынхаа хүнд суртал, цаг алдсаныг санах үед цахимаар 3 өдөрт шийддэг давуу талыг хэлэхэд илүү үнэ цэнтэй сонсогдоно.',
    authorName: 'Жишээ асуулт',
    votesCount: 0,
    dislikesCount: 0,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    title: '“Өөр газар даатгалтай” гэхэд эргүүлэх асуулт',
    category: 'objection',
    tags: ['татгалзалдавах', 'автотээврийндаатгал'],
    question: '«Маш сайн байна аа! Одоогийн даатгалынхаа яг ямар үйлчилгээнд нь хамгийн сэтгэл хангалуун байдаг вэ? Хэрэв сайжруулах зүйл байвал юуг нь өөрчилмөөр байна?»',
    context: 'Өрсөлдөгчийг шууд муулахгүйгээр харилцагчаас өөрөөс нь дутуу зүйлийг нь хэлүүлдэг асуулт.',
    authorName: 'Жишээ асуулт',
    votesCount: 0,
    dislikesCount: 0,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    title: '“Үнэтэй байна” гэхэд сард хувааж тайлбарлах арга',
    category: 'objection',
    tags: ['татгалзалдавах', 'үнэтэйбайна'],
    question: '«Төсвөө тооцож байгаа тань зөв өө. Хэрэв зөрүүг 12 сард хуваахад сард хэдхэн мянган төгрөг болох ч, тохиолдол гарахад таны ажлын өдрийг алдагдуулахгүй онлайнаар шийдэх нь үүнээс илүү хэмнэлт болж чадах уу?»',
    context: 'Нийт дүнг сард хувааж хөнгөлөлт мэдрүүлээд, алдах цагтай нь харьцуулна.',
    authorName: 'Жишээ асуулт',
    votesCount: 0,
    dislikesCount: 0,
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    title: 'Эцсийн шийдвэр гаргагчийг тодруулах',
    category: 'bant',
    tags: ['байгууллага', 'шийдвэргаргагч'],
    question: '«Хэрэв бид таны хүссэн нөхцөлийг тааруулж өгвөл та өөрөө шууд батлаад шийдэх үү, эсвэл гэр бүл/хамтрагчтайгаа зөвшилцөх шаардлагатай юу?»',
    context: 'Санал илгээхээс өмнө шийдвэр хэн дээр байгааг эвтэйхэн мэдэж авна.',
    authorName: 'Жишээ асуулт',
    votesCount: 0,
    dislikesCount: 0,
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    title: 'Утсаараа 2 минутад баталгаажуулах хаалтын асуулт',
    category: 'closing',
    tags: ['хаалт', 'цахимдаатгал'],
    question: '«Та салбар дээр бичиг баримт авч очих шаардлагагүй, би одоо чатаар төлбөрийн баталгаажуулах холбоосыг илгээчихье, та утаснаасаа 2 минутад баталгаажуулчих уу?»',
    context: 'Яриа эерэг төгсөх үед шууд холбоос өгч гэрээг хаах асуулт.',
    authorName: 'Жишээ асуулт',
    votesCount: 0,
    dislikesCount: 0,
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    title: 'Цахим даатгалын амлалтаар яриа эхлүүлэх',
    category: 'digital',
    tags: ['анхныдуудлага', 'цахимдаатгал'],
    question: '«Сайн байна уу! Бид салбар дээр очихгүйгээр утсаараа 3 минутад даатгуулаад, тохиолдол гарвал 3 өдөрт онлайнаар нөхөн төлбөрөө авах боломж олгож байгаа юм. Та даатгалаа ийм шуурхай нөхцөлөөр шинэчлэхийг сонирхох уу?»',
    context: 'Эхний 15 секундэд цаг хэмнэх бодит үнэ цэнийг хэлэхэд тохиромжтой.',
    authorName: 'Жишээ асуулт',
    votesCount: 0,
    dislikesCount: 0,
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    title: 'Гэрээ дуусахаас өмнө сунгалт санал болгох',
    category: 'renewal',
    tags: ['сунгалт', 'автотээврийндаатгал'],
    question: '«Таны даатгалын хугацаа 14 хоногийн дараа дуусахаар байна. Энэ жил осол гаргаагүй урамшуулал болон шуурхай цахим сунгалтын нөхцөлөөр шинэчилсэн саналаа одоо явуулах уу?»',
    context: 'Хугацаа дуусахаас 2 долоо хоногийн өмнө залгаж сунгалт авах асуулт.',
    authorName: 'Жишээ асуулт',
    votesCount: 0,
    dislikesCount: 0,
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    title: 'Гол эрсдэлийг нь харилцагчаар өөрөөр нь хэлүүлэх',
    category: 'discovery',
    tags: ['оронсууц', 'эрүүлмэнд'],
    question: '«Таны өдөр тутмын хөдөлгөөн эсвэл гэр орон, бизнест ямар гэнэтийн эрсдэл учирвал хамгийн их санхүүгийн дарамт үүсэхээр байна вэ?»',
    context: 'Хувь хүний өөрийнх нь санаа зовниж буй эрсдэлийг ил гаргаж тохирох хамгаалалтыг сонгоход ашиглана.',
    authorName: 'Жишээ асуулт',
    votesCount: 0,
    dislikesCount: 0,
  },
];
