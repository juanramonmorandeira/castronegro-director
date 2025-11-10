// src/lib/utils.js
// ─────────────────────────────────────────────────────────────
// Utilidades compartidas para formateo y normalización.

import { get } from 'svelte/store';
import { dictionary, locale as localeStore } from './i18n.js';

// Constants
const DEFAULT_LOCALE = 'en-GB';
const DATE_OPTIONS = { year: 'numeric', month: 'short', day: '2-digit' };
const TIME_OPTIONS = { hour: '2-digit', minute: '2-digit' };
const DATETIME_SEPARATOR = ' · ';

// Helpers
const resolveLocale = (locale) => {
  if (locale) return locale;
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return DEFAULT_LOCALE;
};

const safeIntlFormat = (options, locale, value) => {
  try {
    return new Intl.DateTimeFormat(resolveLocale(locale), options).format(value);
  } catch {
    return null;
  }
};

const resolvePath = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

// Date helpers
export function toDateSafe(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') {
    const millis = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
    return new Date(millis);
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toEpochMillis(value) {
  const date = toDateSafe(value);
  return date ? date.getTime() : null;
}

export function formatDate(dateLike, locale) {
  const date = toDateSafe(dateLike);
  if (!date) return '—';
  return safeIntlFormat(DATE_OPTIONS, locale, date) ?? date.toISOString();
}

export function formatTime(dateLike, locale) {
  const date = toDateSafe(dateLike);
  if (!date) return '—';
  return safeIntlFormat(TIME_OPTIONS, locale, date) ?? date.toISOString();
}

export function formatDateTime(dateLike, locale) {
  const date = toDateSafe(dateLike);
  if (!date) return '—';
  const formattedDate = safeIntlFormat(DATE_OPTIONS, locale, date);
  const formattedTime = safeIntlFormat(TIME_OPTIONS, locale, date);
  if (formattedDate && formattedTime) return `${formattedDate}${DATETIME_SEPARATOR}${formattedTime}`;
  return formattedDate ?? formattedTime ?? date.toISOString();
}

// Status helpers
export function normalizeStatus(raw) {
  if (!raw) return 'draft';
  const normalized = String(raw).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const map = {
    draft: 'draft',
    shared: 'shared',
    waiting: 'waiting',
    pending: 'waiting',
    in_progress: 'in_progress',
    progress: 'in_progress',
    running: 'in_progress',
    paused: 'paused',
    hold: 'paused',
    finished: 'finished',
    done: 'finished',
    complete: 'finished',
    cancelled: 'cancelled',
    canceled: 'cancelled'
  };
  return map[normalized] || 'draft';
}

export function statusBadgeClass(raw) {
  return normalizeStatus(raw);
}

export function statusLabel(raw, fallback = 'Unknown') {
  const normalized = normalizeStatus(raw);
  try {
    const dict = get(dictionary);
    const currentLocale = get(localeStore);
    const pack = dict[currentLocale] || dict.en;
    return resolvePath(pack, `status.${normalized}`) ?? fallback;
  } catch {
    return fallback;
  }
}
