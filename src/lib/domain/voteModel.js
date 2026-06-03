// voteModel.js
// -----------------------------------------------------------------------------
// Este archivo modela una votacion como recuento mecanico.
//
// Votar no significa automaticamente eliminar, expulsar o nombrar a alguien.
// Votar significa:
// - un actor inPlay elige un target inPlay;
// - cada voto vale una unidad;
// - los votos se agrupan por targetRoleInstanceId;
// - el target con mas votos gana la votacion, segun la politica de empate.
//
// El efecto de ganar la votacion vive fuera de este archivo. Puede ser
// set_property inPlay=false, dar una accion extra, crear una marca, etc.
// -----------------------------------------------------------------------------

import { getRelatedRoleInstanceIds, normalizeId } from './sessionModel.js';

export const VOTE_OUTCOME_TYPES = Object.freeze({
  WINNER: 'winner',
  TIE: 'tie',
  NULL: 'null'
});

export const VOTE_TIE_POLICIES = Object.freeze({
  NULL_ON_TIE: 'null_on_tie',
  RUNOFF_ON_TIE: 'runoff_on_tie'
});

export const VOTE_ROUND_TYPES = Object.freeze({
  INITIAL: 'initial',
  RUNOFF: 'runoff'
});

export const VOTE_REQUIRED_POLICIES = Object.freeze({
  OPTIONAL: 'optional',
  ALL_IN_PLAY: 'all_in_play'
});

export const VOTE_RESTRICTION_TYPES = Object.freeze({
  EXCLUDE_RELATED_TARGET: 'exclude_related_target'
});

// Crea un voto normalizado.
//
// Guardamos actorRoleInstanceId y targetRoleInstanceId porque el motor trabaja
// sobre roleInstances, no sobre nombres visuales ni tokens de tablero.
export function createVote({
  actorRoleInstanceId,
  targetRoleInstanceId,
  value = 1,
  roundId = VOTE_ROUND_TYPES.INITIAL,
  metadata = {}
} = {}) {
  return {
    actorRoleInstanceId,
    targetRoleInstanceId,
    value: Number.isFinite(value) ? value : 1,
    roundId,
    metadata: { ...metadata }
  };
}

// Busca una instancia de rol por id.
function findRoleInstance(session, roleInstanceId) {
  return (session?.roleInstances ?? []).find((role) => role.id === roleInstanceId) ?? null;
}

// Devuelve los ids de roleInstances que deben participar si la ronda exige
// voto obligatorio de todos los participantes activos.
export function getInPlayVoteActorIds(session = {}) {
  return (session?.roleInstances ?? [])
    .filter((role) => role?.inPlay === true)
    .map((role) => role.id);
}

// Crea errores de votos obligatorios faltantes.
export function getRequiredVoteErrors({ session, seenActors, requiredVotes }) {
  if (requiredVotes !== VOTE_REQUIRED_POLICIES.ALL_IN_PLAY) return [];

  const missingActorRoleInstanceIds = getInPlayVoteActorIds(session).filter(
    (id) => !seenActors.has(id)
  );
  if (missingActorRoleInstanceIds.length === 0) return [];

  return [
    {
      code: 'vote/missing-required-votes',
      message: 'all inPlay roleInstances must vote',
      missingActorRoleInstanceIds
    }
  ];
}

// Valida votos antes del recuento.
//
// Reglas actuales:
// - el actor debe existir;
// - el actor debe estar inPlay;
// - el target debe existir;
// - el target debe estar inPlay;
// - cada actor solo puede emitir un voto por ronda de votacion;
// - si allowedTargetRoleInstanceIds existe, el target debe estar en esa lista;
// - si requiredVotes=all_in_play, todos los roleInstances inPlay deben votar;
// - si hay restricciones de relacion, actor y target no pueden incumplirlas.
export function validateVotes({
  session,
  votes = [],
  allowedTargetRoleInstanceIds = null,
  requiredVotes = VOTE_REQUIRED_POLICIES.OPTIONAL,
  relationRestrictions = []
} = {}) {
  const errors = [];
  const seenActors = new Set();
  const allowedTargets = Array.isArray(allowedTargetRoleInstanceIds)
    ? new Set(allowedTargetRoleInstanceIds)
    : null;

  (votes ?? []).forEach((rawVote, index) => {
    const vote = createVote(rawVote);
    const actor = findRoleInstance(session, vote.actorRoleInstanceId);
    const target = findRoleInstance(session, vote.targetRoleInstanceId);

    if (!actor) {
      errors.push({
        code: 'vote/missing-actor',
        message: `vote at index ${index} has missing actor "${vote.actorRoleInstanceId}"`,
        index,
        actorRoleInstanceId: vote.actorRoleInstanceId
      });
    } else if (actor.inPlay !== true) {
      errors.push({
        code: 'vote/actor-not-in-play',
        message: `actor "${actor.id}" is not inPlay`,
        index,
        actorRoleInstanceId: actor.id
      });
    }

    if (!target) {
      errors.push({
        code: 'vote/missing-target',
        message: `vote at index ${index} has missing target "${vote.targetRoleInstanceId}"`,
        index,
        targetRoleInstanceId: vote.targetRoleInstanceId
      });
    } else if (target.inPlay !== true) {
      errors.push({
        code: 'vote/target-not-in-play',
        message: `target "${target.id}" is not inPlay`,
        index,
        targetRoleInstanceId: target.id
      });
    }

    if (allowedTargets && !allowedTargets.has(vote.targetRoleInstanceId)) {
      errors.push({
        code: 'vote/target-not-allowed',
        message: `target "${vote.targetRoleInstanceId}" is not allowed in this voting round`,
        index,
        targetRoleInstanceId: vote.targetRoleInstanceId,
        allowedTargetRoleInstanceIds: [...allowedTargets]
      });
    }

    getRelationRestrictionErrors({ session, vote, index, relationRestrictions }).forEach((error) =>
      errors.push(error)
    );

    if (seenActors.has(vote.actorRoleInstanceId)) {
      errors.push({
        code: 'vote/duplicate-actor',
        message: `actor "${vote.actorRoleInstanceId}" voted more than once`,
        index,
        actorRoleInstanceId: vote.actorRoleInstanceId
      });
    }
    seenActors.add(vote.actorRoleInstanceId);
  });

  errors.push(...getRequiredVoteErrors({ session, seenActors, requiredVotes }));

  return {
    ok: errors.length === 0,
    errors
  };
}

// Valida restricciones basadas en relaciones de sesion.
//
// Ejemplo actual:
// - exclude_related_target + linked impide que un actor vote a su linked.
export function getRelationRestrictionErrors({
  session,
  vote,
  index,
  relationRestrictions = []
} = {}) {
  return (relationRestrictions ?? []).flatMap((restriction) => {
    if (restriction?.type !== VOTE_RESTRICTION_TYPES.EXCLUDE_RELATED_TARGET) return [];

    const relationType = normalizeId(restriction.relationType);
    if (!relationType) return [];

    const relatedRoleInstanceIds = getRelatedRoleInstanceIds(
      session,
      vote.actorRoleInstanceId,
      relationType
    );

    if (!relatedRoleInstanceIds.includes(vote.targetRoleInstanceId)) return [];

    return [
      {
        code: 'vote/restricted-related-target',
        message: `actor "${vote.actorRoleInstanceId}" cannot vote related target "${vote.targetRoleInstanceId}"`,
        index,
        actorRoleInstanceId: vote.actorRoleInstanceId,
        targetRoleInstanceId: vote.targetRoleInstanceId,
        relationType
      }
    ];
  });
}

// Agrupa votos por targetRoleInstanceId y suma sus unidades.
export function tallyVotes(votes = []) {
  const totals = new Map();

  (votes ?? []).forEach((rawVote) => {
    const vote = createVote(rawVote);
    const currentTotal = totals.get(vote.targetRoleInstanceId) ?? 0;
    totals.set(vote.targetRoleInstanceId, currentTotal + vote.value);
  });

  return [...totals.entries()]
    .map(([targetRoleInstanceId, voteCount]) => ({
      targetRoleInstanceId,
      voteCount
    }))
    .sort(
      (a, b) =>
        b.voteCount - a.voteCount || a.targetRoleInstanceId.localeCompare(b.targetRoleInstanceId)
    );
}

// Resuelve una ronda de votacion.
//
// Si hay ganador unico, devuelve winner.
// Si hay empate:
// - null_on_tie declara la votacion sin efecto;
// - runoff_on_tie pide una nueva ronda limitada a los empatados;
// - si ya era runoff, declara la votacion sin efecto.
export function resolveVoteRound({
  session,
  votes = [],
  tiePolicy = VOTE_TIE_POLICIES.NULL_ON_TIE,
  roundType = VOTE_ROUND_TYPES.INITIAL,
  allowedTargetRoleInstanceIds = null,
  requiredVotes = VOTE_REQUIRED_POLICIES.OPTIONAL,
  relationRestrictions = []
} = {}) {
  const validation = validateVotes({
    session,
    votes,
    allowedTargetRoleInstanceIds,
    requiredVotes,
    relationRestrictions
  });
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      result: null
    };
  }

  const tally = tallyVotes(votes);
  const highestVoteCount = tally[0]?.voteCount ?? 0;
  const tiedTargets = tally
    .filter((entry) => entry.voteCount === highestVoteCount)
    .map((entry) => entry.targetRoleInstanceId);

  if (tally.length === 0) {
    return {
      ok: true,
      errors: [],
      result: {
        type: VOTE_OUTCOME_TYPES.NULL,
        reason: 'no_votes',
        tally,
        winnerRoleInstanceId: null,
        tiedTargetRoleInstanceIds: []
      }
    };
  }

  if (tiedTargets.length === 1) {
    return {
      ok: true,
      errors: [],
      result: {
        type: VOTE_OUTCOME_TYPES.WINNER,
        reason: 'single_highest_vote_count',
        tally,
        winnerRoleInstanceId: tiedTargets[0],
        tiedTargetRoleInstanceIds: []
      }
    };
  }

  if (tiePolicy === VOTE_TIE_POLICIES.RUNOFF_ON_TIE && roundType !== VOTE_ROUND_TYPES.RUNOFF) {
    return {
      ok: true,
      errors: [],
      result: {
        type: VOTE_OUTCOME_TYPES.TIE,
        reason: 'runoff_required',
        tally,
        winnerRoleInstanceId: null,
        tiedTargetRoleInstanceIds: tiedTargets,
        nextRound: {
          roundType: VOTE_ROUND_TYPES.RUNOFF,
          allowedTargetRoleInstanceIds: tiedTargets
        }
      }
    };
  }

  return {
    ok: true,
    errors: [],
    result: {
      type: VOTE_OUTCOME_TYPES.NULL,
      reason: roundType === VOTE_ROUND_TYPES.RUNOFF ? 'runoff_tied' : 'tied_vote',
      tally,
      winnerRoleInstanceId: null,
      tiedTargetRoleInstanceIds: tiedTargets
    }
  };
}
