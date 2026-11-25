import { z } from 'zod';

const str = z.string().trim().max(2000).optional().nullable();

export const contactInput = z.object({
  fullName: z.string().trim().min(1, 'Нэр заавал').max(200),
  company: str,
  role: str,
  phone: str,
  email: z.union([z.literal(''), z.string().trim().email('Имэйл буруу')]).optional().nullable(),
  address: str,
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  temperature: z.enum(['hot', 'warm', 'cold']).optional(),
  channels: z.record(z.string(), z.string().max(500)).optional(),
  persona: z.record(z.string(), z.string().max(2000)).optional(),
  notes: z.string().max(10000).optional().nullable(),
});

export const contactPatch = contactInput.partial();

export const messageInput = z.object({
  role: z.enum(['user', 'assistant']).optional().default('user'),
  content: z.string().trim().min(1).max(32000),
  skill: z.string().max(64).optional().nullable(),
});

export const QUESTION_CATEGORIES = ['discovery', 'spin', 'bant', 'objection', 'closing', 'digital', 'renewal'] as const;

export const questionInput = z.object({
  title: z.string().trim().min(3, 'Гарчиг хамгийн багадаа 3 тэмдэгт байна').max(200),
  question: z.string().trim().min(5, 'Асуулт хамгийн багадаа 5 тэмдэгт байна').max(2000),
  category: z.enum(QUESTION_CATEGORIES).default('discovery'),
  context: z.string().trim().max(2000).optional().nullable(),
});

export const questionCommentInput = z.object({
  content: z.string().trim().min(1, 'Сэтгэгдэл хоосон байна').max(2000),
});

export function clean(o?: Record<string, string>) {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v.trim()]));
}
