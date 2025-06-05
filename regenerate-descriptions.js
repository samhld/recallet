import pkg from 'pg';
const { Pool } = pkg;
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateRelationshipDescription(sourceEntity, relationship, targetEntity) {
  try {
    const prompt = `Generate a very concise description of this relationship. Keep under 80 characters total.

Relationship: ${sourceEntity} ${relationship} ${targetEntity}

Rules:
1. Maximum 1-2 short sentences
2. Focus on core semantic meaning
3. Be specific but brief
4. Under 80 characters total

Examples:
Input: "sam-test1 loves Thomas Rhett"
Output: "Strong affection for country artist Thomas Rhett."

Input: "sam-test1 favorite country artist is Jake Owen" 
Output: "Considers Jake Owen top country music performer."

Now generate a description for: ${sourceEntity} ${relationship} ${targetEntity}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating semantic descriptions of relationships between entities. Generate concise, meaningful descriptions that capture the full context and nuance of relationships."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 100
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

async function regenerateDescriptions() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Starting description regeneration...');
    
    // Get all relationships with their entity names
    const relationships = await pool.query(`
      SELECT r.id, r.relationship, e1.name as source_name, e2.name as target_name
      FROM relationships r
      JOIN entities e1 ON r.source_entity_id = e1.id
      JOIN entities e2 ON r.target_entity_id = e2.id
    `);
    
    console.log(`Found ${relationships.rows.length} relationships to regenerate`);
    
    for (const row of relationships.rows) {
      console.log(`Generating description for relationship ${row.id}: ${row.source_name} -> ${row.relationship} -> ${row.target_name}`);
      
      const description = await generateRelationshipDescription(
        row.source_name, 
        row.relationship, 
        row.target_name
      );
      
      console.log(`Generated: "${description}"`);
      
      const embedding = await createEmbedding(description);
      
      await pool.query(`
        UPDATE relationships 
        SET relationship_desc = $1, relationship_desc_vec = $2::vector
        WHERE id = $3
      `, [description, `[${embedding.join(',')}]`, row.id]);
      
      console.log(`✓ Updated relationship ${row.id}`);
    }
    
    console.log('Description regeneration complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

regenerateDescriptions();