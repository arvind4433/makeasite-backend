export const LIMITS = Object.freeze({ message: 1200, historyTurns: 16, historyTurn: 3000, historyChars: 14000, reply: 3000 });

export class ChatInputError extends Error {}

export function validateChatInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['message', 'conversationHistory'].includes(key))) {
    throw new ChatInputError('Please send a message and conversation history.');
  }
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > LIMITS.message) {
    throw new ChatInputError(`Please enter a message of 1–${LIMITS.message} characters.`);
  }
  const history = body.conversationHistory ?? [];
  if (!Array.isArray(history) || history.length > LIMITS.historyTurns) throw new ChatInputError('Please start a new conversation.');
  let total = 0;
  let previousRole;
  const normalized = history.map(item => {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.text !== 'string' ||
        !item.text.trim() || item.text.length > LIMITS.historyTurn ||
        Object.keys(item).some(key => !['role', 'text'].includes(key))) throw new ChatInputError('Invalid conversation history.');
    if (item.role === previousRole) throw new ChatInputError('Invalid conversation order.');
    previousRole = item.role;
    total += item.text.length;
    return { role: item.role, text: item.text.trim() };
  });
  if (total > LIMITS.historyChars) throw new ChatInputError('Please start a new conversation.');
  if (normalized.length && (normalized[0].role !== 'user' || normalized.at(-1).role !== 'assistant')) {
    throw new ChatInputError('Invalid conversation order.');
  }
  return { message: body.message.trim(), history: normalized };
}

// Defense in depth; this filter is not the trust boundary. No secrets, tools,
// environment values or private source are ever included in the model context.
export function isInjection(message) {
  const normalized = message.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  return /(?:ignore|override|forget|disregard)\s+(?:all\s+|previous\s+|your\s+|the\s+)*(?:instructions|rules|system)|(?:show|reveal|print|give|display|repeat|translate|encode|bata|dikha).{0,100}(?:api.?key|system.?prompt|environment|\.env|secret|server config|private source)|(?:api.?key|system.?prompt|\.env|secret).{0,80}(?:bata|dikha|बताओ|दिखाओ)|(?:निर्देश).{0,30}(?:भूल|अनदेखा)/iu.test(normalized);
}

export function languageOf(text) {
  if (/[\u0900-\u097f]/u.test(text)) return 'hi';
  return /\b(hai|ho|mujhe|mere|mera|kya|kitn\w*|bata\w*|chahiye|bnwani|banwani|aap|tum|nahi)\b/i.test(text) ? 'hinglish' : 'en';
}

export const unavailableMessage = (text = '') => ({
  en: "I'm having trouble responding right now. Please retry, or contact the MakeASite team below.",
  hi: 'अभी जवाब देने में दिक्कत आ रही है। दोबारा कोशिश करें या नीचे MakeASite टीम से संपर्क करें।',
  hinglish: 'Abhi reply karne mein dikkat aa rahi hai. Dobara try karein ya neeche MakeASite team se baat kar lein.'
}[languageOf(text)]);
