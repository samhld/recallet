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

async function generateEmbeddings() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Starting embedding generation...');
    
    // Get all relationships that need embeddings
    const relationships = await pool.query(`
      SELECT id, relationship_desc
      FROM relationships
      WHERE relationship_desc IS NOT NULL 
      AND relationship_desc != ''
      AND relationship_desc_vec IS NULL
    `);
    
    console.log(`Found ${relationships.rows.length} relationships needing embeddings`);
    
    for (const row of relationships.rows) {
      console.log(`Generating embedding for relationship ${row.id}...`);
      
      const embedding = await createEmbedding(row.relationship_desc);
      
      await pool.query(`
        UPDATE relationships 
        SET relationship_desc_vec = $1::vector
        WHERE id = $2
      `, [`[${embedding.join(',')}]`, row.id]);
      
      console.log(`✓ Embedded relationship ${row.id}`);
    }
    
    console.log('Embedding generation complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

generateEmbeddings();