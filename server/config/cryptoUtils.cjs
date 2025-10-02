const crypto = require('crypto');

const DEFAULT_SECRET = process.env.ENCRYPTION_SECRET || 'emailmind-encryption-key-2024';
const ALGORITHM = 'aes-256-cbc';
const LEGACY_ALGORITHM = 'aes-256-cbc';
const KEY = crypto.scryptSync(DEFAULT_SECRET, 'salt', 32);

function encryptString(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptWithIv(payload) {
  const [ivHex, encrypted] = payload.split(':');
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted payload format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function decryptLegacy(payload) {
  const decipher = crypto.createDecipher(LEGACY_ALGORITHM, KEY);
  let decrypted = decipher.update(payload, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function decryptString(payload) {
  if (typeof payload !== 'string' || payload.length === 0) {
    return null;
  }

  try {
    if (payload.includes(':')) {
      return decryptWithIv(payload);
    }
  } catch (error) {
    // Fall back to legacy decryption if IV-based payload fails.
  }

  try {
    return decryptLegacy(payload);
  } catch (legacyError) {
    throw legacyError;
  }
}

module.exports = {
  encryptString,
  decryptString
};