const { GoogleGenerativeAI } = require('@google/generative-ai');

// Default to Gemini API using env key, fallback for testing
const API_KEY = process.env.AI_API_KEY || 'fake-key-for-tests';
const genAI = new GoogleGenerativeAI(API_KEY);

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-2';
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-3.5-flash-lite';

async function generateEmbedding(text) {
  if (!text) return [];
  try {
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    // Return empty or throw depending on strictness
    throw error;
  }
}

async function generateText(prompt, systemInstruction = null) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('GROQ_API_KEY is missing');
    
    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        messages: messages,
        temperature: 0.2
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error: ${response.status} ${errText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Failed to generate text (Groq):', error);
    throw error;
  }
}

module.exports = {
  generateEmbedding,
  generateText
};
