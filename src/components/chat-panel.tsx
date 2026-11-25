'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, Bot, Check, ChevronDown, Copy, Eraser, Mail, ShieldCheck, Sparkles, Square, UserPlus, X } from 'lucide-react';
import type { ContactDTO, MessageDTO } from './types';
import { Avatar, IconButton, gmailComposeUrl } from './ui';
import { clsx } from './clsx';
import { QUICK_ACTIONS, SKILLS, SKILL_MAP } from '@/lib/skills';

interface Props {
  contact: ContactDTO | null;
  messages: MessageDTO[];
  streaming: boolean;
  aiEnabled: boolean;
  onSend: (content: string, skill?: string | null) => void;
  onClear: () => void;
  onNewContact: () => void;
  onCancel?: () => void;
}

export function ChatPanel({ contact, messages, streaming, aiEnabled, onSend, onClear, onNewContact, onCancel }: Props) {
  const [text, setText] = useState('');
  const [skill, setSkill] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [text]);

  if (!contact) {
    return (
      <section className="flex min-w-0 flex-1 flex-col items-center justify-center p-8 text-center">
        <img
          src="/app-icon.png"
          alt="InsurTech Sales Coach"
          className="h-16 w-16 rounded-2xl shadow-sm object-cover"
        />
        <h2 className="mt-4 text-lg font-semibold">InsurTech Sales Coach</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-2">
          Харилцагч нэмж, түүний мэдээлэл, persona-д үндэслэн BANT, AIDA, SPIN зэрэг аргаар хэрхэн харилцахыг коучаасаа асуугаарай.
        </p>
        <button onClick={onNewContact} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600">
          <UserPlus className="h-4 w-4" /> Харилцагч нэмэх
        </button>
      </section>
    );
  }

  const submit = () => {
    if (!text.trim() || streaming) return;
    onSend(text.trim(), skill);
    setText('');
    setSkill(null);
  };

  const subtitle = [contact.role, contact.company].filter(Boolean).join(' · ') || contact.email || contact.phone || '';

  return (
    <section className="flex min-w-0 flex-1 flex-col border-r border-line">
      <header className="flex items-center gap-3 px-6 py-4">
        <Avatar name={contact.fullName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-medium">{contact.fullName}</p>
          <p className="truncate text-[13px] text-ink-2">{subtitle}</p>
        </div>
        <IconButton title="Gmail-ээр имэйл бичих" href={gmailComposeUrl(contact.email)}>
          <Mail className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton title="Чатын түүх цэвэрлэх" onClick={onClear}>
          <Eraser className="h-[18px] w-[18px]" />
        </IconButton>
      </header>

      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto px-6 pb-4">
        {messages.length === 0 ? (
          <EmptyChat contact={contact} aiEnabled={aiEnabled} onPick={(id) => onSend(SKILL_MAP[id].prompt, id)} disabled={streaming} />
        ) : (
          <div className="mx-auto max-w-[760px] space-y-5 pt-2">
            {messages.map((m) => (
              <Bubble key={m.id} m={m} contact={contact} />
            ))}
          </div>
        )}
      </div>

      <div className="px-6 pb-5">
        {messages.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-[760px] flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((id) => (
              <button
                key={id}
                disabled={streaming}
                onClick={() => onSend(SKILL_MAP[id].prompt, id)}
                className="h-7 rounded-full border border-line bg-white px-3 text-[12.5px] text-ink-2 hover:border-brand hover:text-brand disabled:opacity-50"
              >
                {SKILL_MAP[id].name}
              </button>
            ))}
          </div>
        )}

        <div className="relative mx-auto max-w-[760px] rounded-2xl border border-line bg-white px-4 pb-2.5 pt-3 focus-within:border-[#c9ccd3]">
          {skill && (
            <span className="mb-2 inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
              <Sparkles className="h-3 w-3" /> {SKILL_MAP[skill]?.name}
              <button onClick={() => setSkill(null)} aria-label="Skill арилгах">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`${contact.fullName.split(' ').slice(-1)[0]}-тэй хэрхэн харилцах талаар асуух…`}
            className="block w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-ink-3"
          />
          <div className="mt-2 flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink-2 hover:bg-hover"
              >
                <Sparkles className="h-4 w-4" /> Арга сонгох <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {pickerOpen && (
                <div className="scroll-thin absolute bottom-10 left-0 z-20 max-h-72 w-64 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-lg">
                  {SKILLS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSkill(s.id);
                        setPickerOpen(false);
                        if (!text.trim()) setText(s.prompt);
                        taRef.current?.focus();
                      }}
                      className="block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-hover"
                    >
                      <span className="block text-[13.5px] font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-ink-3">{s.short}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="ml-auto text-[11.5px] text-ink-3">Ухаалаг зөвлөх</span>
            {streaming ? (
              <button
                type="button"
                onClick={onCancel}
                className="ml-2 inline-flex h-8 items-center gap-1 rounded-full bg-rose-50 px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
                title="Зогсоох"
              >
                <Square className="h-3 w-3 fill-current" /> Зогсоох
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!text.trim()}
                aria-label="Илгээх"
                className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-600 disabled:bg-[#d5d8de]"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyChat({ contact, onPick, disabled }: { contact: ContactDTO; aiEnabled?: boolean; onPick: (id: string) => void; disabled: boolean }) {
  const cards = ['bant', 'spin', 'aida', 'cold-email', 'objection', 'persona'];
  return (
    <div className="mx-auto flex max-w-[620px] flex-col items-center pt-14 text-center">
      <img
        src="/bot-icon.png"
        alt="Sales Coach"
        className="h-16 w-16 rounded-2xl shadow-md object-cover"
      />
      <h3 className="mt-3 text-[17px] font-semibold">{contact.fullName}-д зориулсан борлуулалтын зөвлөх</h3>
      <p className="mt-1 text-sm text-ink-2">
        Харилцагчийн мэдээлэл, хэрэгцээнд үндэслэн ямар аргаар, юу санал болгохыг зөвлөнө.
      </p>
      <div className="mt-6 grid w-full grid-cols-2 gap-2.5 text-left">
        {cards.map((id) => {
          const s = SKILL_MAP[id];
          return (
            <button
              key={id}
              disabled={disabled}
              onClick={() => onPick(id)}
              className="rounded-xl border border-line p-3 text-left hover:border-brand hover:bg-brand-soft/40 disabled:opacity-50"
            >
              <span className="block text-[13.5px] font-medium">{s.name}</span>
              <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-ink-2">{s.prompt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bubble({ m, contact }: { m: MessageDTO; contact: ContactDTO }) {
  if (m.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <span className="mb-1 mr-1 text-xs text-ink-3">Та{m.skill && SKILL_MAP[m.skill] ? ` · ${SKILL_MAP[m.skill].name}` : ''}</span>
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-white">{m.content}</div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <img
        src="/bot-icon.png"
        alt="Sales Coach"
        className="mt-4 h-8 w-8 shrink-0 rounded-xl shadow-sm object-cover"
      />
      <div className="min-w-0 max-w-[88%]">
        <span className="mb-1 ml-1 block text-xs text-ink-3">Sales коуч</span>
        <div className="rounded-2xl bg-[#f2f3f5] px-4 py-3">
          {m.pending && !m.content ? (
            <span className="flex gap-1 py-1.5">
              <span className="dot h-1.5 w-1.5 rounded-full bg-ink-3" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-ink-3" />
              <span className="dot h-1.5 w-1.5 rounded-full bg-ink-3" />
            </span>
          ) : (
            <div className="md">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: (p) => <a {...p} target="_blank" rel="noreferrer" />,
                  pre: ({ children }) => <>{children}</>,
                  code: ({ className, children }) => {
                    const raw = String(children ?? '');
                    if (className?.includes('language-email')) return <EmailCard raw={raw} to={contact.email} />;
                    if (className) return <pre><code>{raw}</code></pre>;
                    return <code>{children}</code>;
                  },
                }}
              >
                {m.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailCard({ raw, to }: { raw: string; to: string | null }) {
  const [copied, setCopied] = useState(false);
  const lines = raw.replace(/\n$/, '').split('\n');
  const subjIdx = lines.findIndex((l) => /^(subject|гарчиг)\s*:/i.test(l.trim()));
  const subject = subjIdx >= 0 ? lines[subjIdx].split(':').slice(1).join(':').trim() : '';
  const body = (subjIdx >= 0 ? lines.slice(subjIdx + 1) : lines).join('\n').trim();

  return (
    <div className="not-prose my-2 overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Mail className="h-4 w-4 text-rose-500" />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{subject || 'Имэйлийн ноорог'}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(subject ? `${subject}\n\n${body}` : body);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-2 hover:bg-hover"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Хууллаа' : 'Хуулах'}
        </button>
        <a
          href={gmailComposeUrl(to, subject, body)}
          target="_blank"
          rel="noreferrer"
          className={clsx('inline-flex h-7 items-center gap-1 rounded-md bg-brand px-2.5 text-xs font-medium text-white no-underline hover:bg-brand-600')}
          style={{ color: 'white', textDecoration: 'none' }}
        >
          Gmail-д нээх
        </a>
      </div>
      <div className="whitespace-pre-wrap px-3 py-2.5 text-[13.5px] leading-relaxed">{body}</div>
    </div>
  );
}
