import pkg from 'pg';
const { Pool } = pkg;
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateRelationshipDescription(sourceEntity, relationship, targetEntity) {
  try {
    const prompt = `Generate a detailed, semantic description of this relationship that captures its full meaning and context.

Relationship: ${sourceEntity} ${relationship} ${targetEntity}

Rules:
1. Create a descriptive sentence that explains the nature of the connection
2. Include context about what this relationship means
3. Make it detailed enough to distinguish from similar relationships
4. Focus on the semantic meaning, not just restating the relationship

Examples:
Input: "sam-test1 loves Thomas Rhett"
Output: "This person has a strong emotional affection and admiration for the country music artist Thomas Rhett, enjoying his music and considering him a preferred performer"

Input: "sam-test1 favorite country artist is Jake Owen" 
Output: "This person considers Jake Owen to be their most preferred and beloved country music performer, ranking him above all other artists in the country genre"

Now generate a description for: ${sourceEntity} ${relationship} ${targetEntity}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating semantic descriptions of relationships between entities. Generate detailed, meaningful descriptions that capture the full context and nuance of relationships."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 150
    });

    const description = response.choices[0].message.content?.trim();
    if (!description) throw new Error("No description generated");

    return description;
  } catch (error) {
    console.error("Error generating relationship description:", error);
    // Fallback to simple description
    return `${sourceEntity} has the relationship "${relationship}" with ${targetEntity}`;
  }
}

async function createEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error creating embedding:", error);
    throw error;
  }
}

async function comprehensiveBackfill() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔄 Starting comprehensive backfill...');
    
    // Step 1: Generate descriptions for relationships missing them
    console.log('\n📝 Step 1: Generating missing relationship descriptions...');
    const missingDescriptions = await pool.query(`
      SELECT r.id, r.relationship, e1.name as source_name, e2.name as target_name
      FROM relationships r
      JOIN entities e1 ON r.source_entity_id = e1.id
      JOIN entities e2 ON r.target_entity_id = e2.id
      WHERE r.relationship_desc IS NULL OR r.relationship_desc = ''
    `);
    
    console.log(`Found ${missingDescriptions.rows.length} relationships needing descriptions`);
    
    for (const row of missingDescriptions.rows) {
      const description = await generateRelationshipDescription(
        row.source_name, 
        row.relationship, 
        row.target_name
      );
      
      await pool.query(`
        UPDATE relationships 
        SET relationship_desc = $1
        WHERE id = $2
      `, [description, row.id]);
      
      console.log(`✅ Generated description for relationship ${row.id}: ${row.source_name} -> ${row.relationship} -> ${row.target_name}`);
    }
    
    // Step 2: Re-embed all relationship descriptions
    console.log('\n🔗 Step 2: Re-embedding all relationship descriptions...');
    const allRelationships = await pool.query(`
      SELECT id, relationship_desc
      FROM relationships
      WHERE relationship_desc IS NOT NULL AND relationship_desc != ''
    `);
    
    console.log(`Found ${allRelationships.rows.length} relationships to re-embed`);
    
    for (const row of allRelationships.rows) {
      const embedding = await createEmbedding(row.relationship_desc);
      
      await pool.query(`
        UPDATE relationships 
        SET relationship_desc_vec = $1::vector
        WHERE id = $2
      `, [`[${embedding.join(',')}]`, row.id]);
      
      console.log(`✅ Re-embedded relationship ${row.id}`);
    }
    
    // Step 3: Re-embed all entity descriptions
    console.log('\n👤 Step 3: Re-embedding all entity descriptions...');
    const allEntities = await pool.query(`
      SELECT id, description
      FROM entities
      WHERE description IS NOT NULL AND description != ''
    `);
    
    console.log(`Found ${allEntities.rows.length} entities to re-embed`);
    
    for (const row of allEntities.rows) {
      const embedding = await createEmbedding(row.description);
      
      await pool.query(`
        UPDATE entities 
        SET description_vec = $1::vector
        WHERE id = $2
      `, [`[${embedding.join(',')}]`, row.id]);
      
      console.log(`✅ Re-embedded entity ${row.id}`);
    }
    
    // Final verification
    console.log('\n📊 Final verification...');
    const verificationQuery = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM relationships WHERE relationship_desc IS NULL OR relationship_desc = '') as missing_descriptions,
        (SELECT COUNT(*) FROM relationships WHERE relationship_desc_vec IS NULL) as missing_rel_embeddings,
        (SELECT COUNT(*) FROM entities WHERE description IS NOT NULL AND description_vec IS NULL) as missing_entity_embeddings
    `);
    
    const verification = verificationQuery.rows[0];
    console.log(`Missing relationship descriptions: ${verification.missing_descriptions}`);
    console.log(`Missing relationship embeddings: ${verification.missing_rel_embeddings}`);
    console.log(`Missing entity embeddings: ${verification.missing_entity_embeddings}`);
    
    console.log('\n🎉 Comprehensive backfill complete!');
    
  } catch (error) {
    console.error('❌ Backfill error:', error);
  } finally {
    await pool.end();
  }
}

comprehensiveBackfill();