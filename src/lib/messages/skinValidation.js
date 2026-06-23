export function validateSkinCoverage({
  skin = {},
  language = skin.defaultLanguage,
  requiredMessageKeys = [],
  requiredEntities = {}
} = {}) {
  const errors = [];
  const warnings = [];

  if (!skin.id) errors.push({ code: 'skin/missing-id' });
  if (!(skin.languages ?? []).includes(language)) {
    errors.push({ code: 'skin/unsupported-language', language });
  }

  const languageMessages = skin.messages?.[language] ?? {};
  (requiredMessageKeys ?? []).forEach((messageKey) => {
    if (!languageMessages[messageKey]) {
      errors.push({
        code: 'skin/missing-required-message',
        language,
        messageKey
      });
    }
  });

  Object.entries(requiredEntities ?? {}).forEach(([entityType, requirement = {}]) => {
    const entities = skin.entities?.[entityType] ?? {};
    (requirement.required ?? []).forEach((entityKey) => {
      if (!entities[entityKey]) {
        errors.push({
          code: 'skin/missing-required-entity',
          entityType,
          entityKey
        });
      }
    });
    (requirement.optional ?? []).forEach((entityKey) => {
      if (!entities[entityKey]) {
        warnings.push({
          code: 'skin/missing-optional-entity',
          entityType,
          entityKey
        });
      }
    });
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
