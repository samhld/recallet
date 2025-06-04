// Quick script to generate embeddings for relationship descriptions
const { createEmbedding } = require('./server/llm.ts');

async function updateEmbeddings() {
  const descriptions = [
    { id: 1, desc: 'This person considers Jake Owen to be their most preferred and beloved country music performer, ranking him above all other artists in the country genre' },
    { id: 2, desc: 'This person has a strong emotional affection and admiration for the country music artist Thomas Rhett, enjoying his music and considering him a preferred performer' },
    { id: 4, desc: 'This person considers Jake Owen to be their most preferred and beloved country music performer, ranking him above all other artists in the country genre' }
  ];

  for (const rel of descriptions) {
    try {
      const embedding = await createEmbedding(rel.desc);
      console.log(`Embedding for relationship ${rel.id}:`, embedding.slice(0, 5), '...');
      // Print the SQL update command
      console.log(`UPDATE relationships SET relationship_desc_vec = '[${embedding.join(',')}]'::vector WHERE id = ${rel.id};`);
    } catch (error) {
      console.error(`Error for relationship ${rel.id}:`, error);
    }
  }
}

updateEmbeddings();