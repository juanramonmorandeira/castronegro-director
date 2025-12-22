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
  const werewolvesClawPath = '/tokens/werewolves-claw.png';
  const fatherBitePath = '/tokens/father-bite.png';
  const hunterBulletPath = '/tokens/hunter-bullet.png';
  const sheriffBadgePath = '/badge/sheriff.png';
  const villagersEliminationPath = '/tokens/villagers-guillotine.png';
  const foxSensesPath = '/tokens/fox-senses.png';

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

  // Piper special tokens: charms the Piper can use each night (at least 2, or one per other player).
  const piperCount =
    Number(
      selection?.loners?.piper ??
        selection?.loners?.Piper ??
        selection?.loners?.['The Piper'] ??
        0
    ) || 0;
  const playerCount = Array.isArray(players) ? players.length : 0;
  if (piperCount > 0) {
    const piperCharms = Math.max(2, playerCount - 1); // mínimo 2 fichas por noche
    for (let index = 0; index < piperCharms; index += 1) {
      tokens.push({
        id: `special-piper-charm-${index}`,
        role: 'Piper Charm',
        category: 'special',
        image: piperFlutePath,
        player: null
      });
    }
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

  // Fox special token: one sensing token per Fox selected.
  const foxCount =
    Number(
      selection?.villagers?.fox ??
        selection?.villagers?.Fox ??
        selection?.villagers?.['The Fox'] ??
        0
    ) || 0;
  if (foxCount > 0) {
    for (let index = 0; index < foxCount; index += 1) {
      tokens.push({
        id: `special-fox-senses-${index}`,
        role: 'Fox Senses',
        category: 'special',
        image: foxSensesPath,
        player: null
      });
    }
  }

  // Werewolves claws: always at least one, +1 if Big Bad Wolf ("bad") is in play.
  // Werewolves claws: always at least one if any werewolf-aligned role is present.
  const werewolfEntries = Object.values(selection?.werewolves ?? {}).map((val) => Number(val) || 0);
  const totalWerewolves = werewolfEntries.reduce((sum, val) => sum + val, 0);
  const badCount = Number(selection?.werewolves?.bad ?? selection?.werewolves?.Bad ?? 0) || 0;
  if (totalWerewolves > 0) {
    const claws = 1 + (badCount > 0 ? 1 : 0);
    for (let index = 0; index < claws; index += 1) {
      tokens.push({
        id: `special-werewolves-claws-${index}`,
        role: 'Werewolves Claws',
        category: 'special',
        image: werewolvesClawPath,
        player: null
      });
    }
  }

  // Cursed Wolf-Father infection marker.
  const fatherCount =
    Number(selection?.werewolves?.father ?? selection?.werewolves?.Father ?? 0) +
    Number(selection?.werewolves?.['Cursed Wolf Father'] ?? 0);
  if (fatherCount > 0) {
    tokens.push({
      id: 'special-father-bite-0',
      role: 'Cursed Wolf Father',
      category: 'special',
      image: fatherBitePath,
      player: null
    });
  }

  // Hunter bullet: one shot available per Hunter, usable when the Hunter dies.
  const hunterCount =
    Number(
      selection?.villagers?.hunter ??
        selection?.villagers?.Hunter ??
        selection?.villagers?.['The Hunter'] ??
        0
    ) || 0;
  if (hunterCount > 0) {
    for (let index = 0; index < hunterCount; index += 1) {
      tokens.push({
        id: `special-hunter-bullet-${index}`,
        role: 'Hunter Bullet',
        category: 'special',
        image: hunterBulletPath,
        player: null
      });
    }
  }

  // Sheriff badge is always available for the preparation phase.
  tokens.push({
    id: 'special-sheriff-badge-0',
    role: 'Sheriff Badge',
    category: 'special',
    image: sheriffBadgePath,
    player: null
  });

  // Villagers elimination marker for daytime resolutions.
  tokens.push({
    id: 'special-villagers-guillotine-0',
    role: 'Villagers Guillotine',
    category: 'special',
    image: villagersEliminationPath,
    player: null
  });

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
