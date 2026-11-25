'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GitBranch,
  HelpCircle,
  Layers,
  Lightbulb,
  MessageCircle,
  MessageSquareShare,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsUp,
  Trash2,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import type { ContactDTO, QuestionClusterDTO, QuestionCommentDTO, QuestionDTO, SynthesizedQuestionDTO } from './types';
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

type BankTab = 'feed' | 'clusters' | 'synthesizer';

const PERSONA_OPTIONS = [
  'Завгүй жолооч (Авто Каско / Хялбар)',
  'Яарч буй гадаад зорчигч',
  'Цахимд эргэлздэг ЖДҮ / Орон сууц эзэмшигч',
  'Байгууллагын захирал / HR (Корпорат)',
  'Сунгалт ба Өөр даатгалтай харилцагч',
];

export function QuestionsView({ query, contacts, selectedContactId, onApply, onCountChange, currentUser }: Props) {
  const [subTab, setSubTab] = useState<BankTab>('feed');
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [clusters, setClusters] = useState<QuestionClusterDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeBanner, setAnalyzeBanner] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<'votes' | 'newest'>('votes');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [highlightedClusterId, setHighlightedClusterId] = useState<string | null>(null);

  // Асуулт бүрийн AI дүгнэлт болон коммент дэлгэх төлөв
  const [expandedAI, setExpandedAI] = useState<Record<string, boolean>>({});
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

  // Асуулт боловсруулагч (Synthesizer) төлөв
  const [synthMode, setSynthMode] = useState<'persona' | 'contact'>('persona');
  const [synthPersona, setSynthPersona] = useState(PERSONA_OPTIONS[0]);
  const [synthContactId, setSynthContactId] = useState(selectedContactId || contacts[0]?.id || '');
  const [synthClusterId, setSynthClusterId] = useState('');
  const [synthQuestionId, setSynthQuestionId] = useState('');
  const [synthGoal, setSynthGoal] = useState('');
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesized, setSynthesized] = useState<SynthesizedQuestionDTO | null>(null);
  const [publishingSynth, setPublishingSynth] = useState(false);

  const currentUserId = currentUser.id || currentUser.email.toLowerCase();

  useEffect(() => {
    if (!synthContactId && (selectedContactId || contacts[0]?.id)) {
      setSynthContactId(selectedContactId || contacts[0]?.id || '');
    }
  }, [contacts, selectedContactId, synthContactId]);

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

  const fetchClusters = useCallback(async () => {
    setLoadingClusters(true);
    setApiError(null);
    try {
      const r = await fetch('/api/questions/clusters');
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(err?.error || 'Кластерийн тайланг ачаалж чадсангүй');
      }
      const data: { clusters: QuestionClusterDTO[]; questions: QuestionDTO[] } = await r.json();
      setClusters(data.clusters);
      if (category === 'all' && data.questions.length) {
        setQuestions(data.questions);
        if (onCountChange) onCountChange(data.questions.length);
      }
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setLoadingClusters(false);
    }
  }, [category, onCountChange]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Кластер эсвэл Боловсруулагч руу анх ороход кластеруудыг татна
  useEffect(() => {
    if ((subTab === 'clusters' || subTab === 'synthesizer') && clusters.length === 0 && !loadingClusters) {
      fetchClusters();
    }
  }, [subTab, clusters.length, loadingClusters, fetchClusters]);

  const handleRunAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setApiError(null);
    setAnalyzeBanner(null);
    try {
      const res = await fetch('/api/questions/analyze', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'AI шинжилгээ амжилтгүй боллоо');
      }
      const data = await res.json();
      setClusters(data.clusters || []);
      if (Array.isArray(data.questions)) {
        setQuestions(data.questions);
        if (onCountChange) onCountChange(data.questions.length);
      }
      const modelNote = data.stats?.model === 'local-trigram-v1' ? 'Локал триграм вектор' : data.stats?.model || 'AI Vector';
      setAnalyzeBanner(
        `Амжилттай: ${data.stats?.questionsCount ?? 0} асуултыг ${modelNote} ашиглан ${data.stats?.clustersCount ?? 0} кластерт хувааж, Persona дүгнэлт боловсрууллаа.`,
      );
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSynthesize = async (e?: React.FormEvent, overrides?: { clusterId?: string; questionId?: string }) => {
    if (e) e.preventDefault();
    if (synthesizing) return;

    const cid = overrides?.clusterId ?? (synthClusterId || null);
    const qid = overrides?.questionId ?? (synthQuestionId || null);
    setSynthesizing(true);
    setApiError(null);
    try {
      const res = await fetch('/api/questions/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId: cid,
          questionId: qid,
          contactId: synthMode === 'contact' && synthContactId ? synthContactId : null,
          personaName: synthMode === 'persona' ? synthPersona : null,
          goal: synthGoal.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Асуулт боловсруулж чадсангүй');
      }
      const result: SynthesizedQuestionDTO = await res.json();
      setSynthesized(result);
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setSynthesizing(false);
    }
  };

  const publishQuestionToBank = async (payload: { title: string; question: string; category: string; context?: string | null }) => {
    setPublishingSynth(true);
    setApiError(null);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Санд нэмэхэд алдаа гарлаа');
      }
      setAnalyzeBanner('AI-ийн боловсруулсан асуулт санд нэмэгдэж, вектортой холбогдлоо!');
      await fetchQuestions();
      setSubTab('feed');
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setPublishingSynth(false);
    }
  };

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

  const openSynthesizerFor = (opts: { clusterId?: string; questionId?: string }) => {
    if (opts.clusterId) setSynthClusterId(opts.clusterId);
    if (opts.questionId) setSynthQuestionId(opts.questionId);
    setSubTab('synthesizer');
    void handleSynthesize(undefined, opts);
  };

  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);

  const filteredQuestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        (item.context && item.context.toLowerCase().includes(q)) ||
        (item.aiAnalysis && item.aiAnalysis.toLowerCase().includes(q)) ||
        item.authorName.toLowerCase().includes(q),
    );
  }, [questions, query]);

  const filteredClusters = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clusters;
    return clusters.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.performanceVerdict.toLowerCase().includes(q) ||
        c.refinedQuestion.toLowerCase().includes(q),
    );
  }, [clusters, query]);

  const targetContactId = selectedContactId || contacts[0]?.id || '';
  const vectorizedCount = questions.filter((q) => Boolean(q.embeddingModel)).length;
  const activeVectorModel = questions.find((q) => q.embeddingModel)?.embeddingModel;

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
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-ink">Борлуулалтын Асуултын Банк</h1>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-lime-dark">
                  AI Vector & Cluster
                </span>
              </div>
              <p className="text-[13px] text-ink-2">
                Хамт олны vote ба туршлагаас вектор кластер, Persona дүгнэлт, оновчилсон асуулт боловсруулна.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {subTab === 'feed' && (
              <div className="inline-flex rounded-xl border border-line bg-white p-1 text-xs font-medium">
                <button
                  onClick={() => setSort('votes')}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 transition-colors',
                    sort === 'votes' ? 'bg-brand font-semibold text-white shadow-sm' : 'text-ink-2 hover:text-ink',
                  )}
                >
                  Олон Vote
                </button>
                <button
                  onClick={() => setSort('newest')}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 transition-colors',
                    sort === 'newest' ? 'bg-brand font-semibold text-white shadow-sm' : 'text-ink-2 hover:text-ink',
                  )}
                >
                  Шинэ
                </button>
              </div>
            )}

            <button
              onClick={handleRunAnalyze}
              disabled={analyzing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand/30 bg-brand-soft px-3 text-xs font-semibold text-brand hover:bg-secondary-soft disabled:opacity-60"
              title="Бүх асуулт, комментийг векторжуулж кластер болон Persona дүгнэлт гаргана"
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', analyzing && 'animate-spin')} />
              <span>{analyzing ? 'AI Шинжилж байна...' : 'AI Вектор & Кластер'}</span>
            </button>

            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              Шинэ асуулт
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs + Category Filter */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
          <div className="flex gap-1">
            {[
              { id: 'feed', label: `Бүх асуулт (${questions.length})`, icon: MessageCircle },
              { id: 'clusters', label: `AI Кластер & Дүгнэлт${clusters.length ? ` (${clusters.length})` : ''}`, icon: Layers },
              { id: 'synthesizer', label: 'Persona Асуулт Боловсруулагч', icon: Wand2 },
            ].map((t) => {
              const Icon = t.icon;
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id as BankTab)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
                    active ? 'bg-brand text-white shadow-sm' : 'text-ink-2 hover:bg-hover hover:text-ink',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {activeVectorModel && (
            <span className="text-[11px] text-ink-3">
              Вектор: {vectorizedCount}/{questions.length} · Загвар: <strong className="text-ink-2">{activeVectorModel}</strong>
            </span>
          )}
        </div>

        {subTab === 'feed' && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pt-1">
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
        )}
      </div>

      {/* Feedback Banners */}
      {analyzeBanner && (
        <div className="mx-6 mt-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-brand-soft px-4 py-2.5 text-xs font-medium text-brand">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 shrink-0" />
            <span>{analyzeBanner}</span>
          </div>
          <button onClick={() => setAnalyzeBanner(null)} className="rounded p-0.5 hover:bg-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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

      {/* Main Content Area */}
      <div className="scroll-thin flex-1 overflow-y-auto px-6 py-6">
        {/* ================= TAB 1: SOCIAL FEED ================= */}
        {subTab === 'feed' && (
          <div className="mx-auto max-w-[820px] space-y-5">
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
                const isAIOpen = Boolean(expandedAI[q.id]);
                const comments = commentsByQuestion[q.id] || [];
                const canDeleteQuestion = q.userId === currentUserId;
                const topPersona = q.personaScores?.[0];
                const clusterObj = q.clusterId ? clusterById.get(q.clusterId) : undefined;
                const hasAI = Boolean(q.aiAnalysis || topPersona);

                return (
                  <div key={q.id} className="rounded-2xl border border-line bg-white shadow-sm transition-all hover:border-brand/40">
                    <div className="p-5 pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={q.authorName} image={q.authorImage} size={32} />
                          <div>
                            <p className="text-[13px] font-semibold leading-tight text-ink">{q.authorName}</p>
                            <p className="text-[11px] text-ink-3">
                              {new Date(q.createdAt).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {topPersona && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary-soft px-2.5 py-0.5 text-[11px] font-semibold text-lime-dark">
                              <UserCheck className="h-3 w-3" />
                              {topPersona.personaName.split('(')[0].trim()} · {topPersona.score}%
                            </span>
                          )}
                          {clusterObj && (
                            <button
                              onClick={() => {
                                setHighlightedClusterId(clusterObj.id);
                                setSubTab('clusters');
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand hover:bg-secondary-soft"
                            >
                              <Layers className="h-3 w-3" />
                              {clusterObj.name.slice(0, 28)}
                            </button>
                          )}
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
                      <div className="flex flex-wrap items-center gap-2">
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

                        {hasAI && (
                          <button
                            onClick={() => setExpandedAI((prev) => ({ ...prev, [q.id]: !isAIOpen }))}
                            className={clsx(
                              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                              isAIOpen
                                ? 'border-brand bg-secondary-soft font-semibold text-lime-dark'
                                : 'border-line bg-white text-ink-2 hover:border-brand hover:text-brand',
                            )}
                          >
                            <Brain className="h-3.5 w-3.5" />
                            <span>AI Дүгнэлт</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openSynthesizerFor({ questionId: q.id, clusterId: q.clusterId || undefined })}
                          className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-brand hover:text-brand"
                          title="Persona-д тохируулж сайжруулах"
                        >
                          <Wand2 className="h-3.5 w-3.5 text-brand" />
                          <span>Сайжруулах</span>
                        </button>

                        <button
                          onClick={() => handleCopy(q.id, q.question)}
                          className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-brand hover:text-brand"
                          title="Асуултыг хуулах"
                        >
                          {copiedId === q.id ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedId === q.id ? 'Хуулагдлаа' : 'Хуулах'}</span>
                        </button>

                        <button
                          onClick={() =>
                            onApply(
                              targetContactId,
                              `Би харилцагчид дараах асуултыг тавих гэж байна: "${q.refinedVariant || q.question}". Энэ харилцагчийн нөхцөлд энэ асуултыг хэрхэн эвтэйхэн хэлэх, хариулснаас нь шалтгаалан ямар бүтээгдэхүүнийг яаж холбохыг зөвлөөрэй.`,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-xl bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                          title="Коуч чатад ашиглах"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-secondary" />
                          <span>Чатад ашиглах</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline AI Analysis & Related Questions Drawer */}
                    {isAIOpen && hasAI && (
                      <div className="space-y-3 border-t border-line bg-secondary-soft/30 p-5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-brand">
                            <Brain className="h-4 w-4" />
                            AI Ажилласан Байдал & Persona Дүгнэлт
                          </span>
                          {q.embeddingModel && <span className="text-[11px] text-ink-3">Вектор: {q.embeddingModel}</span>}
                        </div>

                        {q.aiAnalysis && <p className="text-xs leading-relaxed text-ink">{q.aiAnalysis}</p>}

                        {q.personaScores && q.personaScores.length > 0 && (
                          <div className="grid gap-2 sm:grid-cols-3">
                            {q.personaScores.map((p) => (
                              <div key={p.personaId} className="rounded-xl border border-line bg-white p-2.5">
                                <div className="flex items-center justify-between text-xs font-semibold text-ink">
                                  <span className="truncate">{p.personaName.split('(')[0].trim()}</span>
                                  <span className="text-brand">{p.score}%</span>
                                </div>
                                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-panel">
                                  <div className="h-full bg-brand" style={{ width: `${p.score}%` }} />
                                </div>
                                <p className="mt-1.5 text-[11px] text-ink-2">{p.reason}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.refinedVariant && q.refinedVariant !== q.question && (
                          <div className="rounded-xl border border-brand/30 bg-white p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-brand">✨ AI Оновчилсон хувилбар:</span>
                              <button
                                onClick={() => handleCopy(`ref-${q.id}`, q.refinedVariant!)}
                                className="text-[11px] font-medium text-brand hover:underline"
                              >
                                {copiedId === `ref-${q.id}` ? 'Хуулагдлаа!' : 'Хуулах'}
                              </button>
                            </div>
                            <p className="mt-1 font-serif text-xs italic text-ink">{q.refinedVariant}</p>
                          </div>
                        )}

                        {q.relatedQuestionIds && q.relatedQuestionIds.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-2">
                              <GitBranch className="h-3 w-3 text-brand" />
                              Вектор ижилсэлтэй / Холбоотой асуултууд:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {q.relatedQuestionIds.map((rid) => {
                                const rel = questionById.get(rid);
                                if (!rel) return null;
                                return (
                                  <button
                                    key={rid}
                                    onClick={() => openSynthesizerFor({ questionId: rel.id, clusterId: rel.clusterId || undefined })}
                                    className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] text-ink-2 hover:border-brand hover:text-brand"
                                  >
                                    {rel.title} ({rel.votesCount} vote)
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comments Thread */}
                    {isCommentsOpen && (
                      <div className="space-y-3.5 border-t border-line bg-panel/30 p-5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ink">
                            💬 Хамт олны хуваалцсан туршлага, үр дүн ({q.commentsCount}):
                          </span>
                          <span className="text-[11px] text-ink-3">Бодит практик туршлагаа бичээрэй</span>
                        </div>

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
        )}

        {/* ================= TAB 2: AI CLUSTERS & INSIGHTS ================= */}
        {subTab === 'clusters' && (
          <div className="mx-auto max-w-[860px] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-gradient-to-r from-brand-soft/70 to-white p-5">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Brain className="h-4 w-4 text-brand" />
                  Вектор Кластер, Ажилласан Байдал & Persona Хамаарлын Тайлан
                </h3>
                <p className="text-xs text-ink-2">
                  Асуулт бүр + борлуулагчдын коммент вектор хэлбэрт шилжиж ижил утгаараа кластер болон, аль Persona дээр илүү амжилттайг тооцоолно.
                </p>
              </div>
              <button
                onClick={handleRunAnalyze}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-60"
              >
                <RefreshCw className={clsx('h-3.5 w-3.5', analyzing && 'animate-spin')} />
                <span>{analyzing ? 'Боловсруулж байна...' : 'Дахин шинжлэх'}</span>
              </button>
            </div>

            {loadingClusters || analyzing ? (
              <div className="flex flex-col items-center justify-center py-20 text-ink-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                <p className="mt-3 text-xs">Асуултуудыг векторжуулж, кластер болон Persona дүгнэлт боловсруулж байна...</p>
              </div>
            ) : filteredClusters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
                <Layers className="mx-auto h-10 w-10 text-ink-3" />
                <p className="mt-3 text-sm font-bold text-ink">Кластер олдсонгүй</p>
                <button onClick={handleRunAnalyze} className="mt-4 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white">
                  AI Кластер үүсгэх
                </button>
              </div>
            ) : (
              filteredClusters.map((c) => {
                const members = questions.filter((q) => q.clusterId === c.id);
                const nextCluster = c.nextClusterId ? clusterById.get(c.nextClusterId) : null;
                const isHighlighted = highlightedClusterId === c.id;

                return (
                  <div
                    key={c.id}
                    className={clsx(
                      'space-y-4 rounded-2xl border bg-white p-5 shadow-sm transition-all',
                      isHighlighted ? 'border-brand ring-2 ring-brand/20' : 'border-line',
                    )}
                  >
                    {/* Cluster Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-brand px-2.5 py-0.5 text-[11px] font-bold text-secondary">
                            {c.questionCount} асуултын кластер
                          </span>
                          <span className="rounded-lg bg-panel px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                            Дундаж {c.avgVotes} vote
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-bold text-ink">{c.name}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-ink-2">{c.summary}</p>
                      </div>

                      <button
                        onClick={() => openSynthesizerFor({ clusterId: c.id })}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand hover:bg-secondary-soft"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        <span>Persona-д асуулт боловсруулах</span>
                      </button>
                    </div>

                    {/* Field Performance Verdict */}
                    <div className="rounded-xl border border-line bg-panel/60 p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-brand">📊 Бодит ажилласан байдлын дүгнэлт</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink">{c.performanceVerdict}</p>
                    </div>

                    {/* Best Personas Matrix */}
                    <div>
                      <p className="mb-2 text-xs font-bold text-ink">👤 Энэ кластер хамгийн сайн ажиллах харилцагчийн Persona:</p>
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {(c.bestPersonas || []).map((p) => (
                          <div key={p.personaId} className="rounded-xl border border-line bg-white p-3">
                            <div className="flex items-center justify-between gap-2 text-xs font-bold text-ink">
                              <span className="truncate">{p.personaName.split('(')[0].trim()}</span>
                              <span className="rounded-md bg-secondary-soft px-1.5 py-0.5 text-lime-dark">{p.score}%</span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-panel">
                              <div className="h-full bg-brand" style={{ width: `${p.score}%` }} />
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed text-ink-2">{p.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Synthesized Master Question */}
                    <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-brand">
                          <Sparkles className="h-4 w-4" />
                          AI Боловсруулсан илүү хүчтэй асуулт
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopy(`cl-${c.id}`, c.refinedQuestion)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:border-brand hover:text-brand"
                          >
                            {copiedId === `cl-${c.id}` ? <Check className="h-3 w-3 text-brand" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedId === `cl-${c.id}` ? 'Хуулагдлаа' : 'Хуулах'}</span>
                          </button>
                          <button
                            disabled={publishingSynth}
                            onClick={() =>
                              publishQuestionToBank({
                                title: `${c.name} — AI Оновчилсон`,
                                question: c.refinedQuestion,
                                category: members[0]?.category || 'discovery',
                                context: c.refinedRationale,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Санд нэмэх</span>
                          </button>
                          <button
                            onClick={() =>
                              onApply(
                                targetContactId,
                                `Энэ харилцагчид "${c.name}" кластерийн AI оновчилсон асуултыг ашиглая: ${c.refinedQuestion}. Түүний нөхцөлд тохируулан ярианы скрипт гаргаж өг.`,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-ink-2"
                          >
                            Чатад ашиглах
                          </button>
                        </div>
                      </div>
                      <p className="font-serif text-[14px] font-semibold italic leading-relaxed text-ink">{c.refinedQuestion}</p>
                      <p className="text-[11px] text-ink-2">
                        <strong>Яагаад илүү вэ:</strong> {c.refinedRationale}
                      </p>
                    </div>

                    {/* Member Questions & Transition Link */}
                    <div className="grid gap-3 pt-1 md:grid-cols-2">
                      <div className="rounded-xl border border-line p-3">
                        <p className="mb-2 text-[11px] font-bold uppercase text-ink-3">Кластерт багтсан асуултууд ({members.length})</p>
                        <ul className="space-y-1.5">
                          {members.map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                              <button
                                onClick={() => {
                                  setSubTab('feed');
                                  setExpandedAI((prev) => ({ ...prev, [m.id]: true }));
                                }}
                                className="truncate text-left font-medium text-ink hover:text-brand hover:underline"
                              >
                                • {m.title}
                              </button>
                              <span className="shrink-0 rounded bg-panel px-1.5 py-0.5 text-[11px] font-semibold text-brand">
                                {m.votesCount}▲
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {nextCluster && (
                        <div className="rounded-xl border border-line bg-secondary-soft/30 p-3">
                          <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase text-lime-dark">
                            <GitBranch className="h-3 w-3" />
                            Дараагийн шатны хамаарал (Transition Flow)
                          </p>
                          <button
                            onClick={() => setHighlightedClusterId(nextCluster.id)}
                            className="flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                          >
                            <span>Шилжих кластер: {nextCluster.name}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                          {c.nextClusterReason && <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{c.nextClusterReason}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= TAB 3: PERSONA QUESTION SYNTHESIZER ================= */}
        {subTab === 'synthesizer' && (
          <div className="mx-auto max-w-[820px] space-y-5">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm space-y-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                  <Wand2 className="h-5 w-5 text-brand" />
                  Persona-д Тааруулсан Шилдэг Асуулт Боловсруулагч
                </h3>
                <p className="mt-1 text-xs text-ink-2">
                  Асуултын банкны кластер, бодит туршлагын сэтгэгдлүүдийг тодорхой харилцагчийн Persona-тай хослуулан хамгийн өндөр үр дүнтэй шинэ асуулт боловсруулна.
                </p>
              </div>

              <form onSubmit={(e) => handleSynthesize(e)} className="space-y-3.5">
                {/* Target mode toggle */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSynthMode('persona')}
                    className={clsx(
                      'rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors',
                      synthMode === 'persona' ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2',
                    )}
                  >
                    1. Ерөнхий Persona сонгох
                  </button>
                  <button
                    type="button"
                    onClick={() => setSynthMode('contact')}
                    className={clsx(
                      'rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors',
                      synthMode === 'contact' ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2',
                    )}
                  >
                    2. Миний бодит Харилцагч (CRM)
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {synthMode === 'persona' ? (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink">Зорилтот Persona</label>
                      <select
                        value={synthPersona}
                        onChange={(e) => setSynthPersona(e.target.value)}
                        className="w-full rounded-xl border border-line bg-white p-2.5 text-xs text-ink outline-none focus:border-brand"
                      >
                        {PERSONA_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink">CRM Харилцагч сонгох</label>
                      {contacts.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line p-2.5 text-xs text-ink-3">Харилцагч бүртгэгдээгүй байна.</p>
                      ) : (
                        <select
                          value={synthContactId}
                          onChange={(e) => setSynthContactId(e.target.value)}
                          className="w-full rounded-xl border border-line bg-white p-2.5 text-xs text-ink outline-none focus:border-brand"
                        >
                          {contacts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.fullName}
                              {c.company ? ` — ${c.company}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">Тулах кластер (Сонголтоор)</label>
                    <select
                      value={synthClusterId}
                      onChange={(e) => setSynthClusterId(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white p-2.5 text-xs text-ink outline-none focus:border-brand"
                    >
                      <option value="">Бүх сангаас ерөнхий оновчлол</option>
                      {clusters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.questionCount} асуулт)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">Эх асуулт сонгох (Сонголтоор)</label>
                    <select
                      value={synthQuestionId}
                      onChange={(e) => setSynthQuestionId(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white p-2.5 text-xs text-ink outline-none focus:border-brand"
                    >
                      <option value="">Шинээр зохиох</option>
                      {questions.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.title} ({q.votesCount}▲)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">Ярианы онцгой нөхцөл / Зорилго</label>
                    <input
                      value={synthGoal}
                      onChange={(e) => setSynthGoal(e.target.value)}
                      placeholder="Ж.нь: Өөр газар даатгалтай гэсэн ч 3 өдрийн хурдаар татах"
                      className="w-full rounded-xl border border-line p-2.5 text-xs text-ink outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={synthesizing || (synthMode === 'contact' && contacts.length === 0)}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
                  >
                    <Wand2 className={clsx('h-4 w-4 text-secondary', synthesizing && 'animate-spin')} />
                    <span>{synthesizing ? 'Боловсруулж байна...' : 'Яг тохирсон асуулт боловсруулах'}</span>
                  </button>
                </div>
              </form>
            </div>

            {synthesized && (
              <div className="space-y-4 rounded-2xl border-2 border-brand/30 bg-white p-6 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-lime-dark">
                        {synthesized.targetPersonaName}
                      </span>
                      <span className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                        {(CATEGORY_LABELS[synthesized.category] || CATEGORY_LABELS.discovery).label}
                      </span>
                    </div>
                    <h4 className="mt-2 text-base font-bold text-ink">{synthesized.title}</h4>
                  </div>
                  <span className="text-[11px] text-ink-3">Загвар: {synthesized.modelUsed}</span>
                </div>

                <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
                  <p className="mb-1 text-[11px] font-bold uppercase text-brand">🎯 Хэлэх оновчилсон асуулт</p>
                  <p className="font-serif text-[15px] font-semibold italic leading-relaxed text-ink">{synthesized.question}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-panel/50 p-3.5">
                    <p className="text-[11px] font-bold text-brand">🧠 Яагаад энэ асуулт ажиллах вэ?</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink">{synthesized.rationale}</p>
                    <p className="mt-2 text-[11px] text-ink-2">{synthesized.context}</p>
                  </div>

                  <div className="space-y-2 rounded-xl border border-line bg-panel/50 p-3.5">
                    <div>
                      <p className="text-[11px] font-bold text-brand">➡️ Дараагийн асуух асуулт</p>
                      <p className="mt-1 text-xs italic text-ink">{synthesized.followUpQuestion}</p>
                    </div>
                    <div className="border-t border-line pt-2">
                      <p className="text-[11px] font-bold text-amber-700">🛡️ Болзошгүй эсэргүүцэл</p>
                      <p className="mt-1 text-xs text-ink-2">{synthesized.predictedObjection}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
                  <button
                    onClick={() => handleCopy('synth-q', synthesized.question)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand"
                  >
                    {copiedId === 'synth-q' ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedId === 'synth-q' ? 'Хуулагдлаа!' : 'Асуулт хуулах'}</span>
                  </button>

                  <button
                    disabled={publishingSynth}
                    onClick={() =>
                      publishQuestionToBank({
                        title: synthesized.title,
                        question: synthesized.question,
                        category: synthesized.category,
                        context: `${synthesized.context} — ${synthesized.rationale}`,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand bg-brand-soft px-3.5 py-2 text-xs font-semibold text-brand hover:bg-secondary-soft disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{publishingSynth ? 'Нийтэлж байна...' : 'Асуултын санд нийтлэх'}</span>
                  </button>

                  <button
                    onClick={() =>
                      onApply(
                        synthMode === 'contact' && synthContactId ? synthContactId : targetContactId,
                        `Би харилцагчид AI-аар боловсруулсан энэ асуултыг ашиглах гэж байна: ${synthesized.question}. Дараагийн алхам нь: ${synthesized.followUpQuestion}. Энэ харилцагчид бүрэн ярианы скрипт болон бүтээгдэхүүний тооцоо гаргаж өг.`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-secondary" />
                    <span>Коуч чатад ашиглах</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
              `Би энэ харилцагч дээр Асуултын банкны вектор кластерийн шилдэг асуултуудыг хэрэглэх гэж байна. Харилцагчийн Persona-д хамгийн их нийцсэн 2 асуулт болон бүтээгдэхүүний тооцоог бэлдэж өгөөрэй.`,
            )
          }
        />
      </div>
    </div>
  );
}
