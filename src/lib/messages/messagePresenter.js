import {
  MESSAGE_AUDIENCE_TYPES,
  MESSAGE_ENTITY_TYPES,
  isEntityReference
} from './messageDefinition.js';

function getRoleKey(session = {}, roleId = null) {
  return (session.roles ?? []).find((role) => role.id === roleId)?.roleKey ?? roleId;
}

function getGroupKey(session = {}, groupId = null) {
  const group = (session.groups ?? []).find(
    (entry) => entry.id === groupId || entry.key === groupId
  );
  return group?.key ?? groupId;
}

function getEntityCollectionKey(entityType) {
  if (entityType === MESSAGE_ENTITY_TYPES.ROLE) return 'roles';
  if (entityType === MESSAGE_ENTITY_TYPES.GROUP) return 'groups';
  if (entityType === MESSAGE_ENTITY_TYPES.STAGE) return 'stages';
  if (entityType === MESSAGE_ENTITY_TYPES.OBJECTIVE) return 'objectives';
  if (entityType === MESSAGE_ENTITY_TYPES.ACTION) return 'actions';
  if (entityType === MESSAGE_ENTITY_TYPES.RECIPE) return 'recipes';
  return null;
}

function getEntityKey(reference, session) {
  if (reference.entityType === MESSAGE_ENTITY_TYPES.ROLE) {
    return getRoleKey(session, reference.id);
  }
  if (reference.entityType === MESSAGE_ENTITY_TYPES.GROUP) {
    return getGroupKey(session, reference.id);
  }
  return reference.id;
}

function getLocalizedValue(value, language, defaultLanguage) {
  if (!value || typeof value !== 'object') return value;
  return value[language] ?? value[defaultLanguage] ?? Object.values(value)[0] ?? null;
}

export function resolveSkinEntity(
  reference,
  { skin = {}, session = {}, language = skin.defaultLanguage } = {}
) {
  if (!isEntityReference(reference)) return reference;
  const collectionKey = getEntityCollectionKey(reference.entityType);
  const entityKey = getEntityKey(reference, session);
  const entity = skin.entities?.[collectionKey]?.[entityKey] ?? null;

  return (
    getLocalizedValue(entity?.displayName, language, skin.defaultLanguage) ??
    getLocalizedValue(entity?.name, language, skin.defaultLanguage) ??
    entityKey
  );
}

function resolveMessageParams(message, context) {
  return Object.fromEntries(
    Object.entries(message.params ?? {}).map(([key, value]) => [
      key,
      isEntityReference(value) ? resolveSkinEntity(value, context) : value
    ])
  );
}

function interpolate(template, params) {
  return String(template ?? '').replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
    Object.hasOwn(params, key) ? String(params[key]) : match
  );
}

function getTemplate(message, skin, language) {
  const definition = skin.messages?.[language]?.[message.key] ?? null;
  if (!definition) return null;
  const audienceType = message.audience?.type ?? MESSAGE_AUDIENCE_TYPES.SYSTEM;
  return definition[audienceType] ?? definition.default ?? null;
}

export function presentMessage({
  message,
  skin,
  language = skin?.defaultLanguage,
  session = {}
} = {}) {
  const template = getTemplate(message, skin, language);
  if (!template) {
    return {
      ok: false,
      errors: [{
        code: 'presentation/missing-message-template',
        skinId: skin?.id ?? null,
        language,
        messageKey: message?.key ?? null,
        audienceType: message?.audience?.type ?? null
      }],
      presentation: null
    };
  }

  const params = resolveMessageParams(message, { skin, session, language });
  return {
    ok: true,
    errors: [],
    presentation: {
      messageId: message.id ?? null,
      text: interpolate(template, params),
      severity: message.severity,
      audience: { ...message.audience, ids: [...(message.audience?.ids ?? [])] },
      language,
      skinId: skin.id,
      metadata: {
        messageKey: message.key,
        resolvedParams: params
      }
    }
  };
}

export function toToastInput(presentation = {}) {
  const variant =
    presentation.severity === 'fatal' || presentation.severity === 'error'
      ? 'error'
      : presentation.severity === 'warning' || presentation.severity === 'info'
        ? 'info'
        : 'success';

  return {
    message: presentation.text ?? '',
    variant
  };
}
