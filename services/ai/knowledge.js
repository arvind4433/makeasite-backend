import { readFileSync } from 'node:fs';

export const knowledge = JSON.parse(readFileSync(new URL('../../data/ai-knowledge.json', import.meta.url), 'utf8'));
export const contact = knowledge.contact;

const synonyms = [
  [/e[- ]?commerce|ecomm?erce|online (store|shop)|products?|dukaan|दुकान|उत्पाद/iu, 'e commerce store product checkout payment'],
  [/pric|cost|budget|quote|kitn|paisa|paise|rate|kharch|कीमत|बजट|कितन|खर्च/iu, 'pricing priceINR calculatorRules cost'],
  [/services?|kya kya|kya kar|offer|सेवा|बनव|bnwa|banwa/iu, 'services website development'],
  [/contact|phone|number|whatsapp|email|baat|human|team|संपर्क|नंबर|बात/iu, 'contact email phone whatsapp'],
  [/deliver|deadline|time|kab|din|jaldi|समय|दिन|कब/iu, 'timelines delivery days weeks'],
  [/tech|stack|mern|तकनीक/iu, 'technologies MERN MongoDB Express React Node'],
  [/refund|cancel|वापस|रिफंड/iu, 'refund cancellation policies'],
  [/privacy|data|गोपनीय/iu, 'privacy data policies'],
  [/support|maintenance|bug/iu, 'support post delivery bugs maintenance'],
  [/portfolio|examples?|demo|previous|काम दिखा/iu, 'portfolio projects examples'],
  [/redesign|design|डिजाइन/iu, 'design redesign UI UX'],
];
const stop = new Set(['the', 'and', 'for', 'you', 'your', 'have', 'what', 'with', 'can', 'hai', 'mujhe', 'mere', 'makeasite', 'website']);
function tokens(text) {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(w => w.length > 2 && !stop.has(w)) || []);
}
function expand(text) {
  return `${text} ${synonyms.filter(([pattern]) => pattern.test(text)).map(([, words]) => words).join(' ')}`;
}
const indexed = knowledge.chunks.map(chunk => ({ ...chunk, terms: tokens(`${chunk.section} ${chunk.text}`) }));

// Small corpus: multilingual keyword expansion + inverse-document-frequency ranking.
// The recent user turns keep short follow-ups ("100", "price?") tied to the project.
export function retrieveKnowledge(message, history = []) {
  const current = tokens(expand(message));
  const previous = tokens(expand(history.filter(m => m.role === 'user').slice(-4).map(m => m.text).join(' ')));
  const scored = indexed.map(chunk => {
    let score = 0;
    for (const term of new Set([...current, ...previous])) {
      if (!chunk.terms.has(term)) continue;
      const frequency = indexed.filter(c => c.terms.has(term)).length;
      score += (current.has(term) ? 3 : 1) * Math.log(1 + indexed.length / (1 + frequency));
    }
    return { chunk, score };
  }).sort((a, b) => b.score - a.score);
  const selected = indexed.filter(c => c.section === 'contact');
  // A compact service overview is always available, including for greetings.
  selected.push(...indexed.filter(c => c.section === 'services').slice(0, 6));
  let chars = selected.reduce((sum, c) => sum + c.text.length, 0);
  let retrieved = 0;
  for (const { chunk, score } of scored) {
    if (!score || selected.includes(chunk) || chars + chunk.text.length > 10500) continue;
    selected.push(chunk);
    chars += chunk.text.length;
    if (++retrieved >= 8) break;
  }
  return selected.map(({ terms: _terms, ...chunk }) => chunk);
}
