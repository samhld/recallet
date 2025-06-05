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

async function fixRelationshipDescriptions() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Fixing relationship descriptions to focus only on relationship semantics...');
    
    // Get all relationships with their entity names
    const relationships = await pool.query(`
      SELECT r.id, r.relationship, e1.name as source_name, e2.name as target_name
      FROM relationships r
      JOIN entities e1 ON r.source_entity_id = e1.id
      JOIN entities e2 ON r.target_entity_id = e2.id
    `);
    
    console.log(`Found ${relationships.rows.length} relationships to fix`);
    
    for (const row of relationships.rows) {
      console.log(`Fixing relationship ${row.id}: ${row.source_name} -> ${row.relationship} -> ${row.target_name}`);
      
      const description = await generateRelationshipDescription(
        row.source_name, 
        row.relationship, 
        row.target_name
      );
      
      console.log(`Generated focused description: "${description}" (${description.length} chars)`);
      
      const embedding = await createEmbedding(description);
      
      await pool.query(`
        UPDATE relationships 
        SET relationship_desc = $1, relationship_desc_vec = $2::vector
        WHERE id = $3
      `, [description, `[${embedding.join(',')}]`, row.id]);
      
      console.log(`✓ Updated relationship ${row.id}`);
    }
    
    console.log('Relationship description fix complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixRelationshipDescriptions();