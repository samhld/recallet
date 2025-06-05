import pkg from 'pg';
const { Pool } = pkg;
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateRelationshipDescription(sourceEntity, relationship, targetEntity) {
  try {
    const prompt = `Generate a semantic description of ONLY this specific relationship. Focus purely on what the relationship "${relationship}" means between these entities. Do not add external context.

Relationship: ${sourceEntity} ${relationship} ${targetEntity}

Rules:
1. Describe ONLY the relationship "${relationship}" - nothing else
2. Do not add context about what the entities are
3. Keep under 80 characters
4. Focus purely on the semantic meaning of "${relationship}"

Examples:
Input: "sam-test1 loves Thomas Rhett"
Output: "Strong emotional affection and admiration."

Input: "sam-test1 favorite country artist is Jake Owen" 
Output: "Top preference ranking above all others in category."

Input: "Marissa is sam-test1's fiancee"
Output: "Engaged romantic partnership with marriage plans."

Now generate a description for the relationship "${relationship}": ${sourceEntity} ${relationship} ${targetEntity}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating concise semantic descriptions of relationships. Focus ONLY on the relationship itself, not the entities involved."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 50
    });

    const description = response.choices[0].message.content?.trim();
    if (!description) throw new Error("No description generated");

    return description;
  } catch (error) {
    console.error("Error generating relationship description:", error);
    throw error;
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

async function comprehensiveRelationshipFix() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Starting comprehensive relationship description fix...');
    
    // Get all relationships that need fixing
    const relationships = await pool.query(`
      SELECT r.id, r.relationship, r.relationship_desc, e1.name as source_name, e2.name as target_name
      FROM relationships r
      JOIN entities e1 ON r.source_entity_id = e1.id
      JOIN entities e2 ON r.target_entity_id = e2.id
      WHERE r.relationship_desc LIKE '%"""%' 
         OR r.relationship_desc LIKE '%person%'
         OR r.relationship_desc LIKE '%enjoys%'
         OR r.relationship_desc LIKE '%harbors%'
         OR r.relationship_desc LIKE '%Marissa%'
         OR r.relationship_desc LIKE '%sam-test1%'
         OR r.relationship_desc LIKE '%Test1%'
         OR r.relationship_desc LIKE '%Jake Owen%'
         OR r.relationship_desc LIKE '%Thomas Rhett%'
         OR r.relationship_desc LIKE '%Jeff%'
         OR r.relationship_desc LIKE '%Carie%'
         OR LENGTH(r.relationship_desc) > 60
      ORDER BY r.id
    `);
    
    console.log(`Found ${relationships.rows.length} relationships that need fixing`);
    
    for (const row of relationships.rows) {
      console.log(`\nFixing relationship ${row.id}: ${row.source_name} -> ${row.relationship} -> ${row.target_name}`);
      console.log(`Current description: "${row.relationship_desc}"`);
      
      const newDescription = await generateRelationshipDescription(
        row.source_name, 
        row.relationship, 
        row.target_name
      );
      
      console.log(`New focused description: "${newDescription}" (${newDescription.length} chars)`);
      
      const embedding = await createEmbedding(newDescription);
      
      await pool.query(`
        UPDATE relationships 
        SET relationship_desc = $1, relationship_desc_vec = $2::vector
        WHERE id = $3
      `, [newDescription, `[${embedding.join(',')}]`, row.id]);
      
      console.log(`✓ Updated relationship ${row.id}`);
    }
    
    console.log('\n=== Summary ===');
    
    // Get final stats
    const finalStats = await pool.query(`
      SELECT COUNT(*) as total_relationships,
             AVG(LENGTH(relationship_desc)) as avg_length,
             MAX(LENGTH(relationship_desc)) as max_length,
             MIN(LENGTH(relationship_desc)) as min_length
      FROM relationships
      WHERE relationship_desc IS NOT NULL
    `);
    
    console.log(`Total relationships: ${finalStats.rows[0].total_relationships}`);
    console.log(`Average description length: ${Math.round(finalStats.rows[0].avg_length)} chars`);
    console.log(`Max description length: ${finalStats.rows[0].max_length} chars`);
    console.log(`Min description length: ${finalStats.rows[0].min_length} chars`);
    
    console.log('\nComprehensive relationship fix complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

comprehensiveRelationshipFix();