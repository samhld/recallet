const { db } = require("./server/db");
const { relationships, entities } = require("./shared/schema");
const { eq, and, isNull } = require("drizzle-orm");
const { generateRelationshipDescription, createEmbedding } = require("./server/llm");

async function backfillRelationshipDescriptions() {
  console.log("🔄 Starting relationship description backfill...");
  
  try {
    // Get all relationships that don't have descriptions
    const relationshipsToUpdate = await db
      .select({
        id: relationships.id,
        userId: relationships.userId,
        sourceEntityId: relationships.sourceEntityId,
        targetEntityId: relationships.targetEntityId,
        relationship: relationships.relationship,
        originalInput: relationships.originalInput,
      })
      .from(relationships)
      .where(isNull(relationships.relationshipDesc));

    console.log(`📊 Found ${relationshipsToUpdate.length} relationships to backfill`);

    let processed = 0;
    for (const rel of relationshipsToUpdate) {
      try {
        // Get entity names
        const [sourceEntity] = await db
          .select({ name: entities.name })
          .from(entities)
          .where(eq(entities.id, rel.sourceEntityId));
          
        const [targetEntity] = await db
          .select({ name: entities.name })
          .from(entities)
          .where(eq(entities.id, rel.targetEntityId));

        if (!sourceEntity || !targetEntity) {
          console.log(`⚠️ Skipping relationship ${rel.id} - missing entity names`);
          continue;
        }

        console.log(`🔄 Processing: ${sourceEntity.name} -> ${rel.relationship} -> ${targetEntity.name}`);

        // Generate description
        const description = await generateRelationshipDescription(
          sourceEntity.name,
          rel.relationship,
          targetEntity.name
        );

        // Create embedding
        const embedding = await createEmbedding(description);

        // Update the relationship
        await db
          .update(relationships)
          .set({
            relationshipDesc: description,
            relationshipDescVec: embedding,
          })
          .where(eq(relationships.id, rel.id));

        processed++;
        console.log(`✅ Updated relationship ${rel.id} (${processed}/${relationshipsToUpdate.length})`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error processing relationship ${rel.id}:`, error);
      }
    }

    console.log(`🎉 Backfill complete! Processed ${processed} relationships`);
  } catch (error) {
    console.error("❌ Backfill failed:", error);
  } finally {
    process.exit(0);
  }
}

backfillRelationshipDescriptions();