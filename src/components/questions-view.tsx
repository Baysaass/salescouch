'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Crown,
  Hash,
  Layers,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import type { ContactDTO, QuestionClusterDTO, QuestionCommentDTO, QuestionDTO, SynthesizedQuestionDTO, VoterInfoDTO } from './types';
import { extractHashtags, SUGGESTED_HASHTAGS, tagBadgeColor } from '@/lib/default-questions';
import type { UserPlan } from '@/lib/api';
import {
  checkCopyGuardrails,
  PERSUASION_STYLE_MAP,
  PERSUASION_STYLES,
  QUESTION_BANK_DRAFTS,
  type CommentOutcomeId,
  type PersuasionStyleId,
  type QuestionBankDraft,
} from '@/lib/persuasion-frameworks';
import { Avatar, ProVerifiedBadge } from './ui';
import { clsx } from './clsx';

const COMMENT_OUTCOME_META: Record<CommentOutcomeId, { label: string; color: string }> = {
  closed: { label: 'Гэрээ хаасан', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  meeting: { label: 'Уулзалт болсон', color: 'border-sky-200 bg-sky-50 text-sky-700' },
  rejected: { label: 'Татгалзсан', color: 'border-rose-200 bg-rose-50 text-rose-700' },
  insight: { label: 'Зөвлөгөө', color: 'border-line bg-canvas text-ink-2' },
};

interface Props {
  query: string;
  contacts: ContactDTO[];
  selectedContactId: string | null;
  onApply: (contactId: string, text: string) => void;
  onCountChange?: (count: number) => void;
  currentUser: {
    id?: string;
    name: string;
    email: string;
    image: string | null;
    plan: UserPlan;
    followedTags?: string[];
  };
  onFollowedTagsChange?: (tags: string[]) => void;
}

type BankTab = 'feed' | 'clusters' | 'synthesizer';

const PERSONA_OPTIONS = [
  'Завгүй жолооч (Авто Каско / Хялбар)',
  'Яарч буй гадаад зорчигч',
  'Цахимд эргэлздэг ЖДҮ / Орон сууц эзэмшигч',
  'Байгууллагын захирал / HR (Корпорат)',
  'Сунгалт ба Өөр даатгалтай харилцагч',
];

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Саяхан';
  if (diffMin < 60) return `${diffMin}м`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}ц`;
  return d.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' });
}

const MAX_FOLLOWED_TAGS = 5;

export function QuestionsView({
  query,
  contacts,
  selectedContactId,
  onApply,
  onCountChange,
  currentUser,
  onFollowedTagsChange,
}: Props) {
  const isPro = currentUser.plan === 'pro';
  const [subTab, setSubTab] = useState<BankTab>('feed');
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [clusters, setClusters] = useState<QuestionClusterDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string>('all');
  const [followedTags, setFollowedTags] = useState<string[]>(currentUser.followedTags ?? []);
  const [availableTags, setAvailableTags] = useState<{ tag: string; count: number }[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagPickerSearch, setTagPickerSearch] = useState('');
  const [togglingTag, setTogglingTag] = useState<string | null>(null);
  const [sort, setSort] = useState<'votes' | 'newest'>('newest');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightedClusterId, setHighlightedClusterId] = useState<string | null>(null);

  // Сэтгэгдэл болон хэн like/unlike хийснийг дэлгэх төлөв
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [expandedVoters, setExpandedVoters] = useState<Record<string, boolean>>({});
  const [expandedProInsight, setExpandedProInsight] = useState<Record<string, boolean>>({});
  const [commentsByQuestion, setCommentsByQuestion] = useState<Record<string, QuestionCommentDTO[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [newCommentOutcome, setNewCommentOutcome] = useState<Record<string, CommentOutcomeId | null>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});

  // Threads хэв маягийн дээд Composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newContext, setNewContext] = useState('');
  const [draftTriggerStyle, setDraftTriggerStyle] = useState<PersuasionStyleId | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [creating, setCreating] = useState(false);

  // Pro: Асуулт боловсруулагч
  const [synthMode, setSynthMode] = useState<'persona' | 'contact'>('persona');
  const [synthPersona, setSynthPersona] = useState(PERSONA_OPTIONS[0]);
  const [synthContactId, setSynthContactId] = useState(selectedContactId || contacts[0]?.id || '');
  const [synthClusterId, setSynthClusterId] = useState('');
  const [synthQuestionId, setSynthQuestionId] = useState('');
  const [synthGoal, setSynthGoal] = useState('');
  const [synthTriggerStyle, setSynthTriggerStyle] = useState<PersuasionStyleId>('auto');
  const [synthAbMode, setSynthAbMode] = useState(false);
  const [synthAbCompareStyle, setSynthAbCompareStyle] = useState<PersuasionStyleId>('honesty');
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesized, setSynthesized] = useState<SynthesizedQuestionDTO | null>(null);
  const [publishingSynth, setPublishingSynth] = useState(false);

  const currentUserId = currentUser.id || currentUser.email.toLowerCase();

  useEffect(() => {
    if (Array.isArray(currentUser.followedTags)) {
      setFollowedTags(currentUser.followedTags);
    }
  }, [currentUser.followedTags]);

  useEffect(() => {
    if (!synthContactId && (selectedContactId || contacts[0]?.id)) {
      setSynthContactId(selectedContactId || contacts[0]?.id || '');
    }
  }, [contacts, selectedContactId, synthContactId]);

  const onFollowedTagsChangeRef = useRef(onFollowedTagsChange);
  onFollowedTagsChangeRef.current = onFollowedTagsChange;

  const fetchAvailableTags = useCallback(async () => {
    try {
      const r = await fetch('/api/profile/tags');
      if (!r.ok) return;
      const data: { followedTags?: string[]; availableTags?: { tag: string; count: number }[] } = await r.json();
      if (Array.isArray(data.followedTags)) {
        setFollowedTags(data.followedTags);
        onFollowedTagsChangeRef.current?.(data.followedTags);
      }
      if (Array.isArray(data.availableTags)) {
        setAvailableTags(data.availableTags);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void fetchAvailableTags();
  }, [fetchAvailableTags]);

  const handleToggleFollowTag = async (rawTag: string) => {
    const clean = extractHashtags('', [rawTag])[0];
    if (!clean || togglingTag) return;

    const currentlyFollowed = followedTags.includes(clean);
    if (!currentlyFollowed && followedTags.length >= MAX_FOLLOWED_TAGS) {
      setApiError(`Хамгийн ихдээ ${MAX_FOLLOWED_TAGS} хаштаг дагах боломжтой. Өөр тагийг болиулаад дахин оролдоно уу.`);
      return;
    }

    setApiError(null);
    setTogglingTag(clean);
    try {
      const res = await fetch('/api/profile/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: clean }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Хаштаг дагахад алдаа гарлаа');
      }
      const nextTags: string[] = Array.isArray(data?.followedTags) ? data.followedTags : [];
      setFollowedTags(nextTags);
      onFollowedTagsChange?.(nextTags);
      if (activeTag === 'following') {
        void fetchQuestions();
      }
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setTogglingTag(null);
    }
  };

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const r = await fetch(`/api/questions?tag=${encodeURIComponent(activeTag)}&sort=${sort}`);
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(err?.error || 'Асуултын санг ачаалж чадсангүй');
      }
      const data: QuestionDTO[] = await r.json();
      setQuestions(data);
      if (activeTag === 'all' && onCountChange) {
        onCountChange(data.length);
      }
    } catch (err) {
      setApiError((err as Error).message);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [activeTag, sort, onCountChange]);

  const fetchClusters = useCallback(async () => {
    if (!isPro) return;
    setLoadingClusters(true);
    setApiError(null);
    try {
      const r = await fetch('/api/questions/clusters');
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(err?.error || 'Шинжилгээ ачаалж чадсангүй');
      }
      const data: { clusters: QuestionClusterDTO[]; questions: QuestionDTO[] } = await r.json();
      setClusters(data.clusters);
      if (activeTag === 'all' && data.questions.length) {
        setQuestions(data.questions);
        if (onCountChange) onCountChange(data.questions.length);
      }
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setLoadingClusters(false);
    }
  }, [isPro, activeTag, onCountChange]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    if (isPro && (subTab === 'clusters' || subTab === 'synthesizer') && clusters.length === 0 && !loadingClusters) {
      fetchClusters();
    }
  }, [isPro, subTab, clusters.length, loadingClusters, fetchClusters]);

  const handleRunAnalyze = async () => {
    if (!isPro || analyzing) return;
    setAnalyzing(true);
    setApiError(null);
    setBanner(null);
    try {
      const res = await fetch('/api/questions/analyze', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Шинжилгээ амжилтгүй боллоо');
      }
      const data = await res.json();
      setClusters(data.clusters || []);
      if (Array.isArray(data.questions)) {
        setQuestions(data.questions);
        if (onCountChange) onCountChange(data.questions.length);
      }
      setBanner(`Нийт ${data.stats?.questionsCount ?? 0} асуултыг ${data.stats?.clustersCount ?? 0} бүлэг болгон дүгнэлт гаргалаа.`);
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSynthesize = async (e?: React.FormEvent, overrides?: { clusterId?: string; questionId?: string }) => {
    if (e) e.preventDefault();
    if (!isPro || synthesizing) return;

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
          triggerStyle: synthTriggerStyle,
          abTestMode: synthAbMode,
          abCompareStyle: synthAbMode ? synthAbCompareStyle : null,
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

  const publishQuestionToBank = async (payload: {
    title?: string;
    question: string;
    tags?: string[];
    context?: string | null;
    triggerStyle?: string | null;
    abGroup?: string | null;
    abVariantLabel?: 'A' | 'B' | null;
  }) => {
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
      setBanner('Шинэ асуулт амжилттай нийтлэгдлээ!');
      await Promise.all([fetchQuestions(), fetchAvailableTags()]);
      setSubTab('feed');
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setPublishingSynth(false);
    }
  };

  const publishAbPairToBank = async (variantA: SynthesizedQuestionDTO, variantB: SynthesizedQuestionDTO) => {
    setPublishingSynth(true);
    setApiError(null);
    const abGroup = `ab-${Date.now()}`;
    try {
      for (const [label, item] of [
        ['A', variantA],
        ['B', variantB],
      ] as const) {
        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `[${label}] ${item.title}`,
            question: item.question,
            tags: ['abтуршилт'],
            context: item.rationale,
            triggerStyle: item.triggerStyle || null,
            abGroup,
            abVariantLabel: label,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || 'A/B хувилбар нийтлэхэд алдаа гарлаа');
        }
      }
      setBanner('A болон B туршилтын хос асуултууд санд нийтлэгдлээ! Багийн саналаар үр дүнг нь хэмжинэ үү.');
      await Promise.all([fetchQuestions(), fetchAvailableTags()]);
      setSubTab('feed');
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setPublishingSynth(false);
    }
  };

  // Like / Unlike (0 хуурамч тоо, хэн дарсныг шууд харуулна)
  const handleVote = async (id: string, type: 'like' | 'unlike', e: React.MouseEvent) => {
    e.stopPropagation();
    setApiError(null);
    let snapshot: QuestionDTO | undefined;
    const me: VoterInfoDTO = { userId: currentUserId, name: currentUser.name || currentUser.email, image: currentUser.image };

    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        snapshot = q;
        const same = q.userVote === type;
        const nextVote = same ? null : type;
        const likedBy = q.likedBy.filter((v) => v.userId !== currentUserId);
        const unlikedBy = q.unlikedBy.filter((v) => v.userId !== currentUserId);
        if (nextVote === 'like') likedBy.push(me);
        if (nextVote === 'unlike') unlikedBy.push(me);
        return {
          ...q,
          userVote: nextVote,
          votesCount: likedBy.length,
          dislikesCount: unlikedBy.length,
          likedBy,
          unlikedBy,
        };
      }),
    );

    try {
      const res = await fetch(`/api/questions/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Санал өгөхөд алдаа гарлаа');
      }
      const data = await res.json();
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                userVote: data.userVote,
                votesCount: data.votesCount,
                dislikesCount: data.dislikesCount,
                likedBy: data.likedBy,
                unlikedBy: data.unlikedBy,
              }
            : q,
        ),
      );
    } catch (err) {
      if (snapshot) setQuestions((prev) => prev.map((q) => (q.id === id ? snapshot! : q)));
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
    const outcome = newCommentOutcome[questionId] || null;

    setApiError(null);
    setSubmittingComment((prev) => ({ ...prev, [questionId]: true }));
    try {
      const res = await fetch(`/api/questions/${questionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, outcome }),
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
      setNewCommentOutcome((prev) => ({ ...prev, [questionId]: null }));
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const nextOutcomes = {
            closed: (q.outcomes?.closed ?? 0) + (outcome === 'closed' ? 1 : 0),
            meeting: (q.outcomes?.meeting ?? 0) + (outcome === 'meeting' ? 1 : 0),
            rejected: (q.outcomes?.rejected ?? 0) + (outcome === 'rejected' ? 1 : 0),
          };
          return { ...q, commentsCount: q.commentsCount + 1, outcomes: nextOutcomes };
        }),
      );
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
    if (!confirm('Энэ асуултыг устгах уу?')) return;
    setApiError(null);
    try {
      const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Асуулт устгаж чадсангүй');
      }
      setQuestions((prev) => {
        const next = prev.filter((q) => q.id !== id);
        if (activeTag === 'all' && onCountChange) onCountChange(next.length);
        return next;
      });
    } catch (err) {
      setApiError((err as Error).message);
    }
  };

  const toggleTagInComposer = (tag: string) => {
    const clean = tag.replace(/^#/, '').toLowerCase();
    setSelectedTags((prev) => (prev.includes(clean) ? prev.filter((t) => t !== clean) : [...prev, clean]));
  };

  const addCustomTag = () => {
    const clean = customTagInput
      .trim()
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_]/gu, '');
    if (clean.length >= 2 && !selectedTags.includes(clean)) {
      setSelectedTags((prev) => [...prev, clean]);
    }
    setCustomTagInput('');
  };

  const applyDraftToComposer = (draft: QuestionBankDraft) => {
    setNewQuestion(draft.question);
    setNewContext(draft.context);
    setSelectedTags(draft.tags);
    setDraftTriggerStyle(draft.triggerStyle);
    setDraftsOpen(false);
    setComposerOpen(true);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || creating) return;

    setApiError(null);
    setCreating(true);
    try {
      const mergedTags = extractHashtags(`${newQuestion} ${newContext}`, selectedTags);
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newQuestion.trim(),
          tags: mergedTags,
          context: newContext.trim() || null,
          triggerStyle: draftTriggerStyle,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Нийтлэхэд алдаа гарлаа');
      }
      setNewQuestion('');
      setNewContext('');
      setSelectedTags([]);
      setCustomTagInput('');
      setDraftTriggerStyle(null);
      setDraftsOpen(false);
      setComposerOpen(false);
      if (activeTag === 'following') setActiveTag('all');
      await Promise.all([fetchQuestions(), fetchAvailableTags()]);
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
    if (!isPro) return;
    if (opts.clusterId) setSynthClusterId(opts.clusterId);
    if (opts.questionId) setSynthQuestionId(opts.questionId);
    setSubTab('synthesizer');
    void handleSynthesize(undefined, opts);
  };

  // Таг дагах сонгогчид харуулах хаштагууд (API + одоогийн feed + санал болгох)
  const pickerTagList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of availableTags) {
      counts.set(item.tag, item.count);
    }
    for (const q of questions) {
      for (const t of q.tags || []) {
        if (!counts.has(t)) counts.set(t, 1);
      }
    }
    for (const s of SUGGESTED_HASHTAGS) {
      if (!counts.has(s.tag)) counts.set(s.tag, 0);
    }
    for (const f of followedTags) {
      if (!counts.has(f)) counts.set(f, 0);
    }
    const q = tagPickerSearch.trim().replace(/^#+/, '').toLowerCase();
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .filter((item) => !q || item.tag.includes(q))
      .sort((a, b) => {
        const af = followedTags.includes(a.tag) ? 1 : 0;
        const bf = followedTags.includes(b.tag) ? 1 : 0;
        if (af !== bf) return bf - af;
        return b.count - a.count || a.tag.localeCompare(b.tag);
      });
  }, [availableTags, questions, followedTags, tagPickerSearch]);

  const cleanPickerQuery = useMemo(() => extractHashtags('', [tagPickerSearch])[0] || '', [tagPickerSearch]);
  const showCustomFollowOption =
    cleanPickerQuery.length >= 2 && !pickerTagList.some((item) => item.tag === cleanPickerQuery);

  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);

  const filteredQuestions = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, '');
    if (!q) return questions;
    return questions.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        (item.context && item.context.toLowerCase().includes(q)) ||
        item.authorName.toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q)),
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

  const detectedTagsInDraft = useMemo(
    () => extractHashtags(`${newQuestion} ${newContext}`, selectedTags),
    [newQuestion, newContext, selectedTags],
  );

  const draftGuardrails = useMemo(
    () => checkCopyGuardrails(`${newQuestion} ${newContext}`),
    [newQuestion, newContext],
  );

  const abLeaderboard = useMemo(() => {
    const byStyle = new Map<
      string,
      { styleId: string; label: string; count: number; likes: number; dislikes: number; closed: number; meeting: number; rejected: number }
    >();
    for (const q of questions) {
      const key = q.triggerStyle && q.triggerStyle !== 'auto' ? q.triggerStyle : 'other';
      const label =
        key === 'other'
          ? 'Ерөнхий / Бусад'
          : (PERSUASION_STYLE_MAP[key as PersuasionStyleId]?.label ?? key);
      const cur = byStyle.get(key) ?? { styleId: key, label, count: 0, likes: 0, dislikes: 0, closed: 0, meeting: 0, rejected: 0 };
      cur.count += 1;
      cur.likes += q.votesCount;
      cur.dislikes += q.dislikesCount;
      cur.closed += q.outcomes?.closed ?? 0;
      cur.meeting += q.outcomes?.meeting ?? 0;
      cur.rejected += q.outcomes?.rejected ?? 0;
      byStyle.set(key, cur);
    }
    return Array.from(byStyle.values()).sort(
      (a, b) => b.closed * 5 + b.meeting * 2 + b.likes - (a.closed * 5 + a.meeting * 2 + a.likes),
    );
  }, [questions]);

  const targetContactId = selectedContactId || contacts[0]?.id || '';

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-canvas/40">
      {/* Clean Minimal Header */}
      <div className="border-b border-line bg-panel px-6 py-4">
        <div className="mx-auto flex max-w-[680px] flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold tracking-tight text-ink">Асуултын банк</h1>
            <p className="text-[12.5px] text-ink-2">Борлуулалтын шилдэг асуултууд, бодит сэтгэгдэл ба туршлага</p>
          </div>

          <div className="flex items-center gap-2">
            {subTab === 'feed' && (
              <div className="inline-flex rounded-full border border-line bg-canvas p-0.5 text-xs font-medium">
                <button
                  onClick={() => setSort('newest')}
                  className={clsx(
                    'rounded-full px-3 py-1 transition-colors',
                    sort === 'newest' ? 'bg-white font-semibold text-ink shadow-xs' : 'text-ink-2 hover:text-ink',
                  )}
                >
                  Шинэ
                </button>
                <button
                  onClick={() => setSort('votes')}
                  className={clsx(
                    'rounded-full px-3 py-1 transition-colors',
                    sort === 'votes' ? 'bg-white font-semibold text-ink shadow-xs' : 'text-ink-2 hover:text-ink',
                  )}
                >
                  Шилдэг
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setSubTab('feed');
                setComposerOpen(true);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Асуулт бичих
            </button>
          </div>
        </div>

        {/* Pro Tabs (Зөвхөн Pro хэрэглэгчид харагдана) */}
        {isPro && (
          <div className="mx-auto mt-3 flex max-w-[680px] items-center justify-between gap-2 border-t border-line/60 pt-2.5">
            <div className="flex gap-1">
              {[
                { id: 'feed', label: 'Асуултын сан', icon: MessageCircle },
                { id: 'clusters', label: 'Бүлэг & Дүгнэлт', icon: Layers },
                { id: 'synthesizer', label: 'Асуулт зохиох', icon: Wand2 },
              ].map((t) => {
                const Icon = t.icon;
                const active = subTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSubTab(t.id as BankTab)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      active ? 'bg-brand text-white' : 'text-ink-2 hover:bg-hover hover:text-ink',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
              <Crown className="h-3 w-3" /> Pro
            </span>
          </div>
        )}

        {/* Follow Hashtags Strip (Max 5) */}
        {subTab === 'feed' && (
          <div className="relative mx-auto mt-3 max-w-[680px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveTag('all')}
                className={clsx(
                  'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeTag === 'all' ? 'bg-ink text-white' : 'border border-line bg-white text-ink-2 hover:text-ink',
                )}
              >
                Бүгд
              </button>

              <button
                onClick={() => setActiveTag(activeTag === 'following' ? 'all' : 'following')}
                className={clsx(
                  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  activeTag === 'following'
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-white text-ink-2 hover:border-brand hover:text-ink',
                )}
              >
                <span>Миний дагасан</span>
                <span
                  className={clsx(
                    'tabular-nums text-[10.5px]',
                    activeTag === 'following' ? 'text-white/90' : 'text-ink-3',
                  )}
                >
                  {followedTags.length}/{MAX_FOLLOWED_TAGS}
                </span>
              </button>

              {followedTags.map((tag) => {
                const active = activeTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(active ? 'all' : tag)}
                    className={clsx(
                      'whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-all',
                      active ? 'border-brand bg-brand text-white' : tagBadgeColor(tag),
                    )}
                  >
                    #{tag}
                  </button>
                );
              })}

              {activeTag !== 'all' && activeTag !== 'following' && !followedTags.includes(activeTag) && (
                <div className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft/70 py-0.5 pl-2.5 pr-1 text-xs">
                  <span className="font-semibold text-brand">#{activeTag}</span>
                  <button
                    type="button"
                    disabled={togglingTag === activeTag}
                    onClick={() => void handleToggleFollowTag(activeTag)}
                    className="rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {togglingTag === activeTag ? '...' : '+ Дагах'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTag('all')}
                    aria-label="Шүүлт арилгах"
                    className="rounded-full p-0.5 text-ink-2 hover:bg-white hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const next = !tagPickerOpen;
                  setTagPickerOpen(next);
                  if (next) void fetchAvailableTags();
                }}
                className={clsx(
                  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-dashed px-3 py-1 text-xs font-medium transition-colors',
                  tagPickerOpen
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-line bg-white text-ink-2 hover:border-brand hover:text-brand',
                )}
              >
                <Hash className="h-3 w-3" />
                <span>Таг дагах</span>
                <span className="tabular-nums text-[10.5px] opacity-80">
                  ({followedTags.length}/{MAX_FOLLOWED_TAGS})
                </span>
              </button>
            </div>

            {tagPickerOpen && (
              <div className="mt-2.5 rounded-2xl border border-line bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-ink">
                      Сонирхдог сэдвээ дагах{' '}
                      <span className="tabular-nums text-brand">
                        ({followedTags.length}/{MAX_FOLLOWED_TAGS})
                      </span>
                    </p>
                    <p className="text-[11px] text-ink-3">
                      Хамгийн ихдээ {MAX_FOLLOWED_TAGS} хаштаг дагаж, зөвхөн хэрэгтэй асуултуудаа шүүж харна уу.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTagPickerOpen(false)}
                    aria-label="Хаах"
                    className="rounded-lg p-1 text-ink-3 hover:bg-hover hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-line bg-canvas/40 px-2.5 py-1.5 focus-within:border-brand focus-within:bg-white">
                  <Search className="h-3.5 w-3.5 text-ink-3" />
                  <input
                    type="text"
                    value={tagPickerSearch}
                    onChange={(e) => setTagPickerSearch(e.target.value)}
                    placeholder="#хаштаг хайх эсвэл шинээр бичих..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink-3"
                  />
                  {tagPickerSearch && (
                    <button
                      type="button"
                      onClick={() => setTagPickerSearch('')}
                      className="text-ink-3 hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {followedTags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-b border-line/70 pb-2.5">
                    <span className="text-[11px] font-medium text-ink-2">Дагасан:</span>
                    {followedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft/60 px-2.5 py-0.5 text-[11px] font-medium text-brand"
                      >
                        #{tag}
                        <button
                          type="button"
                          disabled={togglingTag === tag}
                          onClick={() => void handleToggleFollowTag(tag)}
                          aria-label={`${tag} болиулах`}
                          className="rounded-full p-0.5 hover:bg-white"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-2.5 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {showCustomFollowOption && (
                    <button
                      type="button"
                      disabled={togglingTag === cleanPickerQuery}
                      onClick={() => {
                        void handleToggleFollowTag(cleanPickerQuery);
                        setTagPickerSearch('');
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand bg-brand-soft/50 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand-soft"
                    >
                      <Plus className="h-3 w-3" />#{cleanPickerQuery} дагах
                    </button>
                  )}

                  {pickerTagList.map(({ tag, count }) => {
                    const isFollowed = followedTags.includes(tag);
                    const atLimit = !isFollowed && followedTags.length >= MAX_FOLLOWED_TAGS;
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={togglingTag === tag}
                        onClick={() => void handleToggleFollowTag(tag)}
                        title={atLimit ? `Хамгийн ихдээ ${MAX_FOLLOWED_TAGS} таг дагах боломжтой` : undefined}
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          isFollowed
                            ? 'border-brand bg-brand text-white'
                            : atLimit
                              ? 'border-line bg-canvas/50 text-ink-3 hover:border-rose-300'
                              : 'border-line bg-white text-ink-2 hover:border-brand hover:text-ink',
                        )}
                      >
                        {isFollowed ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        <span>#{tag}</span>
                        {count > 0 && (
                          <span className={clsx('tabular-nums text-[10px]', isFollowed ? 'text-white/80' : 'text-ink-3')}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {pickerTagList.length === 0 && !showCustomFollowOption && (
                    <p className="py-2 text-xs text-ink-3">Тохирох хаштаг олдсонгүй.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Banners */}
      {banner && (
        <div className="mx-auto mt-3 flex w-full max-w-[680px] items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-brand-soft px-4 py-2 text-xs font-medium text-brand">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="rounded p-0.5 hover:bg-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {apiError && (
        <div className="mx-auto mt-3 flex w-full max-w-[680px] items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
          <button onClick={() => setApiError(null)} className="rounded p-0.5 hover:bg-rose-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Scroll Area */}
      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {/* ================= THREADS SOCIAL FEED ================= */}
        {subTab === 'feed' && (
          <div className="mx-auto max-w-[680px] space-y-3">
            {/* Inline Threads Composer Card */}
            <div className="rounded-2xl border border-line bg-white p-4 shadow-2xs">
              {!composerOpen ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar name={currentUser.name || currentUser.email} image={currentUser.image} size={36} />
                    <span className="truncate text-sm text-ink-3">
                      Ямар асуулт сайн ажилласан бэ? #автотээврийндаатгал гэх мэтээр хуваалцаарай...
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerOpen(true);
                      setDraftsOpen(true);
                    }}
                    className="rounded-full border border-line bg-canvas/50 px-3 py-1.5 text-xs font-medium text-ink hover:border-brand hover:text-brand"
                  >
                    Загвар ({QUESTION_BANK_DRAFTS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                  >
                    Бичих
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreatePost} className="space-y-3">
                  <div className="flex gap-3">
                    <Avatar name={currentUser.name || currentUser.email} image={currentUser.image} size={36} />
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink">
                          <span>{currentUser.name || currentUser.email}</span>
                          {isPro && <ProVerifiedBadge size={15} />}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDraftsOpen((v) => !v)}
                            className={clsx(
                              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                              draftsOpen
                                ? 'border-brand bg-brand-soft text-brand'
                                : 'border-line bg-white text-ink-2 hover:border-brand hover:text-brand',
                            )}
                          >
                            {draftsOpen ? 'Загвар хаах' : `Бэлэн загвар сонгох (${QUESTION_BANK_DRAFTS.length})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerOpen(false);
                              setDraftsOpen(false);
                            }}
                            className="rounded-lg p-1 text-ink-3 hover:bg-hover hover:text-ink"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {draftsOpen && (
                        <div className="space-y-2 rounded-xl border border-line bg-canvas/45 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-ink">
                              Нийтлэхэд бэлэн сэтгэлзүйн загварууд
                            </p>
                            <span className="text-[11px] text-ink-3">Сонгоод засварлаж нийтлэнэ үү</span>
                          </div>
                          <div className="scroll-thin max-h-60 space-y-2 overflow-y-auto pr-1">
                            {QUESTION_BANK_DRAFTS.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => applyDraftToComposer(d)}
                                className="block w-full rounded-xl border border-line bg-white p-2.5 text-left transition-colors hover:border-brand"
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-semibold text-brand">
                                    {d.triggerLabel}
                                  </span>
                                  <span className="text-[10.5px] text-ink-3">{d.awarenessLabel}</span>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-ink">{d.title}</p>
                                <p className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-2">{d.question}</p>
                                {d.abPairHint && (
                                  <p className="mt-1 text-[10.5px] text-emerald-700">{d.abPairHint}</p>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {draftTriggerStyle && draftTriggerStyle !== 'auto' && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 font-semibold text-brand">
                            {PERSUASION_STYLE_MAP[draftTriggerStyle]?.label}
                            <button
                              type="button"
                              onClick={() => setDraftTriggerStyle(null)}
                              aria-label="Төрөл арилгах"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        </div>
                      )}

                      <textarea
                        autoFocus
                        required
                        minLength={5}
                        maxLength={2000}
                        rows={3}
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="Асуултаа бичнэ үү... (текст дотор #автотээврийндаатгал #хаалт гэх мэт tag бичиж болно)"
                        className="w-full resize-none rounded-xl border border-line bg-canvas/40 p-3 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:bg-white"
                      />

                      <input
                        maxLength={500}
                        value={newContext}
                        onChange={(e) => setNewContext(e.target.value)}
                        placeholder="Тайлбар / Хэзээ асуухад зүгээр вэ? (заавал биш)"
                        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink outline-none placeholder:text-ink-3 focus:border-brand"
                      />

                      {/* Hashtag Picker */}
                      <div className="space-y-2 rounded-xl bg-canvas/50 p-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-2">
                            <Hash className="h-3 w-3" /> Таг сонгох:
                          </span>
                          {SUGGESTED_HASHTAGS.map((s) => {
                            const active = detectedTagsInDraft.includes(s.tag);
                            return (
                              <button
                                key={s.tag}
                                type="button"
                                onClick={() => toggleTagInComposer(s.tag)}
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all',
                                  active ? 'border-brand bg-brand text-white' : s.color,
                                )}
                              >
                                #{s.tag}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            value={customTagInput}
                            onChange={(e) => setCustomTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                addCustomTag();
                              }
                            }}
                            placeholder="#шинэтаг нэмээд Enter дарна уу"
                            className="h-7 flex-1 rounded-lg border border-line bg-white px-2.5 text-xs outline-none focus:border-brand"
                          />
                          <button
                            type="button"
                            onClick={addCustomTag}
                            className="h-7 rounded-lg border border-line bg-white px-2.5 text-[11px] font-medium text-ink hover:border-brand"
                          >
                            + Нэмэх
                          </button>
                        </div>

                        {detectedTagsInDraft.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {detectedTagsInDraft.map((t) => (
                              <span
                                key={t}
                                className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tagBadgeColor(t))}
                              >
                                #{t}
                                {selectedTags.includes(t) && (
                                  <button type="button" onClick={() => toggleTagInComposer(t)}>
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {draftGuardrails.length > 0 && (
                        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                            <span>Итгэлцэл ба хариуцлагын анхааруулга</span>
                          </div>
                          {draftGuardrails.map((w) => (
                            <p key={w.code} className="leading-snug">{w.message}</p>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setComposerOpen(false)}
                          className="rounded-full px-3.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-hover"
                        >
                          Болих
                        </button>
                        <button
                          type="submit"
                          disabled={creating || newQuestion.trim().length < 5}
                          className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                        >
                          {creating ? 'Нийтэлж байна...' : 'Нийтлэх'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Threads Feed Cards */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-ink-3">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                <p className="mt-3 text-xs">Ачаалж байна...</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
                {activeTag === 'following' && followedTags.length === 0 ? (
                  <>
                    <p className="text-sm font-semibold text-ink">Та одоогоор хаштаг дагаагүй байна</p>
                    <p className="mt-1 text-xs text-ink-2">
                      Сонирхдог сэдвүүдээсээ хамгийн ихдээ {MAX_FOLLOWED_TAGS} хаштаг дагаад зөвхөн хэрэгтэй асуултуудаа хараарай.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTagPickerOpen(true)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                    >
                      <Hash className="h-3.5 w-3.5" /> Таг дагах
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-ink">Энэ сэдвээр асуулт алга байна</p>
                    <p className="mt-1 text-xs text-ink-2">Та эхний асуултаа бичээд #таг нэмж хуваалцаарай.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line bg-white divide-y divide-line">
                {filteredQuestions.map((q) => {
                  const isCommentsOpen = Boolean(expandedComments[q.id]);
                  const isVotersOpen = Boolean(expandedVoters[q.id]);
                  const isProOpen = Boolean(expandedProInsight[q.id]);
                  const comments = commentsByQuestion[q.id] || [];
                  const canDeleteQuestion = q.userId === currentUserId;
                  const tags = q.tags || [];
                  const likedNames = q.likedBy || [];
                  const unlikedNames = q.unlikedBy || [];
                  const hasReactions = likedNames.length > 0 || unlikedNames.length > 0;

                  return (
                    <article key={q.id} className="p-5 transition-colors hover:bg-canvas/20">
                      <div className="flex gap-3.5">
                        {/* Left Avatar + Threads Vertical Line */}
                        <div className="flex flex-col items-center">
                          <Avatar name={q.authorName} image={q.authorImage} size={38} />
                          {(isCommentsOpen || isVotersOpen) && <div className="mt-2 w-[2px] flex-1 rounded-full bg-line" />}
                        </div>

                        {/* Right Content */}
                        <div className="min-w-0 flex-1">
                          {/* Author Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[14px] font-semibold text-ink">{q.authorName}</span>
                                {q.authorPlan === 'pro' && <ProVerifiedBadge size={15} />}
                                {q.userId === 'system' && (
                                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[10.5px] font-medium text-ink-2">Жишээ</span>
                                )}
                                {q.abVariantLabel && (
                                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">
                                    Туршилт {q.abVariantLabel}
                                  </span>
                                )}
                                {q.triggerStyle && q.triggerStyle !== 'auto' && PERSUASION_STYLE_MAP[q.triggerStyle as PersuasionStyleId] && (
                                  <span className="rounded-full border border-line bg-canvas/60 px-2 py-0.5 text-[10.5px] font-medium text-ink-2">
                                    {PERSUASION_STYLE_MAP[q.triggerStyle as PersuasionStyleId].label}
                                  </span>
                                )}
                                <span className="text-[12px] text-ink-3">{formatShortTime(q.createdAt)}</span>
                              </div>

                              {/* Instagram / Threads Hashtag Pills */}
                              {tags.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {tags.map((t) => (
                                    <button
                                      key={t}
                                      onClick={() => setActiveTag(activeTag === t ? 'all' : t)}
                                      className={clsx(
                                        'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80',
                                        tagBadgeColor(t),
                                      )}
                                    >
                                      #{t}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Quick Copy / Use / Delete */}
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={() => handleCopy(q.id, q.question)}
                                title="Хуулах"
                                className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[11px] font-medium text-ink-2 hover:border-brand hover:text-brand"
                              >
                                {copiedId === q.id ? <Check className="h-3 w-3 text-brand" /> : <Copy className="h-3 w-3" />}
                                <span>{copiedId === q.id ? 'Хуулагдлаа' : 'Хуулах'}</span>
                              </button>

                              <button
                                onClick={() =>
                                  onApply(
                                    targetContactId,
                                    `Энэ харилцагчид дараах асуултыг ашиглая: "${q.question}". Харилцагчийн нөхцөлд тааруулан хэрхэн асуух болон дараагийн алхмыг зөвлөөрэй.`,
                                  )
                                }
                                title="Зөвлөх чатад ашиглах"
                                className="inline-flex h-7 items-center gap-1 rounded-full bg-brand px-2.5 text-[11px] font-medium text-white hover:bg-brand-600"
                              >
                                <Sparkles className="h-3 w-3 text-secondary" />
                                <span>Чат руу</span>
                              </button>

                              {canDeleteQuestion && (
                                <button
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  title="Устгах"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Question Body */}
                          <p className="mt-2.5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">{q.question}</p>
                          {q.context && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{q.context}</p>}

                          {/* Threads-Style Social Actions: Like / Unlike / Comment */}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              onClick={(e) => handleVote(q.id, 'like', e)}
                              className={clsx(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                q.userVote === 'like'
                                  ? 'border-brand bg-brand text-white'
                                  : 'border-line bg-white text-ink-2 hover:border-brand hover:text-brand',
                              )}
                            >
                              <ThumbsUp className={clsx('h-3.5 w-3.5', q.userVote === 'like' && 'fill-current')} />
                              <span>{q.votesCount}</span>
                            </button>

                            <button
                              onClick={(e) => handleVote(q.id, 'unlike', e)}
                              className={clsx(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                q.userVote === 'unlike'
                                  ? 'border-rose-500 bg-rose-600 text-white'
                                  : 'border-line bg-white text-ink-2 hover:border-rose-400 hover:text-rose-600',
                              )}
                            >
                              <ThumbsDown className={clsx('h-3.5 w-3.5', q.userVote === 'unlike' && 'fill-current')} />
                              <span>{q.dislikesCount}</span>
                            </button>

                            <button
                              onClick={() => toggleComments(q.id)}
                              className={clsx(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                isCommentsOpen
                                  ? 'border-ink bg-ink text-white'
                                  : 'border-line bg-white text-ink-2 hover:bg-hover hover:text-ink',
                              )}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>{q.commentsCount}</span>
                            </button>

                            {(q.outcomes?.closed ?? 0) > 0 && (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 tabular-nums">
                                {q.outcomes!.closed} гэрээ хаасан
                              </span>
                            )}
                            {(q.outcomes?.meeting ?? 0) > 0 && (
                              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 tabular-nums">
                                {q.outcomes!.meeting} уулзалт
                              </span>
                            )}

                            {/* Pro-only quick insight toggle */}
                            {isPro && (q.aiAnalysis || q.personaScores?.length) && (
                              <button
                                onClick={() => setExpandedProInsight((prev) => ({ ...prev, [q.id]: !isProOpen }))}
                                className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-secondary-soft"
                              >
                                <Crown className="h-3 w-3" />
                                <span>Pro Дүгнэлт</span>
                              </button>
                            )}
                          </div>

                          {/* Хэн Like / Unlike хийснийг харуулах хэсэг */}
                          {hasReactions && (
                            <div className="mt-2">
                              <button
                                onClick={() => setExpandedVoters((prev) => ({ ...prev, [q.id]: !isVotersOpen }))}
                                className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2 hover:text-ink"
                              >
                                {likedNames.length > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="flex -space-x-1.5">
                                      {likedNames.slice(0, 3).map((v) => (
                                        <Avatar key={v.userId} name={v.name} image={v.image} size={18} className="ring-1 ring-white" />
                                      ))}
                                    </span>
                                    <span>
                                      👍 {likedNames.slice(0, 2).map((v) => v.name).join(', ')}
                                      {likedNames.length > 2 ? ` болон бусад ${likedNames.length - 2}` : ''}
                                    </span>
                                  </span>
                                )}
                                {unlikedNames.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-rose-700/80">
                                    <span>
                                      · 👎 {unlikedNames.slice(0, 2).map((v) => v.name).join(', ')}
                                      {unlikedNames.length > 2 ? ` +${unlikedNames.length - 2}` : ''}
                                    </span>
                                  </span>
                                )}
                              </button>

                              {isVotersOpen && (
                                <div className="mt-2 grid gap-2 rounded-xl border border-line bg-canvas/50 p-3 text-xs sm:grid-cols-2">
                                  <div>
                                    <p className="mb-1.5 font-semibold text-brand">👍 Ажилласан ({likedNames.length})</p>
                                    {likedNames.length === 0 ? (
                                      <p className="text-[11px] text-ink-3">Одоогоор алга</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {likedNames.map((v) => (
                                          <div key={v.userId} className="flex items-center gap-1.5">
                                            <Avatar name={v.name} image={v.image} size={18} />
                                            <span className="text-ink">{v.name}</span>
                                            {v.plan === 'pro' && <ProVerifiedBadge size={12} />}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="mb-1.5 font-semibold text-rose-600">👎 Ажиллаагүй ({unlikedNames.length})</p>
                                    {unlikedNames.length === 0 ? (
                                      <p className="text-[11px] text-ink-3">Одоогоор алга</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {unlikedNames.map((v) => (
                                          <div key={v.userId} className="flex items-center gap-1.5">
                                            <Avatar name={v.name} image={v.image} size={18} />
                                            <span className="text-ink">{v.name}</span>
                                            {v.plan === 'pro' && <ProVerifiedBadge size={12} />}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Pro Insight Drawer (Зөвхөн Pro багцад) */}
                          {isPro && isProOpen && (
                            <div className="mt-3 space-y-2.5 rounded-xl border border-brand/20 bg-brand-soft/40 p-3.5 text-xs">
                              {q.aiAnalysis && <p className="leading-relaxed text-ink">{q.aiAnalysis}</p>}
                              {q.personaScores && q.personaScores.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {q.personaScores.map((p) => (
                                    <span key={p.personaId} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                                      <UserCheck className="h-3 w-3" />
                                      {p.personaName.split('(')[0].trim()} · {p.score}%
                                    </span>
                                  ))}
                                </div>
                              )}
                              {q.refinedVariant && q.refinedVariant !== q.question && (
                                <p className="rounded-lg bg-white p-2.5 text-xs text-ink">
                                  <strong className="text-brand">Сайжруулсан хувилбар:</strong> {q.refinedVariant}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Threads-Style Comments / Replies */}
                          {isCommentsOpen && (
                            <div className="mt-3.5 space-y-3 border-t border-line/70 pt-3">
                              {loadingComments[q.id] ? (
                                <p className="text-xs text-ink-3">Сэтгэгдлүүдийг уншиж байна...</p>
                              ) : comments.length === 0 ? (
                                <p className="text-xs text-ink-3">Одоогоор сэтгэгдэл бичигдээгүй байна. Анхны туршлагаа бичээрэй!</p>
                              ) : (
                                <div className="space-y-3">
                                  {comments.map((c) => {
                                    const canDeleteComment = c.userId === currentUserId;
                                    return (
                                      <div key={c.id} className="flex gap-2.5">
                                        <Avatar name={c.authorName} image={c.authorImage} size={26} />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className="text-[12.5px] font-semibold text-ink">{c.authorName}</span>
                                              {c.authorPlan === 'pro' && <ProVerifiedBadge size={13} />}
                                              {c.outcome && COMMENT_OUTCOME_META[c.outcome as CommentOutcomeId] && (
                                                <span
                                                  className={clsx(
                                                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                                    COMMENT_OUTCOME_META[c.outcome as CommentOutcomeId].color,
                                                  )}
                                                >
                                                  {COMMENT_OUTCOME_META[c.outcome as CommentOutcomeId].label}
                                                </span>
                                              )}
                                              <span className="text-[11px] text-ink-3">{formatShortTime(c.createdAt)}</span>
                                            </div>
                                            {canDeleteComment && (
                                              <button
                                                onClick={() => handleDeleteComment(q.id, c.id)}
                                                title="Сэтгэгдэл устгах"
                                                className="rounded p-0.5 text-ink-3 hover:text-rose-600"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            )}
                                          </div>
                                          <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{c.content}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Inline Reply Input + Real Outcome Tag */}
                              <div className="space-y-2 pt-1">
                                <div className="flex flex-wrap items-center gap-1.5 pl-8">
                                  <span className="text-[11px] text-ink-3">Бодит үр дүн (сонголтоор):</span>
                                  {(['meeting', 'closed', 'rejected'] as CommentOutcomeId[]).map((outKey) => {
                                    const active = newCommentOutcome[q.id] === outKey;
                                    return (
                                      <button
                                        key={outKey}
                                        type="button"
                                        onClick={() =>
                                          setNewCommentOutcome((prev) => ({
                                            ...prev,
                                            [q.id]: active ? null : outKey,
                                          }))
                                        }
                                        className={clsx(
                                          'rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors',
                                          active
                                            ? COMMENT_OUTCOME_META[outKey].color
                                            : 'border-line bg-white text-ink-2 hover:border-brand',
                                        )}
                                      >
                                        {COMMENT_OUTCOME_META[outKey].label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Avatar name={currentUser.name || currentUser.email} image={currentUser.image} size={26} />
                                  <input
                                    maxLength={2000}
                                    value={newCommentText[q.id] || ''}
                                    onChange={(e) => setNewCommentText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        void handleAddComment(q.id);
                                      }
                                    }}
                                    placeholder="Энэ асуултыг асуухад хэрхэн ажилласан туршлагаа бичнэ үү..."
                                    className="h-9 min-w-0 flex-1 rounded-full border border-line bg-canvas/50 px-3.5 text-xs text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:bg-white"
                                  />
                                  <button
                                    disabled={!newCommentText[q.id]?.trim() || submittingComment[q.id]}
                                    onClick={() => handleAddComment(q.id)}
                                    aria-label="Илгээх"
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-600 disabled:bg-[#d5d8de]"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= PRO TAB 2: БҮЛЭГ & ДҮГНЭЛТ ================= */}
        {isPro && subTab === 'clusters' && (
          <div className="mx-auto max-w-[780px] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-white p-5">
              <div>
                <h3 className="text-sm font-bold text-ink">Асуултын бүлгүүд ба бодит үр дүнгийн дүгнэлт</h3>
                <p className="mt-1 text-xs text-ink-2">
                  Асуултуудыг ижил зорилгоор бүлэглэн, ямар харилцагч дээр илүү үр дүнтэй ажиллаж байгааг дүгнэнэ.
                </p>
              </div>
              <button
                onClick={handleRunAnalyze}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                <RefreshCw className={clsx('h-3.5 w-3.5', analyzing && 'animate-spin')} />
                <span>{analyzing ? 'Шинжилж байна...' : 'Шинжилгээ шинэчлэх'}</span>
              </button>
            </div>

            {/* A/B & Real Conversion Leaderboard (Зөвхөн бодит үр дүн ба гэрээ хаалтаар хэмжих) */}
            {abLeaderboard.length > 0 && (
              <div className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-ink">A/B Туршилт ба Бодит Хөрвүүлэлтийн Дүн</h4>
                    <p className="mt-0.5 text-[11.5px] text-ink-2">
                      Зөвхөн дарсан тоо биш — багийн бодит санал, уулзалт болон гэрээ хаасан үр дүнгээр харьцуулна.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> Итгэлцлийн дүрэм идэвхтэй
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {abLeaderboard.slice(0, 6).map((row) => {
                    const totalVotes = row.likes + row.dislikes;
                    const winRate = totalVotes > 0 ? Math.round((row.likes / totalVotes) * 100) : null;
                    return (
                      <div key={row.styleId} className="rounded-xl border border-line bg-canvas/30 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ink">{row.label}</span>
                          <span className="tabular-nums text-[11px] text-ink-3">{row.count} асуулт</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 tabular-nums">
                            {row.closed} гэрээ
                          </span>
                          <span className="rounded-md bg-sky-50 px-2 py-0.5 font-semibold text-sky-700 tabular-nums">
                            {row.meeting} уулзалт
                          </span>
                          <span className="rounded-md bg-white px-2 py-0.5 text-ink-2 tabular-nums">
                            👍 {row.likes} / 👎 {row.dislikes}
                            {winRate !== null ? ` (${winRate}%)` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {loadingClusters || analyzing ? (
              <div className="flex flex-col items-center justify-center py-16 text-ink-3">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                <p className="mt-3 text-xs">Асуултуудын бүлэг болон дүгнэлтийг бэлтгэж байна...</p>
              </div>
            ) : (
              filteredClusters.map((c) => {
                const members = questions.filter((q) => q.clusterId === c.id);
                const nextCluster = c.nextClusterId ? clusterById.get(c.nextClusterId) : null;
                return (
                  <div
                    key={c.id}
                    className={clsx(
                      'space-y-4 rounded-2xl border bg-white p-5',
                      highlightedClusterId === c.id ? 'border-brand ring-2 ring-brand/20' : 'border-line',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                      <div>
                        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                          {c.questionCount} асуулт
                        </span>
                        <h3 className="mt-2 text-base font-bold text-ink">{c.name}</h3>
                        <p className="mt-1 text-xs text-ink-2">{c.summary}</p>
                      </div>
                      <button
                        onClick={() => openSynthesizerFor({ clusterId: c.id })}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        <span>Асуулт зохиох</span>
                      </button>
                    </div>

                    <div className="rounded-xl bg-canvas/60 p-3.5 text-xs">
                      <p className="font-bold text-brand">Бодит үр дүн:</p>
                      <p className="mt-1 text-ink">{c.performanceVerdict}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      {(c.bestPersonas || []).map((p) => (
                        <div key={p.personaId} className="rounded-xl border border-line p-3 text-xs">
                          <div className="flex items-center justify-between font-bold text-ink">
                            <span className="truncate">{p.personaName.split('(')[0].trim()}</span>
                            <span className="text-brand">{p.score}%</span>
                          </div>
                          <p className="mt-1 text-[11px] text-ink-2">{p.reason}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-brand">✨ Сайжруулсан хувилбар</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleCopy(`cl-${c.id}`, c.refinedQuestion)}
                            className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:text-ink"
                          >
                            {copiedId === `cl-${c.id}` ? 'Хуулагдлаа' : 'Хуулах'}
                          </button>
                          <button
                            disabled={publishingSynth}
                            onClick={() =>
                              publishQuestionToBank({
                                title: c.name,
                                question: c.refinedQuestion,
                                tags: members[0]?.tags || ['хаалт'],
                                context: c.refinedRationale,
                              })
                            }
                            className="rounded-full bg-brand px-3 py-1 text-[11px] font-semibold text-white hover:bg-brand-600"
                          >
                            Санд нэмэх
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-ink">{c.refinedQuestion}</p>
                      <p className="text-[11px] text-ink-2">{c.refinedRationale}</p>
                    </div>

                    {nextCluster && (
                      <div className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-xs">
                        <div>
                          <span className="text-ink-3">Дараагийн шат: </span>
                          <button
                            onClick={() => setHighlightedClusterId(nextCluster.id)}
                            className="inline-flex items-center gap-1 font-bold text-brand hover:underline"
                          >
                            {nextCluster.name} <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= PRO TAB 3: АСУУЛТ ЗОХИОХ ================= */}
        {isPro && subTab === 'synthesizer' && (
          <div className="mx-auto max-w-[740px] space-y-5">
            <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                  <Wand2 className="h-5 w-5 text-brand" />
                  Харилцагчийн төрөлд тохирсон асуулт зохиох
                </h3>
                <p className="mt-1 text-xs text-ink-2">
                  Асуултын сангийн туршлага дээр тулгуурлан сонгосон харилцагчид яг таарах асуулт боловсруулна.
                </p>
              </div>

              <form onSubmit={(e) => handleSynthesize(e)} className="space-y-3.5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSynthMode('persona')}
                    className={clsx(
                      'rounded-full border px-3.5 py-1.5 text-xs font-semibold',
                      synthMode === 'persona' ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2',
                    )}
                  >
                    Харилцагчийн төрөл
                  </button>
                  <button
                    type="button"
                    onClick={() => setSynthMode('contact')}
                    className={clsx(
                      'rounded-full border px-3.5 py-1.5 text-xs font-semibold',
                      synthMode === 'contact' ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2',
                    )}
                  >
                    Миний харилцагч
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {synthMode === 'persona' ? (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink">Харилцагчийн төрөл</label>
                      <select
                        value={synthPersona}
                        onChange={(e) => setSynthPersona(e.target.value)}
                        className="w-full rounded-xl border border-line bg-white p-2.5 text-xs outline-none focus:border-brand"
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
                      <label className="mb-1 block text-xs font-semibold text-ink">Харилцагч сонгох</label>
                      <select
                        value={synthContactId}
                        onChange={(e) => setSynthContactId(e.target.value)}
                        className="w-full rounded-xl border border-line bg-white p-2.5 text-xs outline-none focus:border-brand"
                      >
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName}
                            {c.company ? ` — ${c.company}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">Бүлэг (сонголтоор)</label>
                    <select
                      value={synthClusterId}
                      onChange={(e) => setSynthClusterId(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white p-2.5 text-xs outline-none focus:border-brand"
                    >
                      <option value="">Ерөнхий</option>
                      {clusters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <input
                  value={synthGoal}
                  onChange={(e) => setSynthGoal(e.target.value)}
                  placeholder="Ярианы зорилго (Ж.нь: Өөр газар даатгалтай гэсэн ч шилжүүлж авах)"
                  className="w-full rounded-xl border border-line p-2.5 text-xs outline-none focus:border-brand"
                />

                {/* Сэтгэлзүйн хөшүүрэг сонгох */}
                <div className="space-y-2 rounded-xl border border-line bg-canvas/35 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-ink">Сэтгэлзүйн хөшүүрэг ба бичвэрийн хэв маяг</label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-brand">
                      <input
                        type="checkbox"
                        checked={synthAbMode}
                        onChange={(e) => setSynthAbMode(e.target.checked)}
                        className="h-3.5 w-3.5 accent-brand"
                      />
                      <span>A/B туршилтын 2 хувилбар үүсгэх</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {PERSUASION_STYLES.map((st) => {
                      const active = synthTriggerStyle === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSynthTriggerStyle(st.id)}
                          className={clsx(
                            'rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors',
                            active
                              ? 'border-brand bg-brand text-white'
                              : 'border-line bg-white text-ink-2 hover:border-brand hover:text-ink',
                          )}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-ink-2">
                    <span className="font-semibold text-ink">{PERSUASION_STYLE_MAP[synthTriggerStyle].label}:</span>{' '}
                    {PERSUASION_STYLE_MAP[synthTriggerStyle].shortHint}
                  </p>

                  {synthAbMode && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-line/70 pt-2.5 text-xs">
                      <span className="font-medium text-ink">Хувилбар Б-ийн харьцуулах арга:</span>
                      <select
                        value={synthAbCompareStyle}
                        onChange={(e) => setSynthAbCompareStyle(e.target.value as PersuasionStyleId)}
                        className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs outline-none focus:border-brand"
                      >
                        {PERSUASION_STYLES.filter((s) => s.id !== 'auto' && s.id !== synthTriggerStyle).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Хуурамч яаравчлал ба баталгаагүй тоог хориглосон дүрмээр үүснэ.
                  </span>
                  <button
                    type="submit"
                    disabled={synthesizing || (synthMode === 'contact' && contacts.length === 0)}
                    className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    <Wand2 className={clsx('h-4 w-4 text-secondary', synthesizing && 'animate-spin')} />
                    <span>{synthesizing ? 'Боловсруулж байна...' : synthAbMode ? 'A/B хоёр хувилбар зохиох' : 'Асуулт зохиох'}</span>
                  </button>
                </div>
              </form>
            </div>

            {synthesized && (
              <div className="space-y-4">
                {synthesized.variantB && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs">
                    <div>
                      <p className="font-semibold text-indigo-900">A/B Туршилтын хоёр хувилбар бэлэн боллоо</p>
                      <p className="text-[11px] text-indigo-800">
                        Хоёуланг нь санд нийтлээд багийн санал, уулзалт ба гэрээ хаасан үр дүнгээр аль нь илүү ажиллаж буйг хэмжээрэй.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={publishingSynth}
                      onClick={() => synthesized.variantB && publishAbPairToBank(synthesized, synthesized.variantB)}
                      className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      {publishingSynth ? 'Нийтэлж байна...' : 'Хоёуланг нь A/B-ээр нийтлэх'}
                    </button>
                  </div>
                )}

                <div className={clsx('grid gap-4', synthesized.variantB ? 'lg:grid-cols-2' : 'grid-cols-1')}>
                  {([synthesized, ...(synthesized.variantB ? [synthesized.variantB] : [])] as SynthesizedQuestionDTO[]).map(
                    (item, idx) => (
                      <div key={`${item.triggerStyle || 'a'}-${idx}`} className="space-y-3.5 rounded-2xl border border-brand/30 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {synthesized.variantB && (
                              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                                Хувилбар {idx === 0 ? 'A' : 'B'}
                              </span>
                            )}
                            {item.triggerLabel && (
                              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                                {item.triggerLabel}
                              </span>
                            )}
                            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-lime-dark">
                              {item.targetPersonaName}
                            </span>
                          </div>
                        </div>

                        <p className="text-[15px] font-semibold leading-relaxed text-ink">{item.question}</p>
                        <p className="text-xs text-ink-2">{item.rationale}</p>

                        <div className="rounded-xl bg-canvas/60 p-3 text-xs space-y-1.5">
                          <div>
                            <p className="font-semibold text-brand">Дараагийн асуулт:</p>
                            <p className="mt-0.5 text-ink">{item.followUpQuestion}</p>
                          </div>
                          {item.predictedObjection && (
                            <div className="border-t border-line/60 pt-1.5">
                              <p className="font-semibold text-ink-2">Магадлалтай татгалзал:</p>
                              <p className="mt-0.5 text-ink-2">{item.predictedObjection}</p>
                            </div>
                          )}
                        </div>

                        {item.guardrailWarnings && item.guardrailWarnings.length > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
                            {item.guardrailWarnings.map((w) => (
                              <p key={w.code}>{w.message}</p>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => handleCopy(`synth-${idx}`, item.question)}
                            className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-ink-2 hover:text-ink"
                          >
                            {copiedId === `synth-${idx}` ? 'Хуулагдлаа' : 'Хуулах'}
                          </button>
                          <button
                            disabled={publishingSynth}
                            onClick={() =>
                              publishQuestionToBank({
                                title: item.title,
                                question: item.question,
                                tags: ['олоннийт'],
                                context: item.rationale,
                                triggerStyle: item.triggerStyle || null,
                              })
                            }
                            className="rounded-full border border-brand bg-brand-soft px-3.5 py-1.5 text-xs font-semibold text-brand"
                          >
                            Санд нийтлэх
                          </button>
                          <button
                            onClick={() =>
                              onApply(
                                synthMode === 'contact' && synthContactId ? synthContactId : targetContactId,
                                `Би энэ асуултыг ашиглах гэж байна: ${item.question}. Харилцагчид тохирсон ярианы дарааллыг гаргаж өг.`,
                              )
                            }
                            className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white"
                          >
                            Чат руу
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
