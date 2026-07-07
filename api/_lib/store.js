const { neon } = require('@neondatabase/serverless');
const { getDefaultMembers } = require('./health-rules');

const RECENT_ENTRY_LIMIT = 10;
const ACTIVE_PREVIEW_KEY = 'default';

let cachedSql = null;
let schemaReady = false;

function getSql() {
  if (cachedSql) return cachedSql;
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) {
    const err = new Error('Health profile storage is not configured. Set DATABASE_URL on the backend.');
    err.statusCode = 500;
    throw err;
  }
  cachedSql = neon(url);
  return cachedSql;
}

async function ensureSchema() {
  if (schemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS family_members (
      member_id text PRIMARY KEY,
      display_name text NOT NULL,
      role text NOT NULL,
      baseline_json jsonb NOT NULL,
      latest_json jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS health_entries (
      id bigserial PRIMARY KEY,
      member_id text NOT NULL REFERENCES family_members(member_id) ON DELETE CASCADE,
      measured_at timestamptz NOT NULL,
      values_json jsonb NOT NULL,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS health_entries_member_measured_idx
      ON health_entries (member_id, measured_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS active_preview (
      key text PRIMARY KEY,
      recommendations_json jsonb NOT NULL,
      profile_snapshot_json jsonb NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await seedDefaultMembers(sql);
  schemaReady = true;
}

async function seedDefaultMembers(sql) {
  const members = getDefaultMembers();
  for (const member of members) {
    await sql`
      INSERT INTO family_members (member_id, display_name, role, baseline_json)
      VALUES (${member.memberId}, ${member.displayName}, ${member.role}, ${JSON.stringify(member.baseline)})
      ON CONFLICT (member_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        baseline_json = EXCLUDED.baseline_json
    `;
  }
}

async function readProfile() {
  await ensureSchema();
  const sql = getSql();
  const members = await sql`
    SELECT member_id, display_name, role, baseline_json, latest_json, updated_at
    FROM family_members
    ORDER BY member_id
  `;
  const entries = await sql`
    SELECT id, member_id, measured_at, values_json, notes, created_at
    FROM health_entries
    ORDER BY measured_at DESC
    LIMIT ${RECENT_ENTRY_LIMIT * 4}
  `;
  const recentByMember = new Map();
  entries.forEach(row => {
    const list = recentByMember.get(row.member_id) || [];
    if (list.length < RECENT_ENTRY_LIMIT) {
      list.push({
        id: String(row.id),
        measuredAt: row.measured_at instanceof Date ? row.measured_at.toISOString() : row.measured_at,
        values: row.values_json || {},
        notes: row.notes || '',
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
      });
    }
    recentByMember.set(row.member_id, list);
  });
  return {
    members: members.map(row => ({
      memberId: row.member_id,
      displayName: row.display_name,
      role: row.role,
      baseline: row.baseline_json || {},
      latest: row.latest_json || null,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      recent: recentByMember.get(row.member_id) || []
    }))
  };
}

async function appendEntry(entry) {
  await ensureSchema();
  const sql = getSql();
  const inserted = await sql`
    INSERT INTO health_entries (member_id, measured_at, values_json, notes)
    VALUES (${entry.memberId}, ${entry.measuredAt}, ${JSON.stringify(entry.values)}, ${entry.notes || ''})
    RETURNING id, created_at
  `;
  const latestJson = {
    measuredAt: entry.measuredAt,
    values: entry.values,
    notes: entry.notes || ''
  };
  await sql`
    UPDATE family_members
    SET latest_json = ${JSON.stringify(latestJson)},
        updated_at = now()
    WHERE member_id = ${entry.memberId}
  `;
  const row = inserted[0] || {};
  return {
    id: row.id != null ? String(row.id) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  };
}

async function setActivePreview(preview) {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO active_preview (key, recommendations_json, profile_snapshot_json, applied_at)
    VALUES (${ACTIVE_PREVIEW_KEY}, ${JSON.stringify(preview.recommendations || [])}, ${JSON.stringify(preview.profileSnapshot || {})}, now())
    ON CONFLICT (key) DO UPDATE SET
      recommendations_json = EXCLUDED.recommendations_json,
      profile_snapshot_json = EXCLUDED.profile_snapshot_json,
      applied_at = EXCLUDED.applied_at
  `;
}

async function getActivePreview() {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT recommendations_json, profile_snapshot_json, applied_at
    FROM active_preview
    WHERE key = ${ACTIVE_PREVIEW_KEY}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0];
  return {
    recommendations: row.recommendations_json || [],
    profileSnapshot: row.profile_snapshot_json || {},
    appliedAt: row.applied_at instanceof Date ? row.applied_at.toISOString() : row.applied_at
  };
}

async function clearActivePreview() {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM active_preview WHERE key = ${ACTIVE_PREVIEW_KEY}`;
}

function isDatabaseConfigured() {
  return Boolean(String(process.env.DATABASE_URL || '').trim());
}

module.exports = {
  appendEntry,
  clearActivePreview,
  ensureSchema,
  getActivePreview,
  isDatabaseConfigured,
  readProfile,
  setActivePreview
};
