'use client';

import {
  BookMarked,
  BookOpen,
  Crown,
  GraduationCap,
  LogOut,
  MessagesSquare,
  MessageSquareShare,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { signOutAction } from '@/app/actions';
import type { UserPlan } from '@/lib/api';
import { Avatar } from './ui';
import { clsx } from './clsx';

export type View = 'chat' | 'playbook' | 'onboarding' | 'questions' | 'docs' | 'products';

const NAV: { id: View; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: 'chat', label: 'Харилцагчид', icon: MessagesSquare, hint: 'Харилцагч + зөвлөх чат' },
  { id: 'playbook', label: 'Playbook', icon: BookMarked, hint: 'Борлуулалтын гарын авлага' },
  { id: 'onboarding', label: 'Onboarding', icon: GraduationCap, hint: 'Шинэ ажилтны хөтөч' },
  { id: 'questions', label: 'Асуултын банк', icon: MessageSquareShare, hint: 'Асуултууд, сэтгэгдэл ба туршлага' },
  { id: 'docs', label: 'Аргачлал', icon: BookOpen, hint: 'Борлуулалтын аргачлал' },
  { id: 'products', label: 'Бүтээгдэхүүн', icon: ShieldCheck, hint: 'Даатгалын бүтээгдэхүүнүүд' },
];

interface Props {
  user: { name: string; email: string; image: string | null; plan?: UserPlan };
  aiEnabled: boolean;
  view: View;
  onView: (v: View) => void;
  query: string;
  onQuery: (q: string) => void;
  counts: { contacts: number; docs: number; products: number; playbook?: number; onboarding?: number; questions?: number };
}

export function Sidebar({ user, view, onView, query, onQuery, counts }: Props) {
  const isPro = user.plan === 'pro';
  const countFor: Record<View, number> = {
    chat: counts.contacts,
    playbook: counts.playbook ?? 3,
    onboarding: counts.onboarding ?? 7,
    questions: counts.questions ?? 8,
    docs: counts.docs,
    products: counts.products,
  };
  const placeholder =
    view === 'chat'
      ? 'Харилцагч хайх…'
      : view === 'playbook'
        ? 'Гарын авлагаас хайх…'
        : view === 'onboarding'
          ? 'Хөтөчөөс хайх…'
          : view === 'questions'
            ? 'Асуулт, #таг хайх…'
            : view === 'docs'
              ? 'Арга хайх…'
              : 'Бүтээгдэхүүн хайх…';

  return (
    <aside className="flex w-[240px] shrink-0 flex-col">
      <div className="mb-2.5 flex items-center gap-2.5 border-b border-line px-2 pb-2.5 pt-1">
        <img src="/app-icon.png" alt="InsurTech Coach" className="h-7 w-7 rounded-lg object-cover shadow-sm" />
        <span className="text-[14px] font-semibold tracking-tight text-ink">InsurTech Coach</span>
      </div>

      <div className="flex items-center gap-2.5 px-2 pb-3 pt-0.5">
        <Avatar name={user.name || user.email} image={user.image} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14.5px] font-medium">{user.name || 'Борлуулагч'}</p>
            <span
              className={clsx(
                'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                isPro ? 'bg-brand text-secondary' : 'bg-[#ebecef] text-ink-2',
              )}
            >
              {isPro && <Crown className="h-2.5 w-2.5" />}
              {isPro ? 'Pro' : 'Free'}
            </span>
          </div>
          <p className="truncate text-xs text-ink-3">{user.email}</p>
        </div>
      </div>

      <label className="mx-1 flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-2.5 focus-within:border-brand">
        <Search className="h-4 w-4 text-ink-3" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
        {query && (
          <button onClick={() => onQuery('')} aria-label="Цэвэрлэх">
            <X className="h-3.5 w-3.5 text-ink-3" />
          </button>
        )}
      </label>

      <nav className="mt-4 space-y-0.5">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = view === n.id;
          return (
            <button
              key={n.id}
              title={n.hint}
              onClick={() => onView(n.id)}
              className={clsx(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14.5px]',
                active ? 'bg-white font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-ink hover:bg-[#ebecef]',
              )}
            >
              <Icon className={clsx('h-[18px] w-[18px]', active ? 'text-brand' : 'text-ink-2')} />
              <span className="flex-1">{n.label}</span>
              <span className="text-xs text-ink-3">{countFor[n.id]}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="space-y-1 border-t border-line pt-3">
        <div className="flex items-center gap-2.5 px-2 py-1 text-[13px] text-ink-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <span>Ухаалаг зөвлөх бэлэн</span>
          <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />
        </div>
        <form action={signOutAction}>
          <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px] text-ink hover:bg-[#ebecef]">
            <LogOut className="h-4 w-4 text-ink-2" /> Гарах
          </button>
        </form>
      </div>
    </aside>
  );
}
