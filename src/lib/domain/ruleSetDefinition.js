// ruleSetDefinition.js
// -----------------------------------------------------------------------------
// Contrato de ruleSets mecanicos.
//
// defineRuleSet normaliza una entrada de catalogo. buildRuleSet selecciona las
// piezas permitidas para una session concreta. No materializa roles ni session:
// esa responsabilidad sigue perteneciendo a buildSession.
// -----------------------------------------------------------------------------

import { normalizeId } from './sessionModel.js';
import { DEFAULT_POOL_ORDER } from './poolCatalog.js';

export const RULE_SET_SUPPORT_STATUSES = Object.freeze({
  READY: 'ready',
  PARTIAL: 'partial',
  PENDING: 'pending'
});

export const ALIGNMENT_IDS = Object.freeze({
  ALIGNMENT_A: 'alignment_a',
  ALIGNMENT_B: 'alignment_b',
  ALIGNMENT_UNDEFINED: 'alignment_undefined',
  ALIGNMENT_INDEPENDENT: 'alignment_independent'
});

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, cloneValue(entryValue)])
    );
  }
  return value;
}

function defineRoleOption({
  roleKey,
  catalogId = roleKey,
  support = RULE_SET_SUPPORT_STATUSES.READY,
  selectable = support === RULE_SET_SUPPORT_STATUSES.READY,
  instanceRule = { min: 0, max: 1, step: 1 },
  missingMechanics = [],
  metadata = {}
} = {}) {
  return {
    roleKey: normalizeId(roleKey),
    catalogId: normalizeId(catalogId),
    support: Object.values(RULE_SET_SUPPORT_STATUSES).includes(support)
      ? support
      : RULE_SET_SUPPORT_STATUSES.PENDING,
    selectable: selectable === true,
    instanceRule: cloneValue(instanceRule),
    missingMechanics: [...new Set((missingMechanics ?? []).filter(Boolean))],
    metadata: { ...metadata }
  };
}

function defineAvailableRuleOption({
  key,
  type = 'generalRule',
  support = RULE_SET_SUPPORT_STATUSES.READY,
  selectable = support === RULE_SET_SUPPORT_STATUSES.READY,
  defaultEnabled = false,
  configuration = {},
  rules = {},
  missingMechanics = [],
  metadata = {}
} = {}) {
  return {
    key: normalizeId(key),
    type: normalizeId(type),
    support: Object.values(RULE_SET_SUPPORT_STATUSES).includes(support)
      ? support
      : RULE_SET_SUPPORT_STATUSES.PENDING,
    selectable: selectable === true,
    defaultEnabled: defaultEnabled === true,
    configuration: cloneValue(configuration),
    rules: cloneValue(rules),
    missingMechanics: [...new Set((missingMechanics ?? []).filter(Boolean))],
    metadata: { ...metadata }
  };
}

export function defineRuleSet({
  id,
  version = 1,
  availableRoles = [],
  availableRules = [],
  groups = [],
  rules = {},
  poolOrder = DEFAULT_POOL_ORDER,
  distributionRules = null,
  skinRequirements = {},
  metadata = {}
} = {}) {
  return {
    id: normalizeId(id),
    version,
    availableRoles: (availableRoles ?? []).map(defineRoleOption),
    availableRules: (availableRules ?? []).map(defineAvailableRuleOption),
    groups: cloneValue(groups),
    rules: {
      baseRules: cloneValue(rules.baseRules ?? []),
      optionalRules: cloneValue(rules.optionalRules ?? []),
      objectiveRules: cloneValue(rules.objectiveRules ?? []),
      selectionRules: cloneValue(rules.selectionRules ?? [])
    },
    poolOrder: [...(poolOrder ?? DEFAULT_POOL_ORDER)],
    distributionRules: distributionRules ? cloneValue(distributionRules) : null,
    skinRequirements: cloneValue(skinRequirements),
    metadata: { ...metadata }
  };
}

export function validateRuleSetSelection({
  selectedRuleSet = {},
  selectedRoleKeys = [],
  selectedRuleKeys = []
} = {}) {
  const roleOptions = new Map(
    (selectedRuleSet.availableRoles ?? []).map((option) => [option.roleKey, option])
  );
  const errors = [];

  (selectedRoleKeys ?? []).forEach((roleKeyInput) => {
    const roleKey = normalizeId(roleKeyInput);
    const option = roleOptions.get(roleKey);

    if (!option) {
      errors.push({ code: 'ruleset/unknown-role', roleKey });
      return;
    }

    if (!option.selectable || option.support !== RULE_SET_SUPPORT_STATUSES.READY) {
      errors.push({
        code: 'ruleset/role-not-ready',
        roleKey,
        support: option.support,
        missingMechanics: [...option.missingMechanics]
      });
    }
  });

  const availableRuleOptions = new Map(
    (selectedRuleSet.availableRules ?? []).map((option) => [option.key, option])
  );

  (selectedRuleKeys ?? []).forEach((ruleKeyInput) => {
    const ruleKey = normalizeId(ruleKeyInput);
    const option = availableRuleOptions.get(ruleKey);

    if (!option) {
      errors.push({ code: 'ruleset/unknown-rule', ruleKey });
      return;
    }

    if (!option.selectable || option.support !== RULE_SET_SUPPORT_STATUSES.READY) {
      errors.push({
        code: 'ruleset/rule-not-ready',
        ruleKey,
        support: option.support,
        missingMechanics: [...option.missingMechanics]
      });
    }
  });

  return { ok: errors.length === 0, errors };
}

export function buildRuleSet({
  selectedRuleSet,
  selectedRoleKeys = [],
  roleCatalog = {},
  selectedOptionalRuleKeys = [],
  selectedRuleKeys = selectedOptionalRuleKeys
} = {}) {
  const selection = validateRuleSetSelection({ selectedRuleSet, selectedRoleKeys, selectedRuleKeys });

  if (!selection.ok) {
    return { ok: false, errors: selection.errors, ruleSet: null };
  }

  const roleOptions = new Map(
    (selectedRuleSet.availableRoles ?? []).map((option) => [option.roleKey, option])
  );
  const missingCatalogRoles = [];
  const roleDefinitions = selectedRoleKeys.map((roleKeyInput) => {
    const roleKey = normalizeId(roleKeyInput);
    const option = roleOptions.get(roleKey);
    const roleDefinition = roleCatalog[option.catalogId];
    if (!roleDefinition) {
      missingCatalogRoles.push({
        code: 'ruleset/missing-catalog-role',
        roleKey,
        catalogId: option.catalogId
      });
      return null;
    }
    return cloneValue(roleDefinition);
  }).filter(Boolean);

  if (missingCatalogRoles.length > 0) {
    return {
      ok: false,
      errors: missingCatalogRoles,
      ruleSet: null
    };
  }
  const optionalRuleKeySet = new Set((selectedOptionalRuleKeys ?? []).map(normalizeId));
  const selectedOptionalRules = (selectedRuleSet.rules?.optionalRules ?? []).filter((rule) =>
    optionalRuleKeySet.has(normalizeId(rule.key ?? rule.id))
  );
  const selectedAvailableRuleKeySet = new Set((selectedRuleKeys ?? []).map(normalizeId));
  const selectedAvailableRules = (selectedRuleSet.availableRules ?? []).filter((rule) =>
    selectedAvailableRuleKeySet.has(rule.key)
  );
  const selectedRuleSelectionRules = selectedAvailableRules.flatMap((rule) =>
    cloneValue(rule.rules?.selectionRules ?? [])
  );

  return {
    ok: true,
    errors: [],
    ruleSet: {
      id: selectedRuleSet.id,
      version: selectedRuleSet.version,
      roles: {
        baseRoles: roleDefinitions,
        optionalRoles: []
      },
      groups: cloneValue(selectedRuleSet.groups ?? []),
      rules: {
        baseRules: cloneValue(selectedRuleSet.rules?.baseRules ?? []),
        optionalRules: [
          ...cloneValue(selectedOptionalRules),
          ...cloneValue(selectedAvailableRules)
        ],
        objectiveRules: cloneValue(selectedRuleSet.rules?.objectiveRules ?? []),
        selectionRules: [
          ...cloneValue(selectedRuleSet.rules?.selectionRules ?? []),
          ...selectedRuleSelectionRules
        ]
      },
      poolOrder: [...(selectedRuleSet.poolOrder ?? DEFAULT_POOL_ORDER)],
      distributionRules: cloneValue(selectedRuleSet.distributionRules),
      skinRequirements: cloneValue(selectedRuleSet.skinRequirements),
      metadata: {
        ...selectedRuleSet.metadata,
        selectedRoleKeys: selectedRoleKeys.map(normalizeId),
        selectedRuleKeys: selectedRuleKeys.map(normalizeId)
      }
    }
  };
}
