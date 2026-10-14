require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');
const { generateEmbedding } = require('../src/lib/aiProvider');
const { chunkText } = require('../src/routes/knowledge');
const { generateAnswer } = require('../src/lib/ragAssistant');

const DOC_PATH = path.resolve(__dirname, '../../docs/VBIT_College_Transport_RAG_Knowledge_Base.md');
const DOC_TITLE = 'VBIT College Transport Knowledge Base';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ingest() {
  console.log('====================================================');
  console.log('🚀 Starting VBIT College Transport Knowledge Base Ingestion');
  console.log('====================================================');

  if (!fs.existsSync(DOC_PATH)) {
    throw new Error(`Knowledge base markdown file not found at: ${DOC_PATH}`);
  }

  const content = fs.readFileSync(DOC_PATH, 'utf8');
  console.log(`📄 Read markdown file (${content.length} characters)`);

  // 1. Remove any prior versions of this document to ensure a clean state
  const existing = await prisma.knowledgeDocument.findFirst({
    where: { title: DOC_TITLE }
  });

  if (existing) {
    console.log(`🧹 Cleaning up previous version of document ID: ${existing.id}`);
    await prisma.knowledgeDocument.delete({ where: { id: existing.id } });
  }

  // 2. Create the KnowledgeDocument
  console.log('📝 Creating KnowledgeDocument record in database...');
  const doc = await prisma.knowledgeDocument.create({
    data: {
      title: DOC_TITLE,
      sourceType: 'TIMETABLE',
      content,
      active: true
    }
  });
  console.log(`✅ Document created with ID: ${doc.id}`);

  // 3. Chunk the content using route-aware chunker
  const textChunks = chunkText(content);
  console.log(`🧩 Split document into ${textChunks.length} semantic chunks`);

  // 4. Ingest each chunk and generate its embedding
  for (let i = 0; i < textChunks.length; i++) {
    const chunkTextContent = textChunks[i];
    const firstLine = chunkTextContent.split('\n')[0].slice(0, 50);

    const chunk = await prisma.knowledgeChunk.create({
      data: {
        documentId: doc.id,
        chunkIndex: i,
        content: chunkTextContent,
        tokenCount: Math.ceil(chunkTextContent.length / 4)
      }
    });

    console.log(`[${i + 1}/${textChunks.length}] Generating embedding for: "${firstLine}"...`);
    try {
      const embeddingArray = await generateEmbedding(chunkTextContent);
      await prisma.knowledgeEmbedding.create({
        data: {
          chunkId: chunk.id,
          embeddingArray,
          modelVersion: process.env.EMBEDDING_MODEL || 'gemini-embedding-2'
        }
      });
      console.log(`   -> Stored embedding (${embeddingArray.length} dims)`);
    } catch (err) {
      console.error(`   ❌ Failed to generate embedding for chunk ${i}:`, err.message || err);
    }

    // Small delay between API calls to avoid rate limiting
    await sleep(400);
  }

  console.log('====================================================');
  console.log('🎉 Ingestion & Embedding Generation Completed!');
  console.log('====================================================');

  // 5. Test verification queries
  const testQueries = [
    'How many bus routes does our college have?',
    'Does Route 30 exist?',
    'Who is the driver of Route 16?',
    'Which bus stops at Malkajgiri?'
  ];

  console.log('\n🔍 Running RAG Verification Tests:');
  console.log('----------------------------------------------------');

  for (const q of testQueries) {
    console.log(`\n❓ Question: "${q}"`);
    try {
      const result = await generateAnswer(q, 'cli-test-session');
      console.log(`💡 Answer:\n${result.answer.trim()}`);
      console.log(`📚 Sources: ${result.sources.join(', ') || 'None'}`);
    } catch (err) {
      console.error(`❌ Error querying RAG:`, err.message);
    }
    await sleep(500);
  }

  console.log('\n====================================================');
  console.log('✅ All tests finished. Exiting.');
  process.exit(0);
}

ingest().catch((err) => {
  console.error('Fatal ingestion error:', err);
  process.exit(1);
});
