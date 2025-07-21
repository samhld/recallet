import OpenAI from "openai";

// Using GPT-4.1-nano - the fastest and most cost-effective model from OpenAI's new GPT-4.1 series
const openai = new OpenAI({
  apiKey: process.env.OpenAI_Sam_D || process.env.OPENAI_API_KEY,
});

export interface EntityRelationship {
  sourceEntity: string;
  relationship: string;
  targetEntity: string;
  aliases: boolean;
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
7. SPECIAL RULE: When the input contains entities describing something's properties ("is fat", "is annoying", "is beautiful", "is delicious", "has long arms", "was too tired", "had a good head on his shoulders", "likes to", "loves to", "prefers not to", etc.). If the entity is the user, inject the user into it (e.g. "<restaurant> has delicious food" becomes "<user> says <restaurant> has delicious food").
8. You will produce JSON objects for these entity-relationship triples. A single triple will look like this: {"source_entity": <parsed_source_entity>, "target_entity": <parsed_target_entity>, "relationship": <parsed_relationship>, "aliases": <whether or not the entities are aliases of one another>}
If multiple entity-relationship triples are identified, they should each have a JSON object to represent them according to the schema above. For example:
"I like the color purple, even though Elvis Presley, who I don't really like, really likes purple too" should be parsed into the following array of three JSON objects:
[{"source_entity": "<user>", "target_entity": "the color purple", "relationship": "likes", "aliases": false}, {"source_entity": "<user>", "target_entity": "Elvis Presley", "relationship": "doesn't really like", "aliases": false}, {"source_entity": "Elvis Presley", "target_entity": "the color purple", "relationship": "really likes", "aliases": false}]
9. Support for aliases: When given an input that has an entity-relationship triple in the shape of entity-is-entity (where "is" is used explicitly and the source and target entities are both entities rather than descriptors), set "aliases": true. For example: "Bob is my husband" would be parsed as {"source_entity": "Bob", "target_entity": "<user>'s husband", "relationship": "is", "aliases": true}.

Examples:
Input: "Jake Owen is my favorite country artist"
Output: [{"source_entity": "<user>", "relationship": "favorite country artist is", "target_entity": "Jake Owen", "aliases": false}]

Input: "my girlfriend has a crush on jake owen"
Output: [{"source_entity": "<user>'s girlfriend", "relationship": "has crush on", "target_entity": "Jake Owen", "aliases": false}]

Input: "I love Thomas Rhett and his music is amazing"
Output: [
  {"source_entity": "<user>", "relationship": "loves", "target_entity": "Thomas Rhett", "aliases": false},
  {"source_entity": "<user>", "relationship": "claims music is amazing", "target_entity": "Thomas Rhett's music", "aliases": false}
]

Input: "the food at Mario's is too spicy"
Output: [{"source_entity": "<user>", "relationship": "says is too spicy", "target_entity": "the food at Mario's", "aliases": false}]

Input: "Carie from work is manipulative"
Output: [{"source_entity": "<user>", "relationship": "claims is manipulative", "target_entity": "Carie from work", "aliases": false}]

Input: "the unagi at crazy fish is too saucy"
Output: [{"source_entity": "<user>", "relationship": "says is too saucy", "target_entity": "the unagi at crazy fish", "aliases": false}]

Input: "Bob is my husband"
Output: [{"source_entity": "Bob", "target_entity": "<user>'s husband", "relationship": "is", "aliases": true}]

Now parse this input: "${input}"`;

  try {
    console.log("\n🔍 === LLM INPUT PARSING START ===");
    console.log("📝 Input text:", input);
    console.log("👤 Username:", username);

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

    // Replace "<user>" with actual username in all relationships and convert to camelCase
    relationships = relationships.map((rel: any) => ({
      sourceEntity: rel.source_entity.replace(/<user>/g, username),
      relationship: rel.relationship,
      targetEntity: rel.target_entity.replace(/<user>/g, username),
      aliases: rel.aliases || false,
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

export async function generateRelationshipDescription(
  sourceEntity: string,
  relationship: string,
  targetEntity: string,
): Promise<string> {
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
          content:
            "You are an expert at creating semantic descriptions of relationships between entities. Generate detailed, meaningful descriptions that capture the full context and nuance of relationships.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 150,
    });

    const description = response.choices[0].message.content?.trim();
    if (!description) throw new Error("No description generated");

    console.log(`🔗 Generated relationship description: "${description}"`);
    return description;
  } catch (error) {
    console.error("❌ Error generating relationship description:", error);
    // Fallback to simple description
    return `${sourceEntity} has the relationship "${relationship}" with ${targetEntity}`;
  }
}

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    console.log("🔗 Creating embedding for text:", text);

    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
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

  try {
    console.log(`📋 Generating description for entity: ${entityName}`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at generating concise, factual descriptions for entities in a personal knowledge base.",
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
  originalInputs: string[],
): Promise<string> {
  if (originalInputs.length === 0) {
    return "No relevant information found in your knowledge base.";
  }

  const prompt = `Question: "${query}"

Context from knowledge base:
${originalInputs.map((input, index) => `${index + 1}. "${input}"`).join("\n")}

Based on this context, provide a direct, helpful answer to the question. If the 
If the context contains comparative information (like "more than", "less than", "most", "favorite"), use that to give a precise answer. 
Keep your response concise and natural.`;

  try {
    console.log("🧠 === LLM ANSWER SYNTHESIS START ===");
    console.log("❓ Question:", query);
    console.log("📚 Context inputs:", originalInputs);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at analyzing personal knowledge and providing direct, helpful answers based on context. Always use the provided context to give accurate, specific responses.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
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

Rules for entity extraction:
1. Use "<user>" to represent the user asking (${username})
2. Extract the subject entities that the question is about
3. When "my" is used, the user (<user>) is one entity
4. "Who", "what", "where" questions often seek information about relationships involving the user
5. Handle possessives properly (e.g., "my girlfriend" becomes "<user>'s girlfriend" as a separate entity)
6. SPECIAL RULE: For queries about descriptive claims (asking about what is too spicy, manipulative, etc.), assume the user made those claims. Use "<user>" as the source entity for "claims" relationships.

Rules for relationship extraction:
1. Extract the core relationship/connection being queried
2. Focus on the action, attribute, or connection being asked about
3. Remove question words (who, what, where, when) from the relationship
4. For descriptive queries about claims, prefix with "claims" (e.g., "claims is too spicy", "claims is manipulative")

Examples:
Query: "who will I marry?"
Output: {"entities": ["<user>"], "relationship": "will marry"}

Query: "who are my favorite artists?"
Output: {"entities": ["<user>"], "relationship": "favorite artists"}

Query: "what does my fiancee like?"
Output: {"entities": ["<user>'s fiancee"], "relationship": "likes"}

Query: "who is my favorite country artist?"
Output: {"entities": ["<user>"], "relationship": "favorite country artist is"}

Query: "Who does my girlfriend love?"
Output: {"entities": ["<user>'s girlfriend"], "relationship": "loves"}

Query: "what does Jake Owen do?"
Output: {"entities": ["Jake Owen"], "relationship": "does"}

Query: "what food is too spicy?"
Output: {"entities": ["<user>"], "relationship": "claims is too spicy"}

Query: "who is manipulative?"
Output: {"entities": ["<user>"], "relationship": "claims is manipulative"}

Now parse this query: "${query}"`;

  try {
    console.log("\n🔍 === LLM QUERY PARSING START ===");
    console.log("❓ Query:", query);
    console.log("👤 Username:", username);

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
