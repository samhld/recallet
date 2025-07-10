import { relations } from "drizzle-orm/relations";
import { users, entities, inputs, queries, relationships } from "./schema";

export const entitiesRelations = relations(entities, ({one, many}) => ({
	user: one(users, {
		fields: [entities.userId],
		references: [users.id]
	}),
	relationships_sourceEntityId: many(relationships, {
		relationName: "relationships_sourceEntityId_entities_id"
	}),
	relationships_targetEntityId: many(relationships, {
		relationName: "relationships_targetEntityId_entities_id"
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	entities: many(entities),
	inputs: many(inputs),
	queries: many(queries),
	relationships: many(relationships),
}));

export const inputsRelations = relations(inputs, ({one}) => ({
	user: one(users, {
		fields: [inputs.userId],
		references: [users.id]
	}),
}));

export const queriesRelations = relations(queries, ({one}) => ({
	user: one(users, {
		fields: [queries.userId],
		references: [users.id]
	}),
}));

export const relationshipsRelations = relations(relationships, ({one}) => ({
	user: one(users, {
		fields: [relationships.userId],
		references: [users.id]
	}),
	entity_sourceEntityId: one(entities, {
		fields: [relationships.sourceEntityId],
		references: [entities.id],
		relationName: "relationships_sourceEntityId_entities_id"
	}),
	entity_targetEntityId: one(entities, {
		fields: [relationships.targetEntityId],
		references: [entities.id],
		relationName: "relationships_targetEntityId_entities_id"
	}),
}));