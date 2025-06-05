import pkg from 'pg';
const { Pool } = pkg;
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function finalEmbeddingUpdate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Final embedding update for all relationship descriptions...');
    
    // Get all relationships that were just updated
    const relationships = await pool.query(`
      SELECT id, relationship_desc
      FROM relationships
      WHERE id IN (6, 11)
      ORDER BY id
    `);
    
    console.log(`Updating embeddings for ${relationships.rows.length} relationships`);
    
    for (const row of relationships.rows) {
      console.log(`Re-embedding relationship ${row.id}: "${row.relationship_desc}"`);
      
      const embedding = await createEmbedding(row.relationship_desc);
      
      await pool.query(`
        UPDATE relationships 
        SET relationship_desc_vec = $1::vector
        WHERE id = $2
      `, [`[${embedding.join(',')}]`, row.id]);
      
      console.log(`✓ Updated embedding for relationship ${row.id}`);
    }
    
    // Final verification
    const finalStats = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN relationship_desc LIKE '%entity%' OR relationship_desc LIKE '%person%' OR relationship_desc LIKE '%sam-test1%' OR relationship_desc LIKE '%Marissa%' OR relationship_desc LIKE '%Jake Owen%' THEN 1 END) as has_entity_names,
             AVG(LENGTH(relationship_desc)) as avg_length,
             MAX(LENGTH(relationship_desc)) as max_length
      FROM relationships
      WHERE relationship_desc IS NOT NULL
    `);
    
    console.log('\n=== Final Verification ===');
    console.log(`Total relationships: ${finalStats.rows[0].total}`);
    console.log(`Descriptions with entity names: ${finalStats.rows[0].has_entity_names}`);
    console.log(`Average description length: ${Math.round(finalStats.rows[0].avg_length)} chars`);
    console.log(`Max description length: ${finalStats.rows[0].max_length} chars`);
    
    console.log('Final embedding update complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

finalEmbeddingUpdate();