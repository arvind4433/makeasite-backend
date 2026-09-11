import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontend = resolve(process.env.AI_WEBSITE_SOURCE || resolve(root, '../makeasite-main'));
// Explicit public sources only. Never index accounts, environment files or server code.
const sources = [
  ['services', 'components/ServicesSection.jsx', '/services', ['services']],
  ['faq', 'components/FAQ.jsx', '/#faq', ['faqs']],
  ['process', 'components/HowItWorks.jsx', '/#how-it-works', ['steps']],
  ['portfolio', 'components/Portfolio.jsx', '/portfolio', ['projects']],
  ['business', 'pages/AboutPage.jsx', '/about', ['values', 'stats']],
  ['business', 'components/HeroSection.jsx', '/', []],
  ['business', 'components/TrustSection.jsx', '/', []],
  ['policies', 'pages/PrivacyPolicy.jsx', '/privacy', []],
  ['policies', 'pages/TermsPage.jsx', '/terms', []],
  ['policies', 'pages/RefundPolicy.jsx', '/refund', ['cases']]
];
const clean = (text) => text.replace(/\s+/g, ' ').trim();
const ignoredKeys = new Set(['icon', 'image', 'color', 'bg', 'border', 'link']);
function literal(node) {
  if (!node) return undefined;
  if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
  if (node.type === 'ArrayExpression') return node.elements.map(literal).filter(v => v !== undefined);
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.flatMap(p => {
    const key = p.key?.name || p.key?.value;
    const value = literal(p.value);
    return key && !ignoredKeys.has(key) && value !== undefined ? [[key, value]] : [];
  }));
  if (node.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
}
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return; }
  if (visit(node) === false) return;
  for (const [key, value] of Object.entries(node)) if (!['loc', 'start', 'end'].includes(key)) walk(value, visit);
}
function visibleText(node) {
  if (node.type === 'JSXText') return node.value;
  if (node.type === 'JSXExpressionContainer') {
    return node.expression.type === 'Identifier' && node.expression.name === 'APP_NAME'
      ? 'MakeASite' : String(literal(node.expression) ?? '');
  }
  return (node.children || []).map(visibleText).join(' ');
}
const chunks = [];
const hashes = {};
function add(section, source, path, text) {
  text = clean(text);
  if (text.length < 12) return;
  // Keep each chunk intact for policy conditions; fail if a new source grows too large.
  if (text.length > 3500) throw new Error(`Split the knowledge chunk in ${source}`);
  chunks.push({ id: `${section}-${chunks.length + 1}`, section, source, path, text });
}
for (const [section, file, path, arrays] of sources) {
  const source = `src/${file}`;
  const code = await readFile(resolve(frontend, source), 'utf8');
  hashes[source] = createHash('sha256').update(code).digest('hex');
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const extractText = arrays.length === 0 || section === 'business' || section === 'policies';
  walk(ast, node => {
    if (node.type === 'VariableDeclarator' && arrays.includes(node.id.name)) {
      for (const item of literal(node.init) || []) add(section, source, path, JSON.stringify(item));
      return false;
    }
    if (extractText && node.type === 'JSXElement') {
      const name = node.openingElement.name.name;
      if (section === 'policies' && name === 'Section') {
        const title = node.openingElement.attributes.find(a => a.name?.name === 'title')?.value?.value || '';
        add(section, source, path, `${title}: ${visibleText(node)}`);
        return false;
      }
      if (['p', 'li', 'h1', 'h2', 'h3'].includes(name)) {
        add(section, source, path, visibleText(node));
        return false;
      }
    }
    // Refund instructions are an inline array rendered with map().
    if (section === 'policies' && node.type === 'ArrayExpression' && node.elements.every(n => n?.type === 'StringLiteral')) {
      for (const value of literal(node)) add(section, source, path, value);
      return false;
    }
  });
}
for (const file of ['src/config/pricing.js', 'src/data/contact.js']) {
  hashes[file] = createHash('sha256').update(await readFile(resolve(frontend, file))).digest('hex');
}
const pricing = await import(pathToFileURL(resolve(frontend, 'src/config/pricing.js')).href);
const { CONTACT } = await import(pathToFileURL(resolve(frontend, 'src/data/contact.js')).href);
add('contact', 'src/data/contact.js', CONTACT.path, JSON.stringify(CONTACT));
for (const plan of [...pricing.WEBSITE_PLANS, ...pricing.DASHBOARD_PLANS]) {
  add('pricing', 'src/config/pricing.js', '/pricing', JSON.stringify({
    title: plan.title, subtitle: plan.subtitle, priceINR: plan.price,
    displayedRange: plan.rangeLabel, features: plan.features, scope: plan.preset
  }));
}
add('pricing', 'src/config/pricing.js', '/pricing', JSON.stringify({ currency: 'INR', calculatorRules: pricing.PRICING_RULES, extras: pricing.EXTRA_FEATURES, delivery: pricing.DELIVERY_OPTIONS }));
add('services', 'src/config/pricing.js', '/pricing', JSON.stringify({ websiteTypes: pricing.WEBSITE_TYPES, designStyles: pricing.DESIGN_STYLES }));
const data = { version: 1, sources: hashes, contact: CONTACT, chunks };
const output = resolve(root, 'data/ai-knowledge.json');
const serialized = `${JSON.stringify(data, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8') !== serialized) throw new Error('AI knowledge is stale. Run npm run knowledge:sync and commit data/ai-knowledge.json.');
  console.log(`Knowledge is current (${chunks.length} public content chunks).`);
} else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, serialized);
  console.log(`Generated ${chunks.length} public content chunks in data/ai-knowledge.json.`);
}
