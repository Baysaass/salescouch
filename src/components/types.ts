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
