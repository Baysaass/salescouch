'use client';

import { useEffect, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Crown,
  GraduationCap,
  Hash,
  KeyRound,
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
  user: { name: string; email: string; image: string | null; plan?: UserPlan; followedTags?: string[] };
  aiEnabled: boolean;
  view: View;
  onView: (v: View) => void;
  query: string;
  onQuery: (q: string) => void;
  counts: { contacts: number; docs: number; products: number; playbook?: number; onboarding?: number; questions?: number };
  onUserUpdated?: (patch: Partial<{ plan: UserPlan; followedTags: string[] }>) => void;
}

export function Sidebar({ user, view, onView, query, onQuery, counts, onUserUpdated }: Props) {
  const isPro = user.plan === 'pro';
  const [profileOpen, setProfileOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const handleOpenProfile = () => {
    setRedeemError(null);
    setRedeemSuccess(null);
    setProfileOpen(true);
  };

  useEffect(() => {
    if (!profileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [profileOpen]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || redeeming) return;
    setRedeemError(null);
    setRedeemSuccess(null);
    setRedeeming(true);
    try {
      const res = await fetch('/api/profile/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Купон код буруу эсвэл хүчингүй байна');
      }
      setRedeemSuccess(data?.message || 'Таны эрх амжилттай Pro боллоо.');
      setCouponCode('');
      onUserUpdated?.({ plan: 'pro' });
    } catch (err) {
      setRedeemError((err as Error).message);
    } finally {
      setRedeeming(false);
    }
  };
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

      <button
        type="button"
        onClick={handleOpenProfile}
        title="Профайл болон Pro эрх"
        className="mx-1 mb-2 flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[#ebecef]"
      >
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
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-3" />
      </button>

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

      {profileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl border border-line bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={user.name || user.email} image={user.image} size={44} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-ink">
                      {user.name || 'Борлуулагч'}
                    </h3>
                    <span
                      className={clsx(
                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                        isPro ? 'bg-brand text-secondary' : 'bg-[#ebecef] text-ink-2',
                      )}
                    >
                      {isPro && <Crown className="h-3 w-3" />}
                      {isPro ? 'Pro' : 'Free'}
                    </span>
                  </div>
                  <p className="truncate text-xs text-ink-3">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                aria-label="Хаах"
                className="rounded-lg p-1 text-ink-3 hover:bg-hover hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {user.followedTags && user.followedTags.length > 0 && (
                <div className="rounded-xl border border-line bg-canvas/40 p-3">
                  <div className="flex items-center justify-between text-xs font-medium text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-brand" />
                      Дагаж буй хаштагууд
                    </span>
                    <span className="tabular-nums font-semibold text-ink">
                      {user.followedTags.length}/5
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {user.followedTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11px] font-medium text-ink"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div
                className={clsx(
                  'rounded-xl border p-4',
                  isPro ? 'border-emerald-200 bg-brand-soft/60' : 'border-line bg-canvas/35',
                )}
              >
                <div className="flex items-center gap-2">
                  <Crown className={clsx('h-4 w-4', isPro ? 'text-brand' : 'text-ink-2')} />
                  <p className="text-sm font-semibold text-ink">
                    {isPro ? 'Pro эрх идэвхтэй байна' : 'Pro эрх рүү шинэчлэх'}
                  </p>
                </div>
                <ul className="mt-2.5 space-y-1.5 text-xs text-ink-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                    <span>Борлуулалтын асуултуудын бүлэг болон нэгдсэн дүгнэлт</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                    <span>Харилцагчийн хэв маягт тохируулж оновчтой асуулт зохиох</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                    <span>Асуулт бүрийн доорх нарийвчилсан зөвлөмж ба хувилбар</span>
                  </li>
                </ul>
              </div>

              {redeemSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                  {redeemSuccess}
                </div>
              )}

              {!isPro && (
                <form onSubmit={handleRedeem} className="space-y-2.5">
                  <label className="block text-xs font-semibold text-ink">
                    Купон код оруулах
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value);
                          if (redeemError) setRedeemError(null);
                        }}
                        placeholder="Купон кодоо оруулна уу"
                        autoComplete="off"
                        className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-xs font-medium uppercase tracking-wide text-ink outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-3 focus:border-brand"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={redeeming || couponCode.trim().length < 4}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-brand px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                    >
                      {redeeming ? 'Шалгаж байна...' : 'Идэвхжүүлэх'}
                    </button>
                  </div>
                  {redeemError && (
                    <p className="text-xs font-medium text-rose-600">{redeemError}</p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
