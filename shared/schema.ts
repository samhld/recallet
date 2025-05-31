import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inputs = pgTable("inputs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const queries = pgTable("queries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  query: text("query").notNull(),
  resultCount: integer("result_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  inputs: many(inputs),
  queries: many(queries),
}));

export const inputsRelations = relations(inputs, ({ one }) => ({
  user: one(users, {
    fields: [inputs.userId],
    references: [users.id],
  }),
}));

export const queriesRelations = relations(queries, ({ one }) => ({
  user: one(users, {
    fields: [queries.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertInputSchema = createInsertSchema(inputs).omit({
  id: true,
  createdAt: true,
});

export const insertQuerySchema = createInsertSchema(queries).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertInput = z.infer<typeof insertInputSchema>;
export type Input = typeof inputs.$inferSelect;
export type InsertQuery = z.infer<typeof insertQuerySchema>;
export type Query = typeof queries.$inferSelect;
