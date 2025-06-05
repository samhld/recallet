import pkg from 'pg';
const { Pool } = pkg;
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateEntityDescription(entityName, username) {
  try {
    const prompt = `Generate a very concise description for "${entityName}". Keep under 80 characters total.

Rules:
1. Maximum 1-2 short sentences
2. Focus on core identity/role
3. Be factual and brief
4. Under 80 characters total

Examples:
Entity: "Thomas Rhett"
Description: "Country music artist known for chart-topping hits."

Entity: "sam-test1's fiancee"  
Description: "User's romantic partner, engaged to be married."

Entity: "Jake Owen"
Description: "Country singer known for 'Barefoot Blue Jean Night'."

Now generate a description for: "${entityName}"`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating very concise, factual entity descriptions. Keep all descriptions under 80 characters."
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
    console.error("Error generating entity description:", error);
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

async function regenerateEntityDescriptions() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Starting entity description regeneration...');
    
    // Get all entities with their user context
    const entities = await pool.query(`
      SELECT e.id, e.name, u.username
      FROM entities e
      JOIN users u ON e.user_id = u.id
      WHERE e.description IS NOT NULL
    `);
    
    console.log(`Found ${entities.rows.length} entities to regenerate`);
    
    for (const row of entities.rows) {
      console.log(`Generating description for entity ${row.id}: ${row.name}`);
      
      const description = await generateEntityDescription(row.name, row.username);
      
      console.log(`Generated: "${description}" (${description.length} chars)`);
      
      const embedding = await createEmbedding(description);
      
      await pool.query(`
        UPDATE entities 
        SET description = $1, description_vec = $2::vector
        WHERE id = $3
      `, [description, `[${embedding.join(',')}]`, row.id]);
      
      console.log(`✓ Updated entity ${row.id}`);
    }
    
    console.log('Entity description regeneration complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

regenerateEntityDescriptions();