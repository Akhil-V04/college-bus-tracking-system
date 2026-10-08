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
 * Fast-path predefined answers to save time and API costs
 */
const PREBUILT_ANSWERS = [
  {
    keywords: /(break\s*down|broken|accident|emergency)/i,
    answer: 'In case of a bus breakdown, remain seated calmly and wait for the driver\'s instructions. The driver will report the incident via the driver console and a replacement bus will be arranged. You can also report the issue via the "Report Issue" button.'
  },
  {
    keywords: /(transport rules|rules|regulations|allowed)/i,
    answer: 'Passengers must carry their valid ID cards, remain seated while the bus is moving, and adhere to the designated route and stop. Unauthorized passengers are strictly prohibited.'
  },
  {
    keywords: /(report.*problem|report.*issue|complain)/i,
    answer: 'You can report any bus-related problems directly through the "Report Issue" section on your dashboard. Select the issue type, add a brief description, and submit. The transport administration will receive the report instantly.'
  },
  {
    keywords: /(who can use|who is allowed|eligibility)/i,
    answer: 'The college transport is exclusively for assigned students and faculty members who have registered for the academic year. Unauthorized passengers are not allowed to board the buses.'
  }
];

/**
 * Handle a chat message using RAG
 */
async function generateAnswer(question, sessionId = 'anonymous') {
  try {
    // 0. Fast-path check for common questions
    const matched = PREBUILT_ANSWERS.find(p => p.keywords.test(question));
    if (matched) {
      // Save conversation quickly
      await prisma.assistantConversation.create({
        data: { sessionId, role: 'USER', content: question, sourceChunkIds: [] }
      });
      await prisma.assistantConversation.create({
        data: { sessionId, role: 'ASSISTANT', content: matched.answer, sourceChunkIds: [] }
      });
      return { answer: matched.answer, sources: ['Pre-built Knowledge'] };
    }

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
