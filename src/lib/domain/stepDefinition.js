// stepDefinition.js
// -----------------------------------------------------------------------------
// Constructor de definiciones de step.
//
// Este archivo describe "que es un step":
// - que slot ocupa;
// - que roles concretos pueden actuar, si ya se conocen;
// - que acciones ofrece;
// - que metadatos de definicion arrastra.
//
// No decide en que pool vive ni en que posicion se ejecuta. Esa organizacion
// pertenece a poolDefinition.js.
// -----------------------------------------------------------------------------

import { STEP_STATUSES, normalizeId } from './sessionModel.js';
import {
  STEP_COMPLETION_MODES,
  STEP_COMPLETION_REQUESTED_BY
} from './stepModel.js';
import { createVoteRules } from './voteModel.js';

export const STEP_SOURCE_TYPES = Object.freeze({
  ROLE: 'role',
  GROUP: 'group',
  SYSTEM: 'system',
  SKIN: 'skin',
  EVENT: 'event'
});

// Normaliza los actores concretos de un step.
//
// Los ids de roles runtime se tratan como opacos. No se pasan por normalizeId
// porque eso cambiaria ids validos como role_key-0 a role_key_0.
function defineActorIds(actorIds = []) {
  return [...new Set((actorIds ?? []).filter(Boolean))];
}

// Prepara una receta para vivir dentro de step.actions.
//
// No crea la receta: normalmente ya viene de recipeCatalog o de createRecipe.
// Aqui solo garantizamos la key mecanica que stepModel usara para seleccionarla
// y el valor optional por defecto.
function prepareRecipe(recipe = {}) {
  const actionKey = normalizeId(recipe.key ?? recipe.actionKey ?? recipe.id);

  return {
    ...recipe,
    key: actionKey,
    optional: recipe.optional !== false
  };
}

// Normaliza las reglas de voto asociadas al step.
//
// El voto no es una receta: es un mecanismo del step para elegir target. Estas
// reglas le dicen a voteModel como contar decisiones antes de ejecutar la receta
// declarada en step.actions sobre el chosenId resultante.
function prepareVoteRules(voteRules = null) {
  if (!voteRules) return null;
  return createVoteRules(voteRules);
}

// Valida y completa la configuracion de cierre de un step.
//
// completion no ejecuta nada. Solo define quien puede pedir avanzar al
// siguiente step y si el cierre es manual o automatico.
function validateStepCompletion({
  mode = STEP_COMPLETION_MODES.MANUAL,
  allowedRequesters = Object.values(STEP_COMPLETION_REQUESTED_BY)
} = {}) {
  const normalizedMode = Object.values(STEP_COMPLETION_MODES).includes(mode)
    ? mode
    : STEP_COMPLETION_MODES.MANUAL;
  const normalizedRequesters = (allowedRequesters ?? []).filter((requester) =>
    Object.values(STEP_COMPLETION_REQUESTED_BY).includes(requester)
  );

  return {
    mode: normalizedMode,
    allowedRequesters:
      normalizedRequesters.length > 0
        ? [...new Set(normalizedRequesters)]
        : Object.values(STEP_COMPLETION_REQUESTED_BY)
  };
}

// Crea una definicion de step lista para que poolDefinition la organice.
//
// order es declarativo: sirve para construir arrays antes de crear la sesion.
// poolCursorModel no lo usa durante la ejecucion.
export function createStep({
  key,
  poolKey = null,
  status = STEP_STATUSES.DISABLED,
  actorIds = [],
  completion = {},
  voteRules = null,
  actions = [],
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
    completion: validateStepCompletion(completion),
    voteRules: prepareVoteRules(voteRules),
    actions: (actions ?? []).map(prepareRecipe),
    order: Number.isFinite(order) ? order : null,
    metadata: {
      ...metadata,
      ...(normalizedSource ? { source: normalizedSource } : {})
    }
  };
}
