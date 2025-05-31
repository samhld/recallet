import { users, inputs, queries, type User, type InsertUser, type Input, type InsertInput, type Query, type InsertQuery } from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";

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
