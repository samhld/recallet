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

async function updateFixedEmbeddings() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Re-embedding all relationship descriptions with text-embedding-ada-002...');
    
    // Get all relationships with descriptions
    const relationships = await pool.query(`
      SELECT id, relationship_desc
      FROM relationships
      WHERE relationship_desc IS NOT NULL
    `);
    
    console.log(`Found ${relationships.rows.length} relationships to re-embed`);
    
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
    
    console.log('Re-embedding complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

updateFixedEmbeddings();