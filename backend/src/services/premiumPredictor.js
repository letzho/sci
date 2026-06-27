const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001').replace(/\/$/, '');
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS) || 8000;

const VALID_SEX = new Set(['male', 'female']);
const VALID_SMOKER = new Set(['yes', 'no']);
const VALID_REGIONS = new Set(['northeast', 'northwest', 'southeast', 'southwest']);

function validateInput(body) {
  const errors = [];
  const age = Number(body?.age);
  const bmi = Number(body?.bmi);
  const children = Number(body?.children);
  const sex = String(body?.sex || '').toLowerCase();
  const smoker = String(body?.smoker || '').toLowerCase();
  const region = String(body?.region || '').toLowerCase();

  if (!Number.isFinite(age) || age < 18 || age > 100) errors.push('age must be between 18 and 100');
  if (!VALID_SEX.has(sex)) errors.push('sex must be male or female');
  if (!Number.isFinite(bmi) || bmi < 10 || bmi > 60) errors.push('bmi must be between 10 and 60');
  if (!Number.isInteger(children) || children < 0 || children > 10) errors.push('children must be 0–10');
  if (!VALID_SMOKER.has(smoker)) errors.push('smoker must be yes or no');
  if (!VALID_REGIONS.has(region)) errors.push('region must be northeast, northwest, southeast, or southwest');

  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }

  return { age, sex, bmi, children, smoker, region };
}

async function mlFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  try {
    const res = await fetch(`${ML_SERVICE_URL}${path}`, { ...options, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

async function checkMlHealth() {
  try {
    const { res, data } = await mlFetch('/health', { method: 'GET' });
    return { available: res.ok && data.ok === true, ...data };
  } catch (err) {
    return {
      available: false,
      ok: false,
      error: err.name === 'AbortError' ? 'ML service timeout' : err.message,
    };
  }
}

async function predictPremium(body) {
  const features = validateInput(body);
  let res;
  let data;
  try {
    ({ res, data } = await mlFetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
    }));
  } catch (err) {
    const error = new Error(
      err.name === 'AbortError'
        ? 'Premium prediction timed out — is the ML service running?'
        : `Cannot reach ML service at ${ML_SERVICE_URL}: ${err.message}`
    );
    error.status = 503;
    throw error;
  }

  if (!res.ok || !data.success) {
    const error = new Error(data.error || 'Premium prediction failed');
    error.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw error;
  }

  return { premium: data.premium, inputs: features };
}

module.exports = { predictPremium, checkMlHealth, validateInput };
