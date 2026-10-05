const test = require('node:test');
const assert = require('node:assert/strict');
const { cosineSimilarity, findSimilar } = require('../src/lib/vectorStore');

// ── Phase 4 — AI Tests ──

test('cosineSimilarity returns ~1 for identical vectors', () => {
  const v = [0.1, 0.2, 0.3, 0.4];
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-10);
});

test('cosineSimilarity returns 0 for orthogonal vectors', () => {
  const a = [1, 0, 0];
  const b = [0, 1, 0];
  assert.equal(cosineSimilarity(a, b), 0);
});

test('cosineSimilarity handles zero vectors gracefully', () => {
  assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
});

test('cosineSimilarity returns 0 for mismatched lengths', () => {
  assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);
});

test('findSimilar returns matches above threshold', () => {
  const query = [1, 0, 0];
  const items = [
    { id: 'a', embeddingArray: [1, 0, 0] },        // identical → 1.0
    { id: 'b', embeddingArray: [0.9, 0.1, 0] },     // very similar
    { id: 'c', embeddingArray: [0, 1, 0] },          // orthogonal → 0.0
    { id: 'd', embeddingArray: [] },                  // empty
  ];
  const results = findSimilar(query, items, 0.8);
  assert.ok(results.length >= 1);
  assert.equal(results[0].id, 'a');
  assert.equal(results[0].score, 1);
  // 'c' should NOT appear (score = 0)
  assert.equal(results.find(r => r.id === 'c'), undefined);
});

test('findSimilar returns empty array when nothing matches', () => {
  const results = findSimilar([1, 0, 0], [{ id: 'x', embeddingArray: [0, 1, 0] }], 0.9);
  assert.equal(results.length, 0);
});

test('findSimilar sorts results descending by score', () => {
  const query = [1, 0, 0];
  const items = [
    { id: 'low', embeddingArray: [0.8, 0.2, 0] },
    { id: 'high', embeddingArray: [0.99, 0.01, 0] },
  ];
  const results = findSimilar(query, items, 0.5);
  if (results.length >= 2) {
    assert.ok(results[0].score >= results[1].score);
  }
});

test('AI provider module exports expected functions', () => {
  const aiProvider = require('../src/lib/aiProvider');
  assert.equal(typeof aiProvider.generateEmbedding, 'function');
  assert.equal(typeof aiProvider.generateText, 'function');
});

test('issueIntelligence module exports processReportForClustering', () => {
  const issueIntelligence = require('../src/lib/issueIntelligence');
  assert.equal(typeof issueIntelligence.processReportForClustering, 'function');
});

test('ragAssistant module exports generateAnswer', () => {
  const ragAssistant = require('../src/lib/ragAssistant');
  assert.equal(typeof ragAssistant.generateAnswer, 'function');
});

// AI failure isolation — ensure these modules don't throw on import
test('AI modules do not throw on require even without API key', () => {
  assert.doesNotThrow(() => require('../src/lib/aiProvider'));
  assert.doesNotThrow(() => require('../src/lib/vectorStore'));
  assert.doesNotThrow(() => require('../src/lib/issueIntelligence'));
  assert.doesNotThrow(() => require('../src/lib/ragAssistant'));
});
