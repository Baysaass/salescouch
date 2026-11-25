'use client';

import { useState } from 'react';
import { Plus, Share2, UserPlus } from 'lucide-react';
import type { ContactDTO } from './types';
import { Avatar, ProVerifiedBadge, relTime } from './ui';
import { clsx } from './clsx';
import { STAGE_LABELS } from '@/lib/labels';

const FILTERS = [
  { id: 'all', label: 'Бүгд' },
  { id: 'hot', label: 'Халуун' },
  { id: 'warm', label: 'Дулаан' },
  { id: 'cold', label: 'Хүйтэн' },
  { id: 'shared', label: 'Хуваалцсан' },
] as const;

const TEMP_DOT: Record<string, string> = { hot: 'bg-rose-500', warm: 'bg-amber-400', cold: 'bg-sky-400' };

function preview(text?: string | null) {
  if (!text) return null;
  return text
    .split('\n')
    .filter((l) => !l.trim().startsWith('>'))
    .join(' ')
    .replace(/```[\s\S]*?```/g, ' [имэйл] ').replace(/[#>*_|`-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

interface Props {
  contacts: ContactDTO[];
  loading: boolean;
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ContactList({ contacts, loading, query, selectedId, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const q = query.trim().toLowerCase();
  const list = contacts.filter((c) => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'shared'
          ? c.isOwner === false || (c.sharedWith?.length ?? 0) > 0
          : c.temperature === filter;
    const matchesQuery =
      !q ||
      `${c.fullName} ${c.company ?? ''} ${c.role ?? ''} ${c.email ?? ''} ${c.phone ?? ''} ${c.sharedBy?.name ?? ''} ${c.sharedBy?.email ?? ''}`
        .toLowerCase()
        .includes(q);
    return matchesFilter && matchesQuery;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h2 className="text-[17px] font-semibold">Харилцагчид</h2>
        <button
          onClick={onNew}
          title="Шинэ харилцагч"
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-brand hover:bg-brand-soft"
        >
          <Plus className="h-4 w-4" /> Нэмэх
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              'h-8 rounded-lg px-3 text-[13px] font-medium',
              filter === f.id ? 'bg-brand-soft text-brand' : 'bg-[#f2f3f5] text-ink hover:bg-[#e9eaee]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-3">
        {loading && <p className="px-3 py-6 text-sm text-ink-3">Ачааллаж байна…</p>}

        {!loading && contacts.length === 0 && (
          <div className="mx-2 mt-6 rounded-xl border border-dashed border-line p-5 text-center">
            <UserPlus className="mx-auto h-6 w-6 text-ink-3" />
            <p className="mt-2 text-sm font-medium">Харилцагч алга</p>
            <p className="mt-1 text-xs text-ink-3">Эхний харилцагчаа нэмээд коучтой ярилцаж эхлээрэй.</p>
            <button onClick={onNew} className="mt-3 h-8 rounded-lg bg-brand px-3 text-[13px] font-medium text-white hover:bg-brand-600">
              Харилцагч нэмэх
            </button>
          </div>
        )}

        {!loading && contacts.length > 0 && list.length === 0 && <p className="px-3 py-6 text-sm text-ink-3">Тохирох харилцагч олдсонгүй.</p>}

        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={clsx(
              'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left',
              selectedId === c.id ? 'bg-[#f2f3f5]' : 'hover:bg-[#f7f8f9]',
            )}
          >
            <span className="relative">
              <Avatar name={c.fullName} size={44} />
              <span className={clsx('absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white', TEMP_DOT[c.temperature] ?? 'bg-gray-300')} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] font-medium">{c.fullName}</span>
                <span className="shrink-0 text-xs text-ink-3">{relTime(c.lastAt ?? c.updatedAt)}</span>
              </span>
              <span className="block truncate text-[13.5px] text-ink-2">
                {preview(c.lastMessage) ?? [c.company, STAGE_LABELS[c.stage]].filter(Boolean).join(' · ')}
              </span>
              {c.isOwner === false && c.sharedBy ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-medium text-brand">
                  <Share2 className="h-2.5 w-2.5" />
                  <span>Ирсэн · {c.sharedBy.name || c.sharedBy.email}</span>
                  {c.sharedBy.plan === 'pro' && <ProVerifiedBadge size={12} />}
                </span>
              ) : (c.sharedWith?.length ?? 0) > 0 ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#eef2f6] px-2 py-0.5 text-[10.5px] font-medium text-ink-2">
                  <Share2 className="h-2.5 w-2.5" />
                  <span className="tabular-nums">{c.sharedWith!.length}</span> хүнд хуваалцсан
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
