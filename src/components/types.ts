import type { ContactChannels, ContactPersona, PersonaMatch } from '@/db/schema';
import type { UserPlan } from '@/lib/api';
import type { CommentOutcomeId, GuardrailWarning, PersuasionStyleId } from '@/lib/persuasion-frameworks';

export interface ContactShareInfoDTO {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  plan?: UserPlan;
  note?: string | null;
  sharedAt: string;
}

export interface RegisteredUserDTO {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  plan?: UserPlan;
}

export interface ContactDTO {
  id: string;
  fullName: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  stage: string;
  temperature: string;
  channels: ContactChannels;
  persona: ContactPersona;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string | null;
  lastAt?: string | null;
  isOwner?: boolean;
  sharedBy?: ContactShareInfoDTO | null;
  sharedWith?: ContactShareInfoDTO[];
}

export interface MessageDTO {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  skill: string | null;
  createdAt: string;
  pending?: boolean;
}

export interface VoterInfoDTO {
  userId: string;
  name: string;
  image: string | null;
  plan?: UserPlan;
}

export interface QuestionDTO {
  id: string;
  userId: string;
  authorName: string;
  authorImage: string | null;
  authorPlan?: UserPlan;
  category: string;
  tags: string[];
  title: string;
  question: string;
  context: string | null;
  votesCount: number;
  dislikesCount: number;
  createdAt: string;
  commentsCount: number;
  triggerStyle?: PersuasionStyleId | string | null;
  abGroup?: string | null;
  abVariantLabel?: 'A' | 'B' | string | null;
  outcomes?: { closed: number; meeting: number; rejected: number };
  userVote: 'like' | 'unlike' | null;
  likedBy: VoterInfoDTO[];
  unlikedBy: VoterInfoDTO[];
  clusterId?: string | null;
  personaScores?: PersonaMatch[];
  aiAnalysis?: string | null;
  refinedVariant?: string | null;
  relatedQuestionIds?: string[];
  analyzedAt?: string | null;
}

export interface QuestionClusterDTO {
  id: string;
  name: string;
  summary: string;
  performanceVerdict: string;
  bestPersonas: PersonaMatch[];
  nextClusterId: string | null;
  nextClusterReason: string | null;
  refinedQuestion: string;
  refinedRationale: string;
  questionCount: number;
  avgVotes: number;
  updatedAt: string;
}

export interface SynthesizedQuestionDTO {
  title: string;
  category: 'discovery' | 'spin' | 'bant' | 'objection' | 'closing' | 'digital' | 'renewal';
  question: string;
  context: string;
  rationale: string;
  followUpQuestion: string;
  predictedObjection: string;
  targetPersonaName: string;
  triggerStyle?: PersuasionStyleId;
  triggerLabel?: string;
  guardrailWarnings?: GuardrailWarning[];
  variantB?: SynthesizedQuestionDTO | null;
}

export interface QuestionCommentDTO {
  id: string;
  questionId: string;
  userId: string;
  authorName: string;
  authorImage: string | null;
  authorPlan?: UserPlan;
  content: string;
  outcome?: CommentOutcomeId | string | null;
  createdAt: string;
}
