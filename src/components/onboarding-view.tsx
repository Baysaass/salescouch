'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  GraduationCap,
  Lightbulb,
  MessageSquareShare,
  PhoneCall,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { ContactDTO } from './types';
import { ApplyBar } from './apply-bar';
import { clsx } from './clsx';

interface Props {
  query?: string;
  contacts: ContactDTO[];
  selectedContactId: string | null;
  onApply: (contactId: string, text: string) => void;
  onNavigateToQuestions?: () => void;
}

type Tab = 'checklist' | 'blueprint' | 'standards' | 'mistakes' | 'scripts';

const ONBOARDING_STEPS = [
  {
    id: 'step-1',
    title: 'Практикал Даатгалын гол ялгарал ба амлалттай танилцах',
    desc: 'Салбар луу очихгүйгээр утсаараа 3 минутад даатгуулах, тохиолдол гарвал онлайнаар ~3 өдөрт нөхөн төлбөрөө авах дижитал амлалтыг цээжлэх.',
    tag: 'Суурь ойлголт',
  },
  {
    id: 'step-2',
    title: '3 гол бүтээгдэхүүний үнэ цэнэ, хамгаалалтыг нүдлэх',
    desc: 'Хялбар даатгал (тогтмол 200,000₮), Ухаалаг жолооч (100% хамгаалалт), Ажилтны гэнэтийн осол (байгууллагын эрсдэл).',
    tag: 'Бүтээгдэхүүн',
  },
  {
    id: 'step-3',
    title: 'Sales Playbook-ийн 3 худалдан авагчийн Persona-г судлах',
    desc: 'Гүйцэтгэх захирал (Цаг хугацаа), Санхүүгийн менежер (Зардал), Клубын жолооч (Эвдрэл, бодит хамгаалалт).',
    tag: 'Сэтгэл зүй',
  },
  {
    id: 'step-4',
    title: 'Асуултын банкнаас 5 шилдэг Discovery асуултыг сонгож бэлтгэх',
    desc: 'SPIN болон BANT асуултууд дээр хамт олны туршлага, комментуудыг уншиж дадлага хийх.',
    tag: 'Асуултын банк',
  },
  {
    id: 'step-5',
    title: 'Эхний 5 бодит харилцагчаа системд бүртгэх',
    desc: 'Харилцагч нэмээд AI Coach-оос шууд тохирох бүтээгдэхүүн, ярианы эхлэл, имэйл нооргийг бэлтгүүлэх.',
    tag: 'Дадлага',
  },
  {
    id: 'step-6',
    title: '1-Click төлбөрийн линк илгээх хаалтын техникийг турших',
    desc: '«Би одоо чатаар төлбөрийн линк явуулчих уу, та утсаараа 2 минутад баталгаажуулчих уу?» скриптийг хэрэглэж үзэх.',
    tag: 'Хаалт',
  },
  {
    id: 'step-7',
    title: 'Анхны 10 дуудлага / уулзалт хийж 15 минутын дүрмээр follow-up илгээх',
    desc: 'Дуудлага дууссанаас хойш 15 минутын дотор 1 хуудас харьцуулалт ба баталгаажуулах холбоосоо чатаар хүргэх.',
    tag: 'Үр дүн',
  },
];

const WEEKS = [
  {
    week: '1-р долоо хоног (Day 1–7)',
    title: 'Суурь мэдлэг & Бүтээгдэхүүний сан',
    goal: 'Практикал даатгалын бүх нөхцөл, хураамж, дижитал сувгуудыг өөрийн болгож, өдөрт 5 харилцагч олох.',
    tasks: [
      'Playbook v2.0-ийн 3 Persona болон ялгарах 5 давуу талыг унших',
      'Бүтээгдэхүүний цэсээс Хялбар, Ухаалаг, Гэр бүл даатгалын хураамж, нөхөн төлбөрийг харьцуулах',
      'AI Coach дээр өдөрт 3 удаа BANT, SPIN, AIDA аргуудаар симуляци хийж үзэх',
      'Өөрийн танил, ойрын хүрээллээс 15 харилцагчийн мэдээллийг оруулж Persona үүсгэх',
    ],
    kpi: '15 харилцагч системд оруулсан, 0 алдаатай бүтээгдэхүүний шалгалт өгсөн байх',
  },
  {
    week: '2-р долоо хоног (Day 8–14)',
    title: 'Дуудлага ба Хэрэгцээ илрүүлэх дадлага',
    goal: 'Асуултын банкны асуултуудыг бодит харилцан ярианд туршиж, өвдөлтийг нь 70% яриулах.',
    tasks: [
      'Асуултын банкнаас хамгийн өндөр Vote-той 3 асуултаар өдөрт 10 дуудлага хийх',
      '«Өөр газар даатгалтай» гэсэн татгалзал бүр дээр «Юуг нь сайжруулмаар байна?» гэж асуух',
      'Дуудлага бүрийн дараа харилцагчийн тэмдэглэл (Notes)-д одоогийн даатгагч, хугацааг бичих',
      'Хамт олныхоо коммент хэсэгт өөрт ажилласан туршлагаасаа 1-2 сэтгэгдэл бичиж хуваалцах',
    ],
    kpi: 'Өдөрт 10+ бодит холбоо тогтоосон байх, 3 харилцагчтай гүнзгий хэрэгцээ ярилцсан байх',
  },
  {
    week: '3-р долоо хоног (Day 15–21)',
    title: 'Санал илгээх ба Хаалтын техник',
    goal: '15 минутын дүрмийг ягштал баримталж, 1-click төлбөрийн линкээр анхны борлуулалтуудаа хаах.',
    tasks: [
      'Яриа дууссанаас хойш 15 минутын дотор Gmail эсвэл чатаар тооцоолсон саналыг илгээх',
      'Үнийн эсэргүүцэл дээр «Зөрүүг 12 сард хуваахад өдөрт 1,000₮ хүрэхгүй» гэсэн тооцоог үзүүлэх',
      'Хаалтын асуулт тавих: «Төлбөрийн холбоосыг одоо илгээчихье, та 2 минутад шийдэх үү?»',
      'Эхний амжилттай борлуулалтаа бүртгэж баталгаажуулах',
    ],
    kpi: 'Анхны 2–3 бодит даатгалын гэрээг баталгаажуулж, төлбөрийн линкээр шийдүүлсэн байх',
  },
  {
    week: '4-р долоо хоног (Day 22–30)',
    title: 'Бие даах, Сунгалт & Referral авах',
    goal: 'Сэтгэл ханамжтай харилцагчдаасаа 2+ шинэ танилцуулга (Referral) авч, борлуулалтын хурдаа нэмэх.',
    tasks: [
      'Даатгуулсан харилцагчдад 7 хоногийн дараа залгаж сэтгэл ханамжийг нь лавлах',
      'Referral скрипт ашиглах: «Таны адил цагаа хэмнэж найдвартай хамгаалуулах 2 найзынхаа дугаарыг хуваалцаач»',
      'Сунгалтын харилцагчдын хугацаа дуусахаас 14 хоногийн өмнө сануулах жагсаалт бэлтгэх',
      'Сар тутмын борлуулалтын дүнгээ дүгнэж, дараа сарын төлөвлөгөөгөө гаргах',
    ],
    kpi: '5+ бие даасан борлуулалт хаасан, 3+ найдвартай referral цуглуулсан байх',
  },
];

const MISTAKES = [
  {
    title: '1. Хэт эрт үнэ хэлэх',
    desc: 'Харилцагчтай мэндлээд л "Манай Хялбар даатгал 200,000₮ байгаа" гэж шууд хэлэх. Харилцагч үнэ цэнийг ойлгоогүй үед 20,000₮ ч үнэтэй санагддаг.',
    fix: 'Эхлээд өвдөлтийг нь тодруулж, "Тохиолдол гарахад өдрийн ажлаа алдахгүй онлайнаар 3 өдөрт шийдүүлэх нь танд чухал уу?" гэж асуух.',
  },
  {
    title: '2. Өөрөө 80% яриад харилцагчаа сонсохгүй байх',
    desc: 'Даатгалын компаниа, шагналаа, олон салбараа тоочиж магтах. Харилцагчид компанийн түүх биш өөрийнх нь эрсдэл л чухал.',
    fix: 'SPIN асуулт ашиглан харилцагчаа 70% яриул. Та зөвхөн оношилж, тохирох эмчилгээг (даатгалыг) бичиж өгөх эмч шиг бай.',
  },
  {
    title: '3. Татгалзлыг "эсэргүүцэл" гэж хүлээн авч маргах',
    desc: 'Харилцагч "Өөр газар даатгалтай" гэхэд "Тэр компани чинь нөхөн төлбөрөө өгдөггүй шүү дээ" гэж өрсөлдөгчөө муулах.',
    fix: 'Шууд дэмжээд: "Маш сайн байна! Та тэр даатгалынхаа юунд нь хамгийн сэтгэл хангалуун байдаг вэ, сайжруулмаар зүйл байгаа юу?" гэж сэтгэл зүйн асуулт тавих.',
  },
  {
    title: '4. Төлбөрийн линк өгөхгүй "Салбар дээр очоод хийгээрэй" гэх',
    desc: 'Харилцагч сонирхоод зөвшөөрсөн байхад "Та манай төв салбар дээр бичиг баримттайгаа очоорой" гэж залхуурлыг нь хөдөлгөх.',
    fix: '1-Click дүрэм: "Би одоо чатаар төлбөрийн холбоос явуулчихья, та 2 минутад утсаараа баталгаажуулчих" гэж шууд хаах.',
  },
  {
    title: '5. Follow-up хийхгүй хаях (80% борлуулалт 5+ хүрэлтээр шийдэгддэг)',
    desc: 'Нэг удаа санал явуулаад хариу бичихгүй болохоор "Сонирхохгүй байгаа юм байна" гээд мартдаг.',
    fix: '15 минутын дүрмээр эхний мэдээллээ явуулаад, 2 дахь өдөр нь шинэ кэйс/жишээ илгээж эелдэгээр лавлаж холбогдох.',
  },
  {
    title: '6. Баталгаажуулах шалгуурыг (BANT) тодруулахгүй цаг алдах',
    desc: 'Шийдвэр гаргах эрхгүй, эсвэл машин нь 2 сарын дараа зарагдах гэж байгаа хүнтэй 1 цаг ярилцаж цагаа үрэх.',
    fix: 'Эхний 5 минутад "Эцсийн шийдвэрийг та шууд гаргах уу?" гэж асууж шийдвэр гаргагчийг мэдэж авах.',
  },
];

const QUICK_SCRIPTS = [
  {
    title: 'Утсаар эхлэх эхний 15 секундийн скрипт',
    script:
      'Сайн байна уу, [Харилцагчийн нэр] ээ? Таны энэ өдрийн ажилд амжилт хүсье. Бид жолооч, харилцагчдадаа салбар дээр очих шаардлагагүйгээр утсаараа 3 минутад даатгуулаад, тохиолдол гарвал цахимаар 3 өдөрт нөхөн төлбөрөө авах боломж олгож байгаа юм. Та одоогийн тээврийн хэрэгслийн даатгалаа ийм шуурхай цахим нөхцөлөөр шинэчлэхийг сонирхох уу?',
  },
  {
    title: '«Өөр газар даатгалтай» гэх үед хэлэх скрипт',
    script:
      'Маш сайн байна аа! Таны хувьд одоогийн даатгалынхаа яг ямар нөхцөл, үйлчилгээнд нь хамгийн сэтгэл хангалуун байдаг вэ? Мөн хэрэв сайжруулах боломж байвал юуг нь өөрчилмөөр байна?',
  },
  {
    title: 'Хаалтын скрипт (1-Click төлбөрийн линк)',
    script:
      'Танд салбар дээр очиж бичиг баримт авч очих ямар ч шаардлага байхгүй. Би одоо таны чат руу төлбөрийн найдвартай баталгаажуулах холбоос илгээчихье, та утаснаасаа 2 минутад баталгаажуулчих уу?',
  },
];

export function OnboardingView({ query = '', contacts, selectedContactId, onApply, onNavigateToQuestions }: Props) {
  const [tab, setTab] = useState<Tab>('checklist');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('insurtech_onboarding_checks');
      if (saved) setCompletedSteps(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('insurtech_onboarding_checks', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetChecklist = () => {
    setCompletedSteps([]);
    try {
      localStorage.removeItem('insurtech_onboarding_checks');
    } catch {}
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  const q = query.trim().toLowerCase();
  const filteredSteps = useMemo(
    () => (q ? ONBOARDING_STEPS.filter((s) => `${s.title} ${s.desc} ${s.tag}`.toLowerCase().includes(q)) : ONBOARDING_STEPS),
    [q],
  );
  const filteredWeeks = useMemo(
    () => (q ? WEEKS.filter((w) => `${w.week} ${w.title} ${w.goal} ${w.tasks.join(' ')} ${w.kpi}`.toLowerCase().includes(q)) : WEEKS),
    [q],
  );
  const filteredMistakes = useMemo(
    () => (q ? MISTAKES.filter((m) => `${m.title} ${m.desc} ${m.fix}`.toLowerCase().includes(q)) : MISTAKES),
    [q],
  );
  const filteredScripts = useMemo(
    () => (q ? QUICK_SCRIPTS.filter((s) => `${s.title} ${s.script}`.toLowerCase().includes(q)) : QUICK_SCRIPTS),
    [q],
  );

  const progressPercent = Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Top Banner */}
      <div className="border-b border-line bg-panel px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-ink">Борлуулалтын Onboarding</h1>
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                  Practical Sales Academy
                </span>
              </div>
              <p className="text-[13px] text-ink-2">
                Шинэ борлуулагчийг 30 хоногт бие даасан дижитал зөвлөх болгох суурь зааварчилгаа & стандарт
              </p>
            </div>
          </div>

          {/* Progress Widget */}
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-2.5 shadow-sm">
            <div className="text-right">
              <p className="text-xs text-ink-3">Таны Onboarding явц</p>
              <p className="text-sm font-bold text-brand">
                {completedSteps.length} / {ONBOARDING_STEPS.length} алхам ({progressPercent}%)
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-brand/20 bg-brand-soft">
              <span className="text-xs font-bold text-brand">{progressPercent}%</span>
            </div>
            {completedSteps.length > 0 && (
              <button
                onClick={resetChecklist}
                title="Явц цэвэрлэх"
                className="rounded-lg p-1.5 text-ink-3 hover:bg-panel hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 flex gap-1 overflow-x-auto border-t border-line/60 pt-3">
          {[
            { id: 'checklist', label: '7 Алхамт Checklist', icon: CheckCircle2 },
            { id: 'blueprint', label: '30 Хоногийн хөтөлбөр', icon: Calendar },
            { id: 'standards', label: 'Өдөр тутмын стандарт', icon: ShieldCheck },
            { id: 'mistakes', label: 'Зайлсхийх 6 алдаа', icon: Lightbulb },
            { id: 'scripts', label: 'Эхлэгчийн түргэн скрипт', icon: Sparkles },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id as Tab)}
                className={clsx(
                  'flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition-colors',
                  active ? 'bg-brand text-white shadow-sm' : 'text-ink-2 hover:bg-white hover:text-ink',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="scroll-thin flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[860px] space-y-6">
          {/* TAB 1: CHECKLIST */}
          {tab === 'checklist' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-brand/20 bg-gradient-to-r from-brand-soft/60 to-white p-5">
                <div className="flex items-start gap-3">
                  <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                  <div>
                    <h3 className="text-sm font-bold text-ink">Шинэ ажилтны баталгаажуулах 7 алхам</h3>
                    <p className="mt-1 text-xs text-ink-2">
                      Та алхам бүрийг биелүүлээд check хийнэ үү. Энэхүү явц таны броузер дээр автоматаар хадгалагдана.
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white">
                  <div className="h-full bg-brand transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <div className="space-y-3">
                {filteredSteps.map((s) => {
                  const idx = ONBOARDING_STEPS.findIndex((x) => x.id === s.id);
                  const done = completedSteps.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleStep(s.id)}
                      className={clsx(
                        'group flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition-all',
                        done ? 'border-brand/30 bg-brand-soft/20 text-ink' : 'border-line bg-white hover:border-brand/40',
                      )}
                    >
                      <div
                        className={clsx(
                          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors',
                          done ? 'border-brand bg-brand text-white' : 'border-line bg-panel group-hover:border-brand/50',
                        )}
                      >
                        {done && <CheckCircle2 className="h-4 w-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-brand">0{idx + 1}.</span>
                          <h4 className={clsx('text-[14px] font-semibold', done && 'line-through text-ink-3')}>{s.title}</h4>
                          <span className="ml-auto rounded-md bg-panel px-2 py-0.5 text-[11px] font-medium text-ink-2">{s.tag}</span>
                        </div>
                        <p className={clsx('mt-1 text-xs leading-relaxed', done ? 'text-ink-3' : 'text-ink-2')}>{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
                {!filteredSteps.length && <p className="py-6 text-center text-xs text-ink-3">Хайлтад тохирох алхам олдсонгүй.</p>}
              </div>

              {onNavigateToQuestions && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-center gap-3">
                    <MessageSquareShare className="h-5 w-5 text-brand" />
                    <div>
                      <p className="text-xs font-bold text-ink">Асуултын банк руу очих</p>
                      <p className="text-xs text-ink-2">Шилдэг Discovery асуултууд дээр хамт олноороо vote өгч, коммент бичээрэй.</p>
                    </div>
                  </div>
                  <button
                    onClick={onNavigateToQuestions}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                  >
                    Асуултын банк үзэх
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BLUEPRINT */}
          {tab === 'blueprint' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Calendar className="h-4 w-4 text-brand" />
                  30 Хоногийн амжилтын төлөвлөгөө
                </h3>
                <p className="mt-1 text-xs text-ink-2">
                  Энэхүү хөтөлбөрөөр явснаар 4 дэх долоо хоног гэхэд та өдөрт 1-2 бодит харилцагчийг цахимаар амжилттай хаах чадвартай болно.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredWeeks.map((w, idx) => (
                  <div key={idx} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                      <div>
                        <span className="text-xs font-bold text-brand">{w.week}</span>
                        <h4 className="text-base font-bold text-ink">{w.title}</h4>
                      </div>
                      <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">Зорилго: {w.goal}</span>
                    </div>

                    <div className="mt-3.5 space-y-2">
                      <p className="text-xs font-semibold text-ink-2">Хийх гол даалгаврууд:</p>
                      <ul className="space-y-1.5">
                        {w.tasks.map((t, tidx) => (
                          <li key={tidx} className="flex items-start gap-2 text-xs text-ink">
                            <span className="font-bold text-brand">•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-panel p-2.5">
                      <Award className="h-4 w-4 shrink-0 text-amber-600" />
                      <p className="text-xs font-medium text-ink">
                        <strong className="text-ink">Долоо хоногийн KPI:</strong> {w.kpi}
                      </p>
                    </div>
                  </div>
                ))}
                {!filteredWeeks.length && <p className="py-6 text-center text-xs text-ink-3">Хайлтад тохирох хөтөлбөр олдсонгүй.</p>}
              </div>
            </div>
          )}

          {/* TAB 3: STANDARDS */}
          {tab === 'standards' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
                  <div className="flex items-center gap-2 text-brand">
                    <Clock className="h-5 w-5" />
                    <h3 className="text-sm font-bold text-ink">15 Минутын алтан дүрэм</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-ink-2">
                    Утсаар эсвэл уулзалтаар ярилцсанаас хойш <strong>15 минутын дотор</strong> чатаар эсвэл имэйлээр:
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-ink">
                    <li>1 хуудас товч харьцуулалт</li>
                    <li>Хураамжийн тооцоо</li>
                    <li>1-Click төлбөрийн баталгаажуулах линкийг илгээх ёстой.</li>
                  </ul>
                  <div className="rounded-xl bg-brand-soft p-2.5 text-xs font-medium text-brand">
                    💡 Статистик: 15 минутад багтаж линк илгээхэд харилцагч шууд зөвшөөрөх магадлал 3.4 дахин өндөр байдаг.
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
                  <div className="flex items-center gap-2 text-brand">
                    <Zap className="h-5 w-5" />
                    <h3 className="text-sm font-bold text-ink">3 Минутын онлайн амлалт</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-ink-2">
                    «Та салбар дээр очиж дугаарлах шаардлагагүй, би чатаар 3 минутад гэрээг тань нээгээд баталгаажуулна.»
                  </p>
                  <div className="space-y-1.5 text-xs text-ink">
                    <p>• <strong>Activation Energy бууруулах:</strong> Хүмүүс бичиг цаас бүрдүүлэхээс залхдаг.</p>
                    <p>• <strong>Нөхөн төлбөрийн хурд:</strong> 7777-6677 дугаараар газар дээрээс зураг илгээгээд ~3 өдөрт цахимаар шийдүүлэх.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <PhoneCall className="h-4 w-4 text-brand" />
                  Дуудлагын стандарт бүтэц (Call Flow)
                </h3>
                <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-4">
                  <div className="rounded-xl border border-line bg-panel p-3">
                    <span className="font-bold text-brand">1. Эхлэл (15 сек)</span>
                    <p className="mt-1 text-ink-2">Мэндчилгээ + Дижитал үнэ цэнийн амлалт.</p>
                  </div>
                  <div className="rounded-xl border border-line bg-panel p-3">
                    <span className="font-bold text-brand">2. Оношилгоо (2 мин)</span>
                    <p className="mt-1 text-ink-2">SPIN асуултаар өвдөлт, өмнөх туршлагыг яриулах.</p>
                  </div>
                  <div className="rounded-xl border border-line bg-panel p-3">
                    <span className="font-bold text-brand">3. Санал (1 мин)</span>
                    <p className="mt-1 text-ink-2">Зөвхөн яг тохирох 1 бүтээгдэхүүний жишээ тооцоо.</p>
                  </div>
                  <div className="rounded-xl border border-line bg-panel p-3">
                    <span className="font-bold text-brand">4. Хаалт (30 сек)</span>
                    <p className="mt-1 text-ink-2">«Линкээ одоо чатаар илгээчих үү?»</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MISTAKES */}
          {tab === 'mistakes' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Шинэ борлуулагчийн гаргадаг 6 алдаа & Засах арга
                </h3>
                <p className="mt-1 text-xs text-ink-2">
                  Борлуулалт амжилтгүй болсон тохиолдлуудын 90% нь эдгээр алдаанаас үүдэлтэй байдаг.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredMistakes.map((m, idx) => (
                  <div key={idx} className="space-y-2.5 rounded-2xl border border-line bg-white p-4">
                    <h4 className="text-[13.5px] font-bold text-rose-600">{m.title}</h4>
                    <p className="text-xs leading-relaxed text-ink-2">
                      <strong>Алдаа:</strong> {m.desc}
                    </p>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                      <strong>✅ Засах арга:</strong> {m.fix}
                    </div>
                  </div>
                ))}
                {!filteredMistakes.length && <p className="col-span-full py-6 text-center text-xs text-ink-3">Хайлтад тохирох алдаа олдсонгүй.</p>}
              </div>
            </div>
          )}

          {/* TAB 5: SCRIPTS */}
          {tab === 'scripts' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Sparkles className="h-4 w-4 text-brand" />
                  Шинэ ажилтны бэлэн ярианы скриптүүд
                </h3>
                <p className="mt-1 text-xs text-ink-2">
                  Та шууд хуулаад ашиглах эсвэл харилцагчийн чат руу илгээж AI коучоор тооцоолол хийлгэх боломжтой.
                </p>
              </div>

              <div className="space-y-4">
                {filteredScripts.map((s, idx) => (
                  <div key={idx} className="space-y-2 rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-ink">{s.title}</h4>
                      <button
                        onClick={() => handleCopy(s.script)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink-2 hover:border-brand hover:text-brand"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedText === s.script ? 'Хуулагдлаа!' : 'Хуулах'}
                      </button>
                    </div>
                    <div className="rounded-xl bg-panel p-3 font-mono text-xs leading-relaxed text-ink">{s.script}</div>
                  </div>
                ))}
                {!filteredScripts.length && <p className="py-6 text-center text-xs text-ink-3">Хайлтад тохирох скрипт олдсонгүй.</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Apply Bar */}
      <div className="shrink-0 border-t border-line bg-panel px-6 py-3.5">
        <ApplyBar
          contacts={contacts}
          defaultContactId={selectedContactId}
          label="Харилцагч руу илгээж AI коучтай дадлага хийх"
          buttonText="Коуч чатад нээх"
          onApply={(cid) =>
            onApply(
              cid,
              `Би энэ харилцагч дээр Onboarding-ийн эхний дуудлагын дадлага хийж байна. Харилцагчийн нэр, үүрэгт тааруулан Практикалын 3 минутын дижитал даатгалын амлалтыг шингээсэн хамгийн сайн эхлэх асуулт, бүтээгдэхүүний жишээ тооцоог бэлдэж өгөөрэй.`,
            )
          }
        />
      </div>
    </div>
  );
}
