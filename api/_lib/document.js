const fs = require('fs');
const path = require('path');

const MAX_CHUNK_CHARS = 1500;
const MAX_CONTEXT_CHUNKS = 5;
const MAX_CONTEXT_CHARS = 5200;
const MAX_CONTEXT_CHARS_PER_CHUNK = 1100;
const CHUNK_OVERLAP_PARAGRAPHS = 1;

let cachedDocument = null;

const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'but', 'can',
  'could', 'day', 'did', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'into',
  'just', 'like', 'make', 'more', 'now', 'our', 'out', 'please', 'should', 'that',
  'the', 'their', 'then', 'there', 'this', 'today', 'was', 'what', 'when', 'with',
  'without', 'would', 'you', 'your'
]);

function getDietDocument() {
  if (cachedDocument) return cachedDocument;
  const htmlPath = path.join(process.cwd(), 'family-diet-plan.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const sections = extractSections(html);
  const fullText = sections.map(section => `${section.heading}\n${section.text}`).join('\n\n');
  const chunks = sections.flatMap(section => chunkSection(section));
  cachedDocument = { fullText, sections, chunks, loadedAt: new Date().toISOString() };
  return cachedDocument;
}

function extractSections(html) {
  const sectionRe = /<section\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/gi;
  const sections = [];
  let match;
  while ((match = sectionRe.exec(html))) {
    const id = match[1];
    const block = match[2];
    const headingMatch = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const heading = normalizeText(stripHtml(headingMatch ? headingMatch[1] : id));
    const text = normalizeText(stripHtml(block));
    if (text) sections.push({ id, heading, text });
  }
  return sections;
}

function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|summary|details|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, '·')
    .replace(/&times;/g, '×');
}

function normalizeText(value) {
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkSection(section) {
  const paragraphs = section.text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean);
  const chunks = [];
  let current = [];
  let currentLen = 0;

  paragraphs.forEach(paragraph => {
    const nextLen = currentLen + paragraph.length + 2;
    if (current.length && nextLen > MAX_CHUNK_CHARS) {
      chunks.push(makeChunk(section, chunks.length, current));
      current = current.slice(-CHUNK_OVERLAP_PARAGRAPHS);
      currentLen = current.join('\n').length;
    }
    current.push(paragraph);
    currentLen += paragraph.length + 2;
  });

  if (current.length) {
    chunks.push(makeChunk(section, chunks.length, current));
  }
  return chunks;
}

function makeChunk(section, index, paragraphs) {
  const text = compactForContext(normalizeText(paragraphs.join('\n')));
  return {
    id: `${section.id}:${index + 1}`,
    sectionId: section.id,
    heading: section.heading,
    text,
    tokens: tokenize(`${section.heading} ${text}`)
  };
}

function compactForContext(value) {
  return normalizeText(String(value)
    .replace(/[\u0C00-\u0C7F]+/g, ' ')
    .replace(/\bclick to open\b/gi, ' ')
    .replace(/\s+\/\s+$/gm, ' ')
    .replace(/[ \t]{2,}/g, ' '));
}

function tokenize(value) {
  const matches = String(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return matches.filter(token => token.length > 2 && !STOPWORDS.has(token));
}

function retrieveContext(payload) {
  const doc = getDietDocument();
  const query = [
    payload.question || '',
    payload.selectedText || '',
    payload.currentSection && payload.currentSection.heading || '',
    Array.isArray(payload.conversation) ? payload.conversation.map(turn => turn && turn.content || '').join(' ') : ''
  ].join(' ');
  const queryTokens = tokenize(query);
  const querySet = new Set(queryTokens);
  const boosts = inferSectionBoosts(query);

  const scored = doc.chunks.map(chunk => {
    let score = 0;
    chunk.tokens.forEach(token => {
      if (querySet.has(token)) score += 2;
      queryTokens.forEach(q => {
        if (q.length > 4 && token.includes(q)) score += 0.35;
      });
    });
    if (payload.currentSection && payload.currentSection.id === chunk.sectionId) score += 5;
    if (boosts.has(chunk.sectionId)) score += boosts.get(chunk.sectionId);
    if (chunk.heading.toLowerCase().includes(String(payload.question || '').toLowerCase())) score += 2;
    return { chunk, score };
  });

  const selected = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .filter(item => item.score > 0)
    .map(item => item.chunk);

  if (looksMedical(query)) addRequiredChunk(selected, doc, 's10');

  const unique = [];
  const seen = new Set();
  const sectionCounts = new Map();
  selected.forEach(chunk => {
    const count = sectionCounts.get(chunk.sectionId) || 0;
    if (!seen.has(chunk.id) && count < 2) {
      unique.push(chunk);
      seen.add(chunk.id);
      sectionCounts.set(chunk.sectionId, count + 1);
    }
  });

  return trimContext(unique);
}

function trimContext(chunks) {
  const result = [];
  let total = 0;
  for (const chunk of chunks) {
    if (result.length >= MAX_CONTEXT_CHUNKS) break;
    const remaining = MAX_CONTEXT_CHARS - total;
    if (remaining <= 0) break;
    const limit = Math.min(MAX_CONTEXT_CHARS_PER_CHUNK, remaining);
    const text = truncateAtBoundary(chunk.text, limit);
    if (!text) continue;
    result.push({ ...chunk, text });
    total += text.length;
  }
  return result;
}

function truncateAtBoundary(text, limit) {
  const value = String(text || '').trim();
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const lastBreak = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  if (lastBreak > limit * 0.55) return cut.slice(0, lastBreak + 1).trim();
  return cut.trim() + '...';
}

function inferSectionBoosts(query) {
  const q = String(query).toLowerCase();
  const boosts = new Map();
  const add = (id, amount) => boosts.set(id, (boosts.get(id) || 0) + amount);

  if (/\b(today|instead|ate|breakfast|lunch|dinner|snack|meal|adjust|swap)\b/.test(q)) add('s3', 6);
  if (/\b(ingredient|substitute|replace|available|have|taste|tasty|cook|recipe|bitter|gourd|dal|curry)\b/.test(q)) {
    add('s6', 5);
    add('s12', 4);
    add('s7', 2);
  }
  if (/\b(avoid|fried|sugar|salt|pickle|papad|oil|ghee)\b/.test(q)) {
    add('s5', 3);
    add('s8', 3);
  }
  if (/\b(amma|veni|diabetes|sugar|glucose)\b/.test(q)) add('s2', 5);
  if (/\b(nanna|suresh|bp|pressure|hypertension|knee|sciatica)\b/.test(q)) add('s2', 5);
  if (/\b(susheel|liver|nafld|teen|child)\b/.test(q)) add('s2', 5);
  if (/\b(karthik|acl|pcl|mcl|recovery|surgery)\b/.test(q)) add('s2', 5);
  if (looksMedical(q)) add('s10', 7);
  return boosts;
}

function looksMedical(query) {
  return /\b(chest|faint|dizzy|vomit|vomiting|fever|pain|sugar|glucose|bp|pressure|medicine|medication|tablet|insulin|doctor|emergency|swelling|bleeding|vision|eye|kidney|heart)\b/i.test(query);
}

function addRequiredChunk(selected, doc, sectionId) {
  if (selected.some(chunk => chunk.sectionId === sectionId)) return;
  const chunk = doc.chunks.find(item => item.sectionId === sectionId);
  if (chunk) selected.push(chunk);
}

module.exports = {
  getDietDocument,
  retrieveContext,
  tokenize
};
