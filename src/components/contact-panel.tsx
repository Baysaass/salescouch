'use client';

import { useState } from 'react';
import {
  AtSign, Briefcase, Building2, Globe, Loader2, Mail, MapPin, MessageCircle, MoreHorizontal,
  Pencil, Phone, Send, Share2, Sparkles, Trash2, Link2, Users,
} from 'lucide-react';
import type { ContactDTO } from './types';
import type { ContactChannels } from '@/db/schema';
import { Avatar, gmailComposeUrl } from './ui';
import { ContactFormModal } from './contact-form';
import { CHANNEL_FIELDS, PERSONA_FIELDS, STAGE_LABELS, TEMPERATURE_LABELS } from '@/lib/labels';
import { clsx } from './clsx';

function glyph(t: string) {
  const G = ({ className }: { className?: string }) => (
    <span className={clsx('inline-flex items-center justify-center rounded-[4px] border border-current text-[8.5px] font-bold leading-none', className)}>{t}</span>
  );
  return G;
}
const Facebook = glyph('f');
const Instagram = glyph('ig');
const Linkedin = glyph('in');

const CHANNEL_ICON: Record<keyof ContactChannels, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  telegram: Send,
  whatsapp: MessageCircle,
  website: Globe,
  other: Link2,
};

function channelHref(key: keyof ContactChannels, v: string) {
  if (/^https?:\/\//.test(v)) return v;
  const handle = v.replace(/^@/, '');
  switch (key) {
    case 'facebook': return `https://facebook.com/${handle.replace(/^facebook\.com\//, '')}`;
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'linkedin': return v.includes('linkedin.com') ? `https://${v}` : `https://linkedin.com/in/${handle}`;
    case 'telegram': return `https://t.me/${handle}`;
    case 'website': return `https://${v}`;
    default: return null;
  }
}

interface Props {
  contact: ContactDTO;
  aiEnabled: boolean;
  onSaved: (c: ContactDTO) => void;
  onShare?: () => void;
  onDelete: () => void;
}

export function ContactPanel({ contact, aiEnabled, onSaved, onShare, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) onSaved(await res.json());
  };

  const genPersona = async () => {
    setGenerating(true);
    setErr(null);
    const res = await fetch(`/api/contacts/${contact.id}/persona`, { method: 'POST' });
    const data = await res.json().catch(() => null);
    setGenerating(false);
    if (!res.ok) return setErr(data?.error || 'Persona үүсгэж чадсангүй');
    onSaved(data);
  };

  const rows: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null; href?: string }[] = [
    { icon: Building2, label: 'Байгууллага', value: contact.company },
    { icon: Briefcase, label: 'Албан тушаал', value: contact.role },
    { icon: Phone, label: 'Утас', value: contact.phone, href: contact.phone ? `tel:${contact.phone.replace(/\s/g, '')}` : undefined },
    { icon: AtSign, label: 'Имэйл', value: contact.email, href: contact.email ? gmailComposeUrl(contact.email) : undefined },
    { icon: MapPin, label: 'Хаяг', value: contact.address },
  ];
  const channels = CHANNEL_FIELDS.filter((f) => contact.channels?.[f.key]);
  const personaRows = PERSONA_FIELDS.filter((f) => contact.persona?.[f.key]);

  return (
    <aside className="scroll-thin w-[360px] shrink-0 overflow-y-auto px-6 pb-8 pt-7">
      <div className="flex flex-col items-center text-center">
        <Avatar name={contact.fullName} size={68} />
        <h2 className="mt-3 text-[21px] font-semibold tracking-tight">{contact.fullName}</h2>
        {(contact.role || contact.company) && <p className="text-[13.5px] text-ink-2">{[contact.role, contact.company].filter(Boolean).join(' · ')}</p>}

        <div className="relative mt-4 flex gap-3">
          <ActionBtn title="Залгах" href={contact.phone ? `tel:${contact.phone.replace(/\s/g, '')}` : undefined}><Phone className="h-[18px] w-[18px]" /></ActionBtn>
          <ActionBtn title="Gmail" href={gmailComposeUrl(contact.email)}><Mail className="h-[18px] w-[18px]" /></ActionBtn>
          <ActionBtn title="Засах" onClick={() => setEditing(true)}><Pencil className="h-[18px] w-[18px]" /></ActionBtn>
          {contact.isOwner !== false && onShare && (
            <ActionBtn title="Бусдад хуваалцах" onClick={onShare}><Share2 className="h-[18px] w-[18px]" /></ActionBtn>
          )}
          <ActionBtn title="Бусад" onClick={() => setMenu((v) => !v)}><MoreHorizontal className="h-[18px] w-[18px]" /></ActionBtn>
          {menu && (
            <div className="absolute right-0 top-12 z-20 w-52 rounded-xl border border-line bg-white p-1 text-left shadow-lg">
              <button onClick={() => { setMenu(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-rose-600 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" />
                {contact.isOwner === false ? 'Миний жагсаалтаас хасах' : 'Харилцагч устгах'}
              </button>
            </div>
          )}
        </div>
      </div>

      {contact.isOwner === false && contact.sharedBy && (
        <div className="mt-5 rounded-xl border border-emerald-200/80 bg-brand-soft/60 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-brand">
            <Share2 className="h-3.5 w-3.5" />
            <span>Тантай хуваалцсан харилцагч</span>
          </div>
          <p className="mt-1 text-ink">
            Илгээсэн: <span className="font-medium">{contact.sharedBy.name || contact.sharedBy.email}</span>{' '}
            <span className="text-ink-2">({contact.sharedBy.email})</span>
          </p>
          {contact.sharedBy.note && (
            <p className="mt-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-ink-2">{contact.sharedBy.note}</p>
          )}
        </div>
      )}

      {contact.isOwner !== false && (contact.sharedWith?.length ?? 0) > 0 && (
        <div className="mt-5 rounded-xl border border-line bg-canvas/35 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
              <Users className="h-3.5 w-3.5 text-brand" />
              Хуваалцсан (<span className="tabular-nums">{contact.sharedWith!.length}</span>)
            </span>
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="text-xs font-medium text-brand hover:underline"
              >
                Удирдах
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {contact.sharedWith!.map((s) => (
              <span
                key={s.userId}
                className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11px] font-medium text-ink"
              >
                {s.name || s.email}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <select value={contact.stage} onChange={(e) => patch({ stage: e.target.value })} className="h-9 rounded-lg border border-line bg-white px-2 text-[13px] outline-none">
          {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={contact.temperature} onChange={(e) => patch({ temperature: e.target.value })} className="h-9 rounded-lg border border-line bg-white px-2 text-[13px] outline-none">
          {Object.entries(TEMPERATURE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <Section title="Холбоо барих">
        {rows.map((r) => (
          <Row key={r.label} icon={r.icon} label={r.label}>
            {r.value ? (
              r.href ? <a href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="hover:text-brand">{r.value}</a> : r.value
            ) : (
              <button onClick={() => setEditing(true)} className="text-ink-3 hover:text-ink-2">Нэмэх…</button>
            )}
          </Row>
        ))}
      </Section>

      <Section title="Холбогдох сувгууд">
        {channels.length === 0 && <button onClick={() => setEditing(true)} className="text-[14px] text-ink-3 hover:text-ink-2">+ Суваг нэмэх</button>}
        {channels.map((f) => {
          const v = contact.channels[f.key]!;
          const href = channelHref(f.key, v);
          return (
            <Row key={f.key} icon={CHANNEL_ICON[f.key]} label={f.label}>
              {href ? <a href={href} target="_blank" rel="noreferrer" className="hover:text-brand">{v}</a> : v}
            </Row>
          );
        })}
      </Section>

      <Section
        title="Persona"
        action={
          <button onClick={genPersona} disabled={generating} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-brand hover:bg-brand-soft disabled:opacity-60">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Автоматаар бөглөх
          </button>
        }
      >
        {err && <p className="text-xs text-rose-600">{err}</p>}
        {personaRows.length === 0 && <p className="text-[13.5px] text-ink-3">Persona хоосон байна. Засах эсвэл автоматаар бөглөнө үү.</p>}
        {personaRows.map((f) => (
          <div key={f.key}>
            <p className="text-[12.5px] text-ink-3">{f.label}</p>
            <p className="whitespace-pre-wrap text-[14px] leading-snug">{contact.persona[f.key]}</p>
          </div>
        ))}
      </Section>

      <Section title="Тэмдэглэл">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (contact.notes ?? '') && patch({ notes })}
          rows={4}
          placeholder="Тэмдэглэл бичих… (коуч үүнийг харгалзана)"
          className={clsx('w-full resize-y rounded-xl border border-line px-3.5 py-3 text-[14px] outline-none placeholder:text-ink-3 focus:border-[#c9ccd3]')}
        />
      </Section>

      {editing && (
        <ContactFormModal
          initial={contact}
          onClose={() => setEditing(false)}
          onCreated={(c) => {
            onSaved(c);
            setNotes(c.notes ?? '');
            setEditing(false);
          }}
        />
      )}
    </aside>
  );
}

function ActionBtn({ title, onClick, href, children }: { title: string; onClick?: () => void; href?: string; children: React.ReactNode }) {
  const cls = 'flex h-11 w-12 items-center justify-center rounded-xl bg-[#f2f3f5] text-ink-2 hover:bg-[#e7e8ec] hover:text-ink';
  if (href) return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" title={title} aria-label={title} className={cls}>{children}</a>;
  return <button type="button" title={title} aria-label={title} onClick={onClick} className={cls}>{children}</button>;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13.5px] text-ink-2">{title}</h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-[14px]">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
      <span className="w-[104px] shrink-0 text-ink-2">{label}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}
