import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { profiles } from './users';

export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  targetType: text('target_type').notNull(), // 'release' | 'user' | 'radar_match'
  targetId: text('target_id').notNull(),
  note: text('note'),
  status: text('status').notNull().default('watching'), // 'watching' | 'contacted' | 'dead_end' | 'found'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userTargetUnique: unique().on(table.userId, table.targetType, table.targetId),
}));

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatus = 'watching' | 'contacted' | 'dead_end' | 'found';
export type LeadTargetType = 'release' | 'user' | 'radar_match';
