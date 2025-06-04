import OpenAI from "openai";

// Using GPT-4.1-nano - the fastest and most cost-effective model from OpenAI's new GPT-4.1 series
const openai = new OpenAI({
  apiKey: process.env.OpenAI_Sam_D || process.env.OPENAI_API_KEY,
});

export interface EntityRelationship {
  sourceEntity: string;
  relationship: string;
  targetEntity: string;
}

export async function parseInputToEntityRelationships(
  input: string,
  username: string,
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
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at parsing text into entity-relationship triples. Always return valid JSON arrays only, no other text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const content = response.choices[0].message.content;
    console.log("🤖 Raw LLM response:", content);

    if (!content) throw new Error("No response from OpenAI");

    const parsed = JSON.parse(content);
    let relationships = parsed.relationships || parsed;

    // If the response is a single object, wrap it in an array
    if (!Array.isArray(relationships)) {
      relationships = [relationships];
    }

    // Replace "<user>" with actual username in all relationships
    relationships = relationships.map((rel: any) => ({
      ...rel,
      sourceEntity: rel.sourceEntity.replace(/<user>/g, username),
      targetEntity: rel.targetEntity.replace(/<user>/g, username),
    }));

    console.log(
      "📊 Parsed relationships:",
      JSON.stringify(relationships, null, 2),
    );
    console.log("🔢 Number of relationships extracted:", relationships.length);
    console.log("🔍 === LLM INPUT PARSING END ===\n");

    return relationships;
  } catch (error) {
    console.error("❌ Error parsing input with LLM:", error);
    throw new Error("Failed to parse input with LLM");
  }
}

export async function resolveEntityAliases(
  entityName: string,
  existingEntities: { name: string; description: string }[],
  username: string
): Promise<{ 
  resolvedEntity: string;
  updatedDescription?: string;
  isAlias: boolean;
}> {
  console.log("🔍 === ENTITY ALIAS RESOLUTION START ===");
  console.log("🎯 Entity to resolve:", entityName);
  console.log("📚 Existing entities:", existingEntities.map(e => e.name));

  const prompt = `IMPORTANT: Analyze if "${entityName}" refers to the same person as any existing entity. Look for alias relationships carefully.

Context: User is "${username}"

Existing entities and their descriptions:
${existingEntities.map(e => `- ${e.name}: ${e.description}`).join('\n')}

CRITICAL RULES:
1. If "${entityName}" is a relationship descriptor (like "my fiancee", "my girlfriend", "my husband") AND there's a person entity that could be that relationship, merge them
2. If "${entityName}" is a proper name that could refer to an existing relationship entity, merge them
3. Consider context clues: if input says "X is my Y" then X and "my Y" are the same person
4. Return the EXISTING entity name when merging, not the new one
5. Provide updated description that includes both names/relationships

MERGE EXAMPLES:
- If "Marissa" exists and new entity is "my fiancee" → {"resolvedEntity": "Marissa", "updatedDescription": "Marissa, who is sam-test1's fiancee...", "isAlias": true}
- If "my girlfriend" exists and new entity is "Sarah" → {"resolvedEntity": "my girlfriend", "updatedDescription": "Sarah, who is sam-test1's girlfriend...", "isAlias": true}

NO MERGE EXAMPLES:
- Clearly different people like "Jake Owen" vs "Thomas Rhett"
- Different relationship roles that couldn't be the same person

Return JSON: {"resolvedEntity": "existing_entity_name", "updatedDescription": "combined description", "isAlias": true/false}`;

  console.log("💭 Prompt sent to LLM:", prompt);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const response = completion.choices[0]?.message?.content;
    console.log("🤖 Raw LLM response:", response);

    if (!response) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(response);
    console.log("📊 Parsed resolution:", parsed);
    console.log("🔍 === ENTITY ALIAS RESOLUTION END ===");

    return {
      resolvedEntity: parsed.resolvedEntity || entityName,
      updatedDescription: parsed.updatedDescription,
      isAlias: parsed.isAlias || false
    };
  } catch (error) {
    console.error("❌ Error in entity alias resolution:", error);
    console.log("🔍 === ENTITY ALIAS RESOLUTION END ===");
    return {
      resolvedEntity: entityName,
      isAlias: false
    };
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

export async function generateEntityDescription(
  entityName: string,
  username: string,
): Promise<string> {
  const prompt = `Generate a concise, informative description for the entity "${entityName}" in the context of user "${username}"'s personal knowledge base.

Rules:
1. Keep it factual and descriptive
2. Maximum 2-3 sentences
3. Focus on what this entity represents in the user's context
4. Don't make assumptions beyond what the entity name suggests
5. Return only the description text, no JSON

Examples:
Entity: "Thomas Rhett"
Description: "A popular country music artist and singer-songwriter known for hits like 'Die From A Broken Heart' and 'Look What God Gave Her'."

Entity: "sam-test1's fiancee"
Description: "The romantic partner of user sam-test1, soon to be married, referenced in their personal knowledge base."

Entity: "Jake Owen"
Description: "A country music artist and singer known for songs like 'Barefoot Blue Jean Night' and 'American Country Love Song'."

Now generate a description for: "${entityName}"`;

  try {
    console.log(`📋 Generating description for entity: ${entityName}`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at generating concise, factual descriptions for entities in a personal knowledge base.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    const description = response.choices[0].message.content?.trim();
    if (!description) throw new Error("No description generated");

    console.log(`✅ Generated description: ${description}`);
    return description;
  } catch (error) {
    console.error("❌ Error generating entity description:", error);
    throw new Error("Failed to generate entity description");
  }
}

export async function synthesizeAnswerFromContext(
  query: string,
  originalInputs: string[]
): Promise<string> {
  if (originalInputs.length === 0) {
    return "No relevant information found in your knowledge base.";
  }

  const prompt = `Question: "${query}"

Context from knowledge base:
${originalInputs.map((input, index) => `${index + 1}. "${input}"`).join('\n')}

Based on this context, provide a direct, helpful answer to the question. If the context contains comparative information (like "more than", "less than", "most", "favorite"), use that to give a precise answer. Keep your response concise and natural.`;

  try {
    console.log("🧠 === LLM ANSWER SYNTHESIS START ===");
    console.log("❓ Question:", query);
    console.log("📚 Context inputs:", originalInputs);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing personal knowledge and providing direct, helpful answers based on context. Always use the provided context to give accurate, specific responses."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    const answer = response.choices[0].message.content?.trim();
    if (!answer) throw new Error("No answer generated");

    console.log("🎯 Synthesized answer:", answer);
    console.log("🧠 === LLM ANSWER SYNTHESIS END ===");

    return answer;
  } catch (error) {
    console.error("❌ Error synthesizing answer:", error);
    return "I couldn't generate an answer based on the available context.";
  }
}

export async function parseQueryToEntityRelationship(
  query: string,
  username: string,
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
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at parsing queries into entities and relationships. Always return valid JSON only, no other text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const content = response.choices[0].message.content;
    console.log("🤖 Raw LLM response:", content);

    if (!content) throw new Error("No response from OpenAI");

    const parsed = JSON.parse(content);

    // Replace "<user>" with actual username in entities
    if (parsed.entities) {
      parsed.entities = parsed.entities.map((entity: string) =>
        entity.replace(/<user>/g, username),
      );
    }

    console.log("📊 Parsed query structure:", JSON.stringify(parsed, null, 2));
    console.log("🔍 === LLM QUERY PARSING END ===\n");

    return parsed;
  } catch (error) {
    console.error("❌ Error parsing query with LLM:", error);
    throw new Error("Failed to parse query with LLM");
  }
}
