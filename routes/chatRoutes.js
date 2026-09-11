import express from 'express';
import rateLimit from 'express-rate-limit';
import { answerChat } from '../services/ai/chatService.js';
import { contact } from '../services/ai/knowledge.js';
import { validateChatInput, ChatInputError, unavailableMessage } from '../services/ai/validation.js';

export function createChatRouter({ answer = answerChat, maxRequests = 20, log = console } = {}) {
  const router = express.Router();
  const busy = { message: 'Please wait a little before sending more messages. You can contact the team below.', contact };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => {
    const origins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'https://www.makeasite.online,https://makeasite.online')
      .split(',').map(s => s.trim()).filter(Boolean);
    if (process.env.NODE_ENV !== 'production') origins.push('http://localhost:5173', 'http://127.0.0.1:5173');
    if (req.get('origin') && !origins.includes(req.get('origin'))) return res.status(403).json({ message: 'This origin is not allowed.', contact });
    next();
  });
  // No account is required. Limits apply before parsing or requesting paid inference.
  router.use(rateLimit({ windowMs: 10 * 60 * 1000, limit: maxRequests, standardHeaders: 'draft-8', legacyHeaders: false, message: busy }));
  router.use(rateLimit({ windowMs: 60 * 60 * 1000, limit: 300, keyGenerator: () => 'chat-global', standardHeaders: false, legacyHeaders: false, message: busy }));
  router.use(express.json({ limit: '64kb', strict: true }));
  let active = 0;
  router.post('/', async (req, res) => {
    let input;
    try { input = validateChatInput(req.body); }
    catch (error) {
      return res.status(400).json({ message: error instanceof ChatInputError ? error.message : 'Invalid message.', contact });
    }
    if (active >= 4) return res.status(503).json({ message: unavailableMessage(input.message), contact });
    active += 1;
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    try {
      const data = await answer({ ...input, signal: controller.signal });
      if (!res.destroyed) res.json(data);
    } catch (error) {
      // Never log prompts, response bodies, raw SDK errors or API keys.
      log.warn('Chat provider request failed', { status: Number(error.status) || 503 });
      if (!res.destroyed) res.status(503).json({ message: unavailableMessage(input.message), contact });
    } finally { res.off('close', disconnect); active -= 1; }
  });
  router.use((error, _req, res, _next) => {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ message: 'Please send a shorter, valid message.', contact });
  });
  return router;
}

export default createChatRouter();
