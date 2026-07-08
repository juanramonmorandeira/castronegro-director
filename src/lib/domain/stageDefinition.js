// stageDefinition.js
// -----------------------------------------------------------------------------
// Definicion y constructor runtime de stages.
//
// Este archivo describe "que es un stage":
// - que slot ocupa;
// - que roles concretos pueden actuar, si ya se conocen;
// - que recipes ofrece;
// - que metadatos de definicion arrastra.
//
// No decide en que pool vive ni en que posicion se ejecuta. Esa organizacion
// pertenece a poolDefinition.js.
// -----------------------------------------------------------------------------

import { STAGE_STATUSES, normalizeId } from './sessionModel.js';
import {
  STAGE_COMPLETION_MODES,
  STAGE_COMPLETION_REQUESTED_BY
} from './stageTypes.js';
import { createSelectRules } from './actionModel.js';

export const AVAILABILITY_RULE_TYPES = Object.freeze({
  ACTOR_IN_PLAY: 'actor_in_play',
  ACTOR_RECENTLY_OUT_OF_PLAY: 'actor_recently_out_of_play',
  HAS_EXECUTABLE_RECIPE: 'has_executable_recipe',
  WITHIN_EXECUTION_WINDOW: 'within_execution_window',
  ALWAYS_AVAILABLE: 'always_available'
});

export const STAGE_SOURCE_TYPES = Object.freeze({
  ROLE: 'role',
  GROUP: 'group',
  EVENT: 'event'
});

export const STAGE_ERRORS = Object.freeze({
  MISSING_SESSION: 'stage/missing-session',
  MISSING_STAGE_POOLS: 'stage/missing-stage-pools',
  MISSING_CURRENT_STAGE: 'stage/missing-current-stage',
  STAGE_NOT_RUNNABLE: 'stage/not-runnable',
  MISSING_RECIPE: 'stage/missing-recipe',
  MISSING_RECIPE_KEY: 'stage/missing-recipe-key',
  RECIPE_NOT_FOUND: 'stage/recipe-not-found',
  COMPLETION_NOT_ALLOWED: 'stage/completion-not-allowed'
});

// IDs anonimos recomendados para slots de ejecucion.
//
// El stage no describe que accion ejecuta. Describe donde ocurre dentro del
// flujo. Las recipes concretas viven en stage.recipes.
export const STAGE_KEYS = Object.freeze({
  STAGE_01: 'stage_01',
  STAGE_02: 'stage_02',
  STAGE_03: 'stage_03',
  STAGE_04: 'stage_04',
  STAGE_05: 'stage_05',
  DELIBERATION: 'stage_deliberation',
  ROLE_STATE_REVEALED: 'stage_role_state_revealed',
  ROLE_REACTIVE_RESPONSE: 'stage_role_reactive_response',
  LINKED_PROPAGATED_EFFECT: 'stage_linked_propagated_effect',
  LINKED_TARGET_RECOGNITION: 'stage_linked_target_recognition',
  SELECT_DOUBLE_SELECTOR: 'select_double_selector',
  PICK_NEXT_DOUBLE_SELECTOR: 'pick_next_double_selector',
  STAGE_08: 'stage_08',
  STAGE_09: 'stage_09'
});

// Claves de recipe dentro de un stage.
//
// actionId puede ser generico, por ejemplo set_in_play. recipeKey permite
// distinguir recipes que usan esa misma action generica con parametros distintos.
export const STAGE_RECIPE_KEYS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  LINK_TARGETS: 'link_targets',
  BLOCK_OUT_OF_PLAY: 'block_out_of_play',
  SET_OUT_OF_PLAY: 'set_out_of_play',
  ASSUME_ROLE: 'assume_role',
  RESTORE_RECENT_OUT_OF_PLAY: 'restore_recent_out_of_play',
  LINKED_PROPAGATED_EFFECT: 'linked_propagated_effect',
  LINKED_TARGET_RECOGNITION: 'linked_target_recognition',
  CHECK_OBJECTIVES: 'check_objectives',
  CONCLUDE_PLAY: 'conclude_play'
});

export const PEEK_RECIPE_KEYS = Object.freeze({
  PEEK_ATTEMPT: 'peekAttempt',
  PEEK_WARNING: 'peek_warning',
  OVERRIDE_SELECTED_CANDIDATE: 'override_selected_candidate'
});

export const PEEK_WARNING_TIMINGS = Object.freeze({
  BEFORE_SELECTION: 'before_selection',
  AFTER_SELECTION: 'after_selection',
  SELECTION_NULL: 'selection_null'
});

export const PEEK_WARNING_CONFIRMATION_RULES = Object.freeze({
  UNANIMITY: 'unanimity',
  SIMPLE_MAJORITY: 'simple_majority'
});

export const STAGE_RULE_TYPES = Object.freeze({
  PEEK_WARNING_OVERRIDE: 'peek_warning_override'
});

// Normaliza los actores concretos de un stage.
//
// Los ids de roles runtime se tratan como opacos. No se pasan por normalizeId
// porque eso cambiaria ids validos como role_key-0 a role_key_0.
function defineActorIds(actorIds = []) {
  return [...new Set((actorIds ?? []).filter(Boolean))];
}

function getStageIdBase({ key, poolKey = null, actorIds = [] } = {}) {
  const normalizedKey = normalizeId(key) || 'stage';
  const locationPart = normalizeId(poolKey) || 'unassigned';
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

// Prepara una receta para vivir dentro de stage.recipes.
//
// No crea la receta: normalmente ya viene de recipeCatalog o de createRecipe.
// Aqui solo garantizamos la key mecanica que stageModel usara para seleccionarla
// y el valor optional por defecto.
function prepareRecipe(recipe = {}) {
  const recipeKey = normalizeId(recipe.key ?? recipe.recipeKey);

  return {
    ...recipe,
    key: recipeKey,
    optional: recipe.optional !== false
  };
}

// Normaliza las reglas de seleccion asociadas al stage.
//
// El seleccion no es una receta: es un mecanismo del stage para elegir target. Estas
// reglas le dicen a actionModel como contar decisiones antes de ejecutar la receta
// declarada en stage.recipes sobre el chosenId resultante.
function prepareSelectionRules(selectionRules = null) {
  if (!selectionRules) return null;
  return createSelectRules(selectionRules);
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

export function isValidStageCompletionRequester(requestedBy) {
  return Object.values(STAGE_COMPLETION_REQUESTED_BY).includes(requestedBy);
}

export function getStageCompletionDefinition(stage = {}) {
  const completion = stage?.completion ?? {};
  const mode = Object.values(STAGE_COMPLETION_MODES).includes(completion.mode)
    ? completion.mode
    : STAGE_COMPLETION_MODES.MANUAL;
  const allowedRequesters = Array.isArray(completion.allowedRequesters)
    ? completion.allowedRequesters.filter(isValidStageCompletionRequester)
    : Object.values(STAGE_COMPLETION_REQUESTED_BY);

  return {
    mode,
    allowedRequesters:
      allowedRequesters.length > 0 ? allowedRequesters : Object.values(STAGE_COMPLETION_REQUESTED_BY)
  };
}

export function canRequesterCompleteStage(stage, requestedBy) {
  const completion = getStageCompletionDefinition(stage);
  return completion.allowedRequesters.includes(requestedBy);
}

export function getStageRecipeKey(recipe) {
  return normalizeId(recipe?.key ?? recipe?.recipeKey ?? recipe?.id);
}

export function selectStageRecipe(recipes = [], requestedRecipeKey = null) {
  if (!recipes.length) {
    return {
      ok: false,
      recipe: null,
      recipeKey: null,
      error: {
        code: STAGE_ERRORS.MISSING_RECIPE,
        message: 'current stage has no recipes'
      }
    };
  }

  const normalizedRequestedKey = requestedRecipeKey ? normalizeId(requestedRecipeKey) : null;

  if (!normalizedRequestedKey && recipes.length > 1) {
    return {
      ok: false,
      recipe: null,
      recipeKey: null,
      error: {
        code: STAGE_ERRORS.MISSING_RECIPE_KEY,
        message: 'current stage has multiple recipes and requires recipeKey'
      }
    };
  }

  const selectedRecipe = normalizedRequestedKey
    ? recipes.find((recipe) => getStageRecipeKey(recipe) === normalizedRequestedKey)
    : recipes[0];

  if (!selectedRecipe) {
    return {
      ok: false,
      recipe: null,
      recipeKey: normalizedRequestedKey,
      error: {
        code: STAGE_ERRORS.RECIPE_NOT_FOUND,
        message: `current stage has no recipe "${normalizedRequestedKey}"`,
        recipeKey: normalizedRequestedKey
      }
    };
  }

  const recipeKey = getStageRecipeKey(selectedRecipe);

  return {
    ok: true,
    recipe: {
      ...selectedRecipe,
      key: selectedRecipe.key ?? recipeKey
    },
    recipeKey,
    error: null
  };
}

// Crea una definicion de stage lista para que poolDefinition la organice.
//
// order es declarativo: sirve para construir arrays antes de crear la sesion.
// poolCursorModel no lo usa durante la ejecucion.
export function defineStage({
  key,
  poolKey = null,
  status = STAGE_STATUSES.DISABLED,
  actorIds = [],
  completion = {},
  selectionRules = null,
  availabilityRules = [],
  recipes = [],
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
    status,
    actorIds: defineActorIds(actorIds),
    completion: validateStageCompletion(completion),
    selectionRules: prepareSelectionRules(selectionRules),
    availabilityRules: normalizeAvailabilityRules(availabilityRules),
    recipes: (recipes ?? []).map(prepareRecipe),
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
          actorIds: normalizedActorIds
        }),
    status: status ?? stageDefinition.status,
    actorIds: normalizedActorIds
  };
}
