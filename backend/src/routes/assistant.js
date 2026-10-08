const express = require('express');
const { generateAnswer } = require('../lib/ragAssistant');
const router = express.Router();

/**
 * POST /api/v1/assistant/chat
 * Send a question to the Transport Assistant
 */
router.post('/chat', async (req, res) => { require('fs').appendFileSync('app_chat_error.log', 'Reached chat route!\n');
  try {
    const { question, sessionId } = req.body;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    // In production, limit message frequency here to prevent spam
    
    const result = await generateAnswer(question, sessionId || 'anonymous');
    
    res.json({
      answer: result.answer,
      sources: result.sources
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    require('fs').appendFileSync('app_chat_error.log', new Date().toISOString() + '\\n' + String(error.stack || error) + '\\n\\n');
    res.status(500).json({ error: 'Assistant is temporarily unavailable.' });
  }
});

module.exports = router;
