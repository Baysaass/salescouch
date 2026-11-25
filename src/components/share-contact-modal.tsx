'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Mail, Search, Send, Share2, Trash2, Users, X } from 'lucide-react';
import type { ContactDTO, ContactShareInfoDTO, RegisteredUserDTO } from './types';
import { Avatar } from './ui';
import { clsx } from './clsx';

interface Props {
  contact: ContactDTO;
  onClose: () => void;
  onSharesChanged: (sharedWith: ContactShareInfoDTO[]) => void;
}

export function ShareContactModal({ contact, onClose, onSharesChanged }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [note, setNote] = useState('');
  const [candidates, setCandidates] = useState<RegisteredUserDTO[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [shares, setShares] = useState<ContactShareInfoDTO[]>(contact.sharedWith ?? []);
  const [sending, setSending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const onSharesChangedRef = useRef(onSharesChanged);
  onSharesChangedRef.current = onSharesChanged;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const loadShares = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}/share`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.sharedWith)) {
        setShares(data.sharedWith);
        onSharesChangedRef.current(data.sharedWith);
      }
    } catch {}
  }, [contact.id]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(searchQuery.trim())}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.users)) {
          setCandidates(data.users);
        }
      } catch {
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const sharedEmailSet = new Set(shares.map((s) => s.email.toLowerCase()));
  const targetEmail = (selectedEmail || searchQuery).trim().toLowerCase();

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail || sending) return;

    setError(null);
    setSuccess(null);
    setSending(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Харилцагч хуваалцахад алдаа гарлаа');
      }
      const nextShares: ContactShareInfoDTO[] = Array.isArray(data?.sharedWith) ? data.sharedWith : [];
      setShares(nextShares);
      onSharesChanged(nextShares);
      setSuccess(data?.message || 'Амжилттай хуваалцлаа.');
      setSelectedEmail('');
      setSearchQuery('');
      setNote('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (targetUserId: string) => {
    if (revokingId) return;
    setError(null);
    setSuccess(null);
    setRevokingId(targetUserId);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/share?userId=${encodeURIComponent(targetUserId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Цуцлахад алдаа гарлаа');
      }
      const nextShares: ContactShareInfoDTO[] = Array.isArray(data?.sharedWith) ? data.sharedWith : [];
      setShares(nextShares);
      onSharesChanged(nextShares);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Share2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-ink">Харилцагч хуваалцах</h3>
              <p className="truncate text-xs text-ink-2">
                {contact.fullName}
                {contact.company ? ` · ${contact.company}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="rounded-lg p-1 text-ink-3 hover:bg-hover hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-5">
          <form onSubmit={handleShare} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">
                Манай санд бүртгэлтэй Gmail хэрэглэгч рүү илгээх
              </label>
              <div className="relative flex items-center rounded-xl border border-line bg-white px-3 focus-within:border-brand">
                <Search className="h-4 w-4 shrink-0 text-ink-3" />
                <input
                  type="text"
                  value={selectedEmail || searchQuery}
                  onChange={(e) => {
                    setSelectedEmail('');
                    setSearchQuery(e.target.value);
                    if (error) setError(null);
                    if (success) setSuccess(null);
                  }}
                  placeholder="Нэр эсвэл Gmail хаягаар хайх..."
                  className="h-10 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink outline-none placeholder:text-ink-3"
                />
                {(selectedEmail || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmail('');
                      setSearchQuery('');
                    }}
                    className="rounded p-1 text-ink-3 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Registered users quick list */}
            <div className="rounded-xl border border-line bg-canvas/35 p-2">
              <div className="mb-1.5 flex items-center justify-between px-1.5">
                <span className="text-[11px] font-medium text-ink-2">
                  Системд бүртгэлтэй хэрэглэгчид
                </span>
                {loadingUsers && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-3" />}
              </div>

              <div className="scroll-thin max-h-40 space-y-1 overflow-y-auto">
                {!loadingUsers && candidates.length === 0 ? (
                  <p className="px-2 py-2.5 text-center text-xs text-ink-3">
                    {searchQuery.trim()
                      ? 'Тохирох бүртгэлтэй хэрэглэгч олдсонгүй.'
                      : 'Системд бүртгэлтэй өөр хэрэглэгч хараахан алга байна.'}
                  </p>
                ) : (
                  candidates.map((u) => {
                    const already = sharedEmailSet.has(u.email.toLowerCase());
                    const isPicked = selectedEmail.toLowerCase() === u.email.toLowerCase();
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedEmail(u.email);
                          setSearchQuery('');
                          setError(null);
                        }}
                        className={clsx(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                          isPicked
                            ? 'bg-brand-soft ring-1 ring-brand/40'
                            : 'hover:bg-white',
                        )}
                      >
                        <Avatar name={u.name || u.email} image={u.image} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink">
                            {u.name || u.email.split('@')[0]}
                          </p>
                          <p className="truncate text-[11px] text-ink-2">{u.email}</p>
                        </div>
                        {already ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700">
                            <Check className="h-3 w-3" /> Хуваалцсан
                          </span>
                        ) : isPicked ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-semibold text-white">
                            Сонгосон
                          </span>
                        ) : (
                          <Mail className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">
                Шилжүүлэх тайлбар (заавал биш)
              </label>
              <input
                type="text"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ж: Өнөөдөр 15:00 цагт залгаж үнийн санал ярина уу"
                className="h-9 w-full rounded-xl border border-line bg-white px-3 text-xs text-ink outline-none placeholder:text-ink-3 focus:border-brand"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={!targetEmail || !targetEmail.includes('@') || sending}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{sending ? 'Илгээж байна...' : 'Хуваалцах / Илгээх'}</span>
            </button>
          </form>

          {shares.length > 0 && (
            <div className="border-t border-line pt-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Users className="h-3.5 w-3.5 text-brand" />
                  Хуваалцсан хүмүүс
                </span>
                <span className="tabular-nums text-xs font-medium text-ink-2">{shares.length}</span>
              </div>
              <div className="space-y-2">
                {shares.map((s) => (
                  <div
                    key={s.userId}
                    className="flex items-start gap-2.5 rounded-xl border border-line bg-canvas/25 px-3 py-2.5"
                  >
                    <Avatar name={s.name || s.email} image={s.image} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink">
                        {s.name || s.email.split('@')[0]}
                      </p>
                      <p className="truncate text-[11px] text-ink-2">{s.email}</p>
                      {s.note && (
                        <p className="mt-1 rounded-md bg-white px-2 py-1 text-[11px] text-ink-2 border border-line/60">
                          {s.note}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={revokingId === s.userId}
                      onClick={() => void handleRevoke(s.userId)}
                      title="Хуваалцалтыг цуцлах"
                      className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Цуцлах</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
