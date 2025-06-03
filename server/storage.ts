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
  searchKnowledgeGraph(userId: number, entities: string[], relationshipEmbedding: number[]): Promise<string[]>;
  
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

  async searchKnowledgeGraph(userId: number, entities: string[], relationshipEmbedding: number[]): Promise<string[]> {
    console.log("🔍 Knowledge Graph Search Debug:");
    console.log("📊 User ID:", userId);
    console.log("🎯 Entities to search for:", entities);
    
    // Search by relationship similarity only, for the user's knowledge graph
    const results = await db
      .select({
        sourceEntity: knowledgeGraph.sourceEntity,
        targetEntity: knowledgeGraph.targetEntity,
        relationship: knowledgeGraph.relationship,
        distance: cosineDistance(knowledgeGraph.relationshipVec, relationshipEmbedding)
      })
      .from(knowledgeGraph)
      .where(eq(knowledgeGraph.userId, userId))
      .orderBy(cosineDistance(knowledgeGraph.relationshipVec, relationshipEmbedding))
      .limit(10);

    console.log("📋 Raw database results:", results);
    console.log("🔢 Number of matches found:", results.length);

    // Filter and return relevant target entities
    const answers = results
      .filter(result => result.distance < 0.5) // Only include reasonably similar relationships
      .map(result => result.targetEntity)
      .filter((entity, index, arr) => arr.indexOf(entity) === index); // remove duplicates
    
    console.log("✅ Final answers after processing:", answers);
    return answers;
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
}

export const storage = new DatabaseStorage();
