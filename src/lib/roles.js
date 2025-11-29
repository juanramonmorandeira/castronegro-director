// src/lib/roles.js
// Shared helpers for dealing with role metadata and selections.

import roleDefinitions from '../../reference-data/datasets/roles.json' with { type: 'json' };

export const ROLE_CATEGORIES = ['villagers', 'ambiguous', 'loners', 'werewolves'];
// Roles que admiten múltiples copias (usar slugifyRole)
export const DUPLICATE_ROLE_NAMES = new Set(['trusted', 'villager', 'werewolf', 'brothers', 'sisters']);

export function slugifyRole(name = '') {
  return String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

export function createEmptyRoleSelection() {
  return ROLE_CATEGORIES.reduce(
    (acc, category) => ({
      ...acc,
      [category]: {}
    }),
    {}
  );
}

export function normalizeRoleSelection(source) {
  const base = createEmptyRoleSelection();
  if (!source || typeof source !== 'object') return base;
  ROLE_CATEGORIES.forEach((category) => {
    const entries = source[category];
    if (!entries || typeof entries !== 'object') return;
    base[category] = Object.entries(entries).reduce((acc, [role, count]) => {
      const numeric = Number(count) || 0;
      if (numeric > 0) acc[role] = numeric;
      return acc;
    }, {});
  });
  return base;
}

export function roleImageSrc(category, role) {
  const file = slugifyRole(role);
  return `/roles/${category}/${file}.png`;
}

export function buildDistributionTokens(selection, assignments = {}, players = []) {
  const assignmentBuckets = {};
  const seenPlayers = new Set();
  const cupidHeartPath = '/tokens/cupido-hearts.png';
  const defenderShieldPath = '/tokens/defender-shield.png';
  const piperFlutePath = '/tokens/piper-flute.png';
  const witchHealPath = '/tokens/witch-heal.png';
  const witchVenomPath = '/tokens/witch-venom.png';

  const pushAssignment = (slug, label) => {
    if (!slug || !label) return;
    if (!assignmentBuckets[slug]) assignmentBuckets[slug] = [];
    assignmentBuckets[slug].push(label);
  };

  // Keep assignment ordering stable by following the current player list.
  (players ?? []).forEach((player) => {
    const data = assignments?.[player.id];
    if (!data) return;
    seenPlayers.add(player.id);
    const slug = data.slug ?? slugifyRole(data.role);
    pushAssignment(slug, player.alias || player.name || player.id);
  });

  // Include any leftover assignments not present in the player list.
  Object.entries(assignments ?? {}).forEach(([playerId, data]) => {
    if (seenPlayers.has(playerId) || !data) return;
    const slug = data.slug ?? slugifyRole(data.role);
    const label = data.alias || data.player || playerId;
    pushAssignment(slug, label);
  });

  const tokens = [];
  ROLE_CATEGORIES.forEach((category) => {
    const roles = selection?.[category] ?? {};
    Object.entries(roles).forEach(([roleName, count]) => {
      const slug = slugifyRole(roleName);
      for (let index = 0; index < count; index += 1) {
        tokens.push({
          id: `${category}-${slug}-${index}`,
          role: roleName,
          category,
          image: roleImageSrc(category, roleName),
          player: (assignmentBuckets[slug] ?? []).shift() ?? null
        });
      }
    });
  });

  // Cupid special tokens: two heart markers per Cupid selected.
  const cupidCount =
    Number(
      selection?.villagers?.cupid ??
        selection?.villagers?.Cupid ??
        selection?.villagers?.['The Cupid'] ??
        0
    ) || 0;
  if (cupidCount > 0) {
    const heartTokens = cupidCount * 2;
    for (let index = 0; index < heartTokens; index += 1) {
      tokens.push({
        id: `special-cupid-heart-${index}`,
        role: 'Cupid Hearts',
        category: 'special',
        image: cupidHeartPath,
        player: null
      });
    }
  }

  // Piper special tokens: one charm per player (excluding the Piper).
  const piperCount =
    Number(
      selection?.villagers?.piper ??
        selection?.villagers?.Piper ??
        selection?.villagers?.['The Piper'] ??
        0
    ) || 0;
  const playerCount = Array.isArray(players) ? players.length : 0;
  const piperCharms = Math.max(0, playerCount - piperCount);
  for (let index = 0; index < piperCharms; index += 1) {
    tokens.push({
      id: `special-piper-charm-${index}`,
      role: 'Piper Charm',
      category: 'special',
      image: piperFlutePath,
      player: null
    });
  }

  // Defender special token: one shield per Defender selected.
  const defenderCount =
    Number(
      selection?.villagers?.defender ??
        selection?.villagers?.Defender ??
        selection?.villagers?.['The Defender'] ??
        0
    ) || 0;
  if (defenderCount > 0) {
    for (let index = 0; index < defenderCount; index += 1) {
      tokens.push({
        id: `special-defender-shield-${index}`,
        role: 'Defender Shield',
        category: 'special',
        image: defenderShieldPath,
        player: null
      });
    }
  }

  // Witch special tokens: one heal and one venom potion per Witch selected.
  const witchCount =
    Number(
      selection?.villagers?.witch ??
        selection?.villagers?.Witch ??
        selection?.villagers?.['The Witch'] ??
        0
    ) || 0;
  if (witchCount > 0) {
    for (let index = 0; index < witchCount; index += 1) {
      tokens.push(
        {
          id: `special-witch-heal-${index}`,
          role: 'Witch Heal',
          category: 'special',
          image: witchHealPath,
          player: null
        },
        {
          id: `special-witch-venom-${index}`,
          role: 'Witch Venom',
          category: 'special',
          image: witchVenomPath,
          player: null
        }
      );
    }
  }

  return tokens;
}

export function flattenRoleSelection(selection) {
  const list = [];
  ROLE_CATEGORIES.forEach((category) => {
    const roles = selection?.[category] ?? {};
    Object.entries(roles).forEach(([roleName, count]) => {
      const numeric = Number(count) || 0;
      if (!numeric) return;
      list.push({
        role: roleName,
        slug: slugifyRole(roleName),
        category,
        count: numeric
      });
    });
  });
  return list;
}

export const ROLE_DEFINITIONS = roleDefinitions;

export function getRoleDefinition(roleName) {
  if (!roleName) return null;
  const slug = slugifyRole(roleName);
  return ROLE_DEFINITIONS[slug] ?? null;
}

export function getRoleName(roleName, locale = 'en') {
  const definition = getRoleDefinition(roleName);
  if (!definition) return roleName;
  const normalized = (locale || 'en').split(/[-_]/)[0].toLowerCase();
  return definition.names[normalized] ?? definition.names.en ?? roleName;
}

export function getRoleDescription(roleName, locale = 'en') {
  const definition = getRoleDefinition(roleName);
  if (!definition) return '';
  const normalized = (locale || 'en').split(/[-_]/)[0].toLowerCase();
  return definition.descriptions[normalized] ?? definition.descriptions.en ?? '';
}

export function getRoleShortDescription(roleName, locale = 'en') {
  const definition = getRoleDefinition(roleName);
  if (!definition) return '';
  const short = definition.short_description;
  if (!short) return getRoleDescription(roleName, locale);
  const normalized = (locale || 'en').split(/[-_]/)[0].toLowerCase();
  return short[normalized] ?? short.en ?? '';
}
