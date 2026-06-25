import axios from 'axios';
import jsforce from 'jsforce';
import dotenv from 'dotenv';

dotenv.config();

const API_VERSION = '61.0';
const LOGIN_URL = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';

export function buildLoginUrl() {
  const params = new URLSearchParams({
    client_id: process.env.SF_CLIENT_ID,
    redirect_uri: process.env.SF_CALLBACK_URL,
    response_type: 'code',
    scope: 'api refresh_token openid profile email'
  });
  return `${LOGIN_URL}/services/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
    redirect_uri: process.env.SF_CALLBACK_URL
  });
  const response = await axios.post(
    `${LOGIN_URL}/services/oauth2/token`,
    body.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
  );
  return response.data;
}

export async function getUserInfo(accessToken, instanceUrl) {
  const response = await axios.get(`${instanceUrl}/services/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  });
  return response.data;
}

export async function fetchValidationRules(accessToken, instanceUrl) {
  const query = `
    SELECT Id, ValidationName, Description, Active, ErrorMessage,
    EntityDefinition.DeveloperName FROM ValidationRule
    WHERE EntityDefinition.DeveloperName = 'Account'
  `;
  const url = `${instanceUrl}/services/data/v${API_VERSION}/tooling/query/?q=${encodeURIComponent(query)}`;
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  });
  return response.data.records || [];
}

// Helpers 

function getConn(accessToken, instanceUrl) {
  return new jsforce.Connection({ instanceUrl, accessToken, version: API_VERSION });
}

async function retry(fn, attempts = 3, delayMs = 1200) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}


async function readFullObjectMeta(conn, objectApiName) {
  const meta = await conn.metadata.read('CustomObject', objectApiName);

  // Normalise: jsforce returns a single object or array depending on count
  if (!meta || (Array.isArray(meta) && meta.length === 0)) {
    throw new Error(`Could not read metadata for object: ${objectApiName}`);
  }
  return Array.isArray(meta) ? meta[0] : meta;
}


function buildSafePayload(fullMeta, newRules) {
  // Fields that Salesforce rejects if sent back during update
  const STRIP_FIELDS = [
    'actionOverrides', 'listViews', 'searchLayouts',
    'sharingReasons', 'sharingRecalculations',
    'webLinks',                        // read-only in metadata API
    'compactLayouts', 'recordTypes',   // safest to exclude unless editing them
  ];

  const payload = { fullName: fullMeta.fullName };

  for (const [key, value] of Object.entries(fullMeta)) {
    if (key === 'fullName') continue;           // already set
    if (key === 'validationRules') continue;    // we supply our own
    if (STRIP_FIELDS.includes(key)) continue;   // Salesforce rejects these
    if (value === null || value === undefined) continue;
    payload[key] = value;
  }

  // Only include validationRules when we actually have rules to write
  if (newRules && newRules.length > 0) {
    payload.validationRules = newRules;
  }

  return payload;
}

/** Normalise a single rule coming back from metadata.read() into a clean object */
function normaliseRule(r, objectApiName) {
  // jsforce may return fullName as "ObjectName.RuleName" or just "RuleName"
  const shortName = r.fullName.includes('.')
    ? r.fullName.split('.').slice(1).join('.')
    : r.fullName;

  const clean = {
    fullName: shortName,           // always store WITHOUT object prefix
    active: r.active === true || r.active === 'true',
    errorConditionFormula: r.errorConditionFormula || '',
    errorMessage: r.errorMessage || '',
  };
  if (r.description)       clean.description       = r.description;
  if (r.errorDisplayField) clean.errorDisplayField  = r.errorDisplayField;
  return clean;
}

// TOGGLE active / inactive ───────────────────────────────────────────
export async function toggleValidationRule(
  accessToken, instanceUrl, objectApiName, validationRuleName, active
) {
  const conn = getConn(accessToken, instanceUrl);

  return retry(async () => {
    const fullMeta = await readFullObjectMeta(conn, objectApiName);
    const rules = [].concat(fullMeta.validationRules || []).map((r) => normaliseRule(r, objectApiName));

    const ruleIndex = rules.findIndex((r) => r.fullName === validationRuleName);
    if (ruleIndex === -1)
      throw new Error(`Validation rule not found: ${objectApiName}.${validationRuleName}`);

    rules[ruleIndex] = { ...rules[ruleIndex], active };

    const payload = buildSafePayload(fullMeta, rules);
    const result = await conn.metadata.update('CustomObject', payload);
    console.log('Toggle result:', JSON.stringify(result, null, 2));
    return result;
  });
}

// CREATE a new rule 
export async function createValidationRule(
  accessToken, instanceUrl, objectApiName, rule
) {
  const conn = getConn(accessToken, instanceUrl);

  return retry(async () => {
    const fullMeta = await readFullObjectMeta(conn, objectApiName);
    const rules = [].concat(fullMeta.validationRules || []).map((r) => normaliseRule(r, objectApiName));

    if (rules.find((r) => r.fullName === rule.ValidationName))
      throw new Error(`A rule named "${rule.ValidationName}" already exists on ${objectApiName}.`);

    const newRule = {
      fullName: rule.ValidationName,   // short name — no object prefix
      active: rule.Active !== false,
      errorConditionFormula: rule.errorConditionFormula,
      errorMessage: rule.errorMessage,
    };
    if (rule.Description)       newRule.description       = rule.Description;
    if (rule.errorDisplayField) newRule.errorDisplayField  = rule.errorDisplayField;

    const payload = buildSafePayload(fullMeta, [...rules, newRule]);
    const result = await conn.metadata.update('CustomObject', payload);
    console.log('Create result:', JSON.stringify(result, null, 2));
    return result;
  });
}

// UPDATE (full edit) a rule 
export async function updateValidationRule(
  accessToken, instanceUrl, objectApiName, validationRuleName, rule
) {
  const conn = getConn(accessToken, instanceUrl);

  return retry(async () => {
    const fullMeta = await readFullObjectMeta(conn, objectApiName);
    const rules = [].concat(fullMeta.validationRules || []).map((r) => normaliseRule(r, objectApiName));

    const ruleIndex = rules.findIndex((r) => r.fullName === validationRuleName);
    if (ruleIndex === -1)
      throw new Error(`Validation rule not found: ${objectApiName}.${validationRuleName}`);

    const existing = rules[ruleIndex];
    const updated = {
      fullName: validationRuleName,
      active: rule.Active !== undefined ? rule.Active : existing.active,
      errorConditionFormula: rule.errorConditionFormula || existing.errorConditionFormula,
      errorMessage: rule.errorMessage || existing.errorMessage,
    };
    if (rule.Description !== undefined)       updated.description       = rule.Description;
    else if (existing.description)            updated.description       = existing.description;
    if (rule.errorDisplayField !== undefined) updated.errorDisplayField  = rule.errorDisplayField;
    else if (existing.errorDisplayField)      updated.errorDisplayField  = existing.errorDisplayField;

    rules[ruleIndex] = updated;

    const payload = buildSafePayload(fullMeta, rules);
    const result = await conn.metadata.update('CustomObject', payload);
    console.log('Update result:', JSON.stringify(result, null, 2));
    return result;
  });
}

// DELETE a rule 
export async function deleteValidationRule(
  accessToken, instanceUrl, objectApiName, validationRuleName
) {
  const conn = getConn(accessToken, instanceUrl);

  return retry(async () => {
    const fullMeta = await readFullObjectMeta(conn, objectApiName);
    const rules = [].concat(fullMeta.validationRules || []).map((r) => normaliseRule(r, objectApiName));

    const filtered = rules.filter((r) => r.fullName !== validationRuleName);
    if (filtered.length === rules.length)
      throw new Error(`Validation rule not found: ${objectApiName}.${validationRuleName}`);

    const payload = buildSafePayload(fullMeta, filtered);
    const result = await conn.metadata.update('CustomObject', payload);
    console.log('Delete result:', JSON.stringify(result, null, 2));
    return result;
  });
}