const express = require('express');
const prisma = require('../lib/prisma');
const { generateEmbedding } = require('../lib/aiProvider');
const router = express.Router();

const CHUNK_SIZE = 500; // characters per chunk (roughly ~100-125 tokens)

/**
 * Split document content into chunks
 * Supports markdown route heading awareness (### Route N, etc.) so stops,
 * timings, driver contacts, and notes stay together.
 */
function chunkText(text, size = CHUNK_SIZE) {
  if (!text) return [];

  // If markdown document contains headings (e.g. ### Route 1, ## Core facts, etc.),
  // split on headings so that route details, stops, driver contacts remain together.
  if (/^###?\s+/m.test(text)) {
    const rawSections = text.split(/(?=\n###?\s+)/g).map((s) => s.trim()).filter(Boolean);
    const chunks = [];
    let preamble = '';

    for (const sec of rawSections) {
      if (sec.startsWith('# ') || sec.startsWith('## Core') || sec.startsWith('## Transport') || sec.startsWith('## Overview')) {
        preamble = preamble ? (preamble + '\n\n' + sec) : sec;
      } else if (sec === '## Routes') {
        continue;
      } else {
        if (preamble) {
          chunks.push(preamble.trim());
          preamble = '';
        }
        if (sec.length <= 1500) {
          chunks.push(sec);
        } else {
          // Fallback split for unusually long individual section
          const paragraphs = sec.split(/\n\n+/);
          let curr = '';
          for (const para of paragraphs) {
            if ((curr + '\n\n' + para).length > size && curr.length > 0) {
              chunks.push(curr.trim());
              curr = para;
            } else {
              curr = curr ? curr + '\n\n' + para : para;
            }
          }
          if (curr.trim()) chunks.push(curr.trim());
        }
      }
    }
    if (preamble) chunks.push(preamble.trim());
    if (chunks.length > 0) return chunks;
  }

  // Fallback paragraph-based chunking
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > size && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * GET /api/v1/knowledge
 * List all knowledge documents
 */
router.get('/', async (_req, res) => {
  try {
    const docs = await prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chunks: true } } }
    });
    res.json(docs);
  } catch (error) {
    console.error('Knowledge list error:', error);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

/**
 * POST /api/v1/knowledge
 * Upload and index a new knowledge document
 */
router.post('/', async (req, res) => {
  try {
    const { title, sourceType, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // 1. Save the document
    const doc = await prisma.knowledgeDocument.create({
      data: { title, sourceType: sourceType || 'OTHER', content }
    });

    // 2. Chunk the text
    const textChunks = chunkText(content);

    // 3. Create chunks and their embeddings
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = await prisma.knowledgeChunk.create({
        data: {
          documentId: doc.id,
          chunkIndex: i,
          content: textChunks[i],
          tokenCount: Math.ceil(textChunks[i].length / 4) // rough estimate
        }
      });

      // Generate embedding for each chunk (async, don't block response for large docs)
      generateEmbedding(textChunks[i])
        .then(async (embeddingArray) => {
          await prisma.knowledgeEmbedding.create({
            data: {
              chunkId: chunk.id,
              embeddingArray,
              modelVersion: process.env.EMBEDDING_MODEL || 'text-embedding-004'
            }
          });
        })
        .catch((err) => console.error(`Embedding failed for chunk ${i}:`, err));
    }

    res.status(201).json({ success: true, id: doc.id, chunks: textChunks.length });
  } catch (error) {
    console.error('Knowledge upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

/**
 * PATCH /api/v1/knowledge/:id
 * Toggle active state
 */
router.patch('/:id', async (req, res) => {
  try {
    const doc = await prisma.knowledgeDocument.update({
      where: { id: req.params.id },
      data: { active: req.body.active }
    });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});

/**
 * DELETE /api/v1/knowledge/:id
 * Remove a document and its chunks/embeddings
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.knowledgeDocument.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.chunkText = chunkText;
module.exports = router;
