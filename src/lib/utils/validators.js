// src/lib/utils/validators.js
// Common validation helpers shared across auth forms.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value = '') {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value = '') {
  const normalized = String(value ?? '').trim();
  if (!normalized) return false;
  return EMAIL_PATTERN.test(normalized);
}

export const PASSWORD_RULES = {
  minLength: 10,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  symbol: /[^A-Za-z0-9]/
};

export function meetsPasswordRequirements(password = '', rules = PASSWORD_RULES) {
  if (!password || typeof password !== 'string') return false;
  const value = password.trim();
  return (
    value.length >= (rules.minLength ?? 0) &&
    (!rules.uppercase || rules.uppercase.test(value)) &&
    (!rules.lowercase || rules.lowercase.test(value)) &&
    (!rules.number || rules.number.test(value)) &&
    (!rules.symbol || rules.symbol.test(value))
  );
}
