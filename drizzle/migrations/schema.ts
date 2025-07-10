import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, foreignKey, varchar, text, json, timestamp, int } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const entities = mysqlTable("entities", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	descriptionVec: json("description_vec").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("user_entity_unique").on(table.userId, table.name),
	index("id").on(table.id),
]);

export const inputs = mysqlTable("inputs", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id),
	content: text().notNull(),
	category: varchar({ length: 255 }),
	tags: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("id").on(table.id),
]);

export const queries = mysqlTable("queries", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id),
	query: text().notNull(),
	resultCount: int("result_count").default(0).notNull(),
	entities: json(),
	relationship: varchar({ length: 255 }),
	postgresQuery: text("postgres_query"),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("id").on(table.id),
]);

export const relationships = mysqlTable("relationships", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id),
	sourceEntityId: bigint("source_entity_id", { mode: "number" }).notNull().references(() => entities.id),
	targetEntityId: bigint("target_entity_id", { mode: "number" }).notNull().references(() => entities.id),
	type: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("id").on(table.id),
]);

export const users = mysqlTable("users", {
	id: bigint({ mode: "number" }).autoincrement().notNull(),
	username: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("users_username_unique").on(table.username),
	index("id").on(table.id),
]);
