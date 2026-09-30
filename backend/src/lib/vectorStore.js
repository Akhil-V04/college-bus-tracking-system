/**
 * Vector similarity matching logic
 */

// Cosine similarity between two arrays
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Perform a semantic search by finding the most similar vectors in the provided store.
 * (In a production environment with pgvector, this would be a SQL query:
 *   SELECT id, 1 - (embedding <=> $1) AS similarity FROM Table ORDER BY similarity DESC LIMIT $2
 *  Since pgvector is a manual step for the user, this fallback implements it in-memory
 *  which is fine for prototype limits).
 * 
 * @param {Array<number>} queryEmbedding 
 * @param {Array<{id: string, embeddingArray: Array<number>}>} items 
 * @param {number} threshold 
 * @returns {Array<{id: string, score: number}>}
 */
function findSimilar(queryEmbedding, items, threshold = 0.75) {
  const results = [];
  
  for (const item of items) {
    if (!item.embeddingArray || item.embeddingArray.length === 0) continue;
    
    const score = cosineSimilarity(queryEmbedding, item.embeddingArray);
    if (score >= threshold) {
      results.push({
        id: item.id,
        score
      });
    }
  }
  
  // Sort descending by score
  return results.sort((a, b) => b.score - a.score);
}

module.exports = {
  cosineSimilarity,
  findSimilar
};
