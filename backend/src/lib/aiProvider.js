const { GoogleGenerativeAI } = require('@google/generative-ai');

// Default to Gemini API using env key, fallback for testing
const API_KEY = process.env.AI_API_KEY || 'fake-key-for-tests';
const genAI = new GoogleGenerativeAI(API_KEY);

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-004';
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-1.5-flash';

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
    const model = genAI.getGenerativeModel({ 
      model: LLM_MODEL,
      systemInstruction: systemInstruction ? { role: 'system', parts: [{text: systemInstruction}] } : undefined
    });
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Failed to generate text:', error);
    throw error;
  }
}

module.exports = {
  generateEmbedding,
  generateText
};
