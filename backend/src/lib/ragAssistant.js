const { generateEmbedding, generateText } = require('./aiProvider');
const { findSimilar } = require('./vectorStore');
const prisma = require('./prisma');

const SIMILARITY_THRESHOLD = 0.70;
const MAX_CHUNKS = 5;

const SYSTEM_INSTRUCTION = `You are the College Transport Assistant. 
Your job is to answer questions about college transport policies, emergency procedures, timetables, and rules.
You MUST base your answers strictly on the provided context documents. 
If the answer is not contained in the context, say "The provided transport documents do not contain information about this." and do not guess.
Do NOT hallucinate live GPS locations or ETAs. If the user asks where a bus is or its ETA, politely inform them to use the Live Tracking map feature in the app.
Be concise, helpful, and polite.`;

/**
 * Handle a chat message using RAG
 */
async function generateAnswer(question, sessionId = 'anonymous') {
  try {
    // 1. Embed the user's question
    const queryEmbedding = await generateEmbedding(question);
    
    // 2. Retrieve document chunks
    // Fetch all active chunks (in a real db with huge text, we'd use pgvector directly here)
    const activeChunks = await prisma.knowledgeChunk.findMany({
      where: {
        document: { active: true }
      },
      include: {
        document: true,
        embedding: true
      }
    });
    
    // Map to format for vectorStore
    const items = activeChunks
      .filter(c => c.embedding && c.embedding.embeddingArray)
      .map(c => ({
        id: c.id,
        embeddingArray: c.embedding.embeddingArray
      }));
      
    // 3. Find top N similar chunks
    const matches = findSimilar(queryEmbedding, items, SIMILARITY_THRESHOLD).slice(0, MAX_CHUNKS);
    
    let contextText = '';
    const sourceChunkIds = [];
    const sourceDocs = new Set();
    
    for (const match of matches) {
      const chunk = activeChunks.find(c => c.id === match.id);
      if (chunk) {
        contextText += `[Source: ${chunk.document.title}]\n${chunk.content}\n\n`;
        sourceChunkIds.push(chunk.id);
        sourceDocs.add(chunk.document.title);
      }
    }
    
    // 4. Generate Answer using LLM
    const prompt = `Context Information:\n${contextText || '(No relevant documents found)'}\n\nUser Question: ${question}\n\nAnswer:`;
    
    const answer = await generateText(prompt, SYSTEM_INSTRUCTION);
    
    // 5. Save conversation
    await prisma.assistantConversation.create({
      data: {
        sessionId: sessionId,
        role: 'USER',
        content: question,
        sourceChunkIds: []
      }
    });
    
    await prisma.assistantConversation.create({
      data: {
        sessionId: sessionId,
        role: 'ASSISTANT',
        content: answer,
        sourceChunkIds: sourceChunkIds
      }
    });
    
    return {
      answer,
      sources: Array.from(sourceDocs)
    };
    
  } catch (error) {
    console.error('RAG Error:', error);
    throw new Error('Failed to generate response from Transport Assistant.');
  }
}

module.exports = {
  generateAnswer
};
