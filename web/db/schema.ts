import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  tokenA: text("token_a").notNull(),
  tokenB: text("token_b"),
  invite: text("invite"),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const usage = sqliteTable("usage_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
});

export const householdDecisions = sqliteTable(
  "household_decisions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    data: text("data").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("decision_room_updated").on(table.roomId, table.updatedAt)],
);
export const householdReviews = sqliteTable(
  "household_reviews",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    week: text("week").notNull(),
    data: text("data").notNull(),
    revision: integer("revision").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("review_room_week").on(table.roomId, table.week)],
);
export const planHistory = sqliteTable(
  "plan_history",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    planVersion: integer("plan_version").notNull(),
    data: text("data").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("history_room_version").on(table.roomId, table.planVersion),
  ],
);

export const householdMonths = sqliteTable(
  "household_months",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    period: text("period").notNull(),
    data: text("data").notNull(),
    revision: integer("revision").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("month_room_period").on(table.roomId, table.period)],
);
