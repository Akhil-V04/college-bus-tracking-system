const { generateEmbedding, generateText } = require('./aiProvider');
const { findSimilar } = require('./vectorStore');
const prisma = require('./prisma');

const SIMILARITY_THRESHOLD = 0.55;
const MAX_CHUNKS = 8;

const SYSTEM_INSTRUCTION = `You are the College Transport Assistant for VBIT (Vignana Bharathi Institute of Technology). 
Your job is to answer questions about college transport schedules, bus routes, driver details, bus in-charges, transport rules, and emergency procedures.
You MUST base your answers strictly on the provided context documents. 

Key Grounding Rules:
- College Routes: The college operates 30 routes (Routes 1 through 29, and Route 31).
- Route 30: Route 30 does NOT exist in the college transport system. If asked about Route 30, state clearly that Route 30 does not exist.
- One Demo Route is available for system testing and development purposes.
- Scheduled arrival at VBIT Campus is 9:25 AM for all morning routes. Clarify this is scheduled time, not live arrival status.
- When asked which bus stops at a location, check all routes in the context and list every route number and its scheduled arrival/pickup time.
- When asked for driver or in-charge details, provide the exact name and phone number from the context.
- If timing inconsistencies are flagged in the context notes for a route, mention that students should verify with the transport in-charge.
- Transport In-Charges: Mr. P. Venu Gopal (7993453629) and Mr. G. Ramesh (7993453635).
- If the answer is not contained in the context, say "The provided transport documents do not contain information about this." and do not guess or hallucinate.
- Do NOT hallucinate live GPS locations, current delays, or ETAs. If the user asks where a bus is or its live ETA, politely inform them to check the Live Tracking map in the app.
Be concise, helpful, and polite.`;

/**
 * Fast-path predefined answers to save time and API costs
 */
const PREBUILT_ANSWERS = [
  {
    keywords: /^(hi|hello|hey|good\s*(morning|afternoon|evening)|namaste|hola|sup|yo)(\s*!*|\s+there|\s+assistant|\s+bot)?$/i,
    answer: 'Hello! I am your VBIT Transport Assistant. I can help you with bus route numbers, stop locations, arrival timings, driver details, or transport guidelines. What would you like to know today?'
  },
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
    // 0. Fast-path check for greetings and common questions
    const matched = PREBUILT_ANSWERS.find((p) => p.keywords.test(question.trim()));
    if (matched) {
      try {
        await prisma.assistantConversation.create({
          data: { sessionId, role: 'USER', content: question, sourceChunkIds: [] }
        });
        await prisma.assistantConversation.create({
          data: { sessionId, role: 'ASSISTANT', content: matched.answer, sourceChunkIds: [] }
        });
      } catch (logErr) {
        console.warn('Failed to log conversation to database:', logErr.message);
      }
      return { answer: matched.answer, sources: ['Pre-built Knowledge'] };
    }

    // 1. Retrieve document chunks
    const activeChunks = await prisma.knowledgeChunk.findMany({
      where: {
        document: { active: true }
      },
      include: {
        document: true,
        embedding: true
      }
    });

    // 2. Try to embed the user's question, but do NOT fail if embedding is unavailable
    let vectorMatches = [];
    try {
      const queryEmbedding = await generateEmbedding(question);
      if (Array.isArray(queryEmbedding) && queryEmbedding.length > 0) {
        const items = activeChunks
          .filter((c) => c.embedding && c.embedding.embeddingArray)
          .map((c) => ({
            id: c.id,
            embeddingArray: c.embedding.embeddingArray
          }));
        vectorMatches = findSimilar(queryEmbedding, items, SIMILARITY_THRESHOLD);
      }
    } catch (embErr) {
      console.warn('Embedding service unavailable, using keyword retrieval:', embErr.message);
    }

    // 3. Hybrid keyword & entity matching
    const qLower = question.toLowerCase();
    const routeMatch = qLower.match(/route\s*(\d+|demo)/i);
    const targetRouteNumber = routeMatch ? routeMatch[1] : null;

    const stopWords = new Set([
      'what', 'when', 'which', 'where', 'who', 'does', 'have', 'from',
      'with', 'stops', 'stop', 'bus', 'college', 'campus', 'time', 'driver',
      'exist', 'total', 'about', 'tell', 'please', 'know', 'many'
    ]);
    const searchWords = qLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    const candidateScores = new Map();
    for (const match of vectorMatches) {
      candidateScores.set(match.id, match.score);
    }

    for (const chunk of activeChunks) {
      const cLower = chunk.content.toLowerCase();
      let boost = 0;

      // Exact route match boost
      if (targetRouteNumber) {
        if (targetRouteNumber.toLowerCase() === 'demo' && cLower.includes('demo route')) {
          boost += 0.50;
        } else if (
          cLower.includes(`### route ${targetRouteNumber}`) ||
          cLower.includes(`route ${targetRouteNumber} `) ||
          cLower.includes(`route ${targetRouteNumber}\n`) ||
          cLower.includes(`route ${targetRouteNumber}:`)
        ) {
          boost += 0.50;
        }
      }

      // Keyword match boost (e.g. stop name like 'malkajgiri', 'uppal', etc.)
      for (const word of searchWords) {
        if (cLower.includes(word)) {
          boost += 0.20;
        }
      }

      if (boost > 0) {
        const prev = candidateScores.get(chunk.id) || 0.4;
        candidateScores.set(chunk.id, prev + boost);
      }
    }

    // Rank candidates by combined score
    const rankedChunkIds = Array.from(candidateScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CHUNKS)
      .map((entry) => entry[0]);

    let contextText = '';
    const sourceChunkIds = [];
    const sourceDocs = new Set();

    for (const chunkId of rankedChunkIds) {
      const chunk = activeChunks.find((c) => c.id === chunkId);
      if (chunk) {
        contextText += `[Source: ${chunk.document.title}]\n${chunk.content}\n\n`;
        sourceChunkIds.push(chunk.id);
        sourceDocs.add(chunk.document.title);
      }
    }

    // If no specific documents matched, include summary of routes
    if (!contextText && activeChunks.length > 0) {
      const defaultChunks = activeChunks.slice(0, 3);
      for (const c of defaultChunks) {
        contextText += `[Source: ${c.document.title}]\n${c.content}\n\n`;
        sourceChunkIds.push(c.id);
        sourceDocs.add(c.document.title);
      }
    }

    // 4. Generate Answer using LLM (Groq)
    const prompt = `Context Information:\n${contextText || '(No specific documents matched, use general college transport policy)'}\n\nUser Question: ${question}\n\nAnswer:`;

    const answer = await generateText(prompt, SYSTEM_INSTRUCTION);

    // 5. Save conversation
    try {
      await prisma.assistantConversation.create({
        data: {
          sessionId,
          role: 'USER',
          content: question,
          sourceChunkIds: []
        }
      });

      await prisma.assistantConversation.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: answer,
          sourceChunkIds
        }
      });
    } catch (saveErr) {
      console.warn('Failed to save conversation:', saveErr.message);
    }

    return {
      answer,
      sources: Array.from(sourceDocs)
    };
  } catch (error) {
    console.error('RAG Error:', error);
    return {
      answer: "I am having trouble retrieving documents right now. You can check the Available Routes on your dashboard for schedules, or contact the Transport In-Charge: Mr. P. Venu Gopal (7993453629).",
      sources: ['VBIT Transport Helpdesk']
    };
  }
}

module.exports = {
  generateAnswer
};
