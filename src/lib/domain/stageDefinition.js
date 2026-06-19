// stageDefinition.js
// -----------------------------------------------------------------------------
// Constructor de definiciones de stage.
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
export function createStage({
  key,
  poolKey = null,
  special = false,
  status = STAGE_STATUSES.DISABLED,
  actorIds = [],
  completion = {},
  selectionRules = null,
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
    actorIds: defineActorIds(actorIds),
    completion: validateStageCompletion(completion),
    selectionRules: prepareSelectionRules(selectionRules),
    actions: (actions ?? []).map(prepareRecipe),
    influences: prepareInfluences(influences),
    order: Number.isFinite(order) ? order : null,
    metadata: {
      ...metadata,
      ...(normalizedSource ? { source: normalizedSource } : {})
    }
  };
}
