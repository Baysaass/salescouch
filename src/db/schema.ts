import { integer, jsonb, pgTable, text, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';

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

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    authorName: text('author_name').notNull(),
    authorImage: text('author_image'),
    category: text('category').notNull(), // 'discovery' | 'spin' | 'bant' | 'objection' | 'closing' | 'cold' | 'renewal' | 'referral'
    title: text('title').notNull(),
    question: text('question').notNull(),
    context: text('context'),
    votesCount: integer('votes_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('questions_category_idx').on(t.category), index('questions_votes_idx').on(t.votesCount)],
);

export const questionVotes = pgTable(
  'question_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    questionId: uuid('question_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('question_votes_uniq_idx').on(t.questionId, t.userId),
    index('question_votes_question_idx').on(t.questionId),
  ],
);

export const questionComments = pgTable(
  'question_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    questionId: uuid('question_id').notNull(),
    userId: text('user_id').notNull(),
    authorName: text('author_name').notNull(),
    authorImage: text('author_image'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('question_comments_question_idx').on(t.questionId)],
);

export type Question = typeof questions.$inferSelect;
export type QuestionVote = typeof questionVotes.$inferSelect;
export type QuestionComment = typeof questionComments.$inferSelect;
