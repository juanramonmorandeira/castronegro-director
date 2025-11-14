// src/lib/players.js
// Helper utilities to manage player entries within a session document.

import { toEpochMillis } from './utils.js';

export const GENERIC_PLAYER_ALIASES = [
  'Moonlit Howl',
  'Silver Fang',
  'Duskwind Claw',
  'Ashen Mane',
  'Crescent Prowler',
  'Ember Snout',
  'Nightfall Stalker',
  'Gloomtail',
  'Scarlet Maw',
  'Whispering Paw',
  'Grim Hollow',
  'Feral Lantern',
  'Twilight Bane',
  'Dusky Snarl',
  'Frostbitten Howler',
  'Shadow Growler',
  'Mourning Fang',
  'Glade Lurker',
  'Stormjaw',
  'Elder Pelt'
];

export function resolvePlayerKey(user = null) {
  if (!user) return null;
  return user.uid || user.auth_uid || user.id || null;
}

export function getGenericAlias(index = 0) {
  if (!GENERIC_PLAYER_ALIASES.length) return 'Guest';
  const safeIndex = Number.isFinite(index) ? index : 0;
  const normalized = ((safeIndex % GENERIC_PLAYER_ALIASES.length) + GENERIC_PLAYER_ALIASES.length) % GENERIC_PLAYER_ALIASES.length;
  return GENERIC_PLAYER_ALIASES[normalized];
}

export function derivePlayerAlias(user = {}, existingAlias = '', fallbackIndex = 0) {
  const trimmedAlias = typeof user.alias === 'string' ? user.alias.trim() : '';
  if (trimmedAlias) return trimmedAlias;
  if (existingAlias && typeof existingAlias === 'string') return existingAlias;
  const trimmedName = typeof user.name === 'string' ? user.name.trim() : '';
  if (trimmedName) return trimmedName;
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  if (email) {
    const [local] = email.split('@');
    if (local) return local;
  }
  return getGenericAlias(fallbackIndex);
}

export function resolvePlayerAvatar(user = {}, existingAvatar = '') {
  const candidate = user.avatarURL || user.avatar || existingAvatar;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  return null;
}

export function computePlayerCounts(players = {}) {
  let connected = 0;
  let ready = 0;
  const entries = players && typeof players === 'object' ? Object.values(players) : [];
  entries.forEach((entry) => {
    const status = typeof entry?.status === 'string' ? entry.status.toLowerCase() : '';
    if (status === 'ready') {
      ready += 1;
      connected += 1;
    } else if (status === 'connected') {
      connected += 1;
    }
  });
  return {
    connected,
    ready,
    total: entries.length
  };
}

export function mapPlayers(players = {}) {
  if (!players || typeof players !== 'object') return [];
  return Object.entries(players)
    .map(([id, data], index) => {
      const alias = data?.alias || getGenericAlias(index);
      const joined =
        toEpochMillis(data?.connected_at) ??
        toEpochMillis(data?.joined_at) ??
        toEpochMillis(data?.created_at) ??
        0;
      const updated = toEpochMillis(data?.updated_at) ?? joined;
      const status = data?.status ?? (data?.ready ? 'ready' : 'connected');
      return {
        id,
        alias,
        avatarURL: data?.avatarURL || data?.avatar || null,
        status,
        ready: status === 'ready' || !!data?.ready,
        connectedAt: joined,
        updatedAt: updated
      };
    })
    .sort((a, b) => {
      if (a.connectedAt !== b.connectedAt) return a.connectedAt - b.connectedAt;
      return a.alias.localeCompare(b.alias);
    });
}
