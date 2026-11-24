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
  content: z.string().trim().min(1).max(8000),
  skill: z.string().max(64).optional().nullable(),
});

export function clean(o?: Record<string, string>) {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v.trim()]));
}
