import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  tokenA: text('token_a').notNull(),
  tokenB: text('token_b'),
  invite: text('invite'),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(),
});

export const usage = sqliteTable('usage_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
});
