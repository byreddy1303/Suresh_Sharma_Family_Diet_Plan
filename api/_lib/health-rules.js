const MEMBERS = [
  {
    memberId: 'suresh',
    displayName: 'Suresh',
    role: 'Father',
    baseline: {
      age: 54,
      weightKg: 105,
      focus: ['hypertension', 'sciatica', 'knee replacement recovery', 'weight loss']
    }
  },
  {
    memberId: 'veni',
    displayName: 'Veni',
    role: 'Mother',
    baseline: {
      age: 48,
      weightKg: 72,
      focus: ['type 2 diabetes', 'spondylitis', 'glaucoma']
    }
  },
  {
    memberId: 'susheel',
    displayName: 'Susheel',
    role: 'Younger son',
    baseline: {
      age: 14,
      weightKg: 115,
      focus: ['grade 2 NAFLD', 'gradual weight loss', 'premature graying']
    }
  },
  {
    memberId: 'karthik',
    displayName: 'Karthikeya',
    role: 'Elder son',
    baseline: {
      age: 24,
      weightKg: 70,
      focus: ['ACL PCL MCL post-op recovery', 'collagen support', 'activity recovery']
    }
  }
];

const MEMBER_MAP = new Map(MEMBERS.map(member => [member.memberId, member]));

function getDefaultMembers() {
  return MEMBERS.map(member => ({ ...member, baseline: { ...member.baseline } }));
}

function assertMemberId(memberId) {
  const id = String(memberId || '').trim().toLowerCase();
  if (!MEMBER_MAP.has(id)) {
    const err = new Error('Unknown family member for health update.');
    err.statusCode = 400;
    throw err;
  }
  return id;
}

function sanitizeHealthValues(memberId, rawValues) {
  const id = assertMemberId(memberId);
  const input = rawValues && typeof rawValues === 'object' ? rawValues : {};
  const values = {};

  const numericKeys = {
    suresh: ['systolic', 'diastolic', 'weightKg', 'kneePain', 'sciaticaPain'],
    veni: ['fastingGlucose', 'postMealGlucose', 'hba1c', 'weightKg', 'spondylitisPain'],
    susheel: ['weightKg', 'alt', 'ast', 'energyLevel', 'snackCravings'],
    karthik: ['weightKg', 'painLevel', 'swellingLevel']
  }[id];

  numericKeys.forEach(key => {
    const value = toNumber(input[key]);
    if (value !== null) values[key] = value;
  });

  const textKeys = {
    suresh: ['activity', 'doctorWarnings'],
    veni: ['glaucomaWarnings', 'doctorWarnings'],
    susheel: ['fattyLiverGrade', 'doctorWarnings'],
    karthik: ['recoveryStage', 'physioStatus', 'doctorWarnings']
  }[id];

  textKeys.forEach(key => {
    const value = cleanText(input[key], 500);
    if (value) values[key] = value;
  });

  return values;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 10) / 10;
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeHealthEntry(memberId, body) {
  const id = assertMemberId(memberId || body && body.memberId);
  const values = sanitizeHealthValues(id, body && body.values || {});
  const measuredAt = body && body.measuredAt ? new Date(body.measuredAt) : new Date();
  if (Number.isNaN(measuredAt.getTime())) {
    const err = new Error('Measured date is invalid.');
    err.statusCode = 400;
    throw err;
  }
  if (Object.keys(values).length === 0) {
    const err = new Error('Enter at least one health value before saving.');
    err.statusCode = 400;
    throw err;
  }
  return {
    memberId: id,
    measuredAt: measuredAt.toISOString(),
    values,
    notes: cleanText(body && body.notes, 1200)
  };
}

function buildRecommendations(profile) {
  const members = Array.isArray(profile && profile.members) ? profile.members : [];
  const recommendations = [];
  members.forEach(member => {
    const latest = member.latest && member.latest.values || {};
    const notes = String(member.latest && member.latest.notes || '');
    const warnings = [
      latest.doctorWarnings,
      latest.glaucomaWarnings,
      notes
    ].filter(Boolean).join(' ');

    if (member.memberId === 'suresh') addSureshRecommendations(recommendations, latest, warnings);
    if (member.memberId === 'veni') addVeniRecommendations(recommendations, latest, warnings);
    if (member.memberId === 'susheel') addSusheelRecommendations(recommendations, latest, warnings);
    if (member.memberId === 'karthik') addKarthikRecommendations(recommendations, latest, warnings);
  });

  return recommendations.map((rec, index) => ({
    id: `rec-${index + 1}`,
    doctorReviewRequired: false,
    ...rec
  }));
}

function addSureshRecommendations(recs, v, warnings) {
  const severeBp = v.systolic >= 160 || v.diastolic >= 100;
  const highBp = v.systolic >= 140 || v.diastolic >= 90;
  if (severeBp || mentionsWarning(warnings)) {
    recs.push(recommendation('suresh', 'high', 's10', '#s10', 'doctor-review',
      'Use diet only as support when BP or warning symptoms are severe.',
      'Doctor review needed before relying on diet changes. Keep salt very low, avoid pickles/papad, and do not change medicines yourself.',
      'Very high BP or warning notes need medical supervision.',
      true));
  }
  if (highBp || severeBp) {
    recs.push(recommendation('suresh', 'high', 's3', '#s3 .pp', 'portion-adjustment',
      'Suresh portions follow the baseline BP plan.',
      'For the next week, keep Suresh to salt-lite cooking, no papad/pickle, more rasam/dal/veg before rice, and rice at or below 3/4 katori at lunch.',
      'BP values are above the safe target, so sodium and rice load should stay tighter.'));
  }
  if (v.weightKg >= 105) {
    recs.push(recommendation('suresh', 'medium', 's2', '#s2', 'portion-adjustment',
      'Suresh target is gradual weight loss with knee-safe meals.',
      'Keep dinner lighter: ragi or millet plus dal and watery gourd curry; avoid second rice serving at night.',
      'Weight is still near baseline, so the plan should preserve the calorie deficit without stressing the knees.'));
  }
  if (v.kneePain >= 7 || v.sciaticaPain >= 7) {
    recs.push(recommendation('suresh', 'medium', 's5', '#s5', 'avoidance',
      'Fried and nightshade-heavy foods are already limited.',
      'Avoid deep-fried snacks fully this week and keep brinjal/tomato-heavy curries away from Suresh portions.',
      'High pain readings call for the more anti-inflammatory version of the plan.'));
  }
}

function addVeniRecommendations(recs, v, warnings) {
  const severeSugar = v.fastingGlucose >= 180 || v.postMealGlucose >= 250 || v.hba1c >= 8.5;
  const highSugar = v.fastingGlucose >= 130 || v.postMealGlucose >= 180 || v.hba1c >= 7;
  if (severeSugar || mentionsWarning(warnings)) {
    recs.push(recommendation('veni', 'high', 's10', '#s10', 'doctor-review',
      'Diet supports glucose control but does not replace diabetes care.',
      'Doctor review needed. Keep fiber-first meals, avoid sweets/juice/refined flour, and do not change diabetes medicine without the doctor.',
      'Very high glucose/HbA1c or eye warning notes need clinical review.',
      true));
  }
  if (highSugar || severeSugar) {
    recs.push(recommendation('veni', 'high', 's3', '#s3 .pp.v', 'portion-adjustment',
      'Veni gets smaller rice portions and fiber-first order.',
      'For Veni, make lunch 1/2 katori rice or millet, double dal/veg first, bitter gourd or methi side before rice, and no sweet snack.',
      'Current glucose values are above target, so the diabetic plate version should become stricter.'));
  }
  if (v.spondylitisPain >= 7) {
    recs.push(recommendation('veni', 'medium', 's8', '#s8', 'ingredient-emphasis',
      'Anti-inflammatory cooking is part of Veni-safe seasoning.',
      'Use turmeric, pepper, sesame podi, ragi, and warm room-temperature curd; avoid cold curd at night.',
      'High pain reading favors warm, calcium-rich, anti-inflammatory meals.'));
  }
}

function addSusheelRecommendations(recs, v, warnings) {
  const highLiverMarkers = v.alt >= 80 || v.ast >= 80 || /grade\s*2|grade\s*3/i.test(String(v.fattyLiverGrade || ''));
  const severeLiverMarkers = v.alt >= 150 || v.ast >= 150 || /grade\s*3/i.test(String(v.fattyLiverGrade || ''));
  if (severeLiverMarkers || mentionsWarning(warnings)) {
    recs.push(recommendation('susheel', 'high', 's10', '#s10', 'doctor-review',
      'The food plan supports fatty liver recovery.',
      'Doctor review needed for liver markers or warning notes. Keep zero sugary drinks, no fried snacks, and no extreme dieting.',
      'Severe liver markers or warning notes need medical supervision.',
      true));
  }
  if (highLiverMarkers || v.weightKg >= 115) {
    recs.push(recommendation('susheel', 'high', 's3', '#s3 .pp.su', 'portion-adjustment',
      'Susheel gets enough protein for growth while reducing liver load.',
      'Keep rice to planned portions, add extra moong/dal, use peanuts or sprouts for snack, and avoid jaggery/fructose outside the planned festival slot.',
      'Liver/weight values call for stricter NAFLD-safe portions without restricting growth protein.'));
  }
  if (v.snackCravings >= 7 || v.energyLevel <= 4) {
    recs.push(recommendation('susheel', 'medium', 's7', '#s7', 'snack-adjustment',
      'The plan already replaces packaged snacks with home tiffins.',
      'Prep roasted chana, sprouted moong, peanuts, and majjiga so Susheel has a ready snack before cravings hit.',
      'High cravings or low energy usually needs planned snacks, not willpower.'));
  }
}

function addKarthikRecommendations(recs, v, warnings) {
  if (v.swellingLevel >= 7 || mentionsWarning(warnings)) {
    recs.push(recommendation('karthik', 'high', 's10', '#s10', 'doctor-review',
      'The plan supports post-op recovery but cannot assess swelling risk.',
      'Doctor or physio review needed for high swelling or warning notes. Keep protein steady and avoid fried foods/alcohol.',
      'High swelling after ligament surgery should be reviewed clinically.',
      true));
  }
  if (v.painLevel >= 6 || v.swellingLevel >= 5) {
    recs.push(recommendation('karthik', 'medium', 's3', '#s3 .pp.k', 'recovery-adjustment',
      'Karthik gets recovery portions with milk/paneer/curd support.',
      'Keep protein steady, add amla or lemon for vitamin C, use turmeric-pepper, and avoid deep-fried snacks for the next week.',
      'Pain or swelling means recovery-support foods should be prioritized.'));
  }
  if (/miss|skip|irregular|no/i.test(String(v.physioStatus || ''))) {
    recs.push(recommendation('karthik', 'medium', 's11', '#s11', 'routine-adjustment',
      'Recovery depends on food plus routine.',
      'Keep meals protein-rich and restart physio routine as advised; use the plan as support, not a replacement for rehab.',
      'Missed physio reduces recovery progress even if food is correct.'));
  }
}

function recommendation(personId, priority, targetSectionId, targetSelector, changeType, currentText, suggestedText, reason, doctorReviewRequired) {
  return {
    personId,
    priority,
    targetSectionId,
    targetSelector,
    changeType,
    currentText,
    suggestedText,
    reason,
    doctorReviewRequired: Boolean(doctorReviewRequired)
  };
}

function mentionsWarning(value) {
  return /\b(warning|doctor|emergency|severe|chest|faint|vision|vomit|swelling|bleeding|dizzy|breath|painful|urgent)\b/i.test(String(value || ''));
}

function summarizeHealthContext(profile, activePreview) {
  if (!profile) return '';
  const memberLines = (profile.members || []).map(member => {
    const latest = member.latest || {};
    const values = latest.values || {};
    const valueText = Object.entries(values)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    return valueText ? `${member.displayName}: ${valueText}` : '';
  }).filter(Boolean);

  const recLines = activePreview && Array.isArray(activePreview.recommendations)
    ? activePreview.recommendations.slice(0, 8).map(rec => {
      const review = rec.doctorReviewRequired ? ' Doctor review required.' : '';
      return `${rec.personId}: ${rec.suggestedText} Reason: ${rec.reason}.${review}`;
    })
    : [];

  return [
    memberLines.length ? `Latest health values:\n${memberLines.join('\n')}` : '',
    recLines.length ? `Applied adaptive diet changes:\n${recLines.join('\n')}` : ''
  ].filter(Boolean).join('\n\n').slice(0, 3200);
}

module.exports = {
  assertMemberId,
  buildRecommendations,
  getDefaultMembers,
  normalizeHealthEntry,
  sanitizeHealthValues,
  summarizeHealthContext
};
