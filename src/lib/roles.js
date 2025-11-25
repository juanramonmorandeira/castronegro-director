// src/lib/roles.js
// Shared helpers for dealing with role metadata and selections.

import roleDefinitions from '../../reference-data/datasets/roles.json' with { type: 'json' };

export const ROLE_CATEGORIES = ['villagers', 'ambiguous', 'loners', 'werewolves'];
// Roles que admiten múltiples copias (usar slugifyRole)
export const DUPLICATE_ROLE_NAMES = new Set(['trusted', 'villager', 'werewolf']);

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

export function buildDistributionTokens(selection) {
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
          player: null
        });
      }
    });
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
