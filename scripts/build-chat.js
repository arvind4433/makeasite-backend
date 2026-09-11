import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const source = process.env.AI_WEBSITE_SOURCE || fileURLToPath(new URL('../../makeasite-main', import.meta.url));
if (existsSync(resolve(source, 'src/config/pricing.js'))) {
  await import('./sync-ai-knowledge.js');
} else {
  console.log('Standalone backend build: using committed public knowledge snapshot.');
}
const { knowledge } = await import('../services/ai/knowledge.js');
if (!knowledge.contact?.whatsapp || !knowledge.chunks?.length) throw new Error('Missing AI knowledge');
await import('../routes/chatRoutes.js');
console.log('Chat backend build/import checks passed.');
