import { pgTable, text, serial, integer, boolean, timestamp, varchar, vector, jsonb, unique } from "drizzle-orm/pg-core";
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
  entities: jsonb("entities"),
  relationship: text("relationship"),
  postgresQuery: text("postgres_query"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const entities = pgTable("entities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  descriptionVec: vector("description_vec", { dimensions: 1536 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    uniqueEntity: unique().on(table.userId, table.name),
  };
});

export const relationships = pgTable("relationships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  sourceEntityId: integer("source_entity_id").notNull().references(() => entities.id),
  targetEntityId: integer("target_entity_id").notNull().references(() => entities.id),
  relationship: text("relationship").notNull(),
  relationshipVec: vector("relationship_vec", { dimensions: 1536 }),
  relationshipDescVec: vector("relationship_desc_vec", { dimensions: 1536 }),
  originalInput: text("original_input").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    uniqueRelationship: unique().on(table.userId, table.sourceEntityId, table.relationship, table.targetEntityId),
  };
});



// Relations
export const usersRelations = relations(users, ({ many }) => ({
  inputs: many(inputs),
  queries: many(queries),
  entities: many(entities),
  relationships: many(relationships),
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

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  user: one(users, {
    fields: [entities.userId],
    references: [users.id],
  }),
  sourceRelationships: many(relationships, { relationName: "sourceEntity" }),
  targetRelationships: many(relationships, { relationName: "targetEntity" }),
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  user: one(users, {
    fields: [relationships.userId],
    references: [users.id],
  }),
  sourceEntity: one(entities, {
    fields: [relationships.sourceEntityId],
    references: [entities.id],
    relationName: "sourceEntity",
  }),
  targetEntity: one(entities, {
    fields: [relationships.targetEntityId],
    references: [entities.id],
    relationName: "targetEntity",
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



export const insertEntitySchema = createInsertSchema(entities).omit({
  id: true,
  createdAt: true,
});

export const insertRelationshipSchema = createInsertSchema(relationships).omit({
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

export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entities.$inferSelect;
export type InsertRelationship = z.infer<typeof insertRelationshipSchema>;
export type Relationship = typeof relationships.$inferSelect;
