const { createEmbedding } = require('./server/llm');
const { Pool } = require('pg');

async function generateMissingEmbeddings() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔄 Generating embeddings for relationship descriptions...');
    
    // Get relationships with descriptions but no embeddings
    const result = await pool.query(`
      SELECT id, relationship_desc 
      FROM relationships 
      WHERE relationship_desc IS NOT NULL 
      AND relationship_desc_vec IS NULL
    `);
    
    console.log(`Found ${result.rows.length} relationships needing embeddings`);
    
    for (const row of result.rows) {
      console.log(`Processing relationship ${row.id}...`);
      
      // Generate embedding
      const embedding = await createEmbedding(row.relationship_desc);
      
      // Update database
      await pool.query(`
        UPDATE relationships 
        SET relationship_desc_vec = $1::vector
        WHERE id = $2
      `, [`[${embedding.join(',')}]`, row.id]);
      
      console.log(`✅ Updated relationship ${row.id}`);
    }
    
    console.log('🎉 All embeddings generated successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

generateMissingEmbeddings();