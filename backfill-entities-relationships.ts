import { db } from './server/db.ts';
import { knowledgeGraph, entities, relationships, users } from './shared/schema.ts';
import { generateEntityDescription, createEmbedding } from './server/llm.ts';
import { eq, and } from 'drizzle-orm';

async function backfillEntitiesAndRelationships() {
  try {
    console.log('🚀 Starting backfill process...');
    
    // Get all knowledge graph entries with user information
    const kgEntries = await db
      .select({
        id: knowledgeGraph.id,
        userId: knowledgeGraph.userId,
        sourceEntity: knowledgeGraph.sourceEntity,
        targetEntity: knowledgeGraph.targetEntity,
        relationship: knowledgeGraph.relationship,
        relationshipVec: knowledgeGraph.relationshipVec,
        originalInput: knowledgeGraph.originalInput,
        username: users.username
      })
      .from(knowledgeGraph)
      .leftJoin(users, eq(knowledgeGraph.userId, users.id))
      .orderBy(knowledgeGraph.id);

    console.log(`📊 Found ${kgEntries.length} knowledge graph entries to process`);

    // Track created entities to avoid duplicates
    const createdEntities = new Map();
    
    for (const entry of kgEntries) {
      console.log(`\n📝 Processing entry ${entry.id}: ${entry.sourceEntity} -> ${entry.relationship} -> ${entry.targetEntity}`);
      
      const { userId, sourceEntity, targetEntity, relationship, relationshipVec, originalInput, username } = entry;
      
      if (!username) {
        console.log(`❌ Skipping entry ${entry.id}: user not found`);
        continue;
      }

      // Create or get source entity
      let sourceEntityRecord;
      const sourceKey = `${userId}-${sourceEntity}`;
      
      if (createdEntities.has(sourceKey)) {
        sourceEntityRecord = createdEntities.get(sourceKey);
        console.log(`✓ Using existing source entity: ${sourceEntity}`);
      } else {
        // Check if entity already exists in database
        const [existingSource] = await db
          .select()
          .from(entities)
          .where(
            and(
              eq(entities.userId, userId),
              eq(entities.name, sourceEntity)
            )
          );

        if (existingSource) {
          sourceEntityRecord = existingSource;
          console.log(`✓ Found existing source entity: ${sourceEntity}`);
        } else {
          // Create new source entity
          console.log(`🔨 Creating new source entity: ${sourceEntity}`);
          const description = await generateEntityDescription(sourceEntity, username);
          const descriptionVec = await createEmbedding(description);
          
          const [newSourceEntity] = await db
            .insert(entities)
            .values({
              userId,
              name: sourceEntity,
              description,
              descriptionVec,
            })
            .returning();
          
          sourceEntityRecord = newSourceEntity;
          console.log(`✅ Created source entity: ${sourceEntity} (ID: ${newSourceEntity.id})`);
        }
        
        createdEntities.set(sourceKey, sourceEntityRecord);
      }

      // Create or get target entity
      let targetEntityRecord;
      const targetKey = `${userId}-${targetEntity}`;
      
      if (createdEntities.has(targetKey)) {
        targetEntityRecord = createdEntities.get(targetKey);
        console.log(`✓ Using existing target entity: ${targetEntity}`);
      } else {
        // Check if entity already exists in database
        const [existingTarget] = await db
          .select()
          .from(entities)
          .where(
            and(
              eq(entities.userId, userId),
              eq(entities.name, targetEntity)
            )
          );

        if (existingTarget) {
          targetEntityRecord = existingTarget;
          console.log(`✓ Found existing target entity: ${targetEntity}`);
        } else {
          // Create new target entity
          console.log(`🔨 Creating new target entity: ${targetEntity}`);
          const description = await generateEntityDescription(targetEntity, username);
          const descriptionVec = await createEmbedding(description);
          
          const [newTargetEntity] = await db
            .insert(entities)
            .values({
              userId,
              name: targetEntity,
              description,
              descriptionVec,
            })
            .returning();
          
          targetEntityRecord = newTargetEntity;
          console.log(`✅ Created target entity: ${targetEntity} (ID: ${newTargetEntity.id})`);
        }
        
        createdEntities.set(targetKey, targetEntityRecord);
      }

      // Create relationship
      try {
        // Check if relationship already exists
        const [existingRelationship] = await db
          .select()
          .from(relationships)
          .where(
            and(
              eq(relationships.userId, userId),
              eq(relationships.sourceEntityId, sourceEntityRecord.id),
              eq(relationships.targetEntityId, targetEntityRecord.id),
              eq(relationships.relationship, relationship)
            )
          );

        if (existingRelationship) {
          console.log(`✓ Relationship already exists: ${sourceEntity} -> ${relationship} -> ${targetEntity}`);
        } else {
          const [newRelationship] = await db
            .insert(relationships)
            .values({
              userId,
              sourceEntityId: sourceEntityRecord.id,
              targetEntityId: targetEntityRecord.id,
              relationship,
              relationshipVec,
              originalInput,
            })
            .returning();
          
          console.log(`✅ Created relationship: ${sourceEntity} -> ${relationship} -> ${targetEntity} (ID: ${newRelationship.id})`);
        }
      } catch (error) {
        console.error(`❌ Error creating relationship for entry ${entry.id}:`, error);
      }
    }

    // Final stats
    const [entityCount] = await db.select({ count: db.$count() }).from(entities);
    const [relationshipCount] = await db.select({ count: db.$count() }).from(relationships);
    
    console.log(`\n🎉 Backfill completed successfully!`);
    console.log(`📊 Total entities created: ${entityCount.count}`);
    console.log(`📊 Total relationships created: ${relationshipCount.count}`);
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
}

// Run the backfill
backfillEntitiesAndRelationships()
  .then(() => {
    console.log('✅ Backfill process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill process failed:', error);
    process.exit(1);
  });