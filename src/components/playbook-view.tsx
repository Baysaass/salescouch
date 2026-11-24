'use client';

import { useMemo, useState } from 'react';
import {
  BookMarked,
  Check,
  Copy,
  ExternalLink,
  Flame,
  HelpCircle,
  Lightbulb,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Workflow,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  CLOSING_TECHNIQUES,
  DIFFERENTIATORS,
  PLAYBOOK_CHECKLIST,
  PLAYBOOK_META,
  PLAYBOOK_PERSONAS,
  PLAYBOOK_PRODUCTS,
  QUESTION_GROUPS,
  REFERRAL_SCRIPT,
  RENEWAL_STAGES,
  THIRTY_DAY_PLAN,
  VERIFICATION_CHECKPOINTS,
  type PlaybookPersona,
} from '@/lib/playbook';
import type { ContactDTO } from './types';
import { ApplyBar } from './apply-bar';
import { clsx } from './clsx';

interface Props {
  query: string;
  contacts: ContactDTO[];
  selectedContactId: string | null;
  onApply: (contactId: string, text: string) => void;
}

type Tab = 'overview' | 'products' | 'questions' | 'personas' | 'closing';

export function PlaybookView({ query, contacts, selectedContactId, onApply }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [activePersonaId, setActivePersonaId] = useState<string>('persona-1');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  const selectedPersona: PlaybookPersona = useMemo(() => {
    return PLAYBOOK_PERSONAS.find((p) => p.id === activePersonaId) ?? PLAYBOOK_PERSONAS[0];
  }, [activePersonaId]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Top Banner / Subnav */}
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-panel px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
            <BookMarked className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold text-ink">{PLAYBOOK_META.title}</h1>
              <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-medium text-brand">
                {PLAYBOOK_META.author}
              </span>
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] text-ink-3">
                {PLAYBOOK_META.version.split('/')[1]?.trim() || 'v2.0'}
              </span>
            </div>
            <p className="text-[12.5px] text-ink-3">{PLAYBOOK_META.unit}</p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 rounded-xl bg-canvas p-1 border border-line">
          {[
            { id: 'overview', label: 'Тойм & Ялгарал' },
            { id: 'products', label: 'Бүтээгдэхүүн → Үнэ цэнэ' },
            { id: 'questions', label: 'Асуултын сан' },
            { id: 'personas', label: 'Persona & Скрипт' },
            { id: 'closing', label: 'Хаалт & Сунгалт' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as Tab)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                activeTab === t.id ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[880px] px-8 py-8">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-7">
              {/* Promise card */}
              <div className="rounded-2xl border border-brand/20 bg-brand-soft/40 p-6">
                <div className="flex items-center gap-2 text-brand">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-[12.5px] font-semibold uppercase tracking-wider">Миний амлалт харилцагчдаа (1 өгүүлбэр)</span>
                </div>
                <p className="mt-2 text-[17px] font-medium leading-snug text-ink">
                  "{PLAYBOOK_META.promise}"
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-brand">
                  <span className="rounded-full bg-white/80 px-2.5 py-1 border border-brand/20">3 минутад гэрээ</span>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 border border-brand/20">~3 өдөрт нөхөн төлбөр</span>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 border border-brand/20">~98% олголт</span>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 border border-brand/20">Сүлжээ 4 эмчтэй</span>
                </div>
              </div>

              {/* Differentiators */}
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight text-ink">Бид юугаар ялгардаг вэ (3 гол нотолгоо)</h2>
                <p className="mt-1 text-[13px] text-ink-3">Өрсөлдөгчөөс давуу талаа батлах албан ёсны нотолгоо ба сэтгэл зүйн зарчим</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {DIFFERENTIATORS.map((d) => (
                    <div key={d.id} className="rounded-xl border border-line bg-panel p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-[12.5px] font-semibold text-ink">
                            #{d.id}
                          </span>
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            {d.psychology}
                          </span>
                        </div>
                        <h3 className="mt-3 text-[14.5px] font-semibold text-ink leading-snug">{d.title}</h3>
                        <p className="mt-2 text-[13px] text-ink-2 leading-relaxed">{d.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules to follow */}
              <div className="rounded-xl border border-line bg-panel p-5">
                <h3 className="text-[15px] font-semibold text-ink">Бөглөхдөө болон харилцахдаа баримтлах 5 дүрэм</h3>
                <ul className="mt-3 space-y-2.5">
                  {PLAYBOOK_META.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
                        {idx + 1}
                      </span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS TO VALUE */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[18px] font-semibold text-ink">Хэсэг 1. Бүтээгдэхүүн → Үнэ цэнэ</h2>
                <p className="mt-1 text-[13px] text-ink-3">
                  Бүтээгдэхүүний онцлог (Feature)-ийг харилцагчийн ашиг тус (Benefit) ба сэтгэл зүйн триггер болгон хөрвүүлэх матриц
                </p>
              </div>

              <div className="space-y-4">
                {PLAYBOOK_PRODUCTS.map((p, idx) => (
                  <div key={idx} className="rounded-xl border border-line bg-panel p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                      <div>
                        <span className="text-[15.5px] font-semibold text-ink">{p.product}</span>
                        <span className="ml-2 text-xs text-ink-3">· Зорилтот: {p.target}</span>
                      </div>
                      <span className="rounded-md bg-brand-soft px-2.5 py-1 text-[11.5px] font-medium text-brand">
                        {p.trigger}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 text-[13px]">
                      <div className="rounded-lg bg-canvas p-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Хаах эрсдэл</span>
                        <p className="mt-1 font-medium text-ink">{p.risk}</p>
                      </div>
                      <div className="rounded-lg bg-canvas p-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Feature (Үйлчилгээ)</span>
                        <p className="mt-1 text-ink-2">{p.feature}</p>
                      </div>
                      <div className="rounded-lg bg-canvas p-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Which Means (Энэ нь юу гэсэн үг вэ)</span>
                        <p className="mt-1 text-ink-2">{p.whichMeans}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50/60 border border-amber-200/50 p-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">Benefit (Үр өгөөж)</span>
                        <p className="mt-1 font-medium text-amber-950">{p.benefit}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: QUESTION BANK */}
          {activeTab === 'questions' && (
            <div className="space-y-7">
              <div>
                <h2 className="text-[18px] font-semibold text-ink">Хэсэг 2. Асуултын сан ба Баталгаажуулалт</h2>
                <p className="mt-1 text-[13px] text-ink-3">Харилцагчийн нөхцөл, хэрэгцээ, сэтгэл зүйн эрсдэлийг илрүүлэх бэлэн асуултууд</p>
              </div>

              {/* Groups */}
              <div className="space-y-5">
                {QUESTION_GROUPS.map((grp, idx) => (
                  <div key={idx} className="rounded-xl border border-line bg-panel p-5">
                    <h3 className="text-[15px] font-semibold text-ink flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-brand" />
                      {grp.category}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {grp.questions.map((qText, qIdx) => (
                        <div key={qIdx} className="group flex items-start justify-between gap-3 rounded-lg bg-canvas p-3 text-[13.5px]">
                          <p className="text-ink-2 leading-relaxed flex-1">{qText}</p>
                          <button
                            onClick={() => handleCopy(qText)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-3 hover:text-brand"
                            title="Хуулах"
                          >
                            {copiedText === qText ? <Check className="h-4 w-4 text-brand" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Verification checkpoints */}
              <div className="rounded-xl border border-line bg-panel p-5">
                <h3 className="text-[15px] font-semibold text-ink">[ ] Тэмдэглэгээ ба Баталгаажуулах хугацаа (SLA)</h3>
                <p className="mt-1 text-xs text-ink-3">Зохиож хариулж болохгүй мэдээллийг хэнээс, ямар хугацаанд тодруулах стандарт</p>
                <div className="mt-3 divide-y divide-line text-[13px]">
                  {VERIFICATION_CHECKPOINTS.map((v, idx) => (
                    <div key={idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[12px] font-mono font-medium text-brand">
                          {v.tag}
                        </code>
                        <span className="font-medium text-ink">{v.what}</span>
                      </div>
                      <span className="text-xs text-ink-3 sm:text-right">{v.whoAndWhen}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PERSONAS & SCRIPTS */}
          {activeTab === 'personas' && (
            <div className="space-y-6">
              {/* Persona selector tabs */}
              <div className="flex flex-wrap gap-2">
                {PLAYBOOK_PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePersonaId(p.id)}
                    className={clsx(
                      'rounded-xl border px-4 py-2.5 text-left transition-all',
                      activePersonaId === p.id
                        ? 'border-brand bg-brand-soft text-brand shadow-sm font-medium'
                        : 'border-line bg-panel text-ink hover:bg-stone-50',
                    )}
                  >
                    <span className="block text-[14px]">{p.name.split(':')[0]}</span>
                    <span className="block text-[11.5px] opacity-80">{p.psychologyTrigger}</span>
                  </button>
                ))}
              </div>

              {/* Selected Persona detail */}
              <div className="space-y-6">
                {/* Persona Header Info */}
                <div className="rounded-xl border border-line bg-panel p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div>
                      <h2 className="text-[17px] font-semibold text-ink">{selectedPersona.name}</h2>
                      <p className="text-xs text-brand font-medium mt-0.5">{selectedPersona.segmentProductChannel}</p>
                    </div>
                    <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs text-ink-2 font-mono">
                      {selectedPersona.psychologyTrigger}
                    </span>
                  </div>

                  <p className="mt-3 text-[13.5px] text-ink-2 leading-relaxed bg-canvas p-3 rounded-lg">
                    <strong>Нөхцөл:</strong> {selectedPersona.context}
                  </p>

                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2 text-[12.5px]">
                    <div className="rounded-lg border border-line p-2.5">
                      <span className="text-ink-3">Нас & Алба:</span> <span className="font-medium text-ink">{selectedPersona.demographics.ageAndRole}</span>
                    </div>
                    <div className="rounded-lg border border-line p-2.5">
                      <span className="text-ink-3">Хөрөнгө / Үнэ:</span> <span className="font-medium text-ink">{selectedPersona.demographics.asset}</span>
                    </div>
                    <div className="rounded-lg border border-line p-2.5">
                      <span className="text-ink-3">Төсөв:</span> <span className="font-medium text-ink">{selectedPersona.demographics.budget}</span>
                    </div>
                    <div className="rounded-lg border border-line p-2.5">
                      <span className="text-ink-3">Шийдвэр гаргагч:</span> <span className="font-medium text-ink">{selectedPersona.demographics.decisionMaker}</span>
                    </div>
                  </div>
                </div>

                {/* 9-Step Dialogue Script */}
                <div className="rounded-xl border border-line bg-panel p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-line">
                    <h3 className="text-[15.5px] font-semibold text-ink">Анхны харилцан яриа (Алхам 1–9)</h3>
                    <span className="text-xs text-ink-3">Мөр бүр 1 асуултаар төгсөнө</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedPersona.dialogue.map((step) => (
                      <div key={step.step} className="rounded-xl border border-line/70 bg-white p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11.5px] font-semibold text-ink">
                            Алхам {step.step}: {step.label}
                          </span>
                          <button
                            onClick={() => handleCopy(step.advisorLine)}
                            className="text-xs text-ink-3 hover:text-brand flex items-center gap-1"
                          >
                            {copiedText === step.advisorLine ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
                            Хуулах
                          </button>
                        </div>

                        {/* Advisor line */}
                        <div className="flex items-start gap-2 text-[13.5px]">
                          <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand shrink-0 mt-0.5">
                            Зөвлөх
                          </span>
                          <p className="text-ink font-medium leading-relaxed">{step.advisorLine}</p>
                        </div>

                        {/* Client response */}
                        <div className="flex items-start gap-2 text-[13px] bg-canvas p-2.5 rounded-lg">
                          <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[11px] font-semibold text-ink-3 shrink-0 mt-0.5">
                            Харилцагч
                          </span>
                          <p className="text-ink-2 leading-relaxed">{step.clientLine}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Branching (Салаа яриа) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-emerald-800">
                      А. Сонирхож байвал
                    </span>
                    <p className="mt-2 text-[12.5px] text-ink-2"><strong>Харилцагч:</strong> {selectedPersona.branches.interested.client}</p>
                    <p className="mt-2 text-[13px] text-emerald-950 font-medium"><strong>Зөвлөх:</strong> {selectedPersona.branches.interested.advisor}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-amber-800">
                      Б. Эргэлзэж байвал
                    </span>
                    <p className="mt-2 text-[12.5px] text-ink-2"><strong>Харилцагч:</strong> {selectedPersona.branches.hesitant.client}</p>
                    <p className="mt-2 text-[13px] text-amber-950 font-medium"><strong>Зөвлөх:</strong> {selectedPersona.branches.hesitant.advisor}</p>
                  </div>
                </div>

                {/* 3 Common Objections (Response Planner) */}
                <div className="rounded-xl border border-line bg-panel p-5">
                  <h3 className="text-[15.5px] font-semibold text-ink">Түгээмэл 3 татгалзал: Response Planner</h3>
                  <div className="mt-4 space-y-3">
                    {selectedPersona.objections.map((obj, oIdx) => (
                      <div key={oIdx} className="rounded-xl border border-line bg-canvas p-4 text-[13px] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-brand text-[14px]">{obj.objection}</span>
                          <span className="text-xs text-ink-3">Шалтгаан: {obj.underlyingCause}</span>
                        </div>
                        <p className="text-ink-2"><strong>Тодруулах асуулт:</strong> {obj.clarifyingQuestion}</p>
                        <p className="text-ink font-medium bg-white p-2.5 rounded-lg border border-line">
                          <strong>Хариулт:</strong> {obj.response}
                        </p>
                        <p className="text-xs text-brand font-medium">↳ Дараагийн алхам: {obj.nextStep}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Action & CRM Notes */}
                <div className="rounded-xl border border-line bg-panel p-5 text-[13px] space-y-2">
                  <p><strong>Дараагийн алхам стандарт:</strong> {selectedPersona.nextAction}</p>
                  <p className="text-ink-2"><strong>CRM-д баталгаажсан:</strong> {selectedPersona.crmConfirmed}</p>
                  <p className="text-ink-3"><strong>CRM-д дараа тодруулах:</strong> {selectedPersona.crmToClarify}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CLOSING & RENEWAL */}
          {activeTab === 'closing' && (
            <div className="space-y-7">
              <div>
                <h2 className="text-[18px] font-semibold text-ink">Хэсэг 4. Close, Follow-up, Сунгалт</h2>
                <p className="mt-1 text-[13px] text-ink-3">Гэрээг баталгаажуулах, тасралтгүй сунгах болон referral авах стандартууд</p>
              </div>

              {/* 4 Closing types */}
              <div className="rounded-xl border border-line bg-panel p-5">
                <h3 className="text-[15.5px] font-semibold text-ink">Хаалтын 4 хэлбэр ба скрипт</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {CLOSING_TECHNIQUES.map((c, idx) => (
                    <div key={idx} className="group rounded-xl border border-line bg-canvas p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[13.5px] font-semibold text-ink">{c.type}</span>
                          <span className="rounded bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">{c.principle}</span>
                        </div>
                        <p className="mt-2 text-[13.5px] font-medium text-ink leading-relaxed">{c.script}</p>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => handleCopy(c.script)}
                          className="text-xs text-ink-3 hover:text-brand flex items-center gap-1"
                        >
                          {copiedText === c.script ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
                          Хуулах
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Referral & Follow-up */}
              <div className="rounded-xl border border-line bg-panel p-5 space-y-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">Referral (Зөвлөмж) асуух скрипт</h3>
                  <div className="mt-2 rounded-xl bg-canvas p-3.5 border border-line text-[13.5px] text-ink font-medium leading-relaxed">
                    {REFERRAL_SCRIPT.script}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Follow-up стандарт</h4>
                  <p className="mt-1 text-[13px] text-ink-2 leading-relaxed bg-stone-50 p-3 rounded-lg border border-line">
                    {REFERRAL_SCRIPT.followupStandard}
                  </p>
                </div>
              </div>

              {/* Renewal Timeline (45, 30, 14, 7 хоног) */}
              <div className="rounded-xl border border-line bg-panel p-5">
                <h3 className="text-[15.5px] font-semibold text-ink">Гэрээ сунгалтын стандарт хуваарь</h3>
                <div className="mt-4 divide-y divide-line text-[13px]">
                  {RENEWAL_STAGES.map((r, idx) => (
                    <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="sm:w-1/3">
                        <span className="font-semibold text-brand">{r.timing}</span>
                        <p className="text-xs text-ink-3 mt-0.5">{r.principle}</p>
                      </div>
                      <div className="sm:w-2/3">
                        <p className="text-ink font-medium">{r.action}</p>
                        <p className="text-xs text-ink-2 mt-0.5">Зорилго: {r.goal}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 30 Day action plan & Checklist */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-panel p-5">
                  <h3 className="text-[15px] font-semibold text-ink">30 хоногийн Action Plan</h3>
                  <div className="mt-3 space-y-3 text-[12.5px]">
                    {THIRTY_DAY_PLAN.map((p, idx) => (
                      <div key={idx} className="rounded-lg bg-canvas p-3 border border-line">
                        <p className="font-semibold text-ink">{p.action}</p>
                        <p className="text-ink-2 mt-1">Турших: {p.target}</p>
                        <p className="text-brand font-medium mt-0.5">Хэмжих: {p.metric}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-panel p-5">
                  <h3 className="text-[15px] font-semibold text-ink">Өөрийгөө шалгах хуудас</h3>
                  <ul className="mt-3 space-y-2 text-[13px]">
                    {PLAYBOOK_CHECKLIST.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-ink-2">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Apply to Active Contact's Coach Chat */}
      <div className="shrink-0 border-t border-line bg-panel p-4 px-8">
        <ApplyBar
          contacts={contacts}
          defaultContactId={selectedContactId}
          label="Сонгосон харилцагчийн коуч чатад ажиллуулах"
          onApply={(cId) => {
            const prompt = `Sales Playbook-ийн дагуу зөвлөгөө авъя. Одоогийн сонгосон хэсэг: "${
              activeTab === 'personas' ? selectedPersona.name : activeTab === 'closing' ? 'Хаалт ба Сунгалт' : 'Борлуулалтын Playbook'
            }". Энэ харилцагчид зориулан тохирох скрипт, асуулт болон дараагийн алхмыг гаргаж өгнө үү.`;
            onApply(cId, prompt);
          }}
        />
      </div>
    </div>
  );
}
