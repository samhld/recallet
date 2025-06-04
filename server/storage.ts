import { users, inputs, queries, knowledgeGraph, entities, relationships, type User, type InsertUser, type Input, type InsertInput, type Query, type InsertQuery, type KnowledgeGraph, type InsertKnowledgeGraph, type Entity, type InsertEntity, type Relationship, type InsertRelationship } from "@shared/schema";
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
  
  // Knowledge Graph operations (legacy)
  createKnowledgeGraphEntry(entry: InsertKnowledgeGraph): Promise<KnowledgeGraph>;
  searchKnowledgeGraph(userId: number, entities: string[], relationshipEmbedding: number[]): Promise<{
    originalInputs: string[];
    targetEntities: string[];
  }>;
  
  // GraphRAG operations
  getOrCreateEntity(userId: number, entityName: string, username: string): Promise<Entity>;
  createRelationship(relationship: InsertRelationship): Promise<Relationship>;
  searchEntitiesByDescription(userId: number, queryEmbedding: number[]): Promise<Entity[]>;
  
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

  async createKnowledgeGraphEntry(entry: InsertKnowledgeGraph): Promise<KnowledgeGraph> {
    try {
      const [graphEntry] = await db
        .insert(knowledgeGraph)
        .values(entry)
        .returning();
      return graphEntry;
    } catch (error: any) {
      // If it's a unique constraint violation, check if the entry already exists
      if (error.code === '23505') { // PostgreSQL unique constraint violation code
        console.log(`⚠️ Duplicate knowledge graph entry detected, fetching existing: ${entry.sourceEntity} -> ${entry.relationship} -> ${entry.targetEntity}`);
        const [existing] = await db
          .select()
          .from(knowledgeGraph)
          .where(
            and(
              eq(knowledgeGraph.userId, entry.userId),
              eq(knowledgeGraph.sourceEntity, entry.sourceEntity),
              eq(knowledgeGraph.relationship, entry.relationship),
              eq(knowledgeGraph.targetEntity, entry.targetEntity)
            )
          );
        return existing;
      }
      throw error;
    }
  }

  async searchKnowledgeGraph(userId: number, entities: string[], relationshipEmbedding: number[]): Promise<{
    originalInputs: string[];
    targetEntities: string[];
  }> {
    console.log("🔍 Knowledge Graph Search Debug:");
    console.log("📊 User ID:", userId);
    console.log("🎯 Entities to search for:", entities);
    
    // Search both legacy knowledge_graph table and new relationships table
    let legacyResults: any[] = [];
    let newResults: any[] = [];
    
    if (entities.length > 0) {
      // Search legacy knowledge_graph table
      legacyResults = await db
        .select({
          sourceEntity: knowledgeGraph.sourceEntity,
          targetEntity: knowledgeGraph.targetEntity,
          relationship: knowledgeGraph.relationship,
          originalInput: knowledgeGraph.originalInput,
          distance: cosineDistance(knowledgeGraph.relationshipVec, relationshipEmbedding)
        })
        .from(knowledgeGraph)
        .where(
          and(
            eq(knowledgeGraph.userId, userId),
            or(
              ...entities.map(entity => eq(knowledgeGraph.sourceEntity, entity)),
              ...entities.map(entity => eq(knowledgeGraph.targetEntity, entity))
            )
          )
        )
        .orderBy(cosineDistance(knowledgeGraph.relationshipVec, relationshipEmbedding))
        .limit(10);

      // Search new relationships table with entity joins
      const embeddingVector = `[${relationshipEmbedding.join(',')}]`;
      const entityList = entities.map(e => `'${e}'`).join(',');
      
      newResults = await db.execute(sql`
        SELECT 
          e1.name as source_entity,
          e2.name as target_entity,
          r.relationship,
          r.original_input,
          cosine_distance(r.relationship_vec, ${embeddingVector}::vector) as distance
        FROM relationships r
        INNER JOIN entities e1 ON r.source_entity_id = e1.id
        INNER JOIN entities e2 ON r.target_entity_id = e2.id
        WHERE r.user_id = ${userId}
          AND (e1.name IN (${entityList}) OR e2.name IN (${entityList}))
        ORDER BY cosine_distance(r.relationship_vec, ${embeddingVector}::vector)
        LIMIT 10
      `).then(result => result.rows.map(row => ({
        sourceEntity: row.source_entity as string,
        targetEntity: row.target_entity as string,
        relationship: row.relationship as string,
        originalInput: row.original_input as string,
        distance: row.distance as number
      })));
    } else {
      // If no entities specified, search both tables by relationship similarity only
      legacyResults = await db
        .select({
          sourceEntity: knowledgeGraph.sourceEntity,
          targetEntity: knowledgeGraph.targetEntity,
          relationship: knowledgeGraph.relationship,
          originalInput: knowledgeGraph.originalInput,
          distance: cosineDistance(knowledgeGraph.relationshipVec, relationshipEmbedding)
        })
        .from(knowledgeGraph)
        .where(eq(knowledgeGraph.userId, userId))
        .orderBy(cosineDistance(knowledgeGraph.relationshipVec, relationshipEmbedding))
        .limit(10);

      newResults = [];
    }

    // Combine results from both tables
    const allResults = [...legacyResults, ...newResults];
    
    console.log("📋 Legacy results:", legacyResults.length);
    console.log("📋 New results:", newResults.length);
    console.log("📋 Combined results:", allResults);

    // Filter relevant results
    const filteredResults = allResults.filter(result => (result.distance as number) < 0.7);
    
    // Extract original inputs and target entities
    const originalInputs = filteredResults.map(result => result.originalInput);
    const targetEntities = filteredResults
      .map(result => result.targetEntity)
      .filter((entity, index, arr) => arr.indexOf(entity) === index); // remove duplicates
    
    console.log("✅ Original inputs found:", originalInputs);
    console.log("✅ Target entities found:", targetEntities);
    
    return { originalInputs, targetEntities };
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
}

export const storage = new DatabaseStorage();
