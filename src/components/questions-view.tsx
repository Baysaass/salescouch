'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  HelpCircle,
  Lightbulb,
  MessageCircle,
  MessageSquareShare,
  Plus,
  Send,
  Sparkles,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import type { ContactDTO, QuestionDTO, QuestionCommentDTO } from './types';
import { CATEGORY_LABELS } from '@/lib/default-questions';
import { ApplyBar } from './apply-bar';
import { Avatar } from './ui';
import { clsx } from './clsx';

interface Props {
  query: string;
  contacts: ContactDTO[];
  selectedContactId: string | null;
  onApply: (contactId: string, text: string) => void;
  onCountChange?: (count: number) => void;
  currentUser: { id?: string; name: string; email: string; image: string | null };
}

export function QuestionsView({ query, contacts, selectedContactId, onApply, onCountChange, currentUser }: Props) {
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<'votes' | 'newest'>('votes');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const currentUserId = currentUser.id || currentUser.email.toLowerCase();

  // Сэтгэгдлийн нээлттэй хэсгүүдийн state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsByQuestion, setCommentsByQuestion] = useState<Record<string, QuestionCommentDTO[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});

  // Шинэ асуулт нэмэх form
  const [newTitle, setNewTitle] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState('discovery');
  const [newContext, setNewContext] = useState('');
  const [creating, setCreating] = useState(false);

  // Асуултуудыг татах
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const r = await fetch(`/api/questions?category=${category}&sort=${sort}`);
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(err?.error || 'Асуултын санг ачаалж чадсангүй');
      }
      const data: QuestionDTO[] = await r.json();
      setQuestions(data);
      if (category === 'all' && onCountChange) {
        onCountChange(data.length);
      }
    } catch (err) {
      setApiError((err as Error).message);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [category, sort, onCountChange]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Vote өгөх / цуцлах
  const handleVote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setApiError(null);
    let prevSnapshot: QuestionDTO | undefined;
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        prevSnapshot = q;
        const willVote = !q.userVoted;
        return {
          ...q,
          userVoted: willVote,
          votesCount: willVote ? q.votesCount + 1 : Math.max(0, q.votesCount - 1),
        };
      }),
    );

    try {
      const res = await fetch(`/api/questions/${id}/vote`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Vote өгөхөд алдаа гарлаа');
      }
      const data = await res.json();
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, userVoted: data.voted, votesCount: data.votesCount } : q)));
    } catch (err) {
      if (prevSnapshot) {
        setQuestions((prev) => prev.map((q) => (q.id === id ? prevSnapshot! : q)));
      }
      setApiError((err as Error).message);
    }
  };

  // Коммент харах / нээх
  const toggleComments = async (questionId: string) => {
    const isExpanded = Boolean(expandedComments[questionId]);
    setExpandedComments((prev) => ({ ...prev, [questionId]: !isExpanded }));

    if (!isExpanded && !commentsByQuestion[questionId]) {
      setLoadingComments((prev) => ({ ...prev, [questionId]: true }));
      try {
        const res = await fetch(`/api/questions/${questionId}/comments`);
        if (!res.ok) throw new Error('Сэтгэгдэл татаж чадсангүй');
        const rows = await res.json();
        setCommentsByQuestion((prev) => ({ ...prev, [questionId]: rows }));
      } catch (err) {
        setApiError((err as Error).message);
      } finally {
        setLoadingComments((prev) => ({ ...prev, [questionId]: false }));
      }
    }
  };

  // Шинэ коммент бичих
  const handleAddComment = async (questionId: string) => {
    const text = (newCommentText[questionId] || '').trim();
    if (!text || submittingComment[questionId]) return;

    setApiError(null);
    setSubmittingComment((prev) => ({ ...prev, [questionId]: true }));
    try {
      const res = await fetch(`/api/questions/${questionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Сэтгэгдэл хадгалж чадсангүй');
      }
      const created: QuestionCommentDTO = await res.json();
      setCommentsByQuestion((prev) => ({
        ...prev,
        [questionId]: [...(prev[questionId] || []), created],
      }));
      setNewCommentText((prev) => ({ ...prev, [questionId]: '' }));
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, commentsCount: q.commentsCount + 1 } : q)));
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  // Өөрийн сэтгэгдлийг устгах
  const handleDeleteComment = async (questionId: string, commentId: string) => {
    if (!confirm('Энэ сэтгэгдлийг устгах уу?')) return;
    setApiError(null);
    try {
      const res = await fetch(`/api/questions/${questionId}/comments?commentId=${commentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Сэтгэгдэл устгаж чадсангүй');
      }
      setCommentsByQuestion((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] || []).filter((c) => c.id !== commentId),
      }));
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, commentsCount: Math.max(0, q.commentsCount - 1) } : q)),
      );
    } catch (err) {
      setApiError((err as Error).message);
    }
  };

  // Өөрийн асуултыг устгах
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Энэ асуултыг сангаас устгах уу?')) return;
    setApiError(null);
    try {
      const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Асуулт устгаж чадсангүй');
      }
      setQuestions((prev) => {
        const next = prev.filter((q) => q.id !== id);
        if (category === 'all' && onCountChange) onCountChange(next.length);
        return next;
      });
    } catch (err) {
      setApiError((err as Error).message);
    }
  };

  // Шинэ асуулт нийтлэх
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newQuestion.trim() || creating) return;

    setApiError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          question: newQuestion.trim(),
          category: newCategory,
          context: newContext.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Асуулт нийтлэхэд алдаа гарлаа');
      }
      setNewTitle('');
      setNewQuestion('');
      setNewContext('');
      setModalOpen(false);
      await fetchQuestions();
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Хайлтаар шүүх
  const filteredQuestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        (item.context && item.context.toLowerCase().includes(q)) ||
        item.authorName.toLowerCase().includes(q),
    );
  }, [questions, query]);

  const targetContactId = selectedContactId || contacts[0]?.id || '';

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Top Banner */}
      <div className="border-b border-line bg-panel px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
              <MessageSquareShare className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-ink">Борлуулалтын Асуултын Банк</h1>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  Олон нийтийн сан
                </span>
              </div>
              <p className="text-[13px] text-ink-2">
                Хамгийн сайн ажилласан асуултуудад vote өгч, бодит хэрэглээний туршлага, комментоо хуваалцаарай.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sort toggle */}
            <div className="inline-flex rounded-xl border border-line bg-white p-1 text-xs font-medium">
              <button
                onClick={() => setSort('votes')}
                className={clsx(
                  'rounded-lg px-2.5 py-1 transition-colors',
                  sort === 'votes' ? 'bg-brand font-semibold text-white shadow-sm' : 'text-ink-2 hover:text-ink',
                )}
              >
                Хамгийн олон Vote
              </button>
              <button
                onClick={() => setSort('newest')}
                className={clsx(
                  'rounded-lg px-2.5 py-1 transition-colors',
                  sort === 'newest' ? 'bg-brand font-semibold text-white shadow-sm' : 'text-ink-2 hover:text-ink',
                )}
              >
                Сүүлд нэмэгдсэн
              </button>
            </div>

            {/* Add question button */}
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              Шинэ асуулт нэмэх
            </button>
          </div>
        </div>

        {/* Categories Pills */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto border-t border-line/60 pt-3">
          {Object.entries(CATEGORY_LABELS).map(([key, item]) => {
            const active = category === key;
            return (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={clsx(
                  'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all',
                  active
                    ? 'bg-ink font-semibold text-white shadow-sm'
                    : 'border border-line bg-white text-ink-2 hover:border-brand hover:text-ink',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Error Alert */}
      {apiError && (
        <div className="mx-6 mt-4 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
          <button onClick={() => setApiError(null)} className="rounded p-0.5 hover:bg-rose-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Stream Area */}
      <div className="scroll-thin flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[800px] space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-ink-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <p className="mt-3 text-xs">Асуултын санг ачаалж байна...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
              <HelpCircle className="mx-auto h-10 w-10 text-ink-3" />
              <h3 className="mt-3 text-sm font-bold text-ink">Асуулт олдсонгүй</h3>
              <p className="mt-1 text-xs text-ink-2">Та шинэ асуулт нийтэлж багийнхантайгаа хуваалцаарай.</p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Шинэ асуулт нэмэх
              </button>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const catMeta = CATEGORY_LABELS[q.category] || CATEGORY_LABELS.discovery;
              const isCommentsOpen = Boolean(expandedComments[q.id]);
              const comments = commentsByQuestion[q.id] || [];
              const canDeleteQuestion = q.userId === currentUserId;

              return (
                <div key={q.id} className="rounded-2xl border border-line bg-white shadow-sm transition-all hover:border-brand/40">
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={q.authorName} image={q.authorImage} size={32} />
                        <div>
                          <p className="text-[13px] font-semibold leading-tight text-ink">{q.authorName}</p>
                          <p className="text-[11px] text-ink-3">
                            {new Date(q.createdAt).toLocaleDateString('mn-MN', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={clsx('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', catMeta.color)}>
                          {catMeta.label}
                        </span>
                        {canDeleteQuestion && (
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            title="Өөрийн асуултыг устгах"
                            className="rounded-lg p-1 text-ink-3 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Question Title & Text */}
                    <div className="mt-3.5 space-y-2">
                      <h3 className="text-[15px] font-bold text-ink">{q.title}</h3>

                      <div className="rounded-xl border border-brand/20 bg-brand-soft/20 p-3.5">
                        <p className="font-serif text-[14px] font-medium italic leading-relaxed text-ink">{q.question}</p>
                      </div>

                      {q.context && (
                        <div className="flex items-start gap-2 pt-1 text-xs text-ink-2">
                          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <p>{q.context}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-line/70 bg-panel/40 px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      {/* Vote Button */}
                      <button
                        onClick={(e) => handleVote(q.id, e)}
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
                          q.userVoted
                            ? 'border-brand bg-brand text-white shadow-sm'
                            : 'border-line bg-white text-ink-2 hover:border-brand hover:text-brand',
                        )}
                      >
                        <ThumbsUp className={clsx('h-3.5 w-3.5', q.userVoted && 'fill-current')} />
                        <span>{q.votesCount} Vote</span>
                      </button>

                      {/* Comments Button */}
                      <button
                        onClick={() => toggleComments(q.id)}
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                          isCommentsOpen
                            ? 'border-brand/40 bg-brand-soft font-semibold text-brand'
                            : 'border-line bg-white text-ink-2 hover:bg-panel hover:text-ink',
                        )}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>{q.commentsCount} туршлага</span>
                        {isCommentsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Copy Question */}
                      <button
                        onClick={() => handleCopy(q.id, q.question)}
                        className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-brand hover:text-brand"
                        title="Асуултыг хуулах"
                      >
                        {copiedId === q.id ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedId === q.id ? 'Хуулагдлаа' : 'Хуулах'}</span>
                      </button>

                      {/* Apply to Active Contact */}
                      <button
                        onClick={() =>
                          onApply(
                            targetContactId,
                            `Би харилцагчид дараах асуултыг тавих гэж байна: "${q.question}". Энэ харилцагчийн нөхцөлд энэ асуултыг хэрхэн эвтэйхэн хэлэх, хариулснаас нь шалтгаалан ямар бүтээгдэхүүнийг яаж холбохыг зөвлөөрэй.`,
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-xl bg-ink px-2.5 py-1.5 text-xs font-medium text-white hover:bg-ink-2"
                        title="Коуч чатад ашиглах"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                        <span>Чатад ашиглах</span>
                      </button>
                    </div>
                  </div>

                  {/* Comments Thread (Collapsible) */}
                  {isCommentsOpen && (
                    <div className="space-y-3.5 border-t border-line bg-panel/30 p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink">
                          💬 Хамт олны хуваалцсан туршлага, үр дүн ({q.commentsCount}):
                        </span>
                        <span className="text-[11px] text-ink-3">Бодит практик туршлагаа бичээрэй</span>
                      </div>

                      {/* Comment Input */}
                      <div className="flex items-start gap-2.5">
                        <Avatar name={currentUser.name || currentUser.email} image={currentUser.image} size={28} />
                        <div className="flex-1 space-y-2">
                          <textarea
                            rows={2}
                            maxLength={2000}
                            value={newCommentText[q.id] || ''}
                            onChange={(e) => setNewCommentText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="«Энэ асуултыг асуух үед харилцагч ингэж хариулаад, манай Хялбар даатгалыг сонирхсон...»"
                            className="w-full rounded-xl border border-line bg-white p-2.5 text-xs text-ink outline-none placeholder:text-ink-3 focus:border-brand"
                          />
                          <div className="flex justify-end">
                            <button
                              disabled={!newCommentText[q.id]?.trim() || submittingComment[q.id]}
                              onClick={() => handleAddComment(q.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                            >
                              <Send className="h-3 w-3" />
                              <span>{submittingComment[q.id] ? 'Илгээж байна...' : 'Туршлага хуваалцах'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Existing comments list */}
                      {loadingComments[q.id] ? (
                        <p className="py-3 text-center text-xs text-ink-3">Сэтгэгдлийг ачаалж байна...</p>
                      ) : comments.length === 0 ? (
                        <p className="py-3 text-center text-xs text-ink-3">
                          Одоогоор туршлага бичигдээгүй байна. Та анхны сэтгэгдлийг бичээрэй!
                        </p>
                      ) : (
                        <div className="space-y-2.5 pt-1">
                          {comments.map((c) => {
                            const canDeleteComment = c.userId === currentUserId;
                            return (
                              <div key={c.id} className="space-y-1 rounded-xl border border-line/60 bg-white p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Avatar name={c.authorName} image={c.authorImage} size={22} />
                                    <span className="text-xs font-bold text-ink">{c.authorName}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-ink-3">
                                      {new Date(c.createdAt).toLocaleDateString('mn-MN', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    {canDeleteComment && (
                                      <button
                                        onClick={() => handleDeleteComment(q.id, c.id)}
                                        title="Сэтгэгдэл устгах"
                                        className="rounded p-0.5 text-ink-3 hover:bg-rose-50 hover:text-rose-600"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="pl-7 text-xs leading-relaxed text-ink-2">{c.content}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* New Question Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-[540px] space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                <Sparkles className="h-4 w-4 text-brand" />
                Шинэ амжилттай асуулт нийтлэх
              </h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-ink-3 hover:bg-panel hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Асуултын зорилго / Гарчиг <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Жишээ: Машины үнэлгээ болон өмнөх эвдрэлийг тодруулах"
                  className="w-full rounded-xl border border-line p-2.5 text-xs text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Ангилал <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white p-2.5 text-xs text-ink outline-none focus:border-brand"
                >
                  <option value="discovery">Хэрэгцээ илрүүлэх (Discovery)</option>
                  <option value="spin">SPIN аргачлал</option>
                  <option value="bant">BANT шалгуур (Төсөв, эрх мэдэл)</option>
                  <option value="objection">Татгалзал давах (Objection Handling)</option>
                  <option value="closing">Хаалтын асуулт (Closing)</option>
                  <option value="digital">Дижитал амлалт (3 минутын онлайн)</option>
                  <option value="renewal">Сунгалт & Retention</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Яг асуух үгс (Харилцагчид хэлэх асуулт) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="«Та өмнө нь ямар нэг тохиолдлоор нөхөн төлбөр авах гээд салбар дээр очиж хэр их цаг алдаж байсан бэ?»"
                  className="w-full rounded-xl border border-line p-2.5 font-serif text-xs italic text-ink outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">Сэтгэл зүйн зөвлөмж / Хэзээ асуух вэ?</label>
                <textarea
                  maxLength={2000}
                  rows={2}
                  value={newContext}
                  onChange={(e) => setNewContext(e.target.value)}
                  placeholder="Жишээ: Энэ асуултыг ярианы дундуур өрсөлдөгчийг шууд муулахгүйгээр өөрийнх нь өвдөлтийг гаргахад ашиглана."
                  className="w-full rounded-xl border border-line p-2.5 text-xs text-ink outline-none focus:border-brand"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-medium text-ink-2 hover:bg-panel"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {creating ? 'Нийтэлж байна...' : 'Нийтлэх (+1 Vote)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply Bar */}
      <div className="shrink-0 border-t border-line bg-panel px-6 py-3.5">
        <ApplyBar
          contacts={contacts}
          defaultContactId={selectedContactId}
          label="Сонгосон асуултыг харилцагчийн коучтай холбох"
          buttonText="Коуч чатад ашиглах"
          onApply={(cid) =>
            onApply(
              cid,
              `Би энэ харилцагч дээр Асуултын банкны discovery болон татгалзал давах асуултуудыг хэрэглэх гэж байна. Харилцагчийн мэдээлэлд тохируулан ярианы хамгийн оновчтой 2 асуулт, тооцоог бэлдэж өгөөрэй.`,
            )
          }
        />
      </div>
    </div>
  );
}
