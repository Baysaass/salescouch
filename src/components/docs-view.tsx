'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock, Copy, Lightbulb, ListOrdered, MessageSquareQuote, BookText } from 'lucide-react';
import { CATEGORY_LABELS, SKILLS, type SkillCategory } from '@/lib/skills';
import { SKILL_DOCS } from '@/lib/skill-docs';
import type { ContactDTO } from './types';
import { ApplyBar } from './apply-bar';
import { clsx } from './clsx';

interface Props {
  query: string;
  contacts: ContactDTO[];
  selectedContactId: string | null;
  onApply: (contactId: string, skillId: string) => void;
}

export function DocsView({ query, contacts, selectedContactId, onApply }: Props) {
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () => (q ? SKILLS.filter((s) => `${s.name} ${s.short} ${s.description} ${SKILL_DOCS[s.id]?.whenToUse ?? ''}`.toLowerCase().includes(q)) : SKILLS),
    [q],
  );
  const [activeId, setActiveId] = useState(SKILLS[0].id);
  const skill = SKILLS.find((s) => s.id === activeId) ?? SKILLS[0];
  const doc = SKILL_DOCS[skill.id];
  const cats = (Object.keys(CATEGORY_LABELS) as SkillCategory[]).filter((c) => list.some((s) => s.category === c));

  return (
    <div className="flex min-w-0 flex-1">
      <div className="scroll-thin w-[280px] shrink-0 overflow-y-auto border-r border-line px-3 pb-6 pt-5">
        <h2 className="px-2 text-[17px] font-semibold">Docs</h2>
        <p className="px-2 pb-2 text-[12.5px] text-ink-3">{SKILLS.length} арга · борлуулалтын playbook</p>
        {cats.map((c) => (
          <div key={c} className="mt-3">
            <p className="px-2 pb-1 text-[12px] font-medium uppercase tracking-wide text-ink-3">{CATEGORY_LABELS[c]}</p>
            {list
              .filter((s) => s.category === c)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className={clsx(
                    'block w-full rounded-lg px-2.5 py-2 text-left',
                    activeId === s.id ? 'bg-brand-soft' : 'hover:bg-[#f4f5f7]',
                  )}
                >
                  <span className={clsx('block text-[14px]', activeId === s.id ? 'font-medium text-brand' : 'text-ink')}>{s.name}</span>
                  <span className="block truncate text-[12px] text-ink-3">{s.short}</span>
                </button>
              ))}
          </div>
        ))}
        {!cats.length && <p className="px-2 py-4 text-sm text-ink-3">Тохирох арга олдсонгүй.</p>}
      </div>

      <article className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-10 pb-16 pt-9">
          <p className="text-[13px] text-ink-3">{CATEGORY_LABELS[skill.category]}</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{skill.name}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{skill.short}</p>
          <p className="mt-4 text-[15.5px] leading-relaxed">{skill.description}</p>

          {doc && (
            <div className="mt-5 flex gap-3 rounded-xl border border-line bg-[#f8f9fb] p-4">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <div>
                <p className="text-[13px] font-medium text-ink-2">Хэзээ хэрэглэх вэ</p>
                <p className="mt-0.5 text-[14.5px] leading-relaxed">{doc.whenToUse}</p>
              </div>
            </div>
          )}

          <Section icon={ListOrdered} title="Алхмууд">
            <ol className="space-y-3">
              {skill.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">{i + 1}</span>
                  <span className="pt-0.5 text-[15px] leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </Section>

          {doc && (
            <Section icon={BookText} title="Дэлгэрэнгүй тайлбар">
              <div className="space-y-3 text-[15px] leading-relaxed text-ink">
                {doc.details.map((d, i) => (
                  <p key={i}>{d}</p>
                ))}
              </div>
            </Section>
          )}

          {doc && doc.scripts.length > 0 && (
            <Section icon={MessageSquareQuote} title="Бэлэн скрипт, асуулт">
              <div className="space-y-2">
                {doc.scripts.map((s, i) => (
                  <ScriptRow key={i} text={s} />
                ))}
              </div>
            </Section>
          )}

          <Section icon={Lightbulb} title="Даатгалын жишээ">
            <p className="rounded-xl bg-amber-50 p-4 text-[14.5px] leading-relaxed text-amber-950">{skill.insuranceExample}</p>
          </Section>

          {doc && doc.mistakes.length > 0 && (
            <Section icon={AlertTriangle} title="Түгээмэл алдаа">
              <ul className="space-y-1.5">
                {doc.mistakes.map((m, i) => (
                  <li key={i} className="flex gap-2 text-[14.5px]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    {m}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="mt-10 rounded-2xl border border-line p-5">
            <p className="text-[14px] font-medium">Харилцагч дээр хэрэглэх</p>
            <p className="mb-3 mt-0.5 text-[13px] text-ink-3">Коуч сонгосон харилцагчийн мэдээлэл, persona, Practical-ийн бүтээгдэхүүнд тулгуурлан энэ аргаар хариулна.</p>
            <ApplyBar contacts={contacts} defaultContactId={selectedContactId} label="Чатад хэрэглэх" onApply={(cid) => onApply(cid, skill.id)} />
          </div>

          <p className="mt-6 text-xs text-ink-3">Эх сурвалж: {skill.source}</p>
        </div>
      </article>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 flex items-center gap-2 text-[16px] font-semibold">
        <Icon className="h-[18px] w-[18px] text-ink-2" /> {title}
      </h2>
      {children}
    </section>
  );
}

function ScriptRow({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-line px-4 py-3">
      <p className="flex-1 text-[14.5px] leading-relaxed">{text}</p>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="shrink-0 rounded-md p-1 text-ink-3 opacity-0 hover:bg-hover hover:text-ink group-hover:opacity-100"
        aria-label="Хуулах"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
