import { mysqlTable, text, serial, int, bigint, timestamp, varchar, json, uniqueIndex, customType } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// TiDB Vector type definition
const vector = customType<{ data: number[]; notNull: false; default: false }>({
  dataType() {
    return "VECTOR(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === 'string') {
      // Parse TiDB vector format like "[0.1, 0.2, ...]"
      const cleanStr = value.replace(/^\[|\]$/g, '');
      return cleanStr.split(',').map(s => parseFloat(s.trim()));
    }
    return value as number[];
  },
});

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inputs = mysqlTable("inputs", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  content: text("content").notNull(),
  category: varchar("category", { length: 255 }),
  tags: varchar("tags", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const queries = mysqlTable("queries", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  query: text("query").notNull(),
  resultCount: int("result_count").notNull().default(0),
  entities: json("entities"),
  relationship: varchar("relationship", { length: 255 }),
  postgresQuery: text("postgres_query"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const entities = mysqlTable("entities", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // TiDB vector type for 1536-dimensional embeddings (OpenAI ada-002)
  descriptionVec: vector("description_vec").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    uniqueEntity: uniqueIndex("user_entity_unique").on(table.userId, table.name),
  };
});

export const relationships = mysqlTable("relationships", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  sourceEntityId: bigint("source_entity_id", { mode: "number", unsigned: true }).notNull().references(() => entities.id),
  targetEntityId: bigint("target_entity_id", { mode: "number", unsigned: true }).notNull().references(() => entities.id),
  relationship: varchar("relationship", { length: 255 }).notNull(),
  // TiDB vector type for 1536-dimensional embeddings
  relationshipVec: vector("relationship_vec").notNull(),
  relationshipDesc: text("relationship_desc"),
  relationshipDescVec: vector("relationship_desc_vec"),
  originalInput: text("original_input").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    uniqueRelationship: uniqueIndex("user_source_rel_target_unique").on(table.userId, table.sourceEntityId, table.relationship, table.targetEntityId),
  };
});

export const aliasGroups = mysqlTable("alias_groups", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  canonicalEntityId: bigint("canonical_entity_id", { mode: "number", unsigned: true }).references(() => entities.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const entityAliases = mysqlTable("entity_aliases", {
  entityId: bigint("entity_id", { mode: "number", unsigned: true }).primaryKey().references(() => entities.id),
  aliasGroupId: bigint("alias_group_id", { mode: "number", unsigned: true }).notNull().references(() => aliasGroups.id),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});



// Relations
export const usersRelations = relations(users, ({ many }) => ({
  inputs: many(inputs),
  queries: many(queries),
  entities: many(entities),
  relationships: many(relationships),
  aliasGroups: many(aliasGroups),
  entityAliases: many(entityAliases),
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
  aliasGroup: one(entityAliases, {
    fields: [entities.id],
    references: [entityAliases.entityId],
  }),
  canonicalAliasGroups: many(aliasGroups, { relationName: "canonicalEntity" }),
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

export const aliasGroupsRelations = relations(aliasGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [aliasGroups.userId],
    references: [users.id],
  }),
  canonicalEntity: one(entities, {
    fields: [aliasGroups.canonicalEntityId],
    references: [entities.id],
    relationName: "canonicalEntity",
  }),
  entityAliases: many(entityAliases),
}));

export const entityAliasesRelations = relations(entityAliases, ({ one }) => ({
  user: one(users, {
    fields: [entityAliases.userId],
    references: [users.id],
  }),
  entity: one(entities, {
    fields: [entityAliases.entityId],
    references: [entities.id],
  }),
  aliasGroup: one(aliasGroups, {
    fields: [entityAliases.aliasGroupId],
    references: [aliasGroups.id],
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

export const insertAliasGroupSchema = createInsertSchema(aliasGroups).omit({
  id: true,
  createdAt: true,
});

export const insertEntityAliasSchema = createInsertSchema(entityAliases).omit({
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

export type InsertAliasGroup = z.infer<typeof insertAliasGroupSchema>;
export type AliasGroup = typeof aliasGroups.$inferSelect;
export type InsertEntityAlias = z.infer<typeof insertEntityAliasSchema>;
export type EntityAlias = typeof entityAliases.$inferSelect;
