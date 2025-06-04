import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { insertUserSchema, insertInputSchema } from "@shared/schema";
import { parseInputToEntityRelationships, createEmbedding, parseQueryToEntityRelationship, synthesizeAnswerFromContext, detectExistingEntitiesForContextUpdate, generateRelationshipDescription } from "./llm";
import bcrypt from "bcrypt";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const searchSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || "dev-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  }));

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
      });

      // Set session
      req.session.userId = user.id;

      res.json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session
      req.session.userId = user.id;

      res.json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Invalid login data" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Input routes
  app.post("/api/inputs", requireAuth, async (req, res) => {
    try {
      const inputData = insertInputSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      
      // Create the traditional input
      const input = await storage.createInput(inputData);
      
      // Get the user for LLM parsing
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Parse input with LLM to extract entity-relationships using GraphRAG
      try {
        console.log("\n🚀 === PROCESSING INPUT FOR GRAPHRAG ===");
        console.log("📝 Input content:", inputData.content);
        console.log("👤 User:", user.username);
        
        const entityRelationships = await parseInputToEntityRelationships(
          inputData.content,
          user.username
        );
        
        // First, detect and update context for existing entities
        await detectExistingEntitiesForContextUpdate(
          entityRelationships,
          req.session.userId!,
          user.username,
          inputData.content
        );
        
        console.log("🔗 Creating GraphRAG entities and relationships...");
        
        // Process each relationship using GraphRAG approach
        for (const er of entityRelationships) {
          console.log(`\n📊 Processing relationship: ${er.sourceEntity} -> ${er.relationship} -> ${er.targetEntity}`);
          
          // Get or create source entity (with description generation only if new)
          const sourceEntity = await storage.getOrCreateEntity(
            req.session.userId!,
            er.sourceEntity,
            user.username
          );
          
          // Get or create target entity (with description generation only if new)
          const targetEntity = await storage.getOrCreateEntity(
            req.session.userId!,
            er.targetEntity,
            user.username
          );
          
          // Create relationship embedding
          const relationshipEmbedding = await createEmbedding(er.relationship);
          
          // Generate and embed relationship description for better semantic matching
          const relationshipDescription = await generateRelationshipDescription(
            er.sourceEntity,
            er.relationship,
            er.targetEntity
          );
          const relationshipDescEmbedding = await createEmbedding(relationshipDescription);
          
          // Create the relationship between entities
          const relationship = await storage.createRelationship({
            userId: req.session.userId!,
            sourceEntityId: sourceEntity.id,
            targetEntityId: targetEntity.id,
            relationship: er.relationship,
            relationshipVec: relationshipEmbedding,
            relationshipDesc: relationshipDescription,
            relationshipDescVec: relationshipDescEmbedding,
            originalInput: inputData.content,
          });
          
          console.log("✅ Relationship created with ID:", relationship.id);
        }
        
        console.log(`\n🎉 Successfully processed ${entityRelationships.length} relationships using GraphRAG`);
        console.log("🚀 === GRAPHRAG PROCESSING COMPLETE ===\n");
      } catch (llmError) {
        console.error("❌ LLM parsing failed, but input was saved:", llmError);
        // Continue even if LLM parsing fails
      }
      
      res.json(input);
    } catch (error) {
      console.error("Error creating input:", error);
      res.status(400).json({ message: "Invalid input data" });
    }
  });

  app.get("/api/inputs", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const inputs = await storage.getUserInputs(req.session.userId!, limit);
      res.json(inputs);
    } catch (error) {
      console.error("Error fetching inputs:", error);
      res.status(500).json({ message: "Failed to fetch inputs" });
    }
  });

  // Search routes
  app.post("/api/search", requireAuth, async (req, res) => {
    try {
      const { query, category } = searchSchema.parse(req.body);
      
      const results = await storage.searchInputs(req.session.userId!, query, category);
      
      // Log the query
      await storage.createQuery({
        userId: req.session.userId!,
        query,
        resultCount: results.length,
      });

      res.json(results);
    } catch (error) {
      console.error("Error searching:", error);
      res.status(400).json({ message: "Invalid search data" });
    }
  });

  // Smart search using knowledge graph
  app.post("/api/smart-search", requireAuth, async (req, res) => {
    try {
      const { query } = z.object({ query: z.string().min(1) }).parse(req.body);
      
      console.log("\n🔍 === SMART SEARCH REQUEST START ===");
      console.log("❓ User query:", query);
      
      // Get the user for LLM parsing
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log("👤 User:", user.username);
      
      // Parse query with LLM to extract entities and relationships
      const parsed = await parseQueryToEntityRelationship(query, user.username);
      
      console.log("🎯 Extracted entities:", parsed.entities);
      console.log("🔗 Extracted relationship:", parsed.relationship);
      
      // Optimization: Check if user entity is in the query entities
      const userEntityInQuery = parsed.entities.includes(user.username);
      if (userEntityInQuery) {
        console.log("🚀 OPTIMIZATION: User entity found in query, user-scoped search already implied");
      }
      
      // Generate query relationship description and create embedding for better semantic matching
      const queryRelationshipDescription = await generateRelationshipDescription(
        "the user",
        parsed.relationship,
        "the target entities being sought"
      );
      const relationshipEmbedding = await createEmbedding(queryRelationshipDescription);
      
      console.log("🔍 Searching knowledge graph and relationships (USER-SCOPED)...");
      console.log("👤 All searches limited to user ID:", req.session.userId);
      
      // Primary search: Find relationships by embedding similarity
      console.log("🔍 Primary: Relationship embedding search (USER-SCOPED)");
      const relationshipResults = await storage.searchRelationshipsByEmbedding(
        req.session.userId!,
        relationshipEmbedding
      );
      
      console.log("🎯 Found", relationshipResults.relationships.length, "matching relationships by embedding similarity");
      console.log("📌 All entities from relationship search:", relationshipResults.targetEntities);
      
      // Filter relationship results to only include entities that match query entities
      let filteredResults: { originalInputs: string[]; targetEntities: string[] } = { originalInputs: [], targetEntities: [] };
      
      if (parsed.entities.length > 0) {
        console.log("🔍 Filtering: Keep only relationships involving query entities");
        const filteredRelationships = relationshipResults.relationships.filter(rel => {
          // Check if any query entity appears as source or target in this specific relationship
          return parsed.entities.some(queryEntity => 
            rel.sourceEntityName === queryEntity || rel.targetEntityName === queryEntity
          );
        });
        
        console.log("✅ Filtered to", filteredRelationships.length, "relationships involving query entities");
        console.log("📌 Filtered relationships:", filteredRelationships.map(r => 
          `${r.sourceEntityName} -> ${r.relationship} -> ${r.targetEntityName}`
        ));
        
        filteredResults.originalInputs = filteredRelationships.map(r => r.originalInput);
        filteredResults.targetEntities = filteredRelationships.map(r => r.targetEntityName)
          .filter((entity, index, arr) => arr.indexOf(entity) === index); // remove duplicates
      } else {
        // No entity filter, use all relationship results
        filteredResults.originalInputs = relationshipResults.relationships.map(r => r.originalInput);
        filteredResults.targetEntities = relationshipResults.targetEntities;
      }
      
      console.log("🎯 Final search results:");
      console.log("📌 Total unique target entities:", filteredResults.targetEntities.length);
      console.log("📚 Total unique original inputs:", filteredResults.originalInputs.length);
      
      console.log("📊 Found target entities:", filteredResults.targetEntities);
      console.log("📚 Found original inputs:", filteredResults.originalInputs);
      
      // Synthesize final answer using LLM with filtered context
      const synthesizedAnswer = await synthesizeAnswerFromContext(query, filteredResults.originalInputs);
      
      console.log("🎯 Final synthesized answer:", synthesizedAnswer);
      
      // Generate the PostgreSQL query that was executed for debugging
      const postgresQuery = `SELECT 
  source_entity, 
  target_entity, 
  relationship,
  cosine_distance(relationship_vec, $1) as distance
FROM knowledge_graph 
WHERE user_id = $2 
ORDER BY cosine_distance(relationship_vec, $1) 
LIMIT 10;`;

      // Log the query with analysis data
      await storage.createQuery({
        userId: req.session.userId!,
        query,
        resultCount: filteredResults.targetEntities.length,
        entities: parsed.entities,
        relationship: parsed.relationship,
        postgresQuery,
      });

      console.log("✅ Smart search complete!");
      console.log("🔍 === SMART SEARCH REQUEST END ===\n");

      res.json({ 
        query: parsed,
        answers: [synthesizedAnswer], // Single synthesized answer
        rawAnswers: filteredResults.targetEntities, // Raw target entities for debugging
        originalInputs: filteredResults.originalInputs, // Context used
        entities: parsed.entities,
        relationship: parsed.relationship
      });
    } catch (error) {
      console.error("❌ Error in smart search:", error);
      res.status(400).json({ message: "Smart search failed" });
    }
  });

  // Stats routes
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getUserStats(req.session.userId!);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Query history
  app.get("/api/queries", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const queries = await storage.getUserQueries(req.session.userId!, limit);
      res.json(queries);
    } catch (error) {
      console.error("Error fetching queries:", error);
      res.status(500).json({ message: "Failed to fetch queries" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
