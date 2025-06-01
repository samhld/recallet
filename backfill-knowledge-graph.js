import { db } from './server/db';
import { users, inputs } from './shared/schema';
import { storage } from './server/storage';
import { parseInputToEntityRelationships, createEmbedding } from './server/llm';
import { eq } from 'drizzle-orm';

async function backfillKnowledgeGraph() {
  console.log("🚀 Starting knowledge graph backfill...");
  
  try {
    // Get all inputs with user info
    const inputsToProcess = await db
      .select({
        userId: inputs.userId,
        inputId: inputs.id,
        content: inputs.content,
        username: users.username
      })
      .from(inputs)
      .innerJoin(users, eq(inputs.userId, users.id))
      .orderBy(inputs.createdAt);

    console.log(`📊 Found ${inputsToProcess.length} inputs to process`);

    let processedCount = 0;
    let errorCount = 0;

    for (const input of inputsToProcess) {
      try {
        console.log(`\n📝 Processing input ${input.inputId}: "${input.content}"`);
        console.log(`👤 User: ${input.username}`);

        // Parse input with LLM to extract entity-relationships
        const entityRelationships = await parseInputToEntityRelationships(
          input.content,
          input.username
        );

        if (entityRelationships.length === 0) {
          console.log("⚠️ No relationships extracted from this input");
          continue;
        }

        // Create knowledge graph entries for each relationship
        for (const er of entityRelationships) {
          console.log(`\n📊 Processing relationship: ${er.sourceEntity} -> ${er.relationship} -> ${er.targetEntity}`);
          
          const relationshipEmbedding = await createEmbedding(er.relationship);
          
          const kgEntry = await storage.createKnowledgeGraphEntry({
            userId: input.userId,
            sourceEntity: er.sourceEntity,
            relationship: er.relationship,
            relationshipVec: relationshipEmbedding,
            targetEntity: er.targetEntity,
            originalInput: input.content,
          });
          
          console.log("✅ Knowledge graph entry created with ID:", kgEntry.id);
        }

        processedCount++;
        console.log(`🎉 Successfully processed input ${input.inputId} with ${entityRelationships.length} relationships`);

      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing input ${input.inputId}:`, error.message);
      }
    }

    console.log(`\n🏁 Backfill complete!`);
    console.log(`✅ Successfully processed: ${processedCount} inputs`);
    console.log(`❌ Errors: ${errorCount} inputs`);

  } catch (error) {
    console.error("❌ Fatal error during backfill:", error);
  }
}

// Run the backfill
backfillKnowledgeGraph()
  .then(() => {
    console.log("🎯 Backfill script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Backfill script failed:", error);
    process.exit(1);
  });