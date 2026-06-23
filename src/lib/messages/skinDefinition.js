export function defineSkin({
  id,
  version = 1,
  supportedRuleSetIds = [],
  defaultLanguage = 'en',
  languages = [],
  entities = {},
  messages = {},
  metadata = {}
} = {}) {
  const supportedLanguages = [...new Set([defaultLanguage, ...(languages ?? [])].filter(Boolean))];

  return {
    id,
    version,
    supportedRuleSetIds: [...new Set((supportedRuleSetIds ?? []).filter(Boolean))],
    defaultLanguage,
    languages: supportedLanguages,
    entities: Object.fromEntries(
      Object.entries(entities ?? {}).map(([type, entries]) => [
        type,
        Object.fromEntries(
          Object.entries(entries ?? {}).map(([key, value]) => [
            key,
            typeof value === 'string' ? { displayName: value } : { ...value }
          ])
        )
      ])
    ),
    messages: Object.fromEntries(
      Object.entries(messages ?? {}).map(([language, entries]) => [
        language,
        Object.fromEntries(
          Object.entries(entries ?? {}).map(([key, value]) => [
            key,
            typeof value === 'string' ? { default: value } : { ...value }
          ])
        )
      ])
    ),
    metadata: { ...metadata }
  };
}
