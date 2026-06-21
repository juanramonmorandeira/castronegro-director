// stageDefinition.js
// -----------------------------------------------------------------------------
// Definicion y constructor runtime de stages.
//
// Este archivo describe "que es un stage":
// - que slot ocupa;
// - que roles concretos pueden actuar, si ya se conocen;
// - que acciones ofrece;
// - que metadatos de definicion arrastra.
//
// No decide en que pool vive ni en que posicion se ejecuta. Esa organizacion
// pertenece a poolDefinition.js.
// -----------------------------------------------------------------------------

import { STAGE_STATUSES, normalizeId } from './sessionModel.js';
import {
  STAGE_COMPLETION_MODES,
  STAGE_COMPLETION_REQUESTED_BY
} from './stageModel.js';
import { createSelectionRules } from './selectionModel.js';

export const AVAILABILITY_RULE_TYPES = Object.freeze({
  ACTOR_IN_PLAY: 'actor_in_play',
  HAS_EXECUTABLE_ACTION: 'has_executable_action',
  WITHIN_EXECUTION_WINDOW: 'within_execution_window',
  ALWAYS_AVAILABLE: 'always_available'
});

export const STAGE_SOURCE_TYPES = Object.freeze({
  ROLE: 'role',
  GROUP: 'group',
  SYSTEM: 'system',
  SKIN: 'skin',
  EVENT: 'event'
});

// Normaliza los actores concretos de un stage.
//
// Los ids de roles runtime se tratan como opacos. No se pasan por normalizeId
// porque eso cambiaria ids validos como role_key-0 a role_key_0.
function defineActorIds(actorIds = []) {
  return [...new Set((actorIds ?? []).filter(Boolean))];
}

function getStageIdBase({ key, poolKey = null, special = false, actorIds = [] } = {}) {
  const normalizedKey = normalizeId(key) || 'stage';
  const locationPart = special === true ? 'special' : normalizeId(poolKey) || 'unassigned';
  const actorPart = defineActorIds(actorIds).map(String).join('-') || 'runtime';
  return `stage-${locationPart}-${normalizedKey}-${actorPart}`;
}

// Garantiza ids runtime unicos sin alterar stage.key.
//
// key identifica la definicion mecanica. id identifica una materializacion
// concreta y, por tanto, puede incorporar un sufijo cuando dos stages proceden
// de la misma definicion y de los mismos actores.
export function assignUniqueStageIds(stages = []) {
  const usedIds = new Set();

  return (stages ?? []).map((stage = {}) => {
    const baseId = String(stage.id || getStageIdBase(stage));
    let id = baseId;
    let occurrence = 1;

    while (usedIds.has(id)) {
      id = `${baseId}-${occurrence}`;
      occurrence += 1;
    }

    usedIds.add(id);
    return { ...stage, id };
  });
}

// Prepara una receta para vivir dentro de stage.actions.
//
// No crea la receta: normalmente ya viene de recipeCatalog o de createRecipe.
// Aqui solo garantizamos la key mecanica que stageModel usara para seleccionarla
// y el valor optional por defecto.
function prepareRecipe(recipe = {}) {
  const actionKey = normalizeId(recipe.key ?? recipe.actionKey ?? recipe.id);

  return {
    ...recipe,
    key: actionKey,
    optional: recipe.optional !== false
  };
}

// Normaliza las reglas de seleccion asociadas al stage.
//
// El seleccion no es una receta: es un mecanismo del stage para elegir target. Estas
// reglas le dicen a selectionModel como contar decisiones antes de ejecutar la receta
// declarada en stage.actions sobre el chosenId resultante.
function prepareSelectionRules(selectionRules = null) {
  if (!selectionRules) return null;
  return createSelectionRules(selectionRules);
}

function prepareInfluences(influences = []) {
  return (influences ?? []).map((influence) => ({
    ...influence,
    subject: influence.subject ? normalizeId(influence.subject) : null,
    property: influence.property ?? null,
    operation: influence.operation ? normalizeId(influence.operation) : null,
    values: Array.isArray(influence.values) ? [...influence.values] : influence.values
  }));
}

function normalizeAvailabilityRule(rule = {}) {
  return {
    ...rule,
    type: normalizeId(rule.type),
    metadata: { ...(rule.metadata ?? {}) }
  };
}

function normalizeAvailabilityRules(availabilityRules = []) {
  if (Array.isArray(availabilityRules)) {
    return {
      all: availabilityRules.map(normalizeAvailabilityRule),
      any: []
    };
  }

  return {
    all: (availabilityRules?.all ?? []).map(normalizeAvailabilityRule),
    any: (availabilityRules?.any ?? []).map((entry) =>
      Array.isArray(entry)
        ? { all: entry.map(normalizeAvailabilityRule), any: [] }
        : entry?.type
          ? normalizeAvailabilityRule(entry)
          : normalizeAvailabilityRules(entry)
    )
  };
}

// Valida y completa la configuracion de cierre de un stage.
//
// completion no ejecuta nada. Solo define quien puede pedir avanzar al
// siguiente stage y si el cierre es manual o automatico.
function validateStageCompletion({
  mode = STAGE_COMPLETION_MODES.MANUAL,
  allowedRequesters = Object.values(STAGE_COMPLETION_REQUESTED_BY)
} = {}) {
  const normalizedMode = Object.values(STAGE_COMPLETION_MODES).includes(mode)
    ? mode
    : STAGE_COMPLETION_MODES.MANUAL;
  const normalizedRequesters = (allowedRequesters ?? []).filter((requester) =>
    Object.values(STAGE_COMPLETION_REQUESTED_BY).includes(requester)
  );

  return {
    mode: normalizedMode,
    allowedRequesters:
      normalizedRequesters.length > 0
        ? [...new Set(normalizedRequesters)]
        : Object.values(STAGE_COMPLETION_REQUESTED_BY)
  };
}

// Crea una definicion de stage lista para que poolDefinition la organice.
//
// order es declarativo: sirve para construir arrays antes de crear la sesion.
// poolCursorModel no lo usa durante la ejecucion.
export function defineStage({
  key,
  poolKey = null,
  special = false,
  status = STAGE_STATUSES.DISABLED,
  completion = {},
  selectionRules = null,
  availabilityRules = [],
  actions = [],
  influences = [],
  order = null,
  source = null,
  metadata = {}
} = {}) {
  const normalizedSource = source
    ? {
        type: source.type ? normalizeId(source.type) : null,
        id: source.id ? normalizeId(source.id) : null,
        metadata: { ...(source.metadata ?? {}) }
      }
    : null;

  return {
    key: normalizeId(key),
    poolKey: poolKey ?? null,
    special: special === true,
    status,
    completion: validateStageCompletion(completion),
    selectionRules: prepareSelectionRules(selectionRules),
    availabilityRules: normalizeAvailabilityRules(availabilityRules),
    actions: (actions ?? []).map(prepareRecipe),
    influences: prepareInfluences(influences),
    order: Number.isFinite(order) ? order : null,
    metadata: {
      ...metadata,
      ...(normalizedSource ? { source: normalizedSource } : {})
    }
  };
}

export function createStage({
  id = null,
  status,
  actorIds = [],
  ...definition
} = {}) {
  const stageDefinition = defineStage(definition);
  const normalizedActorIds = defineActorIds(actorIds);

  return {
    ...stageDefinition,
    id: id
      ? String(id)
      : getStageIdBase({
          key: stageDefinition.key,
          poolKey: stageDefinition.poolKey,
          special: stageDefinition.special,
          actorIds: normalizedActorIds
        }),
    status: status ?? stageDefinition.status,
    actorIds: normalizedActorIds
  };
}
