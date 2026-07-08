const {
  assertGroqKey,
  getGroqConfig,
  handleOptions,
  readJsonBody,
  requireMethod,
  sendError,
  sendJson
} = require('./_lib/config');
const { groqJson } = require('./_lib/groq');

const MAX_MEALS = 80;
const MAX_DISH_CHARS = 400;
const MAX_NOTE_CHARS = 500;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const payload = await readJsonBody(req, 96 * 1024);
    const meals = sanitizeMeals(payload.meals);
    if (meals.length === 0) {
      sendError(req, res, 400, 'Please include at least one meal to generate a shopping list.');
      return;
    }

    const scope = payload.scope === 'week' ? 'week' : 'day';
    const family = normalizeFamily(payload.family);
    const dayLabel = String(payload.dayLabel || '').slice(0, 120).trim();

    const apiKey = assertGroqKey();
    const { chatModel } = getGroqConfig();
    const groqPayload = {
      model: chatModel,
      messages: [
        { role: 'system', content: buildGrocerySystemPrompt() },
        { role: 'user', content: buildGroceryUserPrompt({ scope, dayLabel, family, meals }) }
      ],
      temperature: 0.2,
      max_completion_tokens: 1800,
      response_format: { type: 'json_object' }
    };

    const data = await groqJson('/chat/completions', apiKey, groqPayload);
    const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!raw) {
      throw Object.assign(new Error('Groq returned no shopping list.'), { statusCode: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw Object.assign(new Error('Shopping list JSON was malformed.'), { statusCode: 502 });
    }

    const categories = normalizeCategories(parsed.categories);
    if (categories.length === 0) {
      throw Object.assign(new Error('Shopping list came back empty. Try again.'), { statusCode: 502 });
    }

    const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
    sendJson(req, res, 200, {
      scope,
      dayLabel: dayLabel || null,
      family,
      categories,
      totalItems,
      generatedAt: new Date().toISOString(),
      model: data.model || chatModel,
      usage: data.usage || null
    });
  } catch (error) {
    sendError(req, res, error.statusCode || 500, error.message || 'Could not build the shopping list.');
  }
};

function sanitizeMeals(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const dish = String(item.dish || '').slice(0, MAX_DISH_CHARS).trim();
    if (!dish) continue;
    out.push({
      day: String(item.day || '').slice(0, 60).trim(),
      time: String(item.time || '').slice(0, 120).trim(),
      dish,
      note: String(item.note || '').slice(0, MAX_NOTE_CHARS).trim()
    });
    if (out.length >= MAX_MEALS) break;
  }
  return out;
}

function normalizeFamily(input) {
  const src = input && typeof input === 'object' ? input : {};
  const members = clampInt(src.members, 1, 12, 4);
  const adults = clampInt(src.adults, 0, members, 2);
  const kids = clampInt(src.kids, 0, members, Math.max(0, members - adults));
  return { members, adults, kids };
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function normalizeCategories(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const cat of input) {
    if (!cat || typeof cat !== 'object') continue;
    const name = String(cat.name || '').slice(0, 60).trim();
    if (!name) continue;
    const items = normalizeItems(cat.items);
    if (items.length === 0) continue;
    out.push({ name, items });
  }
  return out;
}

function normalizeItems(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const name = String(item.name || '').slice(0, 120).trim();
    if (!name) continue;
    out.push({
      name,
      quantity: String(item.quantity || '').slice(0, 60).trim(),
      notes: String(item.notes || '').slice(0, 200).trim(),
      days: Array.isArray(item.days)
        ? item.days.map(d => String(d).slice(0, 40).trim()).filter(Boolean).slice(0, 8)
        : []
    });
  }
  return out;
}

function buildGrocerySystemPrompt() {
  return [
    "You build shopping lists for Suresh Sharma's Andhra Brahmin vegetarian household in Kurnool.",
    '',
    'From the meal descriptions the user sends, extract every ingredient needed, then consolidate identical ingredients across meals into single lines with total quantity.',
    '',
    'Rules:',
    '- No garlic (household never uses it). Onion is allowed.',
    '- Use Andhra household names first, with Telugu term in parentheses when helpful (e.g., "Drumstick (munakkaya)", "Bottle gourd (sorakaya)", "Toor dal (kandi pappu)").',
    '- Skip pantry staples that are always present unless explicitly needed in unusual quantities: salt, drinking water, cooking gas.',
    '- Include: fresh vegetables, greens, fruits, dals & grains, dairy (milk, curd, ghee), spices & tempering (mustard, jeera, methi, hing, curry leaves, red chili, turmeric, coriander powder, sambar/rasam powder), oils, nuts & seeds, condiments, ready mixes, and beverages that appear in dishes.',
    '- Estimate quantities for the specified family size across the scope (day or full week). Give practical Indian shopping units: grams/kg, ml/litres, pieces, bunches, packets. Assume ~50-60g rice per adult meal, ~30-40g dal per person per day, ~150-200g vegetables per person per meal — adjust reasonably.',
    '- If a dish name is unfamiliar, infer standard Andhra recipe ingredients from the note field when present.',
    '- Group items into these categories in this exact order and casing:',
    '  1. "Fresh vegetables & greens"',
    '  2. "Fruits, nuts & seeds"',
    '  3. "Grains, pulses & flours"',
    '  4. "Dairy"',
    '  5. "Spices, oils & condiments"',
    '  6. "Others"',
    '- Omit any category that ends up empty.',
    '- For each item, list the day names (short: Mon, Tue, ...) it appears in under `days`.',
    '- Notes should be brief practical hints ("For sambar Mon/Wed", "Ferment overnight"). Keep them under 15 words.',
    '',
    'Return ONLY a JSON object with this exact shape:',
    '{"categories":[{"name":"<category>","items":[{"name":"<ingredient>","quantity":"<amount + unit>","notes":"<short hint or empty>","days":["Mon","Wed"]}]}]}',
    'No preface, no commentary, no markdown fences — pure JSON.'
  ].join('\n');
}

function buildGroceryUserPrompt(input) {
  const { scope, dayLabel, family, meals } = input;
  const scopeLine = scope === 'week'
    ? 'Scope: FULL WEEK (7 days). Total quantities should cover the entire week for the family.'
    : `Scope: SINGLE DAY${dayLabel ? ' — ' + dayLabel : ''}. Quantities should cover this one day only.`;
  const familyLine = `Family size: ${family.members} people (${family.adults} adults, ${family.kids} kids).`;
  const mealLines = meals.map((m, i) => {
    const parts = [`${i + 1}. [${m.day || 'Day'} · ${m.time || 'meal'}]`, `Dish: ${m.dish}`];
    if (m.note) parts.push(`Note: ${m.note}`);
    return parts.join('\n');
  }).join('\n\n');
  return [
    scopeLine,
    familyLine,
    '',
    'Meals to source ingredients from:',
    mealLines,
    '',
    'Build the consolidated shopping list now. Return JSON only.'
  ].join('\n');
}
