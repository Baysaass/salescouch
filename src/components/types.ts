import type { ContactChannels, ContactPersona } from '@/db/schema';

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
}

export interface MessageDTO {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  skill: string | null;
  createdAt: string;
  pending?: boolean;
}

export interface QuestionDTO {
  id: string;
  userId: string;
  authorName: string;
  authorImage: string | null;
  category: string;
  title: string;
  question: string;
  context: string | null;
  votesCount: number;
  createdAt: string;
  commentsCount: number;
  userVoted: boolean;
}

export interface QuestionCommentDTO {
  id: string;
  questionId: string;
  userId: string;
  authorName: string;
  authorImage: string | null;
  content: string;
  createdAt: string;
}
