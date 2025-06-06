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
    console.log("🔍 Enhanced Knowledge Graph Search:");
    console.log("📊 User ID:", userId);
    console.log("🎯 Entities to search for:", entities);
    
    if (entities.length === 0) {
      return { originalInputs: [], targetEntities: [] };
    }

    // Step 1: Entity Resolution
    let startingEntityId: number | null = null;
    const queryEntity = entities[0]; // Use first entity as primary
    
    // Check if entity exists exactly in user's data
    const exactMatch = await db.execute(sql`
      SELECT id, name FROM entities 
      WHERE user_id = ${userId} AND name = ${queryEntity}
      LIMIT 1
    `);
    
    if (exactMatch.rows.length > 0) {
      startingEntityId = exactMatch.rows[0].id as number;
      console.log(`📌 Found exact entity match: ${queryEntity} (id: ${startingEntityId})`);
    } else {
      // Find best matching entity using description embedding
      const entityEmbedding = await this.createEntityEmbedding(queryEntity);
      const entityEmbeddingVector = `[${entityEmbedding.join(',')}]`;
      
      const similarEntities = await db.execute(sql`
        SELECT id, name, description, 
               cosine_distance(description_vec, ${entityEmbeddingVector}::vector) as distance
        FROM entities 
        WHERE user_id = ${userId}
        ORDER BY cosine_distance(description_vec, ${entityEmbeddingVector}::vector)
        LIMIT 5
      `);
      
      if (similarEntities.rows.length > 0) {
        startingEntityId = similarEntities.rows[0].id as number;
        console.log(`📌 Found similar entity: ${similarEntities.rows[0].name} (id: ${startingEntityId}, distance: ${similarEntities.rows[0].distance})`);
      }
    }
    
    if (!startingEntityId) {
      console.log("❌ No starting entity found, returning empty results");
      return { originalInputs: [], targetEntities: [] };
    }
    
    // Step 2: Graph Walk (2 edges)
    console.log("🚶 Walking graph from entity id:", startingEntityId);
    
    // First edge: direct relationships from starting entity
    const firstEdgeQuery = await db.execute(sql`
      SELECT r.id, r.relationship, r.relationship_desc, r.relationship_desc_vec, 
             r.original_input, r.target_entity_id,
             e2.name as target_entity_name
      FROM relationships r
      INNER JOIN entities e2 ON r.target_entity_id = e2.id
      WHERE r.user_id = ${userId} AND r.source_entity_id = ${startingEntityId}
    `);
    
    // Second edge: relationships from first-edge targets
    const firstEdgeTargets = firstEdgeQuery.rows.map(row => row.target_entity_id);
    let secondEdgeQuery: any = { rows: [] };
    
    if (firstEdgeTargets.length > 0) {
      const targetIdsStr = firstEdgeTargets.join(',');
      secondEdgeQuery = await db.execute(sql`
        SELECT r.id, r.relationship, r.relationship_desc, r.relationship_desc_vec,
               r.original_input, r.target_entity_id,
               e2.name as target_entity_name
        FROM relationships r
        INNER JOIN entities e2 ON r.target_entity_id = e2.id
        WHERE r.user_id = ${userId} AND r.source_entity_id IN (${sql.raw(targetIdsStr)})
      `);
    }
    
    // Combine all discovered relationships
    const allRelationships = [...firstEdgeQuery.rows, ...secondEdgeQuery.rows];
    console.log(`🔗 Found ${firstEdgeQuery.rows.length} first-edge and ${secondEdgeQuery.rows.length} second-edge relationships`);
    
    if (allRelationships.length === 0) {
      console.log("❌ No relationships found in graph walk");
      return { originalInputs: [], targetEntities: [] };
    }
    
    // Step 3: Relationship Embedding Match with Statistical Filtering
    const relationshipDistances = allRelationships.map(rel => {
      const relDescVec = rel.relationship_desc_vec;
      if (!relDescVec) return { ...rel, distance: 1.0 };
      
      // Calculate cosine distance against relationship_desc_vec
      const distance = this.calculateCosineDistance(relationshipEmbedding, relDescVec);
      return { ...rel, distance };
    }).filter(rel => rel.distance < 0.76); // Only keep good matches (>0.24 similarity)
    
    if (relationshipDistances.length === 0) {
      console.log("❌ No relationships passed distance threshold");
      return { originalInputs: [], targetEntities: [] };
    }
    
    // Calculate statistics for filtering
    const distances = relationshipDistances.map(rel => rel.distance);
    const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);
    const threshold = mean + stdDev; // 1 standard deviation greater than mean (since lower distance = better match)
    
    console.log(`📊 Distance stats - Mean: ${mean.toFixed(4)}, StdDev: ${stdDev.toFixed(4)}, Threshold: ${threshold.toFixed(4)}`);
    
    // Filter results by statistical threshold (keep distances at most 1 std dev greater than mean)
    const filteredResults = relationshipDistances.filter(rel => rel.distance <= threshold);
    
    console.log(`🎯 ${filteredResults.length} relationships passed statistical filtering`);
    
    const originalInputsSet = new Set<string>();
    const targetEntitiesSet = new Set<string>();
    
    for (const result of filteredResults) {
      originalInputsSet.add(result.original_input);
      targetEntitiesSet.add(result.target_entity_name);
    }
    
    const originalInputs = Array.from(originalInputsSet);
    const targetEntities = Array.from(targetEntitiesSet);
    
    console.log("✅ Enhanced search found:", originalInputs.length, "inputs and", targetEntities.length, "entities");
    
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
      console.log("🔍 Query embedding vector length:", relationshipEmbedding.length);
      console.log("🎯 User ID being searched:", userId);
      
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
        relationship_desc: row.relationship_desc,
        distance: parseFloat(row.distance as string).toFixed(4)
      })));

      console.log("🔍 Executing filtered query with threshold 0.8...");
      
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
      
      console.log("🔍 Filtered query returned", queryResult.rows.length, "rows");

      console.log("📊 Raw relationship search results with distances:", queryResult.rows.map(row => ({
        source_entity_name: row.source_entity_name,
        target_entity_name: row.target_entity_name,
        relationship: row.relationship,
        relationship_desc: row.relationship_desc,
        distance: parseFloat(row.distance as string).toFixed(4),
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

  private calculateCosineDistance(vec1: number[], vec2: any): number {
    try {
      // Handle PostgreSQL vector format
      let vector2: number[];
      if (typeof vec2 === 'string') {
        // Parse PostgreSQL vector format like "[0.1, 0.2, ...]"
        const cleanStr = vec2.replace(/^\[|\]$/g, '');
        vector2 = cleanStr.split(',').map(s => parseFloat(s.trim()));
      } else if (Array.isArray(vec2)) {
        vector2 = vec2;
      } else {
        return 1.0; // Maximum distance for invalid vectors
      }
      
      if (vec1.length !== vector2.length) {
        return 1.0;
      }
      
      // Calculate cosine similarity then convert to distance
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;
      
      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vector2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vector2[i] * vector2[i];
      }
      
      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      return 1 - similarity; // Convert similarity to distance
    } catch (error) {
      console.error("Error calculating cosine distance:", error);
      return 1.0;
    }
  }
  
  private async createEntityEmbedding(entityName: string): Promise<number[]> {
    // Import the embedding creation function from llm.ts
    const { createEmbedding } = await import('./llm.js');
    return await createEmbedding(entityName);
  }
}

export const storage = new DatabaseStorage();
