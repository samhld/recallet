import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OpenAI_Sam_D || process.env.OPENAI_API_KEY });

export interface EntityRelationship {
  sourceEntity: string;
  relationship: string;
  targetEntity: string;
}

export async function parseInputToEntityRelationships(
  input: string,
  username: string
): Promise<EntityRelationship[]> {
  const prompt = `Parse the following input into entity-relationship triples. The user who wrote this input is "${username}".

Rules:
1. Extract ALL distinct entities and their relationships
2. Use "<user>" to represent the user who wrote the input (${username})
3. Handle possessives properly (e.g., "my girlfriend" becomes "<user>'s girlfriend")
4. Create one triple for each unique relationship between entities
5. Be precise with relationship descriptions
6. Return valid JSON array only

Examples:
Input: "Jake Owen is my favorite country artist"
Output: [{"sourceEntity": "<user>", "relationship": "favorite country artist is", "targetEntity": "Jake Owen"}]

Input: "my girlfriend has a crush on jake owen"
Output: [{"sourceEntity": "<user>'s girlfriend", "relationship": "has crush on", "targetEntity": "Jake Owen"}]

Input: "I love Thomas Rhett and his music is amazing"
Output: [
  {"sourceEntity": "<user>", "relationship": "loves", "targetEntity": "Thomas Rhett"},
  {"sourceEntity": "Thomas Rhett's music", "relationship": "is", "targetEntity": "amazing"}
]

Now parse this input: "${input}"`;

  try {
    console.log("\n🔍 === LLM INPUT PARSING START ===");
    console.log("📝 Input text:", input);
    console.log("👤 Username:", username);
    console.log("💭 Prompt sent to LLM:", prompt);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at parsing text into entity-relationship triples. Always return valid JSON arrays only, no other text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const content = response.choices[0].message.content;
    console.log("🤖 Raw LLM response:", content);
    
    if (!content) throw new Error("No response from OpenAI");
    
    const parsed = JSON.parse(content);
    const relationships = parsed.relationships || parsed;
    
    console.log("📊 Parsed relationships:", JSON.stringify(relationships, null, 2));
    console.log("🔢 Number of relationships extracted:", relationships.length);
    console.log("🔍 === LLM INPUT PARSING END ===\n");
    
    return relationships;
  } catch (error) {
    console.error("❌ Error parsing input with LLM:", error);
    throw new Error("Failed to parse input with LLM");
  }
}

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    console.log("🔗 Creating embedding for text:", text);
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    const embedding = response.data[0].embedding;
    console.log("✅ Embedding created, dimensions:", embedding.length);
    
    return embedding;
  } catch (error) {
    console.error("❌ Error creating embedding:", error);
    throw new Error("Failed to create embedding");
  }
}

export async function parseQueryToEntityRelationship(
  query: string,
  username: string
): Promise<{ entities: string[]; relationship: string }> {
  const prompt = `Parse this query to extract the main entities and relationship being asked about.

Rules:
1. Use "<user>" to represent the user asking (${username})
2. Handle possessives properly (e.g., "my girlfriend" becomes "<user>'s girlfriend")
3. Extract the core relationship being queried
4. Return entities as an array and relationship as a string
5. Return valid JSON only

Examples:
Query: "who is my favorite country artist"
Output: {"entities": ["<user>"], "relationship": "favorite country artist is"}

Query: "Who does my girlfriend love?"
Output: {"entities": ["<user>'s girlfriend"], "relationship": "loves"}

Query: "what does Jake Owen do?"
Output: {"entities": ["Jake Owen"], "relationship": "does"}

Now parse this query: "${query}"`;

  try {
    console.log("\n🔍 === LLM QUERY PARSING START ===");
    console.log("❓ Query:", query);
    console.log("👤 Username:", username);
    console.log("💭 Prompt sent to LLM:", prompt);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at parsing queries into entities and relationships. Always return valid JSON only, no other text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const content = response.choices[0].message.content;
    console.log("🤖 Raw LLM response:", content);
    
    if (!content) throw new Error("No response from OpenAI");
    
    const parsed = JSON.parse(content);
    console.log("📊 Parsed query structure:", JSON.stringify(parsed, null, 2));
    console.log("🔍 === LLM QUERY PARSING END ===\n");
    
    return parsed;
  } catch (error) {
    console.error("❌ Error parsing query with LLM:", error);
    throw new Error("Failed to parse query with LLM");
  }
}