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

async function updateShortEntityEmbeddings() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Updating entity embeddings for shortened descriptions...');
    
    // Get entities that were just updated with short descriptions
    const entities = await pool.query(`
      SELECT id, description
      FROM entities
      WHERE description IS NOT NULL
      AND id IN (3, 5, 6, 7, 8, 12)
    `);
    
    console.log(`Found ${entities.rows.length} entities to re-embed`);
    
    for (const row of entities.rows) {
      console.log(`Re-embedding entity ${row.id}: "${row.description}"`);
      
      const embedding = await createEmbedding(row.description);
      
      await pool.query(`
        UPDATE entities 
        SET description_vec = $1::vector
        WHERE id = $2
      `, [`[${embedding.join(',')}]`, row.id]);
      
      console.log(`✓ Updated embedding for entity ${row.id}`);
    }
    
    console.log('Entity embedding updates complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

updateShortEntityEmbeddings();