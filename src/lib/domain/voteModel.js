// voteModel.js
// -----------------------------------------------------------------------------
// Este archivo modela una votacion como recuento mecanico.
//
// Votar no significa automaticamente eliminar, expulsar o nombrar a alguien.
// Votar significa:
// - un actor inPlay elige un target inPlay;
// - cada voto vale una unidad;
// - los votos se agrupan por targetId;
// - el target con mas votos es el chosen provisional;
// - voteRules decide si ese chosen se acepta, se anula o pide otra ronda.
//
// El efecto de ganar la votacion vive fuera de este archivo. Puede ser
// set_property inPlay=false, dar una accion extra, crear una marca, etc.
// -----------------------------------------------------------------------------

import { getRelatedRoleIds, normalizeId } from './sessionModel.js';

export const VOTE_OUTCOME_TYPES = Object.freeze({
  CHOSEN: 'chosen',
  TIE: 'tie',
  NULL: 'null'
});

export const VOTE_TIE_RULES = Object.freeze({
  NULL_ON_TIE: 'null_on_tie',
  RUNOFF_ON_TIE: 'runoff_on_tie'
});

export const VOTE_RUNOFF_RULES = Object.freeze({
  TIED_CANDIDATES: 'tied_candidates',
  VOTED_CANDIDATES: 'voted_candidates',
  SAME_CANDIDATES: 'same_candidates'
});

export const VOTE_NULL_RULES = Object.freeze({
  END_AS_NULL: 'end_as_null',
  REPEAT_ON_NULL: 'repeat_on_null'
});

export const VOTE_SUPPORT_THRESHOLD_TYPES = Object.freeze({
  NONE: 'none',
  MAJORITY: 'majority',
  FRACTION: 'fraction'
});

export const VOTE_SUPPORT_BASES = Object.freeze({
  CAST_VOTES: 'cast_votes',
  ACTOR_COUNT: 'actor_count'
});

export const VOTE_ROUND_TYPES = Object.freeze({
  INITIAL: 'initial',
  RUNOFF: 'runoff'
});

export const VOTE_REQUIRED_RULES = Object.freeze({
  OPTIONAL: 'optional',
  ALL_ACTORS: 'all_actors'
});

export const VOTE_ABSTAIN_RULES = Object.freeze({
  NOT_ALLOWED: 'not_allowed',
  ALLOWED: 'allowed'
});

export const VOTE_ABSTAIN_RESOLUTION_TYPES = Object.freeze({
  IGNORE: 'ignore',
  NULL_IF_HIGHEST: 'null_if_highest'
});

export const VOTE_UNANIMOUS_RULES = Object.freeze({
  NOT_REQUIRED: 'not_required',
  REQUIRED: 'required'
});

export const VOTE_RESTRICTION_TYPES = Object.freeze({
  EXCLUDE_RELATED_TARGET: 'exclude_related_target'
});

export function createVoteRules({
  required = VOTE_REQUIRED_RULES.OPTIONAL,
  abstain = VOTE_ABSTAIN_RULES.NOT_ALLOWED,
  unanimous = VOTE_UNANIMOUS_RULES.NOT_REQUIRED,
  tie = VOTE_TIE_RULES.NULL_ON_TIE,
  runoff = VOTE_RUNOFF_RULES.TIED_CANDIDATES,
  nullResult = VOTE_NULL_RULES.END_AS_NULL,
  repeatLimit = 1,
  supportThreshold = {},
  abstainResolution = {},
  relationRestrictions = [],
  candidateIds = null
} = {}) {
  return {
    required,
    abstain,
    unanimous,
    tie,
    runoff,
    nullResult,
    repeatLimit: Number.isInteger(repeatLimit) && repeatLimit >= 0 ? repeatLimit : 1,
    supportThreshold: createSupportThreshold(supportThreshold),
    abstainResolution: createAbstainResolution(abstainResolution),
    relationRestrictions: (relationRestrictions ?? []).map((restriction) => ({ ...restriction })),
    candidateIds: Array.isArray(candidateIds) ? [...candidateIds] : null
  };
}

export function createSupportThreshold({
  type = VOTE_SUPPORT_THRESHOLD_TYPES.NONE,
  base = VOTE_SUPPORT_BASES.CAST_VOTES,
  numerator = 1,
  denominator = 2
} = {}) {
  const normalizedType = Object.values(VOTE_SUPPORT_THRESHOLD_TYPES).includes(type)
    ? type
    : VOTE_SUPPORT_THRESHOLD_TYPES.NONE;
  const normalizedBase = Object.values(VOTE_SUPPORT_BASES).includes(base)
    ? base
    : VOTE_SUPPORT_BASES.CAST_VOTES;

  return {
    type: normalizedType,
    base: normalizedBase,
    numerator: Number.isInteger(numerator) && numerator > 0 ? numerator : 1,
    denominator: Number.isInteger(denominator) && denominator > 0 ? denominator : 2
  };
}

export function createAbstainResolution({
  type = VOTE_ABSTAIN_RESOLUTION_TYPES.IGNORE
} = {}) {
  return {
    type: Object.values(VOTE_ABSTAIN_RESOLUTION_TYPES).includes(type)
      ? type
      : VOTE_ABSTAIN_RESOLUTION_TYPES.IGNORE
  };
}

// Crea un voto normalizado.
//
// Guardamos actorId y targetId porque el motor trabaja
// sobre roles, no sobre nombres visuales ni tokens de tablero.
export function createVote({
  actorId,
  targetId = null,
  abstain = false,
  value = 1,
  roundId = VOTE_ROUND_TYPES.INITIAL,
  metadata = {}
} = {}) {
  const isAbstention = abstain === true;

  return {
    actorId,
    targetId: isAbstention ? null : targetId,
    abstain: isAbstention,
    value: Number.isFinite(value) ? value : 1,
    roundId,
    metadata: { ...metadata }
  };
}

// Busca un rol de sesion por id.
function findRole(session, roleId) {
  return (session?.roles ?? []).find((role) => role.id === roleId) ?? null;
}

// Devuelve los ids de roles que deben participar si la ronda exige
// voto obligatorio de todos los participantes activos.
export function getInPlayVoteActorIds(session = {}) {
  return (session?.roles ?? [])
    .filter((role) => role?.inPlay === true)
    .map((role) => role.id);
}

// Devuelve los candidatos por defecto de una votacion.
//
// candidateIds no significa "objetivos narrativos"; significa roles que pueden
// recibir votos en esta ronda. Si una regla no acota candidatos, todos los roles
// inPlay son candidatos.
export function getDefaultVoteCandidateIds(session = {}) {
  return getInPlayVoteActorIds(session);
}

export function getRequiredActorIds(session = {}, actorIds = []) {
  return Array.isArray(actorIds) && actorIds.length > 0
    ? [...actorIds]
    : getInPlayVoteActorIds(session);
}

// Crea errores de votos obligatorios faltantes.
export function getRequiredVoteErrors({ session, actorIds = [], seenActors, voteRules = {} }) {
  if (voteRules.required !== VOTE_REQUIRED_RULES.ALL_ACTORS) return [];

  const missingActorIds = getRequiredActorIds(session, actorIds).filter((id) => !seenActors.has(id));
  if (missingActorIds.length === 0) return [];

  return [
    {
      code: 'vote/missing-required-votes',
      message: 'all inPlay roles must vote',
      missingActorIds
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
// - todo target debe estar dentro de los candidatos de la ronda;
// - si voteRules.required=all_actors, todos los actorIds del step deben decidir;
// - abstenerse solo es valido si voteRules.abstain lo permite;
// - si hay restricciones de relacion, actor y target no pueden incumplirlas.
export function validateVotes({
  session,
  actorIds = [],
  votes = [],
  voteRules = createVoteRules()
} = {}) {
  const rules = createVoteRules(voteRules);
  const errors = [];
  const seenActors = new Set();
  const allowedActors = Array.isArray(actorIds) && actorIds.length > 0 ? new Set(actorIds) : null;
  const candidateIds = Array.isArray(rules.candidateIds)
    ? rules.candidateIds
    : getDefaultVoteCandidateIds(session);
  const candidates = new Set(candidateIds);

  (votes ?? []).forEach((rawVote, index) => {
    const vote = createVote(rawVote);
    const actor = findRole(session, vote.actorId);
    const target = vote.abstain ? null : findRole(session, vote.targetId);

    if (!actor) {
      errors.push({
        code: 'vote/missing-actor',
        message: `vote at index ${index} has missing actor "${vote.actorId}"`,
        index,
        actorId: vote.actorId
      });
    } else if (actor.inPlay !== true) {
      errors.push({
        code: 'vote/actor-not-in-play',
        message: `actor "${actor.id}" is not inPlay`,
        index,
        actorId: actor.id
      });
    }

    if (allowedActors && !allowedActors.has(vote.actorId)) {
      errors.push({
        code: 'vote/actor-not-allowed',
        message: `actor "${vote.actorId}" is not allowed in this voting round`,
        index,
        actorId: vote.actorId,
        allowedActorIds: [...allowedActors]
      });
    }

    if (vote.abstain && rules.abstain !== VOTE_ABSTAIN_RULES.ALLOWED) {
      errors.push({
        code: 'vote/abstain-not-allowed',
        message: `actor "${vote.actorId}" cannot abstain in this voting round`,
        index,
        actorId: vote.actorId
      });
    }

    if (!vote.abstain && !target) {
      errors.push({
        code: 'vote/missing-target',
        message: `vote at index ${index} has missing target "${vote.targetId}"`,
        index,
        targetId: vote.targetId
      });
    } else if (!vote.abstain && target.inPlay !== true) {
      errors.push({
        code: 'vote/target-not-in-play',
        message: `target "${target.id}" is not inPlay`,
        index,
        targetId: target.id
      });
    }

    if (!vote.abstain && !candidates.has(vote.targetId)) {
      errors.push({
        code: 'vote/target-not-candidate',
        message: `target "${vote.targetId}" is not a candidate in this voting round`,
        index,
        targetId: vote.targetId,
        candidateIds: [...candidates]
      });
    }

    if (!vote.abstain) {
      getRelationRestrictionErrors({
        session,
        vote,
        index,
        relationRestrictions: rules.relationRestrictions
      }).forEach((error) =>
        errors.push(error)
      );
    }

    if (seenActors.has(vote.actorId)) {
      errors.push({
        code: 'vote/duplicate-actor',
        message: `actor "${vote.actorId}" voted more than once`,
        index,
        actorId: vote.actorId
      });
    }
    seenActors.add(vote.actorId);
  });

  errors.push(...getRequiredVoteErrors({ session, actorIds, seenActors, voteRules: rules }));

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

    const relatedRoleIds = getRelatedRoleIds(
      session,
      vote.actorId,
      relationType
    );

    if (!relatedRoleIds.includes(vote.targetId)) return [];

    return [
      {
        code: 'vote/restricted-related-target',
        message: `actor "${vote.actorId}" cannot vote related target "${vote.targetId}"`,
        index,
        actorId: vote.actorId,
        targetId: vote.targetId,
        relationType
      }
    ];
  });
}

// Agrupa votos no abstenidos por targetId y suma sus unidades.
export function tallyVotes(votes = []) {
  const totals = new Map();

  (votes ?? []).forEach((rawVote) => {
    const vote = createVote(rawVote);
    if (vote.abstain) return;

    const currentTotal = totals.get(vote.targetId) ?? 0;
    totals.set(vote.targetId, currentTotal + vote.value);
  });

  return [...totals.entries()]
    .map(([targetId, voteCount]) => ({
      targetId,
      voteCount
    }))
    .sort(
      (a, b) =>
        b.voteCount - a.voteCount || a.targetId.localeCompare(b.targetId)
    );
}

function getCurrentCandidateIds(session, rules) {
  return Array.isArray(rules.candidateIds)
    ? [...rules.candidateIds]
    : getDefaultVoteCandidateIds(session);
}

function getVotedCandidateIds(tally = []) {
  return tally.map((entry) => entry.targetId);
}

function getRunoffCandidateIds({ session, rules, tally, tiedTargets }) {
  if (rules.runoff === VOTE_RUNOFF_RULES.VOTED_CANDIDATES) {
    return getVotedCandidateIds(tally);
  }
  if (rules.runoff === VOTE_RUNOFF_RULES.SAME_CANDIDATES) {
    return getCurrentCandidateIds(session, rules);
  }
  return [...tiedTargets];
}

function canRequestAnotherRound({ roundIndex = 0, rules }) {
  return roundIndex < rules.repeatLimit;
}

function createNextRound({ roundType, roundIndex, candidateIds }) {
  return {
    roundType,
    roundIndex: roundIndex + 1,
    candidateIds: [...candidateIds]
  };
}

function createNullVoteResult({
  reason,
  tally,
  abstentions,
  tiedTargetIds = [],
  nextRound = null,
  metadata = {}
}) {
  return {
    type: VOTE_OUTCOME_TYPES.NULL,
    reason,
    tally,
    abstentions,
    chosenId: null,
    tiedTargetIds,
    ...metadata,
    ...(nextRound ? { nextRound } : {})
  };
}

function createChosenVoteResult({ reason, tally, abstentions, chosenId }) {
  return {
    type: VOTE_OUTCOME_TYPES.CHOSEN,
    reason,
    tally,
    abstentions,
    chosenId,
    tiedTargetIds: []
  };
}

function createTieVoteResult({ tally, abstentions, tiedTargetIds, nextRound }) {
  return {
    type: VOTE_OUTCOME_TYPES.TIE,
    reason: 'runoff_required',
    tally,
    abstentions,
    chosenId: null,
    tiedTargetIds,
    nextRound
  };
}

function createVoteResolution(result) {
  return {
    ok: true,
    errors: [],
    result
  };
}

function getRepeatOnNullNextRound({ session, rules, roundType, roundIndex }) {
  if (
    rules.nullResult !== VOTE_NULL_RULES.REPEAT_ON_NULL ||
    !canRequestAnotherRound({ roundIndex, rules })
  ) {
    return null;
  }

  return createNextRound({
    roundType,
    roundIndex,
    candidateIds: getCurrentCandidateIds(session, rules)
  });
}

function getSupportBaseCount({ session, actorIds = [], votes = [], supportThreshold }) {
  if (supportThreshold.base === VOTE_SUPPORT_BASES.ACTOR_COUNT) {
    return getRequiredActorIds(session, actorIds).length;
  }
  return (votes ?? []).map(createVote).filter((vote) => !vote.abstain).length;
}

function getRequiredSupportCount({ baseCount, supportThreshold }) {
  if (supportThreshold.type === VOTE_SUPPORT_THRESHOLD_TYPES.MAJORITY) {
    return Math.floor(baseCount / 2) + 1;
  }
  if (supportThreshold.type === VOTE_SUPPORT_THRESHOLD_TYPES.FRACTION) {
    return Math.ceil((baseCount * supportThreshold.numerator) / supportThreshold.denominator);
  }
  return 0;
}

function evaluateSupportThreshold({
  session,
  actorIds = [],
  votes = [],
  voteCount = 0,
  supportThreshold
}) {
  if (supportThreshold.type === VOTE_SUPPORT_THRESHOLD_TYPES.NONE) {
    return {
      ok: true,
      requiredSupportCount: 0,
      supportBaseCount: 0
    };
  }

  const supportBaseCount = getSupportBaseCount({ session, actorIds, votes, supportThreshold });
  const requiredSupportCount = getRequiredSupportCount({ baseCount: supportBaseCount, supportThreshold });

  return {
    ok: voteCount >= requiredSupportCount,
    requiredSupportCount,
    supportBaseCount
  };
}

function getAbstainVoteCount(abstentions = []) {
  return (abstentions ?? []).reduce((total, vote) => total + vote.value, 0);
}

function shouldNullifyByAbstention({ abstentions = [], highestVoteCount = 0, rules }) {
  if (rules.abstainResolution.type !== VOTE_ABSTAIN_RESOLUTION_TYPES.NULL_IF_HIGHEST) {
    return false;
  }
  return getAbstainVoteCount(abstentions) > highestVoteCount;
}

function evaluateUnanimousVote({ session, actorIds = [], tally = [], abstentions = [] }) {
  const requiredActorCount = getRequiredActorIds(session, actorIds).length;
  const hasUnanimousTarget =
    tally.length === 1 &&
    abstentions.length === 0 &&
    tally[0].voteCount === requiredActorCount;

  return {
    hasUnanimousTarget,
    chosenId: hasUnanimousTarget ? tally[0].targetId : null
  };
}

// Resuelve una ronda de votacion.
//
// Prioridad de reglas:
// 1. Validar participantes, candidatos y restricciones de relacion.
// 2. Resolver votacion vacia o totalmente abstenida como null.
// 3. Aplicar unanimidad si el step la exige.
// 4. Aplicar abstainResolution si la abstencion domina.
// 5. Aceptar chosen provisional solo si supera supportThreshold.
// 6. Resolver empate con tie/runoff/repeatLimit.
export function resolveVoteRound({
  session,
  actorIds = [],
  votes = [],
  voteRules = createVoteRules(),
  roundType = VOTE_ROUND_TYPES.INITIAL,
  roundIndex = null
} = {}) {
  const rules = createVoteRules(voteRules);
  const currentRoundIndex =
    Number.isInteger(roundIndex)
      ? roundIndex
      : roundType === VOTE_ROUND_TYPES.RUNOFF
        ? 1
        : 0;
  const validation = validateVotes({
    session,
    actorIds,
    votes,
    voteRules: rules
  });
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      result: null
    };
  }

  const decisions = (votes ?? []).map(createVote);
  const abstentions = decisions.filter((vote) => vote.abstain);
  const tally = tallyVotes(votes);
  const highestVoteCount = tally[0]?.voteCount ?? 0;
  const tiedTargets = tally
    .filter((entry) => entry.voteCount === highestVoteCount)
    .map((entry) => entry.targetId);

  if (tally.length === 0) {
    const reason =
      decisions.length > 0 && decisions.length === abstentions.length ? 'all_abstained' : 'no_votes';
    return createVoteResolution(
      createNullVoteResult({
        reason,
        tally,
        abstentions,
        nextRound: getRepeatOnNullNextRound({
          session,
          rules,
          roundType,
          roundIndex: currentRoundIndex
        })
      })
    );
  }

  if (rules.unanimous === VOTE_UNANIMOUS_RULES.REQUIRED) {
    const unanimous = evaluateUnanimousVote({ session, actorIds, tally, abstentions });

    return createVoteResolution(
      unanimous.hasUnanimousTarget
        ? createChosenVoteResult({
            reason: 'unanimous_target',
            tally,
            abstentions,
            chosenId: unanimous.chosenId
          })
        : createNullVoteResult({
            reason: 'not_unanimous',
            tally,
            abstentions,
            nextRound: getRepeatOnNullNextRound({
              session,
              rules,
              roundType,
              roundIndex: currentRoundIndex
            })
          })
    );
  }

  if (shouldNullifyByAbstention({ abstentions, highestVoteCount, rules })) {
    return createVoteResolution(
      createNullVoteResult({
        reason: 'abstention_highest',
        tally,
        abstentions,
        tiedTargetIds: tiedTargets.length > 1 ? tiedTargets : [],
        nextRound: getRepeatOnNullNextRound({
          session,
          rules,
          roundType,
          roundIndex: currentRoundIndex
        }),
        metadata: {
          abstainVoteCount: getAbstainVoteCount(abstentions)
        }
      })
    );
  }

  if (tiedTargets.length === 1) {
    const chosenEntry = tally.find((entry) => entry.targetId === tiedTargets[0]);
    const support = evaluateSupportThreshold({
      session,
      actorIds,
      votes,
      voteCount: chosenEntry?.voteCount ?? 0,
      supportThreshold: rules.supportThreshold
    });

    if (!support.ok) {
      return createVoteResolution(
        createNullVoteResult({
          reason: 'insufficient_support',
          tally,
          abstentions,
          nextRound: getRepeatOnNullNextRound({
            session,
            rules,
            roundType,
            roundIndex: currentRoundIndex
          }),
          metadata: {
            support
          }
        })
      );
    }

    return createVoteResolution(
      createChosenVoteResult({
        reason: 'single_highest_vote_count',
        tally,
        abstentions,
        chosenId: tiedTargets[0]
      })
    );
  }

  if (
    rules.tie === VOTE_TIE_RULES.RUNOFF_ON_TIE &&
    canRequestAnotherRound({ roundIndex: currentRoundIndex, rules })
  ) {
    return createVoteResolution(
      createTieVoteResult({
        tally,
        abstentions,
        tiedTargetIds: tiedTargets,
        nextRound: createNextRound({
          roundType: VOTE_ROUND_TYPES.RUNOFF,
          roundIndex: currentRoundIndex,
          candidateIds: getRunoffCandidateIds({ session, rules, tally, tiedTargets })
        })
      })
    );
  }

  return createVoteResolution(
    createNullVoteResult({
      reason: roundType === VOTE_ROUND_TYPES.RUNOFF ? 'runoff_tied' : 'tied_vote',
      tally,
      abstentions,
      tiedTargetIds: tiedTargets
    })
  );
}
