import { users, inputs, queries, entities, relationships, type User, type InsertUser, type Input, type InsertInput, type Query, type InsertQuery, type Entity, type InsertEntity, type Relationship, type InsertRelationship } from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, or, and, sql, cosineDistance } from "drizzle-orm";
import { generateEntityDescription, createEmbedding } from "./llm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Input operations
  createInput(input: InsertInput): Promise<Input>;
  getUserInputs(userId: number, limit?: number): Promise<Input[]>;
  searchInputs(userId: number, searchTerm: string, category?: string): Promise<Input[]>;
  
  // Query operations
  createQuery(query: InsertQuery): Promise<Query>;
  getUserQueries(userId: number, limit?: number): Promise<Query[]>;
  
  // Knowledge Graph operations (entity + relationship combined search)
  searchKnowledgeGraph(userId: number, entities: string[], relationshipEmbedding: number[]): Promise<{
    originalInputs: string[];
    targetEntities: string[];
  }>;
  
  // Entity and Relationship operations
  getOrCreateEntity(userId: number, entityName: string, username: string): Promise<Entity>;
  createRelationship(relationship: InsertRelationship): Promise<Relationship>;
  searchEntitiesByDescription(userId: number, queryEmbedding: number[]): Promise<Entity[]>;
  updateEntityContext(userId: number, entityName: string, additionalContext: string, username: string): Promise<Entity>;
  searchRelationshipsByEmbedding(userId: number, relationshipEmbedding: number[]): Promise<{
    relationships: (Relationship & { sourceEntityName: string; targetEntityName: string })[];
    targetEntities: string[];
  }>;
  
  // Stats operations
  getUserStats(userId: number): Promise<{
    totalInputs: number;
    totalQueries: number;
    thisWeekInputs: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createInput(insertInput: InsertInput): Promise<Input> {
    const [input] = await db
      .insert(inputs)
      .values(insertInput)
      .returning();
    return input;
  }

  async getUserInputs(userId: number, limit: number = 10): Promise<Input[]> {
    return await db
      .select()
      .from(inputs)
      .where(eq(inputs.userId, userId))
      .orderBy(desc(inputs.createdAt))
      .limit(limit);
  }

  async searchInputs(userId: number, searchTerm: string, category?: string): Promise<Input[]> {
    const conditions = [eq(inputs.userId, userId)];
    
    if (searchTerm) {
      conditions.push(
        or(
          ilike(inputs.content, `%${searchTerm}%`),
          ilike(inputs.tags, `%${searchTerm}%`)
        )!
      );
    }
    
    if (category) {
      conditions.push(eq(inputs.category, category));
    }

    return await db
      .select()
      .from(inputs)
      .where(and(...conditions))
      .orderBy(desc(inputs.createdAt));
  }

  async createQuery(insertQuery: InsertQuery): Promise<Query> {
    const [query] = await db
      .insert(queries)
      .values(insertQuery)
      .returning();
    return query;
  }

  async getUserQueries(userId: number, limit: number = 10): Promise<Query[]> {
    return await db
      .select()
      .from(queries)
      .where(eq(queries.userId, userId))
      .orderBy(desc(queries.createdAt))
      .limit(limit);
  }

  async createKnowledgeGraphEntry(entry: any): Promise<any> {
    // Legacy method - no longer used, entities and relationships tables are used instead
    throw new Error("createKnowledgeGraphEntry is deprecated - use entity/relationship methods instead");
  }

  async searchKnowledgeGraph(userId: number, entities: string[], relationshipEmbedding: number[]): Promise<{
    originalInputs: string[];
    targetEntities: string[];
  }> {
    console.log("🔍 Entity + Relationship Combined Search:");
    console.log("📊 User ID:", userId);
    console.log("🎯 Entities to search for:", entities);
    console.log("🔗 Must match BOTH entity AND relationship similarity");
    
    if (entities.length === 0) {
      return { originalInputs: [], targetEntities: [] };
    }

    // Search relationships table where entity matches AND relationship is similar
    const embeddingVector = `[${relationshipEmbedding.join(',')}]`;
    
    let entityQuery = '';
    if (entities.length === 1) {
      entityQuery = `AND (e1.name = '${entities[0]}' OR e2.name = '${entities[0]}')`;
    } else {
      const conditions = entities.map(entity => `e1.name = '${entity}' OR e2.name = '${entity}'`).join(' OR ');
      entityQuery = `AND (${conditions})`;
    }
    
    const queryResult = await db.execute(sql`
      SELECT 
        e1.name as source_entity,
        e2.name as target_entity,
        r.relationship,
        r.original_input,
        cosine_distance(r.relationship_vec, ${embeddingVector}::vector) as distance
      FROM relationships r
      INNER JOIN entities e1 ON r.source_entity_id = e1.id
      INNER JOIN entities e2 ON r.target_entity_id = e2.id
      WHERE r.user_id = ${userId} ${sql.raw(entityQuery)}
        AND cosine_distance(r.relationship_vec, ${embeddingVector}::vector) < 0.7
      ORDER BY cosine_distance(r.relationship_vec, ${embeddingVector}::vector)
      LIMIT 5
    `);
    
    console.log("🔍 Combined search results:", queryResult.rows.map(row => ({
      source_entity: row.source_entity,
      target_entity: row.target_entity,
      relationship: row.relationship,
      distance: row.distance,
      original_input: row.original_input
    })));
    
    const results = queryResult.rows.map(row => ({
      sourceEntity: row.source_entity as string,
      targetEntity: row.target_entity as string,
      relationship: row.relationship as string,
      originalInput: row.original_input as string,
      distance: row.distance as number
    }));

    const originalInputsSet = new Set<string>();
    const targetEntitiesSet = new Set<string>();

    for (const result of results) {
      originalInputsSet.add(result.originalInput);
      targetEntitiesSet.add(result.targetEntity);
    }

    const originalInputs = Array.from(originalInputsSet);
    const targetEntities = Array.from(targetEntitiesSet);

    console.log("✅ Combined search found:", originalInputs.length, "inputs and", targetEntities.length, "entities");

    return {
      originalInputs,
      targetEntities,
    };
  }

  async getUserStats(userId: number): Promise<{
    totalInputs: number;
    totalQueries: number;
    thisWeekInputs: number;
  }> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [totalInputsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inputs)
      .where(eq(inputs.userId, userId));

    const [totalQueriesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(queries)
      .where(eq(queries.userId, userId));

    const [thisWeekInputsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inputs)
      .where(
        and(
          eq(inputs.userId, userId),
          sql`${inputs.createdAt} > ${weekAgo}`
        )
      );

    return {
      totalInputs: totalInputsResult.count || 0,
      totalQueries: totalQueriesResult.count || 0,
      thisWeekInputs: thisWeekInputsResult.count || 0,
    };
  }

  async getOrCreateEntity(userId: number, entityName: string, username: string): Promise<Entity> {
    try {
      // First, check if entity already exists
      const [existingEntity] = await db
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.userId, userId),
            eq(entities.name, entityName)
          )
        );

      if (existingEntity) {
        console.log(`📌 Entity "${entityName}" already exists, skipping description generation`);
        return existingEntity;
      }

      console.log(`✨ Creating new entity "${entityName}" for user ${username}`);
      
      // Generate description and embedding for new entity
      const description = await generateEntityDescription(entityName, username);
      const descriptionVec = await createEmbedding(description);

      // Create the new entity
      const [newEntity] = await db
        .insert(entities)
        .values({
          userId,
          name: entityName,
          description,
          descriptionVec,
        })
        .returning();

      console.log(`✅ Created entity "${entityName}" with ID ${newEntity.id}`);
      return newEntity;

    } catch (error: any) {
      // Handle unique constraint violation (in case of race condition)
      if (error.code === '23505') {
        console.log(`⚠️ Unique constraint violation for entity "${entityName}", fetching existing`);
        const [existingEntity] = await db
          .select()
          .from(entities)
          .where(
            and(
              eq(entities.userId, userId),
              eq(entities.name, entityName)
            )
          );
        return existingEntity;
      }
      throw error;
    }
  }

  async createRelationship(relationship: InsertRelationship): Promise<Relationship> {
    try {
      const [newRelationship] = await db
        .insert(relationships)
        .values(relationship)
        .returning();
      return newRelationship;
    } catch (error: any) {
      // Handle unique constraint violation gracefully
      if (error.code === '23505') {
        console.log(`⚠️ Duplicate relationship detected, fetching existing`);
        const [existing] = await db
          .select()
          .from(relationships)
          .where(
            and(
              eq(relationships.userId, relationship.userId),
              eq(relationships.sourceEntityId, relationship.sourceEntityId),
              eq(relationships.relationship, relationship.relationship),
              eq(relationships.targetEntityId, relationship.targetEntityId)
            )
          );
        return existing;
      }
      throw error;
    }
  }

  async searchEntitiesByDescription(userId: number, queryEmbedding: number[]): Promise<Entity[]> {
    const results = await db
      .select()
      .from(entities)
      .where(eq(entities.userId, userId))
      .orderBy(cosineDistance(entities.descriptionVec, queryEmbedding))
      .limit(10);

    return results.filter(entity => entity.descriptionVec); // Only return entities with embeddings
  }

  async updateEntityContext(userId: number, entityName: string, additionalContext: string, username: string): Promise<Entity> {
    try {
      // Get the existing entity
      const [existingEntity] = await db
        .select()
        .from(entities)
        .where(
          and(
            eq(entities.userId, userId),
            eq(entities.name, entityName)
          )
        );

      if (!existingEntity) {
        throw new Error(`Entity "${entityName}" not found`);
      }

      // Append the additional context to the existing description
      const updatedDescription = existingEntity.description 
        ? `${existingEntity.description}\n\nAdditional context: ${additionalContext}`
        : `Additional context: ${additionalContext}`;

      console.log(`📝 Updating entity "${entityName}" with additional context`);
      console.log(`🔄 Original description: ${existingEntity.description}`);
      console.log(`➕ Additional context: ${additionalContext}`);
      console.log(`📊 Updated description: ${updatedDescription}`);

      // Create new embedding for the updated description
      const updatedDescriptionVec = await createEmbedding(updatedDescription);

      // Update the entity with new description and embedding
      const [updatedEntity] = await db
        .update(entities)
        .set({
          description: updatedDescription,
          descriptionVec: updatedDescriptionVec,
        })
        .where(
          and(
            eq(entities.userId, userId),
            eq(entities.name, entityName)
          )
        )
        .returning();

      console.log(`✅ Successfully updated entity "${entityName}"`);
      return updatedEntity;

    } catch (error) {
      console.error(`❌ Error updating entity context for "${entityName}":`, error);
      throw error;
    }
  }

  async searchRelationshipsByEmbedding(userId: number, relationshipEmbedding: number[]): Promise<{
    relationships: (Relationship & { sourceEntityName: string; targetEntityName: string })[];
    targetEntities: string[];
  }> {
    try {
      console.log("🔍 Searching RELATIONSHIP DESCRIPTION EMBEDDINGS in relationship_desc_vec column");
      console.log("🎯 Searching for relationships similar to the query relationship using enhanced descriptions");
      
      // Search relationships table by relationship description embedding similarity
      const embeddingVector = `[${relationshipEmbedding.join(',')}]`;
      
      console.log("📊 SQL Query: Searching relationship_desc_vec column with cosine_distance for similarity");
      
      // First, get all relationships and show their distances
      const allRelationshipsQuery = await db.execute(sql`
        SELECT 
          r.*,
          e1.name as source_entity_name,
          e2.name as target_entity_name,
          CASE 
            WHEN r.relationship_desc_vec IS NOT NULL THEN cosine_distance(r.relationship_desc_vec, ${embeddingVector}::vector)
            ELSE cosine_distance(r.relationship_vec, ${embeddingVector}::vector)
          END as distance
        FROM relationships r
        INNER JOIN entities e1 ON r.source_entity_id = e1.id
        INNER JOIN entities e2 ON r.target_entity_id = e2.id
        WHERE r.user_id = ${userId}
        ORDER BY distance
        LIMIT 10
      `);

      console.log("📊 ALL relationships with distances (for analysis):", allRelationshipsQuery.rows.map(row => ({
        source_entity_name: row.source_entity_name,
        target_entity_name: row.target_entity_name,
        relationship: row.relationship,
        distance: parseFloat(row.distance as string).toFixed(4),
        embedding_type: row.relationship_desc_vec ? 'description' : 'original',
        has_desc: row.relationship_desc ? 'YES' : 'NO'
      })));

      const queryResult = await db.execute(sql`
        SELECT 
          r.*,
          e1.name as source_entity_name,
          e2.name as target_entity_name,
          CASE 
            WHEN r.relationship_desc_vec IS NOT NULL THEN cosine_distance(r.relationship_desc_vec, ${embeddingVector}::vector)
            ELSE cosine_distance(r.relationship_vec, ${embeddingVector}::vector)
          END as distance
        FROM relationships r
        INNER JOIN entities e1 ON r.source_entity_id = e1.id
        INNER JOIN entities e2 ON r.target_entity_id = e2.id
        WHERE r.user_id = ${userId}
          AND (
            (r.relationship_desc_vec IS NOT NULL AND cosine_distance(r.relationship_desc_vec, ${embeddingVector}::vector) < 0.8)
            OR 
            (r.relationship_desc_vec IS NULL AND cosine_distance(r.relationship_vec, ${embeddingVector}::vector) < 0.8)
          )
        ORDER BY distance
        LIMIT 5
      `);

      console.log("📊 Raw relationship search results with distances:", queryResult.rows.map(row => ({
        source_entity_name: row.source_entity_name,
        target_entity_name: row.target_entity_name,
        relationship: row.relationship,
        distance: parseFloat(row.distance as string).toFixed(4),
        embedding_type: row.relationship_desc_vec ? 'description' : 'original',
        original_input: row.original_input
      })));

      const relationships = queryResult.rows.map(row => ({
        id: row.id as number,
        userId: row.user_id as number,
        sourceEntityId: row.source_entity_id as number,
        targetEntityId: row.target_entity_id as number,
        relationship: row.relationship as string,
        relationshipVec: row.relationship_vec as number[],
        relationshipDesc: row.relationship_desc as string | null,
        relationshipDescVec: row.relationship_desc_vec as number[] | null,
        originalInput: row.original_input as string,
        createdAt: row.created_at as Date,
        sourceEntityName: row.source_entity_name as string,
        targetEntityName: row.target_entity_name as string,
      }));

      const targetEntities = queryResult.rows.map(row => row.target_entity_name as string);

      console.log(`🎯 Found ${relationships.length} matching relationships by embedding similarity`);
      console.log(`📌 Target entities from relationship search: ${targetEntities.join(', ')}`);

      return {
        relationships,
        targetEntities,
      };

    } catch (error) {
      console.error("❌ Error searching relationships by embedding:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
