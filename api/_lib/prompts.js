function buildSystemPrompt(language, options) {
  const hasHealthContext = Boolean(options && options.hasHealthContext);
  const lines = [
    "You are a friendly diet-plan assistant for Suresh Sharma's family.",
    '',
    'You answer doubts about meals, ingredient substitutions, taste improvements, missed meals, cravings, travel food, timing, cooking methods, and practical family adjustments.',
    '',
    'Use the Suresh Sharma Family Nutrition System as the primary reference. You may use general safe cooking and nutrition knowledge for practical questions not directly answered in the plan.',
    '',
    'Prefer Andhra Brahmin vegetarian home-food suggestions. No garlic. Onion is allowed. Keep suggestions practical for Kurnool/Andhra kitchens.',
    '',
    'If a user ate something different today, do not scold them. Help them balance the next meal.',
    '',
    'For diabetes, high BP, glaucoma, liver disease, surgery recovery, severe symptoms, medication questions, or emergency concerns, give cautious food guidance and advise speaking with the treating doctor. Do not diagnose, prescribe, or change medication.',
    ''
  ];
  if (hasHealthContext) {
    lines.push(
      'The family has shared recent health readings and applied adaptive diet changes below. Use them as light context to tune food suggestions. Never diagnose from numbers, never change medication, and if any reading looks severe or a doctor-review flag is noted, gently remind the family to check with their doctor.',
      ''
    );
  }
  lines.push(
    'Answer style: warm, simple, direct, practical. Use bullets only when useful. Keep most answers under 180 words unless the user asks for detail.',
    languageInstruction(language)
  );
  return lines.join('\n');
}

function languageInstruction(language) {
  switch (language) {
    case 'english':
      return 'Answer in English.';
    case 'telugu':
      return 'Answer in simple Telugu. Use familiar household food words.';
    case 'hinglish':
      return 'Answer in simple Hindi plus English, using familiar Indian household food words.';
    default:
      return "If the user's language is clear, match it. Otherwise answer in simple English.";
  }
}

function buildUserPrompt(payload, contextChunks, healthContext) {
  const context = contextChunks.map((chunk, index) => {
    return `Source ${index + 1} [${chunk.sectionId} · ${chunk.heading}]\n${chunk.text}`;
  }).join('\n\n---\n\n');

  const selectedText = payload.selectedText ? `\nSelected page text:\n${payload.selectedText}` : '';
  const currentSection = payload.currentSection && payload.currentSection.heading
    ? `\nCurrent section: ${payload.currentSection.id || 'unknown'} · ${payload.currentSection.heading}`
    : '';
  const history = formatConversation(payload.conversation);
  const healthBlock = healthContext ? `\nFamily health context:\n${healthContext}` : '';

  return [
    'Diet plan context:',
    context || 'No context chunks were retrieved. Use conservative general guidance and ask the family to check the plan.',
    healthBlock,
    history,
    selectedText,
    currentSection,
    '',
    `Question: ${payload.question}`,
    '',
    'Give a practical answer. If giving a substitution, explain what to use, how to cook it, and what to adjust in the next meal if needed.'
  ].join('\n');
}

function formatConversation(conversation) {
  if (!Array.isArray(conversation) || conversation.length === 0) return '';
  const turns = conversation
    .slice(-8)
    .map(turn => {
      const role = turn && turn.role === 'assistant' ? 'Assistant' : 'User';
      const content = String(turn && turn.content || '').replace(/\s+/g, ' ').trim().slice(0, 700);
      return content ? `${role}: ${content}` : '';
    })
    .filter(Boolean)
    .join('\n');
  return turns ? `\nRecent conversation:\n${turns}` : '';
}

function buildFollowUps(question) {
  const q = String(question || '').toLowerCase();
  if (/\b(instead|ate|today|swap|missed)\b/.test(q)) {
    return [
      'What should I eat for the next meal to balance today?',
      'How much rice or millet should I take tonight?',
      'Is this okay for Amma or Nannagaru?'
    ];
  }
  if (/\b(ingredient|substitute|replace|have|available)\b/.test(q)) {
    return [
      'What can I cook with the vegetables I have?',
      'How do I keep it tasty with less oil?',
      'Is this substitution okay for sugar and BP?'
    ];
  }
  if (/\b(tasty|taste|bitter|boring)\b/.test(q)) {
    return [
      'How can I make this tasty without frying?',
      'What chutney or podi is safest with this meal?',
      'Can I add onion or curd to improve taste?'
    ];
  }
  return [
    'What should I adjust in the next meal?',
    'Is this okay for sugar and BP?',
    'What is the closest Andhra home-food alternative?'
  ];
}

module.exports = {
  buildFollowUps,
  buildSystemPrompt,
  buildUserPrompt
};
