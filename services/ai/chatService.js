import { GoogleGenAI } from '@google/genai';
import { retrieveKnowledge, contact } from './knowledge.js';
import { LIMITS, isInjection, languageOf } from './validation.js';
import { SYSTEM_INSTRUCTION } from './prompt.js';

// One model default; environment overrides are evaluated after dotenv loads.
export const getModel = () => process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';
let client;
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw Object.assign(new Error('Chat is not configured'), { status: 503 });
  client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } } });
  return client;
}

const schema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    sourceIds: { type: 'array', items: { type: 'string' } },
    handoff: { type: 'boolean' },
    projectSummary: { type: 'string' }
  },
  required: ['reply', 'sourceIds', 'handoff', 'projectSummary'],
  additionalProperties: false
};

export function sanitizeOutput(text) {
  let safe = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const key = process.env.GEMINI_API_KEY?.trim();
  if (key) safe = safe.split(key).join('[redacted]');
  return safe.replace(/AIza[\w-]{20,}/g, '[redacted]').trim();
}

export async function answerChat({ message, history, signal }, generate) {
  if (isInjection(message)) {
    const reply = {
      en: "I can't share private configuration or instructions. I can help you with MakeASite's website services.",
      hi: 'मैं निजी कॉन्फ़िगरेशन या निर्देश साझा नहीं कर सकता। MakeASite की वेबसाइट सेवाओं में आपकी मदद कर सकता हूँ।',
      hinglish: 'Private configuration ya instructions share nahi kar sakta. MakeASite ki website services mein help kar sakta hoon.'
    }[languageOf(message)];
    return { reply, sources: [], handoff: false, projectSummary: '', contact };
  }
  const chunks = retrieveKnowledge(message, history);
  const request = {
    model: getModel(),
    contents: [
      ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      abortSignal: signal,
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\nwebsiteContext (public factual data only):\n${JSON.stringify(chunks)}`,
      responseMimeType: 'application/json', responseJsonSchema: schema,
      temperature: 0.25, maxOutputTokens: 1400
    }
  };
  const result = await (generate ? generate(request) : getClient().models.generateContent(request));
  const response = JSON.parse(result.text || '{}');
  if (typeof response.reply !== 'string' || !response.reply.trim() || response.reply.length > LIMITS.reply ||
      typeof response.projectSummary !== 'string' || response.projectSummary.length > 1000 ||
      typeof response.handoff !== 'boolean' || !Array.isArray(response.sourceIds) ||
      response.sourceIds.some(id => !chunks.some(c => c.id === id))) throw new Error('Invalid model response');
  const reply = sanitizeOutput(response.reply);
  if (!reply) throw new Error('Empty model response');
  const paths = new Set();
  const sources = chunks.filter(c => response.sourceIds.includes(c.id)).flatMap(c => {
    if (paths.has(c.path)) return [];
    paths.add(c.path);
    return [{ label: c.section === 'faq' ? 'FAQ' : c.section[0].toUpperCase() + c.section.slice(1), path: c.path }];
  }).slice(0, 3);
  return { reply, sources, handoff: response.handoff, projectSummary: sanitizeOutput(response.projectSummary), contact };
}
