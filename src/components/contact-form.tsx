'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { ContactDTO } from './types';
import { CHANNEL_FIELDS, PERSONA_FIELDS, STAGE_LABELS, TEMPERATURE_LABELS } from '@/lib/labels';
import { clsx } from './clsx';
import { PRODUCTS } from '@/lib/products';

interface Props {
  initial?: ContactDTO;
  onClose: () => void;
  onCreated: (c: ContactDTO) => void;
}

const BASIC = [
  { key: 'fullName', label: 'Овог нэр *', placeholder: 'Б. Болд' },
  { key: 'company', label: 'Байгууллага', placeholder: 'Х ХХК' },
  { key: 'role', label: 'Албан тушаал', placeholder: 'Хүний нөөцийн менежер' },
  { key: 'email', label: 'Имэйл', placeholder: 'bold@company.mn' },
  { key: 'phone', label: 'Утас', placeholder: '+976 9911 2233' },
  { key: 'address', label: 'Хаяг', placeholder: 'Улаанбаатар, СБД ...' },
] as const;

type Tab = 'contact' | 'channels' | 'persona';

export function ContactFormModal({ initial, onClose, onCreated }: Props) {
  const [tab, setTab] = useState<Tab>('contact');
  const [basic, setBasic] = useState<Record<string, string>>(() =>
    Object.fromEntries(BASIC.map((f) => [f.key, (initial?.[f.key as keyof ContactDTO] as string | null) ?? ''])),
  );
  const [stage, setStage] = useState(initial?.stage ?? 'lead');
  const [temperature, setTemperature] = useState(initial?.temperature ?? 'warm');
  const [channels, setChannels] = useState<Record<string, string>>({ ...(initial?.channels as Record<string, string>) });
  const [persona, setPersona] = useState<Record<string, string>>({ ...(initial?.persona as Record<string, string>) });
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!basic.fullName.trim()) {
      setTab('contact');
      setError('Овог нэр заавал');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(initial ? `/api/contacts/${initial.id}` : '/api/contacts', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basic, stage, temperature, channels, persona, notes }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) return setError(data?.error || 'Хадгалж чадсангүй');
    onCreated(data);
  };

  const input = 'h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-[560px] flex-col rounded-2xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-[17px] font-semibold">{initial ? 'Харилцагч засах' : 'Шинэ харилцагч'}</h2>
          <button onClick={onClose} aria-label="Хаах" className="rounded-lg p-1.5 text-ink-2 hover:bg-hover">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-1 border-b border-line px-6">
          {(
            [
              ['contact', 'Холбоо барих'],
              ['channels', 'Сувгууд'],
              ['persona', 'Persona'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx('-mb-px border-b-2 px-3 py-2 text-sm', tab === id ? 'border-brand font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">
          {tab === 'contact' && (
            <div className="grid grid-cols-2 gap-3">
              {BASIC.map((f) => (
                <label key={f.key} className={clsx('block', f.key === 'fullName' || f.key === 'address' ? 'col-span-2' : '')}>
                  <span className="mb-1 block text-[13px] text-ink-2">{f.label}</span>
                  <input
                    autoFocus={f.key === 'fullName'}
                    value={basic[f.key]}
                    onChange={(e) => setBasic((b) => ({ ...b, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className={input}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-2">Үе шат</span>
                <select value={stage} onChange={(e) => setStage(e.target.value)} className={input}>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] text-ink-2">Сонирхол</span>
                <select value={temperature} onChange={(e) => setTemperature(e.target.value)} className={input}>
                  {Object.entries(TEMPERATURE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 block">
                <span className="mb-1 block text-[13px] text-ink-2">Тэмдэглэл</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
              </label>
            </div>
          )}

          {tab === 'channels' && (
            <div className="space-y-3">
              {CHANNEL_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-[13px] text-ink-2">{f.label}</span>
                  <input value={channels[f.key] ?? ''} onChange={(e) => setChannels((c) => ({ ...c, [f.key]: e.target.value }))} placeholder={f.placeholder} className={input} />
                </label>
              ))}
            </div>
          )}

          {tab === 'persona' && (
            <div className="space-y-3">
              <p className="text-xs text-ink-3">Мэдэх зүйлээ бөглөөрэй. Хадгалсны дараа баруун талын “AI-аар бөглөх” товчоор дутууг нь нөхүүлж болно.</p>
              {PERSONA_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-[13px] text-ink-2">{f.label}</span>
                  <textarea
                    rows={f.key === 'summary' ? 2 : 1}
                    value={persona[f.key] ?? ''}
                    onChange={(e) => setPersona((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full resize-y rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  {f.key === 'productsOfInterest' && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {PRODUCTS.filter((p) => !(persona.productsOfInterest ?? '').includes(p.name)).map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() =>
                            setPersona((x) => ({ ...x, productsOfInterest: [x.productsOfInterest, p.name].filter(Boolean).join(', ') }))
                          }
                          className="rounded-full border border-line px-2 py-0.5 text-[11.5px] text-ink-2 hover:border-brand hover:text-brand"
                        >
                          + {p.name.replace(/^Автомашины /, '')}
                        </button>
                      ))}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-6 py-4">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button onClick={onClose} className="ml-auto h-10 rounded-lg px-4 text-sm text-ink-2 hover:bg-hover">Болих</button>
          <button onClick={save} disabled={saving} className="h-10 rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </div>
    </div>
  );
}
