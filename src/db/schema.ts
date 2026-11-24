import { jsonb, pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';

export interface ContactChannels {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  telegram?: string;
  whatsapp?: string;
  website?: string;
  other?: string;
}

export interface ContactPersona {
  summary?: string;
  segment?: string; // Хувь хүн / ЖДҮ / Корпорац
  decisionRole?: string; // Шийдвэр гаргагч, нөлөөлөгч ...
  goals?: string;
  pains?: string;
  budget?: string;
  timeline?: string;
  objections?: string;
  communicationStyle?: string;
  currentInsurer?: string;
  productsOfInterest?: string;
  renewalDate?: string;
}

export const users = pgTable('users', {
  id: text('id').primaryKey(), // имэйл (жижиг үсгээр)
  email: text('email').notNull(),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    fullName: text('full_name').notNull(),
    company: text('company'),
    role: text('role'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    stage: text('stage').notNull().default('lead'),
    temperature: text('temperature').notNull().default('warm'),
    channels: jsonb('channels').$type<ContactChannels>().notNull().default({}),
    persona: jsonb('persona').$type<ContactPersona>().notNull().default({}),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('contacts_user_idx').on(t.userId)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contactId: uuid('contact_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    skill: text('skill'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('messages_contact_idx').on(t.contactId)],
);

export type Contact = typeof contacts.$inferSelect;
export type Message = typeof messages.$inferSelect;
